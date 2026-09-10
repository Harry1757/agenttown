'use strict';

// ClaudeTown 을 Windows 로컬 경로(%LOCALAPPDATA%\ClaudeTown)에 설치하고
// 시작 메뉴/자동 실행 바로가기를 그 복사본으로 건다.
//
// 이유: electron.exe 를 \\wsl.localhost\... UNC 경로에서 그대로 실행하면
// Chromium 의 OS 샌드박스가 GPU/네트워크 자식 프로세스를 못 띄운다(재현
// 확인됨, src/main.js 의 ponytail 주석 참고). --no-sandbox 로 그 샌드박스를
// 통째로 끄는 대신, 원인인 실행 위치를 고친다 - 실행 파일을 로컬 NTFS 로
// 옮기면 스위치 없이도 정상 동작한다. 파이썬 서버는 그대로 WSL 에 둔다
// (사용자의 ~/.claude/projects 를 읽는 게 그 서버라서 옮길 이유가 없다).
// 옮기는 건 Electron 셸(샌드박스가 깨지는 쪽) 뿐이다.
//
// node_modules 는 복사하지 않고 로컬에서 다시 npm install 한다 -
// fs.cpSync 로 그 큰 트리(200MB+ 의 electron 바이너리 포함)를
// \\wsl.localhost\... 너머로 통째로 복사하면 이 환경에서 opendir 이
// 중간에 ENOTDIR 로 죽는 걸 겪었다(재현됨, 원인은 9P/UNC 브리지 쪽으로
// 추정 - node_modules 안에 심볼릭 링크는 없었다). 로컬 npm install 이
// 더 적은 코드로 더 안정적이다.
//
//   node_modules\.bin\electron.cmd tools/install.js              설치
//   node_modules\.bin\electron.cmd tools/install.js --uninstall  제거

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { app, shell } = require('electron');

// src/main.js 의 같은 이유 - 이 스크립트 자신도 아직 로컬로 옮기기 전이라
// UNC 경로에서 도는 electron.exe 로 실행된다. 그 상태에서는 OS 샌드박스가
// 자식 프로세스(GPU 등)를 못 띄우니 여기서도 켜야 한다.
if (/^\\\\/.test(__dirname)) {
  app.commandLine.appendSwitch('no-sandbox');
}

const SRC_DIR = path.resolve(__dirname, '..');
const WIN_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'ClaudeTown');
const ICON = path.join(WIN_DIR, 'assets', 'claudetown.ico');
const APP_USER_MODEL_ID = 'com.claudetown.app';
const uninstall = process.argv.includes('--uninstall');

// 소스 코드만 복사한다(node_modules, icon-src 제외) - 왜인지는 위 주석 참고.
function copyApp() {
  fs.rmSync(WIN_DIR, { recursive: true, force: true });
  fs.cpSync(SRC_DIR, WIN_DIR, {
    recursive: true,
    filter: (src) => !/[\\/]node_modules([\\/]|$)/.test(src) && !src.includes(`${path.sep}icon-src`),
  });
}

function npmInstall(dir) {
  console.log(`npm install: ${dir}`);
  execFileSync('npm.cmd', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit', shell: true });
}

// electron 의 postinstall(바이너리 다운로드)이 npm install 중에 안 돌 때가
// 있었다(이 저장소 쪽 설치에서도 겪음) - 없으면 여기서 한 번 더 부른다.
// electron.exe 자신을 ELECTRON_RUN_AS_NODE 로 평범한 node 처럼 써서, 별도
// node.exe 경로를 몰라도 된다.
function ensureElectronBinary(dir) {
  const exe = path.join(dir, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(exe)) return exe;
  console.log('electron 바이너리를 내려받는 중...');
  execFileSync(process.execPath, [path.join(dir, 'node_modules', 'electron', 'install.js')], {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  return exe;
}

app.whenReady().then(() => {
  const programs = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  const targets = [
    { label: '시작 메뉴', file: path.join(programs, 'ClaudeTown.lnk') },
    { label: '자동 실행', file: path.join(programs, 'Startup', 'ClaudeTown.lnk') },
  ];

  if (uninstall) {
    for (const t of targets) {
      if (fs.existsSync(t.file)) { fs.unlinkSync(t.file); console.log(`지움  ${t.label}: ${t.file}`); }
      else console.log(`없음  ${t.label}`);
    }
    if (fs.existsSync(WIN_DIR)) {
      fs.rmSync(WIN_DIR, { recursive: true, force: true });
      console.log(`지움  설치 폴더: ${WIN_DIR}`);
    } else {
      console.log(`없음  설치 폴더: ${WIN_DIR}`);
    }
    app.exit(0);
    return;
  }

  try {
    console.log(`복사: ${SRC_DIR} -> ${WIN_DIR}`);
    copyApp();
    npmInstall(WIN_DIR);
    const electronExe = ensureElectronBinary(WIN_DIR);
    if (!fs.existsSync(electronExe)) {
      console.error(`electron.exe 를 못 받았다: ${electronExe}`);
      app.exit(1);
      return;
    }

    for (const t of targets) {
      fs.mkdirSync(path.dirname(t.file), { recursive: true });
      const ok = shell.writeShortcutLink(t.file, 'create', {
        target: electronExe,
        args: `"${WIN_DIR}"`,
        cwd: WIN_DIR,
        icon: ICON,
        iconIndex: 0,
        description: 'ClaudeTown - Claude Code 세션을 도트 맵으로 보는 뷰어',
        appUserModelId: APP_USER_MODEL_ID,  // 작업표시줄에서 Electron 이 아니라 이 앱으로 잡히게
      });
      console.log(`${ok ? '만듦 ' : '실패 '} ${t.label}: ${t.file}`);
    }
    console.log(`설치 완료: ${WIN_DIR}`);
    app.exit(0);
  } catch (err) {
    console.error('설치 실패:', err.message);
    app.exit(1);
  }
});
