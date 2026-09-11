"""Smoke-check a frozen server without using a developer's Codex profile."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

with tempfile.TemporaryDirectory(prefix='codextown-build-') as profile:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    command = [str(Path(sys.argv[1]).resolve())]
    if command[0].endswith('.py'):
        command.insert(0, sys.executable)
    proc = subprocess.Popen(command + ['--no-browser'], env={**os.environ,
        'CODEX_HOME': profile, 'CODEXTOWN_ROOTS': str(Path(profile) / 'sessions'),
        'CODEXTOWN_PORT': str(port), 'PYTHONUTF8': '1',
    }, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        base = f'http://127.0.0.1:{port}'
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError(proc.stderr.read().decode(errors='replace'))
            try:
                with urllib.request.urlopen(base + '/health', timeout=.5) as response:
                    assert json.load(response)['app'] == 'codextown'
                break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Packaged server did not become healthy')
        for route in ['/', '/town-ui.js', '/town-ui.css', '/assets/dungeon.png']:
            with urllib.request.urlopen(base + route, timeout=3) as response:
                assert response.status == 200 and response.read(), route
        print('Packaged server: health, UI, and sprite assets OK')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        proc.stderr.close()
