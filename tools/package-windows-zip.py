"""Create a Windows install ZIP from official runtimes, on macOS or Windows.

Pass the checksum-verified electron-v43.4.0-win32-x64.zip from @electron/get.
No personal profiles, repository history or screenshots enter the archive.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'downloads' / 'AgentTown-Windows-x64.zip'
PYTHON_URL = 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip'
INSTALL = r'''@echo off
setlocal
set "CODEXTOWN_INSTALL=%LOCALAPPDATA%\Programs\AgentTown"
tasklist /FI "IMAGENAME eq AgentTown.exe" /NH 2>nul | find /I "AgentTown.exe" >nul
if not errorlevel 1 (
  echo Please quit AgentTown from its tray menu, then run this installer again.
  pause
  exit /b 1
)
tasklist /FI "IMAGENAME eq CodexTown.exe" /NH 2>nul | find /I "CodexTown.exe" >nul
if not errorlevel 1 (
  echo Please quit the previous version of AgentTown from its tray menu before installing.
  pause
  exit /b 1
)
if not exist "%~dp0app\AgentTown.exe" (
  echo Extract the entire ZIP first. Do not run this file inside the ZIP.
  pause
  exit /b 1
)
echo Installing AgentTown for the current user...
robocopy "%~dp0app" "%CODEXTOWN_INSTALL%" /E /R:2 /W:1 /NFL /NDL /NJH /NJS >nul
if errorlevel 8 goto failed
powershell.exe -NoProfile -NonInteractive -Command "$w=New-Object -ComObject WScript.Shell; foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$s=$w.CreateShortcut((Join-Path $folder 'AgentTown.lnk'));$s.TargetPath=Join-Path $env:CODEXTOWN_INSTALL 'AgentTown.exe';$s.WorkingDirectory=$env:CODEXTOWN_INSTALL;$s.IconLocation=Join-Path $env:CODEXTOWN_INSTALL 'resources\app\assets\claudetown.ico';$s.Save()}"
if errorlevel 1 goto failed
echo Installation complete. Opening AgentTown...
start "" "%CODEXTOWN_INSTALL%\AgentTown.exe"
exit /b 0
:failed
echo Installation failed. Please keep this window open and share the error.
pause
exit /b 1
'''
GUIDE = '''AgentTown Windows 설치

1. ZIP을 전부 압축 해제합니다. 압축 파일 안에서 바로 실행하지 마세요.
2. 설치.cmd를 더블클릭합니다. 현재 사용자 폴더에 설치하고 바탕화면과 시작 메뉴에 바로가기를 만듭니다.
3. 다음부터는 AgentTown 바로가기로 실행합니다.

관리자 권한, Python, Node.js 별도 설치가 필요 없는 Windows x64 패키지입니다.
설치 위치: %LOCALAPPDATA%\\Programs\\AgentTown
설치하지 않고 쓰려면 app 폴더의 AgentTown.exe를 실행해도 됩니다.
업데이트할 때는 트레이 메뉴의 종료로 앱을 완전히 종료한 뒤 새 ZIP의 설치.cmd를 실행합니다.

본인 PC에서 Codex를 사용한 기록이 있어야 캐릭터가 나옵니다.
기본 기록 폴더: %USERPROFILE%\\.codex
다른 PC의 작업, ChatGPT 웹 대화, WSL 내부 기록은 자동으로 가져오지 않습니다.
계정 사용량 조회에는 로그인된 Codex 명령줄 실행 파일이 필요합니다.
찾지 못하면 CODEXTOWN_CODEX 환경 변수에 실제 codex.exe 경로를 지정할 수 있습니다.
작업 바로 열기는 codex:// 주소를 처리하는 Codex 앱이 있어야 합니다.
알림은 항상 무음이며 Windows 알림 및 방해 금지 설정을 따릅니다.

검증 상태(2026-09-15): Windows 11 Pro x64에서 ZIP 설치·바로가기·앱 실행을 확인했습니다.
한글 경로의 테스트 세션 읽기, 상점·전투·작은 창 화면, 무음 설정의 네이티브 알림 표시 이벤트를 검증했습니다.
로그인된 Codex 계정의 실시간 한도 조회와 codex:// 작업 바로 열기는 아직 별도 확인이 필요합니다.
서명 없는 배포본입니다. 회사 정책이 실행을 차단하면 보안 설정을 변경하지 말고 관리자에게 확인하세요.
이 ZIP에는 개발자의 세션, 로그인 정보, 개인 설정이 들어 있지 않습니다.
'''


def package(electron_zip):
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='codextown-windows-') as temporary:
        stage = Path(temporary)
        bundle = stage / 'AgentTown-Windows'
        app = bundle / 'app'
        with zipfile.ZipFile(electron_zip) as archive:
            archive.extractall(app)
        (app / 'electron.exe').rename(app / 'AgentTown.exe')
        (app / 'resources/default_app.asar').unlink(missing_ok=True)
        resources = app / 'resources'
        payload = resources / 'app'
        (payload / 'src').mkdir(parents=True)
        for name in ['main.js', 'preload.js', 'server-command.js']:
            shutil.copy2(ROOT / 'app/src' / name, payload / 'src' / name)
        shutil.copytree(ROOT / 'app/assets', payload / 'assets', ignore=shutil.ignore_patterns('icon-src'))
        server = payload / 'server'
        server.mkdir()
        for name in ['agenttown.py', 'codextown.py', 'claudetown.py', 'town.html', 'town-ui.js', 'town-adventure.js', 'town-chronicle.js', 'town-events.js', 'town-journal-ui.js', 'town-journal.css', 'town-ui.css', 'tiles.html']:
            shutil.copy2(ROOT / name, server / name)
        shutil.copytree(ROOT / 'assets', server / 'assets')
        (payload / 'package.json').write_text(json.dumps({
            'name': 'codextown-app', 'productName': 'AgentTown', 'version': '1.0.0', 'main': 'src/main.js'
        }), encoding='utf-8')
        python_zip = stage / 'python.zip'
        with urllib.request.urlopen(PYTHON_URL, timeout=60) as response:
            python_zip.write_bytes(response.read())
        with zipfile.ZipFile(python_zip) as archive:
            archive.extractall(resources / 'python')
        # Embedded Python isolates sys.path. Explicitly permit only the bundled server.
        (resources / 'python/python312._pth').write_text('python312.zip\n.\n../app/server\n', encoding='ascii')
        (bundle / '설치.cmd').write_bytes(INSTALL.replace('\n', '\r\n').encode('ascii'))
        (bundle / '설치 안내.txt').write_text(GUIDE, encoding='utf-8-sig')
        (bundle / 'runtime-sources.json').write_text(json.dumps({
            'electron': {'version': '43.4.0', 'archiveSha256': hashlib.sha256(Path(electron_zip).read_bytes()).hexdigest()},
            'python': {'url': PYTHON_URL, 'archiveSha256': hashlib.sha256(python_zip.read_bytes()).hexdigest()},
        }, indent=2), encoding='utf-8')
        with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as archive:
            for item in sorted(bundle.rglob('*')):
                if item.is_file():
                    archive.write(item, item.relative_to(stage))
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix('.zip.sha256').write_text(f'{digest}  {OUTPUT.name}\n', encoding='ascii')
    print(f'{OUTPUT} ({OUTPUT.stat().st_size / 1024**2:.1f} MB)')


if __name__ == '__main__':
    package(Path(sys.argv[1]).resolve())
