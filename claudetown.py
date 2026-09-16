#!/usr/bin/env python3
"""AgentTown — Claude Code 세션을 도트 맵으로 보는 로컬 뷰어."""
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LABEL_MAX = 40
_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")   # 'VAR=값' 접두사

# --- 업무 구역 분류 ----------------------------------------------------------
# role_reference.py (9,206건 실측 검증) 를 그대로 포팅한다. 순서가 중요하다:
# 파일 확장자 -> Bash 동사 -> Bash 파일 인자 -> skill -> 툴 이름.

# 이 세그먼트는 명령이 아니다 — 다음 세그먼트를 본다
_NOT_CMD = {"cd", "export", "set", "source", ".", "unset", "alias"}
# 래퍼 — 진짜 명령은 같은 세그먼트의 다음 토큰이다
_WRAP = {"sudo", "timeout", "env", "nohup", "exec", "command", "xargs", "stdbuf"}
# label_for 에서 'VAR=값' 앞에 붙는 래퍼 단어들 — export/set 은 _NOT_CMD 에도 있지만
# 거긴 "이 세그먼트는 명령이 아니다"용이라 의미가 다르다. 여기선 화면에 안 보일 단어들.
_ASSIGN_SKIP_WORDS = _WRAP | {"export", "set"}

_ROLE_EXT = {
    "tsx": "frontend", "jsx": "frontend", "ts": "frontend", "js": "frontend",
    "mjs": "frontend", "cjs": "frontend", "vue": "frontend", "svelte": "frontend",
    "html": "frontend", "css": "frontend", "scss": "frontend", "sass": "frontend",
    "py": "backend", "go": "backend", "rs": "backend", "java": "backend",
    "rb": "backend", "sql": "backend", "php": "backend", "kt": "backend",
    "png": "design", "jpg": "design", "jpeg": "design", "svg": "design",
    "gif": "design", "webp": "design", "ico": "design", "fig": "design",
    "md": "plan", "mdx": "plan", "txt": "plan",
    "sh": "infra", "ps1": "infra", "bat": "infra", "yml": "infra", "yaml": "infra",
    "toml": "infra", "ini": "infra", "json": "infra", "lock": "infra",
    "cfg": "infra", "conf": "infra", "ahk": "infra", "jsonl": "infra",
}
_QA_VERB = {"pytest", "vitest", "jest", "playwright", "cypress",
            "eslint", "ruff", "mypy", "coverage", "nyc"}
# 러너(python/node/...) 뒤에 오는 '진짜로 뭘 돌리는지' 힌트. _QA_VERB 자체에
# "test" 를 넣으면 bash 의 `test -f x` 같은 흔한 verb 까지 QA 로 오분류된다 —
# 그래서 이건 _ROLE_RUN_VERB 뒤 인자를 볼 때만 쓰는 별도 집합이다.
_QA_RUN_HINTS = _QA_VERB | {"unittest", "test"}
_INFRA_VERB = {"docker", "kubectl", "systemctl", "pm2", "nginx", "chmod", "chown",
               "mkdir", "cp", "mv", "rm", "ln", "tar", "unzip", "zip", "pkill",
               "kill", "ss", "netstat", "systemd"}
_BUILD_VERB = {"pnpm", "npm", "yarn", "tsc", "vite", "webpack", "make",
                "cargo", "gradle", "mvn"}
_ROLE_NET_VERB = {"curl", "wget", "ssh", "scp", "rsync"}
_ROLE_RUN_VERB = {"python", "python3", "node", "deno", "uvicorn",
                   "gunicorn", "flask", "ruby", "go", "java"}
_ROLE_LOOK_VERB = {"ls", "cat", "grep", "rg", "find", "head", "tail", "wc",
                    "tree", "du", "file", "diff", "less", "sed", "awk",
                    "stat", "echo", "printf"}
_ROLE_SKILL = [
    ("brainstorm", "plan"), ("writing-plans", "plan"), ("executing-plans", "plan"),
    ("claude-md", "plan"), ("init", "plan"),
    ("artifact-design", "design"), ("dataviz", "design"), ("design", "design"),
    ("debugging", "qa"), ("test-driven", "qa"), ("code-review", "qa"),
    ("verification", "qa"), ("security-review", "qa"),
    ("finishing-a-development", "release"), ("git", "release"),
    ("tavily", "research"), ("exa", "research"), ("firecrawl", "research"),
    ("context7", "research"), ("search", "research"),
    ("update-config", "infra"), ("hookify", "infra"), ("plugin", "infra"),
    ("run", "infra"), ("worktree", "infra"),
]
_ROLE_TOOL = {
    "WebSearch": "research", "WebFetch": "research", "ToolSearch": "research",
    "TodoWrite": "plan", "AskUserQuestion": "plan",
    "Agent": "meeting", "Task": "meeting",
}
# MCP 서버 이름 -> 업무 구역. _ROLE_SKILL(문자열 아무데나 substring 매칭)을 MCP
# 툴 이름에 재사용하면 안 된다 — 'mcp__plugin_serena_serena__find_symbol' 처럼
# 이름 자체에 "plugin" 이 구조적으로 박혀 있어 _ROLE_SKILL 의 ("plugin","infra")
# 가 사실상 전부를 인프라로 삼켜버린다(버그 2). 서버 세그먼트만 뽑아 여기서 찾는다.
_MCP_SERVER_ROLE = {
    "serena": "explore",
    "playwright": "qa",
    "chrome-devtools": "qa",
    "chrome-devtools-mcp": "qa",   # 세그먼트 추출이 실패해도 잡히게
    "context7": "research",
    "github": "release",
    "tavily": "research",
    "exa": "research",
    "firecrawl": "research",
}


def _mcp_server(name):
    """'mcp__<plugin>_<server>__<tool>' 또는 'mcp__<server>__<tool>' 에서
    서버 이름만 구조적으로 뽑는다 (이중 밑줄이 진짜 구분자). 못 찾으면 빈 문자열.

    'mcp__plugin_serena_serena__find_symbol' -> 'serena'
    'mcp__plugin_chrome-devtools-mcp_chrome-devtools__click' -> 'chrome-devtools'
    'mcp__github__create_pr' -> 'github'
    """
    parts = name.split("__")
    if len(parts) < 2:
        return ""
    middle = parts[1]
    if middle.startswith("plugin_"):
        segs = middle[len("plugin_"):].split("_")
        return segs[-1] if len(segs) >= 2 else middle
    return middle.split("_")[0]


def _as_dict(value):
    """JSONL 은 신뢰할 수 없는 입력이다. dict 가 아니면 빈 dict 로 본다."""
    return value if isinstance(value, dict) else {}


def _as_str(value):
    """JSONL 값은 신뢰할 수 없다. 문자열이 아니면 빈 문자열로 본다."""
    return value if isinstance(value, str) else ""


def _segments(cmd):
    """셸 명령을 세그먼트로 나눠 (동사, 나머지 인자) 를 차례로 낸다.

    cd 체인과 VAR=값 접두사는 건너뛰고, sudo/timeout 같은 래퍼는 벗긴다.
    bash_verb 와 role_for 가 공유하는 세그먼트 워커.

    'cd /a && git status' -> git 만 낸다      (cd 만 2842회라 앞 단어를 그냥 읽으면 안 된다)
    'FOO=1 python3 x.py'  -> python3
    'sudo git push'       -> git             (래퍼를 건너뛴다)
    'timeout 30 python3'  -> python3         (래퍼의 숫자 인자를 건너뛴다)
    """
    for seg in re.split(r"&&|\|\||;|\|", _as_str(cmd)):
        seg = seg.strip("(){} ")
        toks = [t for t in re.split(r"\s+", seg)
                if t and not _ASSIGN_RE.match(t)]

        # Walk through tokens, skipping non-command words and wrappers
        i = 0
        while i < len(toks):
            tok = toks[i]
            if tok in _NOT_CMD:
                # This segment is not a command, go to next segment
                break
            if tok in _WRAP:
                # Skip the wrapper word
                i += 1
                # Skip any option flags or numbers that follow
                while i < len(toks) and (toks[i].startswith('-') or toks[i].isdigit()):
                    i += 1
                # Continue to next token (which should be the real command)
                continue
            # This is the verb
            verb = tok.split("/")[-1]
            yield verb, toks[i + 1:]
            break


def bash_verb(cmd):
    """셸 명령에서 실제 동사를 뽑는다. 첫 세그먼트의 첫 동사만 쓴다."""
    for verb, _args in _segments(cmd):
        return verb
    return ""


def _role_by_ext(args):
    """파일 인자 목록에서 확장자/경로로 업무 구역을 추정한다. 못 찾으면 None."""
    for a in args:
        if a.startswith("-"):
            continue
        base = a.strip("'\"").split("/")[-1]
        if re.search(r"(^|_)(test|spec)|\.(test|spec)\.", base):
            return "qa"
        if "." in base:
            ext = base.rsplit(".", 1)[-1].lower()
            if ext in _ROLE_EXT:
                return _ROLE_EXT[ext]
    for a in args:
        s = a.strip("'\"")
        if re.search(r"(^|/)(tests?|__tests__|spec)/", s):
            return "qa"
        if re.search(r"(^|/)(api|server|backend|routes|models|migrations)/", s):
            return "backend"
        if re.search(r"(^|/)(components|pages|styles|ui|src/app)/", s):
            return "frontend"
        if re.search(r"(^|/)(docs?|specs?|plans?)/", s):
            return "plan"
        if re.search(r"(^|/)(assets|public|images)/", s):
            return "design"
    return None


def role_for(tool_name, tool_input, skill=""):
    """툴 호출 하나가 어느 업무 구역인지 정한다 (탐색/프론트/백엔드/인프라/QA/
    릴리즈/기획/디자인/리서치/회의 중 하나). 실 데이터 9,206건으로 검증했다
    (role_reference.py). 순서가 중요하다: 파일 확장자 -> Bash 동사 ->
    Bash 파일 인자 -> skill -> 툴 이름.
    """
    name = _as_str(tool_name)
    inp = _as_dict(tool_input)
    skill = _as_str(skill)

    if name in ("Agent", "Task"):
        return "meeting"
    if name.startswith("mcp__"):
        return _MCP_SERVER_ROLE.get(_mcp_server(name), "research")

    path = inp.get("file_path") or inp.get("notebook_path")
    if isinstance(path, str) and path:
        role = _role_by_ext([path])
        if role:
            return role

    if name == "Bash":
        cmd = inp.get("command")
        cmd = cmd if isinstance(cmd, str) else ""
        first = None
        for verb, args in _segments(cmd):
            if first is None:
                first = (verb, args)
            if verb in _QA_VERB:
                return "qa"
            if verb == "git":
                return "release"
            if verb in _BUILD_VERB:
                return "qa" if any(a in ("test", "lint", "typecheck") for a in args) else "infra"
            if verb in _INFRA_VERB:
                return "infra"
            if verb in _ROLE_NET_VERB:
                return "research"
        if first:
            verb, args = first
            role = _role_by_ext(args)
            if role:
                return role
            if verb in _ROLE_RUN_VERB:
                # 러너(python/node/...)는 실제로 뭘 돌리는지가 인자에 있다 —
                # 'python -m pytest'/'python -m unittest' 는 -m 다음 토큰이,
                # 'node --test' 는 그 플래그 자체(대시를 뗀 이름)가 QA 신호다.
                # 안 보면 셋 다 verb(python3/node)만 보고 backend 로 잘못 간다.
                arg0 = args[0] if args else ""
                arg1 = args[1] if len(args) > 1 else ""
                hint = arg1 if arg0 == "-m" else arg0.lstrip("-")
                if hint in _QA_RUN_HINTS:
                    return "qa"
                return "backend"
            if verb in _ROLE_LOOK_VERB:
                return "explore"
        return "explore"

    if skill:
        for key, role in _ROLE_SKILL:
            if key in skill:
                return role
    tool_role = _ROLE_TOOL.get(name)
    if tool_role:
        return tool_role
    if isinstance(inp.get("pattern"), str) or isinstance(inp.get("query"), str):
        return "explore"
    return "explore"


# 자격증명이 화면·명찰·툴팁으로 새는 걸 막는 마지막 방어선.
# 휴리스틱이다 — 보장이 아니다. 아래 나열한 흔한 모양(sk-…, gh 계열 토큰, AKIA…,
# Bearer 토큰, aws_secret_access_key, URL 안의 user:pass@)은 잡아내지만, 이 모양을
# 벗어난 낯선 포맷의 비밀은 여전히 통과할 수 있다. "안 보이게" 수준이지 "안전 보장"이
# 아니라는 걸 분명히 해둔다.
_CRED_PATTERNS = [
    (re.compile(r"\bBearer\s+\S+"), "Bearer ***"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{10,}"), "sk-***"),
    (re.compile(r"\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{6,}"),
     lambda m: m.group(1) + "_***"),
    (re.compile(r"\bAKIA[A-Z0-9]{16}\b"), "AKIA***"),
    (re.compile(r"(?i)(aws_secret_access_key\S*?[:=]\s*)\S+"), r"\1***"),
    (re.compile(r"([A-Za-z][A-Za-z0-9+.-]*://)[^\s/@]+:[^\s/@]+@"), r"\1***@"),
]


def _redact_credentials(text):
    for pat, repl in _CRED_PATTERNS:
        text = pat.sub(repl, text)
    return text


def label_for(tool_name, tool_input):
    """화면에 띄울 짧은 문자열. 파일명이 있으면 그것, 없으면 명령어 앞부분.

    프라이버시: 파일 본문(content), 프롬프트, 툴 결과는 절대 담지 않는다.
    커맨드에 섞인 자격증명은 _redact_credentials 로 가린다(휴리스틱, 위 주석 참고).
    """
    inp = _as_dict(tool_input)
    path = _as_str(inp.get("file_path") or inp.get("notebook_path") or inp.get("path") or "")
    if path:
        parts = path.rstrip("/").split("/")
        label = "/".join(parts[-2:]) if len(parts) >= 2 else parts[-1]
        return label[:LABEL_MAX]
    cmd = _as_str(inp.get("command"))
    if cmd:
        toks = cmd.split()
        # 앞에 붙은 'VAR=값' 과 export/set/sudo/env 같은 래퍼는 화면에 내보내지
        # 않는다. 래퍼 뒤에 또 대입이 와도('export FOO=1 BAR=2 cmd') 계속 벗긴다 —
        # 대입 판정은 기존 _ASSIGN_RE 하나만 쓴다.
        while toks and (_ASSIGN_RE.match(toks[0]) or toks[0] in _ASSIGN_SKIP_WORDS):
            toks.pop(0)
        raw = " ".join(toks)
    else:
        raw = _as_str(inp.get("pattern") or inp.get("query") or "")
    text = " ".join(raw.split())            # 개행·연속 공백 정리
    text = _redact_credentials(text)         # 자격증명 모양이면 위치 상관없이 가린다
    return text[:LABEL_MAX]


def normalize(row):
    """JSONL 한 줄에서 이벤트 0개 이상을 뽑는다. proj 는 호출자가 채운다."""
    row = _as_dict(row)
    message = _as_dict(row.get("message"))
    content = message.get("content")
    if not isinstance(content, list):
        return []

    events = []
    for block in content:
        if not isinstance(block, dict) or block.get("type") != "tool_use":
            continue
        name = _as_str(block.get("name"))
        tool_input = block.get("input")
        skill = _as_str(row.get("attributionSkill") or "")
        events.append({
            "t": "tool",
            "proj": "",                                   # 호출자가 채운다
            "sid": str(row.get("sessionId", ""))[:8],
            "entry": row.get("entrypoint", "cli"),
            "name": name,
            "role": role_for(name, tool_input, skill),
            "label": label_for(name, tool_input),
            "skill": skill,
            "sub": bool(row.get("isSidechain")),
            "ts": row.get("timestamp", ""),
        })
    return events


POLL_INTERVAL = 1.0
# 토큰 "오늘" 은 한국 시간 기준이다. 트랜스크립트 시각은 UTC ISO 라 그대로 자르면
# 오전 9시에 날이 바뀐다.
KST = timezone(timedelta(hours=9))


def kst_day(ts=None):
    """한국 시간 기준 'YYYY-MM-DD'. ts 가 없으면 지금, 있으면 그 ISO 시각 기준."""
    if ts is None:
        return datetime.now(KST).strftime("%Y-%m-%d")
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%Y-%m-%d")


# 이 시간 넘게 아무 줄도 안 붙으면 "완료"로 본다. Claude Code 는 세션 종료를
# 트랜스크립트에 남기지 않으므로(끝났는지 알 방법이 없다) 방치 시간으로 가른다 —
# 추측이지 사실이 아니다. 30분은 "잠깐 자리 비움"과 "그 세션 끝났음"을 가르는 선.
DONE_AFTER = 30 * 60
# 완료된 지 이만큼 지나면 아예 안 내보낸다. 완료 방이 몇 달치 세션으로 차면
# "오늘 뭐가 끝났나"를 못 읽는다 — 오래된 건 화면이 아니라 저장소가 들고 있으면 된다.
HIDE_AFTER = 2 * 24 * 60 * 60
MAX_ROOMS = 4
def _roots():
    """세션 기록이 있는 자리. 기본은 이 컴퓨터의 홈이다.

    서버가 Claude Code 와 '같은 쪽'에서 돌면 홈 하나로 충분하다. 그런데 배포본은
    상황이 갈린다 — Windows 앱이 WSL 안의 기록을 봐야 할 수도 있고 그 반대일 수도
    있다. 그래서 밖에서 CLAUDETOWN_ROOTS 로 덮어쓸 수 있게 열어 둔다
    (os.pathsep 로 여러 개, 없는 경로는 조용히 건너뛴다 — Tailer 가 이미 그렇게 한다).
    """
    override = os.environ.get("CLAUDETOWN_ROOTS", "").strip()
    if override:
        return [Path(p) for p in override.split(os.pathsep) if p.strip()]
    return [Path.home() / ".claude" / "projects"]


ROOTS = _roots()


class Tailer:
    """세션 JSONL 을 offset 기억하며 따라 읽는다.

    파일이 600KB~3MB 라 매번 통째로 읽으면 안 된다.
    append 중인 파일은 마지막 줄이 잘려 있을 수 있으므로,
    완전한 줄까지만 offset 을 전진시킨다.
    """

    def __init__(self, roots):
        self.roots = [Path(r) for r in roots]
        self._offset = {}        # 경로 -> 읽은 바이트 수
        self._seen = {}          # 경로 -> {sid, entry, mtime}
        self._turn_ended = {}    # 경로 -> 마지막 턴이 끝났나(= 사용자 차례인가)
        self._last_role = {}     # 경로 -> 마지막으로 있던 업무 구역(방)
        self._cwd = {}           # 경로 -> 그 세션의 실제 작업 폴더(cwd)
        self._tokens = {}        # 경로 -> 그 세션이 쓴 누적 토큰(전체 기간)
        self._tokens_today = {}  # 경로 -> 오늘(KST) 쓴 토큰
        self._today = kst_day()  # 이 값이 바뀌면 오늘치를 비운다
        self._titles = {}        # 경로 -> aiTitle (세션 자동 생성 제목)

    def _files(self):
        for root in self.roots:
            if not root.is_dir():
                continue
            for proj_dir in root.iterdir():
                if proj_dir.is_dir():
                    yield from proj_dir.glob("*.jsonl")

    @staticmethod
    def _turn_signal(row):
        """그 줄이 턴 경계에 대해 말해주는 것. True=턴 끝남, False=진행 중, None=무관.

        Claude Code 는 어시스턴트 턴이 끝날 때 system/turn_duration 을 남긴다.
        그 뒤로 user/assistant 줄이 다시 붙으면 또 일하는 중이다. attachment,
        last-prompt, ai-title 같은 메타 줄은 턴과 무관하므로 건드리지 않는다.
        """
        t = row.get("type")
        if t == "system":
            return True if row.get("subtype") == "turn_duration" else None
        if t in ("assistant", "user"):
            return False
        return None

    @staticmethod
    def _usage_tokens(row):
        """이 줄이 쓴 토큰. 캐시 읽기(cache_read)는 일부러 뺀다.

        캐시 읽기는 매 턴 컨텍스트 전체를 다시 세므로 턴 수만큼 중복 계상된다 —
        실측으로 한 세션이 32억까지 나왔다. 실제로 "쓴" 양은 입력·출력·캐시 생성이다.
        cost-state 행에 누계가 통째로 들어있긴 한데 파일 절반에만 있고 꼬리에는
        거의 없어서(실측 12개 중 4개) 못 믿는다. 그래서 여기서 직접 더한다.
        """
        usage = _as_dict(_as_dict(row.get("message")).get("usage"))
        total = 0
        for key in ("input_tokens", "output_tokens", "cache_creation_input_tokens"):
            value = usage.get(key)
            if isinstance(value, int) and value > 0:
                total += value
        return total

    def _absorb(self, path, row, proj):
        """한 줄에서 상태(제목·턴·방·토큰)를 흡수하고 이벤트를 돌려준다.

        seed() 와 scan() 이 같은 줄을 같은 방식으로 읽게 하려고 하나로 묶었다.
        """
        title = row.get("aiTitle")
        if isinstance(title, str) and title:
            self._titles[path] = title
        # 프로젝트 슬러그는 경로 구분자와 이름 속 하이픈이 똑같이 '-' 로 뭉개져 있어
        # 폴더 이름을 복원할 수 없다. 그런데 행에 cwd 가 그대로 들어 있다 — 추측하지
        # 말고 이걸 쓴다. (화면 이름표에도, 창 찾기 검색어에도.)
        cwd = row.get("cwd")
        if isinstance(cwd, str) and cwd:
            self._cwd[path] = cwd
        sig = self._turn_signal(row)
        if sig is not None:
            self._turn_ended[path] = sig
        tokens = self._usage_tokens(row)
        if tokens:
            self._tokens[path] = self._tokens.get(path, 0) + tokens
            if kst_day(row.get("timestamp")) == self._today:
                self._tokens_today[path] = self._tokens_today.get(path, 0) + tokens
        events = normalize(row)
        for ev in events:
            ev["proj"] = proj
            self._seen[path] = {"sid": ev["sid"], "entry": ev["entry"]}
            self._last_role[path] = ev["role"]
        return events

    def seed(self):
        """빠른 시작용. 화면에 오를 파일(HIDE_AFTER 안)만 실제로 읽는다.

        토큰 누계는 꼬리만 봐서는 안 나온다 — 파일 전체를 봐야 한다. 대신 이틀
        넘게 조용한 파일은 sessions() 가 어차피 빼므로 통째로 건너뛴다. 실측:
        ~/.claude/projects 336MB 중 145MB(12개 파일)만 읽어 450ms — 예전의
        "전부 파싱하면 2초"보다 빠르면서 방·토큰까지 채운다.
        """
        now = time.time()
        for path in self._files():
            try:
                st = path.stat()
            except OSError:
                continue
            self._offset[path] = st.st_size          # 과거는 이벤트로 흘려보내지 않는다
            if st.st_size == 0 or (now - st.st_mtime) > HIDE_AFTER:
                continue
            try:
                data = path.read_bytes()
            except OSError:
                continue
            proj = path.parent.name
            for raw in data.split(b"\n"):
                if not raw.strip():
                    continue
                try:
                    row = json.loads(raw.decode("utf-8", "replace"))
                except ValueError:
                    continue                          # 깨진/잘린 줄은 건너뛴다
                if not isinstance(row, dict):
                    continue
                try:
                    self._absorb(path, row, proj)     # 이벤트는 버린다 — 과거니까
                except Exception as exc:
                    print(f"[seed] {path.name}: 행 건너뜀 — {type(exc).__name__}: {exc}")

    def scan(self):
        events = []
        for path in self._files():
            try:
                size = path.stat().st_size
            except OSError:
                continue

            start = self._offset.get(path, 0)
            if size < start:         # 파일이 잘렸다 (교체 등). 처음부터 다시.
                start = 0
            if size == start:
                continue

            try:
                with open(path, "rb") as f:
                    f.seek(start)
                    chunk = f.read(size - start)
            except OSError:
                continue

            # 마지막 개행까지만 처리한다. 그 뒤는 아직 쓰이는 중일 수 있다.
            cut = chunk.rfind(b"\n")
            if cut == -1:
                continue
            self._offset[path] = start + cut + 1

            proj = path.parent.name
            for raw in chunk[:cut].split(b"\n"):
                if not raw.strip():
                    continue
                try:
                    row = json.loads(raw.decode("utf-8", "replace"))
                except ValueError:
                    continue        # 깨진 줄은 건너뛴다
                if not isinstance(row, dict):
                    continue
                try:
                    events.extend(self._absorb(path, row, proj))
                except Exception as exc:
                    print(f"[tail] {path.name}: 행 건너뜀 — {type(exc).__name__}: {exc}")
                    continue
        return events

    def sessions(self):
        """{proj: [{sid, entry, active, state, mtime}, ...]} — 최근 수정 순, 방 MAX_ROOMS 개까지.

        state 는 셋 중 하나다:
          working  턴이 진행 중이다
          waiting  턴이 끝났다 — 사용자 차례다
          done     DONE_AFTER 넘게 아무것도 안 붙었다 (끝난 것으로 본다)

        한때 '조용한데 턴이 안 끝난' 상태를 stuck 으로 따로 뒀는데 뺐다. 권한 요청
        대기인지, 긴 명령에 물린 건지, 그냥 죽은 건지 구분할 근거가 트랜스크립트에
        없어서 추측밖에 안 됐다. 턴이 안 끝났으면 그냥 일하는 중으로 본다.

        HIDE_AFTER(이틀) 넘게 조용한 세션은 아예 빼고 내보낸다.
        """
        now = time.time()
        today = kst_day()
        if today != self._today:      # 자정을 넘겼다 — 오늘치는 0 부터 다시
            self._today = today
            self._tokens_today = {}
        out = {}
        for path, info in self._seen.items():
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            age = now - mtime
            if age > HIDE_AFTER:
                continue                      # 이틀 넘게 조용한 건 화면에 안 올린다
            if age > DONE_AFTER:
                state = "done"
            elif self._turn_ended.get(path, False):
                state = "waiting"             # 턴이 끝났다 — 사용자 차례
            else:
                state = "working"
            out.setdefault(path.parent.name, []).append({
                "sid": info["sid"],
                "entry": info["entry"],
                "active": state == "working",
                "state": state,
                # 화면이 "한 번도 안 움직인 세션"도 원래 방에 세울 수 있게 한다.
                # 모르면 null 을 보낸다 — 기본값(explore)으로 채우면 마지막 방을
                # 못 찾은 세션이 전부 탐색 방에 몰려 선다(실측 11명). 어디 있었는지
                # 모르는 사람을 지어내 세우느니 안 세우는 게 낫다.
                "role": self._last_role.get(path),
                "tokens": self._tokens.get(path, 0),
                "tokensToday": self._tokens_today.get(path, 0),
                "cwd": self._cwd.get(path, ""),
                "mtime": mtime,
                "title": self._titles.get(path, ""),
            })
        for proj in out:
            out[proj].sort(key=lambda r: r["mtime"], reverse=True)
            del out[proj][MAX_ROOMS:]
        return out


PORT = 8765
HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"

_clients = []            # 접속 중인 SSE 큐들
_clients_lock = threading.Lock()
_recent = []             # 최근 이벤트 (스냅샷용)


def safe_asset(name):
    """assets/ 밖으로 나가는 경로를 막는다. 안전하면 Path, 아니면 None."""
    try:
        target = (ASSETS / name).resolve()
        if target.is_file() and ASSETS.resolve() in target.parents:
            return target
    except (ValueError, OSError):
        return None
    return None


def asset_content_type(name):
    """파일명 확장자로 Content-Type 을 정한다."""
    suffix_type = {
        ".png": "image/png",
        ".txt": "text/plain; charset=utf-8",
    }
    suffix = Path(name).suffix.lower()
    return suffix_type.get(suffix, "application/octet-stream")


def sse(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _broadcast(event, payload):
    msg = sse(event, payload).encode()
    with _clients_lock:
        dead = []
        for q in _clients:
            try:
                q.put_nowait(msg)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _clients.remove(q)


def poll_loop(tailer):
    """백그라운드에서 tail 하며 접속자 전원에게 밀어준다."""
    while True:
        try:
            for ev in tailer.scan():
                _recent.append(ev)
                del _recent[:-200]
                _broadcast("tool", ev)
            _broadcast("sessions", tailer.sessions())
        except Exception as exc:                  # 폴러는 절대 죽지 않는다
            print(f"[poll] {exc}")
        time.sleep(POLL_INTERVAL)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass                                       # 요청 로그 끔

    def _send(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path in ("/", "/town.html"):
            return self._send((HERE / "town.html").read_bytes(), "text/html; charset=utf-8")

        if path == "/tiles.html":
            return self._send((HERE / "tiles.html").read_bytes(), "text/html; charset=utf-8")

        if path.startswith("/assets/"):
            name = path[len("/assets/"):]
            target = safe_asset(name)
            if not target:
                self.send_error(404)
                return
            return self._send(target.read_bytes(), asset_content_type(name))

        if path == "/events":
            return self._events()

        self.send_error(404)

    def _events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        q = queue.Queue(maxsize=500)
        with _clients_lock:
            _clients.append(q)
        try:
            self.wfile.write(sse("snapshot", {"recent": _recent[-60:]}).encode())
            self.wfile.flush()
            while True:
                try:
                    self.wfile.write(q.get(timeout=15))
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")   # 프록시·브라우저 타임아웃 방지
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass                                    # 브라우저가 닫았다
        finally:
            with _clients_lock:
                if q in _clients:
                    _clients.remove(q)


def open_browser(url):
    """WSL 에서는 xdg-open 이 없을 수 있다. 플랫폼별 폴백으로 넘어간다."""
    try:
        if webbrowser.open(url):
            return
    except Exception:
        pass
    # 맥은 open, WSL 은 explorer.exe. 둘 다 없으면 조용히 포기한다 —
    # 주소는 이미 화면에 찍혀 있으니 직접 열면 된다.
    fallback = ["open"] if sys.platform == "darwin" else ["explorer.exe"]
    try:
        subprocess.Popen(fallback + [url],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def main():
    # 필수 assets 확인 (cwd 와 무관하게 항상 이 스크립트 옆 assets/ 를 본다)
    for name in ['town.png', 'dungeon.png', 'indoor.png']:
        if not (ASSETS / name).is_file():
            print(f"오류: assets/{name} 가 없습니다. ./fetch_assets.sh 를 먼저 실행하세요.")
            raise SystemExit(1)

    tailer = Tailer(ROOTS)
    tailer.seed()                                    # 과거를 파싱하지 않고 오프셋만 맞춘다 — 즉시 뜬다
    threading.Thread(target=poll_loop, args=(tailer,), daemon=True).start()

    url = f"http://127.0.0.1:{PORT}/"
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)   # 로컬 전용
    except OSError as e:
        if e.errno in (98, 10048):  # 리눅스/윈도우 "이미 사용 중" 번호가 다르다
            print(f"포트 {PORT} 이 이미 사용 중입니다. 다른 AgentTown 인스턴스가 실행 중인지 확인하세요.")
            raise SystemExit(1)
        raise
    server.daemon_threads = True
    print(f"AgentTown  →  {url}   (Ctrl+C 로 종료)", flush=True)
    # 데스크톱 앱이 띄울 때는 브라우저를 열면 안 된다. 예전엔 BROWSER=true 라는
    # 환경변수 꼼수를 썼는데 그건 리눅스에서만 통한다 — 플래그로 바꿨다.
    if "--no-browser" not in sys.argv:
        open_browser(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n종료")


if __name__ == "__main__":
    main()
