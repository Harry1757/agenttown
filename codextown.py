#!/usr/bin/env python3
"""CodexTown: read-only Codex session viewer, using ClaudeTown's map renderer."""
import hashlib
import json
import math
import os
from pathlib import Path
import queue
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

import claudetown as town

CODEX_HOME = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))).expanduser()
PORT = int(os.environ.get('CODEXTOWN_PORT', '8766'))


def tool_details(payload):
    """Classify recorded tool input locally; never publish command/code bodies."""
    name = str(payload.get('name', 'tool')).split('.')[-1]
    raw = payload.get('arguments', payload.get('input', ''))
    if isinstance(raw, dict):
        args = raw
    else:
        try:
            args = json.loads(raw)
        except (ValueError, TypeError):
            args = {}
    if not isinstance(args, dict):
        args = {}
    if name == 'exec' and isinstance(raw, str):
        nested = re.search(r'tools\.([\w]+)\s*\(', raw)
        if nested:
            name = nested.group(1)
        # This is a display hint, never eval/execute JavaScript from a transcript.
        command = re.search(r'\bcmd\s*:\s*("(?:[^"\\]|\\.)*")', raw)
        if command:
            try:
                args['cmd'] = json.loads(command.group(1))
            except ValueError:
                pass
    role = 'explore'
    if name in ('exec_command', 'shell_command', 'shell', 'write_stdin'):
        cmd = args.get('cmd', args.get('command', ''))
        if isinstance(cmd, list):
            cmd = ' '.join(str(x) for x in cmd)
        role = town.role_for('Bash', {'command': cmd})
    elif name == 'apply_patch':
        match = re.search(r'\*\*\* (?:Update|Add|Delete) File: ([^\n]+)', str(raw))
        role = town.role_for('Write', {'file_path': match.group(1) if match else ''})
    elif name in ('spawn_agent', 'send_message', 'followup_task', 'wait_agent'):
        role = 'meeting'
    elif 'request_user_input' in name:
        return 'AskUserQuestion', 'waiting', '사용자 응답 대기'
    elif any(x in name for x in ('imagegen', 'image_gen', 'figma')):
        role = 'design'
    elif any(x in name for x in ('web', 'search', 'fetch', 'browse')):
        role = 'research'
    elif any(x in name for x in ('plan', 'goal')):
        role = 'plan'
    elif name.startswith('mcp__'):
        role = town.role_for(name, args)
    return name[:100], role, name[:40]


class Tailer(town.Tailer):
    def __init__(self, roots, codex_home=CODEX_HOME):
        super().__init__(roots)
        self.codex_home = Path(codex_home)
        self._meta = {}
        self._totals = {}
        self._daily = {}
        self._requests = {}
        self._last_tools = {}
        self._identity = {}
        self._index_at = 0
        self._index = {}
        self.latest_limits = None

    def _files(self):
        for root in self.roots:
            if root.is_dir():
                yield from root.rglob('*.jsonl')

    def _refresh_index(self):
        if time.monotonic() - self._index_at < 5:
            return
        self._index_at = time.monotonic()
        index = {}
        try:
            for line in (self.codex_home / 'session_index.jsonl').read_text().splitlines():
                try:
                    row = json.loads(line)
                    index[row['id']] = {'title': row.get('thread_name', '')}
                except (ValueError, KeyError, TypeError):
                    continue
        except OSError:
            pass
        databases = sorted(self.codex_home.glob('state_*.sqlite'), reverse=True)
        for db in databases:
            try:
                with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=.2) as conn:
                    columns = {r[1] for r in conn.execute('PRAGMA table_info(threads)')}
                    name_column = 'name' if 'name' in columns else 'NULL'
                    for sid, name, archived in conn.execute(f'SELECT id, {name_column}, archived FROM threads'):
                        index[sid] = {'title': name or index.get(sid, {}).get('title', ''), 'archived': bool(archived)}
                break
            except sqlite3.Error:
                continue
        self._index = index

    def _absorb(self, path, row, proj):
        p = row.get('payload')
        if not isinstance(p, dict):
            return []
        kind = row.get('type')
        if kind == 'session_meta':
            sid = p.get('id')
            if not isinstance(sid, str):
                return []
            source = p.get('source', '')
            sub = isinstance(source, dict) and 'subagent' in source
            self._meta[path] = {'sid': sid, 'entry': 'codex-desktop' if 'Desktop' in str(p.get('originator')) else 'codex-cli', 'sub': sub}
            self._seen[path] = self._meta[path]
            self._cwd[path] = str(p.get('cwd', ''))
            self._last_role[path] = 'plan'
        if path not in self._meta:
            return []
        if kind == 'response_item' and p.get('type') == 'message' and p.get('role') == 'user':
            self._requests.pop(path, None)
            self._turn_ended[path] = False
        if kind == 'turn_context':
            self._meta[path]['model'] = str(p.get('model', ''))
        if kind == 'event_msg':
            typ = p.get('type')
            if typ in ('task_started', 'turn_started', 'user_message'):
                self._requests.pop(path, None)
                self._turn_ended[path] = False
            elif typ in ('task_complete', 'task_completed', 'turn_complete', 'turn_aborted'):
                self._turn_ended[path] = True
            if typ == 'token_count':
                info = p.get('info') or {}
                total = (info.get('total_token_usage') or {}).get('total_tokens')
                if isinstance(total, int) and not isinstance(total, bool) and total >= 0:
                    previous = self._totals.get(path, 0)
                    # A decreasing counter can follow context compaction. Start a new segment.
                    delta = total - previous if total >= previous else total
                    self._totals[path] = total
                    self._tokens[path] = self._tokens.get(path, 0) + delta
                    day = town.kst_day(row.get('timestamp'))
                    daily = self._daily.setdefault(path, {})
                    daily[day] = daily.get(day, 0) + delta
                limits = p.get('rate_limits')
                if isinstance(limits, dict):
                    at = row.get('timestamp', '')
                    if not self.latest_limits or at > self.latest_limits['at']:
                        self.latest_limits = {'at': at, 'limits': limits}
        if kind != 'response_item' or p.get('type') not in ('function_call', 'custom_tool_call'):
            return []
        name, role, label = tool_details(p)
        self._last_role[path] = role
        self._last_tools[path] = name
        if name == 'AskUserQuestion':
            self._requests[path] = row.get('timestamp', '')
            self._turn_ended[path] = True
        else:
            self._turn_ended[path] = False
        meta = self._meta[path]
        writes = []
        if name == 'apply_patch':
            raw = str(p.get('input', p.get('arguments', '')))
            nested_patch = re.search(r'apply_patch\s*\(\s*("(?:[^"\\]|\\.)*")', raw)
            if nested_patch:
                try:
                    raw = json.loads(nested_patch.group(1))
                except ValueError:
                    pass
            for filename in re.findall(r'\*\*\* (?:Update|Add|Delete) File: ([^\n]+)', raw):
                full = os.path.normpath(os.path.join(self._cwd.get(path, ''), filename.strip()))
                writes.append(hashlib.sha256(full.encode()).hexdigest())
        return [{'t': 'tool', 'proj': self._project(path), 'sid': meta['sid'], 'entry': meta['entry'],
                 'name': name, 'role': role, 'label': label, 'writes': writes, 'skill': '', 'sub': meta['sub'], 'ts': row.get('timestamp', '')}]

    def _project(self, path):
        cwd = self._cwd.get(path, '')
        return hashlib.sha256(cwd.encode()).hexdigest()[:12] if cwd else 'codex'

    def seed(self):
        self.scan()  # Discard historic events, but keep exact complete-line offsets.

    def scan(self):
        events = []
        now = time.time()
        for path in self._files():
            try:
                st = path.stat()
                if now - st.st_mtime > town.HIDE_AFTER:
                    continue
                identity = (st.st_dev, st.st_ino)
                start = self._offset.get(path, 0)
                if st.st_size < start or self._identity.get(path, identity) != identity:
                    start = 0
                    for mapping in (self._seen, self._meta, self._totals, self._tokens, self._daily, self._turn_ended, self._last_role, self._cwd, self._requests, self._last_tools):
                        mapping.pop(path, None)
                self._identity[path] = identity
                with path.open('rb') as f:
                    f.seek(start)
                    chunk = f.read()
                cut = chunk.rfind(b'\n')
                if cut < 0:
                    continue
                self._offset[path] = start + cut + 1
                for line in chunk[:cut].split(b'\n'):
                    try:
                        row = json.loads(line)
                        if isinstance(row, dict):
                            events.extend(self._absorb(path, row, ''))
                    except (ValueError, TypeError, AttributeError):
                        continue
            except OSError:
                continue
        return events

    def sessions(self):
        self._refresh_index()
        result = {}
        now = time.time()
        for path, meta in self._meta.items():
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            record = self._index.get(meta['sid'], {})
            if now - mtime > town.HIDE_AFTER or record.get('archived'):
                continue
            state = 'waiting' if path in self._requests else 'done' if now - mtime > town.DONE_AFTER else 'waiting' if self._turn_ended.get(path) else 'working'
            cwd = self._cwd.get(path, '')
            result.setdefault(self._project(path), []).append({
                **meta, 'cwd': cwd, 'title': str(record.get('title') or Path(cwd).name or 'Codex 작업')[:180],
                'active': state == 'working', 'state': state, 'mtime': mtime,
                'needsInput': path in self._requests, 'requestAt': self._requests.get(path), 'lastTool': self._last_tools.get(path, ''),
                'role': self._last_role.get(path, 'plan'), 'tokens': self._tokens.get(path, 0),
                'tokensToday': self._daily.get(path, {}).get(town.kst_day(), 0),
            })
        for rows in result.values():
            rows.sort(key=lambda r: r['mtime'], reverse=True)
        return result


def usage_windows(response):
    buckets = response.get('rateLimitsByLimitId') or {'codex': response.get('rateLimits')}
    windows = []
    for key, bucket in sorted(buckets.items(), key=lambda item: (item[0] != 'codex', item[0])):
        if not isinstance(bucket, dict):
            continue
        for slot in ('primary', 'secondary'):
            value = bucket.get(slot)
            if not isinstance(value, dict):
                continue
            used = value.get('usedPercent', value.get('used_percent'))
            if not isinstance(used, (int, float)) or isinstance(used, bool) or not math.isfinite(used):
                continue
            minutes = value.get('windowDurationMins', value.get('window_minutes'))
            duration = f'{minutes // 1440}일' if minutes and minutes % 1440 == 0 else f'{minutes // 60}시간' if minutes and minutes % 60 == 0 else f'{minutes}분' if minutes else '한도'
            label = 'Codex' if key == 'codex' else str(bucket.get('limitName') or key).replace('GPT-5.3-Codex-', '')
            reset = value.get('resetsAt', value.get('resets_at'))
            windows.append({'key': f'{key}:{slot}', 'label': f'{label} {duration}', 'used': max(0, min(100, used)), 'resetsAt': reset * 1000 if isinstance(reset, (int, float)) else None})
    return windows


def codex_binary():
    candidates = [os.environ.get('CODEXTOWN_CODEX'), shutil.which('codex'),
                  '/Applications/Codex.app/Contents/Resources/codex',
                  '/Applications/ChatGPT.app/Contents/Resources/codex',
                  str(Path.home() / '.local/bin/codex')]
    return next((p for p in candidates if p and Path(p).is_file()), None)


def read_account_limits(binary=None, timeout=20):
    binary = binary or codex_binary()
    if not binary:
        raise RuntimeError('Codex 실행 파일을 찾지 못함')
    proc = subprocess.Popen([binary, 'app-server', '--stdio'], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, text=True)
    messages = queue.Queue()
    def read():
        for line in proc.stdout:
            try:
                messages.put(json.loads(line))
            except ValueError:
                pass
        messages.put({'error': {'message': 'Codex 연결 종료'}})
    threading.Thread(target=read, daemon=True).start()
    def send(message):
        proc.stdin.write(json.dumps(message) + '\n')
        proc.stdin.flush()
    def receive(wanted):
        deadline = time.monotonic() + timeout
        while True:
            message = messages.get(timeout=max(.01, deadline - time.monotonic()))
            if message.get('id') == wanted or 'error' in message:
                if 'error' in message:
                    raise RuntimeError('Codex 사용량 조회 실패 — 로그인 상태 확인')
                return message['result']
            if time.monotonic() >= deadline:
                raise TimeoutError()
    try:
        send({'id': 0, 'method': 'initialize', 'params': {'clientInfo': {'name': 'codextown', 'version': '1.0.0'}}})
        receive(0)
        send({'method': 'initialized'})
        send({'id': 1, 'method': 'account/rateLimits/read'})
        return receive(1)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill(); proc.wait()
        proc.stdin.close(); proc.stdout.close()


class Usage:
    def __init__(self, tailer):
        self.tailer = tailer
        self.value = None
        self.error = '사용량 조회 중'

    def refresh(self):
        try:
            windows = usage_windows(read_account_limits())
            if not windows:
                raise RuntimeError('이 계정에서 제공되는 사용량 한도 없음')
            self.value = {'windows': windows, 'at': datetime.now(timezone.utc).isoformat(), 'source': 'live'}
            self.error = None
        except Exception:
            self.error = '조회 실패 — Codex 로그인 또는 연결 확인'

    def snapshot(self):
        value = self.value
        if value is None and self.tailer.latest_limits:
            cached = self.tailer.latest_limits
            windows = usage_windows({'rateLimits': cached['limits']})
            if windows:
                value = {'windows': windows, 'at': cached['at'], 'source': 'session'}
        return {**(value or {'windows': [], 'at': None}), 'error': self.error, 'stale': bool(self.error)}

    def loop(self):
        while True:
            self.refresh()
            time.sleep(300)


def main():
    roots = [Path(p).expanduser() for p in os.environ.get('CODEXTOWN_ROOTS', str(CODEX_HOME / 'sessions')).split(os.pathsep) if p]
    tailer = Tailer(roots)
    tailer.seed()
    usage = Usage(tailer)
    class Handler(town.Handler):
        def do_GET(self):
            # Reject DNS rebinding; no CORS, no transcript file endpoint.
            host = self.headers.get('Host', '').split(':')[0]
            if host not in ('127.0.0.1', 'localhost'):
                self.send_error(403); return
            route = self.path.split('?')[0]
            if route in ('/town-ui.js', '/town-ui.css'):
                target = town.HERE / route[1:]
                ctype = 'text/javascript' if route.endswith('.js') else 'text/css'
                return self._send(target.read_bytes(), ctype + '; charset=utf-8')
            if route == '/favicon.ico':
                return self._send((town.ASSETS / 'town.png').read_bytes(), 'image/png')
            if route == '/health':
                return self._send(b'{"app":"codextown"}', 'application/json')
            if route == '/api/usage':
                return self._send(json.dumps(usage.snapshot()).encode(), 'application/json')
            return super().do_GET()
    server = town.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    server.daemon_threads = True
    threading.Thread(target=town.poll_loop, args=(tailer,), daemon=True).start()
    threading.Thread(target=usage.loop, daemon=True).start()
    url = f'http://127.0.0.1:{PORT}/'
    print(f'CodexTown → {url}', flush=True)
    if '--no-browser' not in sys.argv:
        town.open_browser(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
