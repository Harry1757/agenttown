'use strict';

// ClaudeTown 데스크톱 셸. 창은 하나뿐이고 하는 일도 하나뿐이다 - WSL 안의
// claudetown.py 를 띄우고(이미 떠 있으면 그대로 쓰고) 그 페이지를 보여준다.
//
// 서버는 WSL 쪽에만 있고(사용자의 ~/.claude/projects 를 읽는다), 이 앱은
// Windows 쪽 실행 파일이다 - 시작 메뉴 바로가기·작업표시줄 고정·트레이가
// 전부 Windows 쉘 기능이라 그렇다. 그래서 서버 기동/종료는 새로 짜지 않고
// launch.sh 를 wsl.exe 로 그대로 불러 쓴다 (있으면 그대로 쓰고, 없으면 띄우고
// 응답할 때까지 기다리는 로직이 이미 거기 있다).

const path = require('node:path');
const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, Notification,
} = require('electron');

const execFileAsync = promisify(execFile);
const { fetchUsage, usageError } = require('./usage');

const PORT = 8765;
const APP_URL = `http://127.0.0.1:${PORT}`;
const ORIGIN = new URL(APP_URL).origin;


const ASSETS = path.join(__dirname, '..', 'assets');
const PRELOAD = path.join(__dirname, 'preload.js');
const ICON = path.join(ASSETS, process.platform === 'win32' ? 'claudetown.ico' : 'claudetown.png');

// 작업표시줄에 Electron 이 아니라 ClaudeTown 자신으로 잡히게 한다. 이걸 안 하면
// 여러 Electron 앱이 작업표시줄에서 한 덩어리로 묶이고, 고정도 엉뚱하게 된다.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.claudetown.app');
}

// 일부 환경(가상 GPU/드라이버 없는 세션)에서는 GPU 프로세스 초기화가 그냥
// 죽는다(FATAL). 이 앱은 정적 도트맵 하나 그리는 게 전부라 GPU 가속이 아쉬울
// 일이 없으니, 실패로 앱이 통째로 죽는 것보다는 소프트웨어 렌더링이 낫다.
app.disableHardwareAcceleration();

// ponytail: electron.exe 가 \\wsl.localhost\... 같은 UNC 경로에서 실행되면
// Chromium 의 OS 수준 프로세스 샌드박스(GPU/네트워크 헬퍼용 restricted
// token)가 자식 프로세스를 못 띄운다(재현 확인: 같은 바이너리를 로컬 NTFS
// 경로에서 돌리면 멀쩡하다). 정식 설치 경로는 tools/install.js 로
// %LOCALAPPDATA%\ClaudeTown 에 복사해 로컬 NTFS 에서 돌리는 것 - 거기서는
// 이 스위치가 필요 없다. `npm start` 로 저장소(WSL)에서 바로 띄우는 개발
// 경로에서만 여전히 UNC 라서, 그 경우에 한해서만 OS 샌드박스를 끈다.
// 렌더러 쪽 방어선(webPreferences.sandbox/contextIsolation/nodeIntegration:
// false, 아래 창 생성 부분)은 이 스위치와 무관하게 항상 켜져 있다.
if (/^\\\\/.test(__dirname)) {
  app.commandLine.appendSwitch('no-sandbox');
}

let win = null;
let tray = null;

function runWsl(cmd, timeout) {
  return execFileAsync('wsl.exe', ['-e', 'bash', '-lc', cmd], { windowsHide: true, timeout });
}

// ── 서버 ──────────────────────────────────────────────────────────────────
//
// 서버(claudetown.py)는 '세션 기록이 있는 쪽' 에서 돌아야 한다. 어느 쪽인지는
// 이 컴퓨터의 조합에 달렸다:
//
//   mac / linux         이 컴퓨터에서 바로. 기록도 여기 홈에 있다.
//   windows + 네이티브   이 컴퓨터에서 바로. 기록이 %USERPROFILE%\.claude 에 있다.
//   windows + WSL       wsl.exe 로 WSL 안에서. 기록을 \\wsl.localhost 로 넘겨 읽으면
//                       첫 스캔(실측 145MB)이 9P 브리지를 타서 느려진다.
//
// 예전에는 "저장소가 WSL 의 ~/projects/claudetown 에 있다" 를 전제로 launch.sh 를
// 불렀다. 남에게 넘기는 순간 그 전제가 깨진다 — 이제 앱이 직접 띄운다.

const SERVER_ARGS = ['--no-browser'];

// 기록이 한쪽에만 있는 게 아니다. 같은 컴퓨터에서
//   Claude Code (WSL 터미널)  -> WSL 홈
//   Claude 데스크톱 앱 / VSCode(Windows) -> Windows 홈
// 으로 갈려 들어간다(실측: entrypoint=claude-desktop 세션이 Windows 홈에만 있었다).
// 서버는 한 곳만 보고 있어서 반쪽만 나왔다 — 양쪽을 다 넘긴다.
// 서버는 CLAUDETOWN_ROOTS 를 os.pathsep 로 갈라 읽고, 없는 경로는 건너뛴다.
async function rootsFor(mode) {
  const winHome = process.platform === 'win32' ? app.getPath('home') : null;
  if (mode === 'wsl') {
    const roots = ['$HOME/.claude/projects'];
    try {
      const { stdout } = await runWsl(`wslpath -u '${String(winHome).replace(/'/g, "'\\''")}'`, 8000);
      const mnt = String(stdout).trim();
      if (mnt) roots.push(`${mnt}/.claude/projects`);
    } catch { /* Windows 쪽을 못 붙이면 WSL 것만 본다 */ }
    return roots.join(':');
  }
  const roots = [path.join(app.getPath('home'), '.claude', 'projects')];
  if (process.platform === 'win32') {
    try {
      // WSL 홈을 Windows 에서 볼 수 있는 UNC 경로로 물어본다(배포판·계정 이름을 몰라도 된다).
      const { stdout } = await runWsl('wslpath -w ~/.claude/projects', 8000);
      const unc = String(stdout).trim();
      if (unc) roots.push(unc);
    } catch { /* WSL 이 없거나 꺼져 있다 */ }
  }
  return roots.join(path.delimiter);
}

/** claudetown.py 가 있는 폴더. 배포본은 app/server, 개발 중에는 저장소 루트. */
function serverDir() {
  const cands = [
    path.join(__dirname, '..', 'server'),                     // 설치본 / 빌드본
    path.join(process.resourcesPath || '', 'server'),         // extraResources 로 담았을 때
    path.join(__dirname, '..', '..'),                         // 개발 중: 저장소 루트
  ];
  for (const d of cands) {
    if (d && fs.existsSync(path.join(d, 'claudetown.py'))) return d;
  }
  return path.join(__dirname, '..', '..');
}

// 어느 쪽 기록이 더 최근인지로 고른다. "있나 없나" 로 고르면 안 된다 — 실측으로
// Windows 홈에도 옛 .claude/projects 가 남아 있어서, 진짜 세션은 WSL 에 있는데도
// 네이티브를 골라 버렸다. 가장 최근에 쓴 쪽이 지금 쓰는 쪽이다.
function newestSessionAt(dir) {
  let best = 0;
  let projs;
  try { projs = fs.readdirSync(dir); } catch { return 0; }
  for (const d of projs) {
    let files;
    try { files = fs.readdirSync(path.join(dir, d)); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      try {
        const m = fs.statSync(path.join(dir, d, f)).mtimeMs;
        if (m > best) best = m;
      } catch { /* 사라진 파일 */ }
    }
  }
  return best;
}

function nativeNewest() {
  return newestSessionAt(path.join(app.getPath('home'), '.claude', 'projects'));
}

async function wslNewest() {
  if (process.platform !== 'win32') return 0;
  try {
    const { stdout } = await runWsl(
      'ls -t ~/.claude/projects/*/*.jsonl 2>/dev/null | head -1 | xargs -r stat -c %Y', 8000);
    const sec = parseInt(String(stdout).trim(), 10);
    return Number.isFinite(sec) ? sec * 1000 : 0;
  } catch { return 0; }
}

/** Finder/Dock 으로 켠 앱은 PATH 가 /usr/bin:/bin:/usr/sbin:/sbin 뿐이다.
 *  로그인 셸(zsh 등)을 한 번 띄워서 사용자가 터미널에서 쓰는 진짜 PATH 를 받아 온다.
 *  홈브루·pyenv·conda·uv 처럼 자리가 제각각인 설치본까지 이걸로 한 번에 잡힌다.
 *  셸을 띄우는 값이 있어서 한 번만 구하고 재사용한다. */
let shellPathCache;
function loginShellPath() {
  if (shellPathCache !== undefined) return shellPathCache;
  shellPathCache = '';
  if (process.platform === 'win32') return shellPathCache;
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const MARK = '__CT_PATH__';
    // 셸 초기화 파일이 뭔가를 출력할 수 있으니 표식으로 감싸 두고 그 사이만 꺼낸다.
    const r = require('node:child_process').spawnSync(
      shell, ['-ilc', 'printf %s "' + MARK + '${PATH}' + MARK + '"'],
      { timeout: 8000, encoding: 'utf8' });
    const m = new RegExp(MARK + '(.*?)' + MARK, 's').exec(String(r.stdout || ''));
    if (m) shellPathCache = m[1].trim();
  } catch { /* 못 얻으면 빈 값으로 두고 아래 고정 목록에 기댄다 */ }
  return shellPathCache;
}

/** 맥에서 파이썬이 실제로 깔려 있는 자리들.
 *  Finder/Dock 으로 켠 앱은 PATH 가 /usr/bin:/bin:/usr/sbin:/sbin 뿐이라
 *  홈브루(/opt/homebrew/bin)에 깐 python3 가 이름만으로는 안 잡힌다.
 *  그래서 이름 대신 전체 경로로도 두들겨 본다. */
function macPythonPaths() {
  const home = require('node:os').homedir();
  const out = [
    '/opt/homebrew/bin/python3',   // 홈브루 (애플 실리콘)
    '/usr/local/bin/python3',      // 홈브루 (인텔 맥)
    '/usr/bin/python3',            // 맥 기본 - Xcode 명령줄 도구를 깔아야 생긴다
    '/Library/Frameworks/Python.framework/Versions/Current/bin/python3', // python.org 설치본
    path.join(home, '.pyenv/shims/python3'),
    path.join(home, '.local/bin/python3'),
    path.join(home, 'miniconda3/bin/python3'),
    path.join(home, 'anaconda3/bin/python3'),
  ];
  // 로그인 셸 PATH 에 들어 있는 폴더도 전부 후보로 넣는다.
  const dirs = ['/opt/homebrew/bin', '/usr/local/bin',
    ...loginShellPath().split(path.delimiter).filter(Boolean)];
  for (const d of loginShellPath().split(path.delimiter).filter(Boolean)) {
    out.push(path.join(d, 'python3'));
  }
  // python3 링크 없이 python3.12 처럼 버전이 붙은 이름만 있는 경우까지 훑는다.
  for (const dir of dirs) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/^python3(\.\d+)?$/.test(f)) out.push(path.join(dir, f));
      }
    } catch { /* 없는 폴더는 건너뛴다 */ }
  }
  return [...new Set(out)];
}

/** 쓸 수 있는 파이썬. 없으면 null.
 *  Windows 의 'python' 은 파이썬이 없어도 스토어로 보내는 껍데기가 잡히므로,
 *  종료 코드만 보지 않고 출력에 'Python' 이 들어있는지까지 확인한다. */
function findPython() {
  const cands = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []],
       ...(process.platform === 'darwin' ? macPythonPaths().map((p) => [p, []]) : [])];
  for (const [cmd, pre] of cands) {
    try {
      const r = require('node:child_process').spawnSync(cmd, [...pre, '--version'],
        { windowsHide: true, timeout: 5000, encoding: 'utf8' });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      if (r.status === 0 && /Python\s+3/i.test(out)) return { cmd, pre };
    } catch { /* 다음 후보 */ }
  }
  return null;
}

async function isUp() {
  try {
    const res = await fetch(`${APP_URL}/`, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch { return false; }
}

let serverProc = null;
let serverMode = null;      // 'native' | 'wsl' | 'already'

async function startServer() {
  if (await isUp()) { serverMode = 'already'; return; }   // 누가 이미 띄워 뒀다

  const dir = serverDir();
  const script = path.join(dir, 'claudetown.py');
  if (!fs.existsSync(script)) throw new Error(`서버 파일을 못 찾았습니다: ${script}`);

  // 최근에 쓴 쪽부터 시도한다. 한쪽에 파이썬이 없으면 다음 후보로 넘어간다 —
  // 실측으로 이 컴퓨터의 Windows 에는 파이썬이 아예 없었다(스토어 껍데기만).
  const cands = [{ mode: 'native', at: nativeNewest() }];
  const wslAt = await wslNewest();
  if (wslAt) cands.push({ mode: 'wsl', at: wslAt });
  cands.sort((a, b) => b.at - a.at);

  const tried = [];
  for (const c of cands) {
    try {
      if (c.mode === 'wsl') await spawnInWsl(script);
      else await spawnNative(dir, script);
    } catch (e) {
      tried.push(`${c.mode}: ${e.message}`);
      continue;
    }
    if (await waitUp()) return;
    await stopServer();
    tried.push(`${c.mode}: 서버가 응답하지 않음`);
  }
  throw new Error(tried.join('\n') || '띄울 방법을 못 찾았습니다');
}

/** Finder 로 켠 앱의 PATH 는 아주 짧다. 파이썬이 안에서 부르는 도구들(git 등)도
 *  찾아야 하니, 흔한 자리를 앞에 붙여 준다. */
function enrichedPath() {
  const home = require('node:os').homedir();
  const extra = process.platform === 'darwin'
    ? [...loginShellPath().split(path.delimiter).filter(Boolean),
       '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local/bin')]
    : [];
  const cur = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return [...new Set([...extra, ...cur])].join(path.delimiter);
}

async function spawnNative(dir, script) {
  const py = findPython();
  if (!py) {
    throw new Error('파이썬 3 을 못 찾았습니다 (python3 / python / py -3)'
      + (process.platform === 'darwin'
        ? '\n찾아본 자리: ' + macPythonPaths().join(', ')
        : ''));
  }
  const roots = await rootsFor('native');
  serverProc = spawn(py.cmd, [...py.pre, script, ...SERVER_ARGS],
    { cwd: dir, windowsHide: true,
      env: { ...process.env, PATH: enrichedPath(), CLAUDETOWN_ROOTS: roots } });
  serverMode = 'native';
  watch();
}

async function spawnInWsl(script) {
  // 스크립트는 Windows 파일이라 WSL 쪽 경로로 바꿔 준다.
  const { stdout } = await runWsl(`wslpath -u '${script.replace(/'/g, "'\\''")}'`, 8000);
  const inWsl = String(stdout).trim();
  if (!inWsl) throw new Error('WSL 이 앱 경로를 못 읽습니다');
  const roots = await rootsFor('wsl');
  // 작은따옴표로 감싸면 $HOME 이 안 펴진다(그러면 WSL 쪽 기록을 통째로 놓친다).
  // 큰따옴표를 써서 셸이 펴게 하고, 경로에 공백이 있어도 안전하게 한다.
  serverProc = spawn('wsl.exe', ['-e', 'bash', '-lc',
    `CLAUDETOWN_ROOTS="${roots}" exec python3 '${inWsl}' ${SERVER_ARGS.join(' ')}`],
    { windowsHide: true });
  serverMode = 'wsl';
  watch();
}

let serverErr = '';
function watch() {
  serverErr = '';
  if (serverProc.stderr) serverProc.stderr.on('data', (d) => { serverErr += d; });
  serverProc.on('exit', () => { serverProc = null; });
}

async function waitUp() {
  for (let i = 0; i < 50; i++) {          // 25초까지
    if (await isUp()) return true;
    if (!serverProc) return false;        // 먼저 죽었다
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function stopServer() {
  if (serverMode === 'already') return;          // 우리가 띄운 게 아니면 건드리지 않는다
  if (serverProc) { try { serverProc.kill(); } catch { /* 이미 죽었다 */ } }
  if (serverMode === 'wsl') {
    // wsl.exe 를 죽여도 그 안의 python 이 남을 수 있다. 우리가 띄운 것만 골라 끝낸다.
    try { await runWsl("pkill -f 'python3 .*claudetown\\.py --no-browser'", 8000); } catch { /* 이미 없다 */ }
  }
}

// ── 사용량(5시간·7일 한도) ─────────────────────────────────────────────────
//
// /usage 가 부르는 자리를 그대로 부른다(app/src/usage.js). 사람이 명령을 칠 때
// 한 번 부르라고 있는 자리라 자주 두드리지 않는다 — 5분에 한 번이면 한도 막대가
// 눈에 띄게 뒤처지지 않으면서도 예의에 어긋나지 않는다.
const USAGE_POLL_MS = 5 * 60 * 1000;
let usageCache = null;

async function refreshUsage() {
  const fresh = await fetchUsage();
  if (fresh) usageCache = fresh;      // 실패하면 직전 값을 그대로 둔다
  return usageCache;
}

// 실패 이유도 같이 넘긴다. 조용히 숨기면 "막대가 안 보인다" 는 신고가 왔을 때
// 토큰이 없는 건지 요청이 막힌 건지 가릴 수가 없다.
ipcMain.handle('usage:get', () => ({
  windows: usageCache ? usageCache.windows : null,
  at: usageCache ? usageCache.at : null,
  error: usageCache ? null : usageError(),
}));

// ── Claude 앱의 채팅/Cowork 대화 ──────────────────────────────────────────
//
// 이 대화들은 트랜스크립트를 남기지 않는다 - 앱 패키지 폴더 전체에 .jsonl 이
// 하나도 없고, 내용은 claude.ai IndexedDB 와 서버 쪽에 있다. 그래서 서버가 알
// 길이 없어, 앱 껍데기의 접근성 트리에서 직접 읽어 온다.
//
// 알고 쓰는 한계 셋:
//  - 사이드바는 '고른 상위 탭' 의 목록만 보여준다(실측: 교차 노출 0건). 그래서
//    채팅 탭일 때만 읽고, 아닐 때는 직전 목록을 그대로 둔다 - 안 그러면 탭을
//    옮길 때마다 캐릭터가 우르르 사라졌다 나타난다.
//  - 토큰도 도구도 작업 폴더도 없다. 제목과 실행 중/유휴뿐이다.
//  - 접근성 트리를 계속 물으면 Claude 앱의 a11y 모드가 켜진 채로 남는다. 그래서
//    우리 창이 보일 때만 묻는다(트레이로 숨으면 아무도 안 보고 있다).
const DESKTOP_POLL_MS = 20000;
let desktopCache = { at: 0, partial: false, items: [] };

// 대화 한 줄을 어떻게 알아보는가. 이름만으로는 못 가린다 - 사이드바에는 내비게이션
// 단추도 프로젝트 단추도 섞여 있다. 대신 구조를 쓴다:
//
//   Button (1928,338) 실행 중 toss 기술              <- 대화
//   Button (2171,341) toss 기술에 대한 더 많은 옵션   <- 같은 줄의 '...' 단추
//
// 대화 줄에는 항상 같은 y 에 '더 많은 옵션' 단추가 딸려 있고, 그 이름은 제목으로
// 시작한다. 그래서 '대화 이름의 어떤 접미사가 옆 단추 이름의 접두사인가' 를 찾으면
// 제목이 정확히 떨어진다 - 문구를 하나도 안 박아도 되니 UI 언어가 바뀌어도 산다.
// 앞에 남는 조각이 상태다('실행 중' / '유휴').
//
// 실행 중 여부는 같은 줄의 StatusBar 로 본다(유휴 줄은 Image 다). 이것도 문구가
// 아니라 구조다.
function psDesktopList() {
  return `
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @"
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;
public class CD {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static IntPtr AppWin(HashSet<uint> pids) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid)) return true;
      var c = new StringBuilder(256); GetClassNameW(h, c, 256);
      if (c.ToString() != "Chrome_WidgetWin_1") return true;
      if (GetWindowTextLength(h) == 0) return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }
  public static List<IntPtr> Renderers(IntPtr h) {
    var l = new List<IntPtr>();
    EnumChildWindows(h, delegate(IntPtr c, IntPtr p) {
      var n = new StringBuilder(256); GetClassNameW(c, n, 256);
      if (n.ToString() == "Chrome_RenderWidgetHostHWND") l.Add(c);
      return true;
    }, IntPtr.Zero);
    return l;
  }
}
"@
$pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
Get-Process claude -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
if ($pids.Count -eq 0) { Write-Output 'NOAPP'; exit }
$h = [CD]::AppWin($pids)
if ($h -eq [IntPtr]::Zero) { Write-Output 'NOWIN'; exit }

$AE = [System.Windows.Automation.AutomationElement]
$btn = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
$bar = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::StatusBar)
$cond = New-Object System.Windows.Automation.OrCondition($btn, $bar)

# Chromium 은 접근성 클라이언트가 붙는 걸 보고서야 트리를 만든다. 탭을 막 옮긴
# 직후에는 렌더러가 갈려 트리가 다시 비어 있기도 하다 - 몇 번 더 본다.
function Snap($h, $AE, $cond) {
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($rh in [CD]::Renderers($h)) {
    try {
      $rel = $AE::FromHandle($rh)
      foreach ($e in $rel.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) {
        $nm = [string]$e.Current.Name
        if (-not $nm) { continue }
        $r = $e.Current.BoundingRectangle
        $inv = $null
        $rows.Add([pscustomobject]@{
          Name = $nm
          IsBar = ($e.Current.ControlType.Id -eq [System.Windows.Automation.ControlType]::StatusBar.Id)
          HasInv = $e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)
          X = [int]$r.X
          Y = [int]$r.Y
        })
      }
    } catch { }
  }
  return $rows
}
$rows = Snap $h $AE $cond
for ($try = 0; $try -lt 5 -and $rows.Count -le 5; $try++) {
  Start-Sleep -Milliseconds 350
  $rows = Snap $h $AE $cond
}
if ($rows.Count -le 5) { Write-Output 'NOTREE'; exit }

# 사이드바를 접었나. 상위 탭 단추('Code')는 사이드바 안에 있어서, 접으면 탭
# 단추도 대화 목록도 트리에서 통째로 사라진다(실측: 접힌 상태에서 항목 0개).
# 그때는 상단 제목 단추로 '지금 열어 둔 대화' 하나만 알 수 있다.
$hasTabs = $false
foreach ($r in $rows) { if ($r.Name -eq 'Code' -or $r.Name -like 'Code,*') { $hasTabs = $true; break } }

if ($hasTabs) {
  # 어느 상위 탭을 보고 있나. 탭 단추 이름으로는 못 가린다 - 뒤에 붙는 ', 작업 중'
  # 은 '안 고른 탭' 표시가 아니라 그냥 상태 배지라, 상태가 없으면 고른 탭에도 안
  # 붙는다(실측으로 이걸로 판별했다가 Code 탭을 채팅 탭으로 잘못 읽었다).
  #
  # 대신 Code 탭에만 있는 것을 본다: 프로젝트마다 붙는 'New session in <이름>'
  # 단추다. 한국어 UI 에서도 이 문구는 영어로 나온다(실측).
  $onCode = $false
  foreach ($r in $rows) { if ($r.Name -like '*New session*') { $onCode = $true; break } }
  if ($onCode) { Write-Output 'TAB code'; exit }
  Write-Output 'TAB chat'
} else {
  # 접힌 상태. 어느 탭인지 알 수 없으니 'partial' 로 알린다 - 받는 쪽은 이걸로
  # 목록을 지우지 않는다(Code 탭이었을 수도 있어서, 화면 쪽이 제목을 한 번 더
  # 걸러낸다).
  Write-Output 'TAB partial'
  # 상단 제목 단추 짝: '<제목>, <이름 바꾸기>' 와 '<제목>에 대한 더 많은 옵션'.
  # 사이드바 줄과 같은 규칙(같은 줄의 못 누르는 단추)이되, 제목이 앞에 온다.
  foreach ($b in $rows) {
    if (-not $b.HasInv -or $b.IsBar) { continue }
    $opt = $null
    foreach ($o in $rows) {
      if ($o.HasInv -or $o.IsBar) { continue }
      if ([Math]::Abs($o.Y - $b.Y) -le 8 -and $o.X -gt $b.X) { $opt = $o; break }
    }
    if (-not $opt) { continue }
    # 둘의 가장 긴 공통 접두사가 제목이다. 쉼표를 기준으로 자르지 않는 까닭은
    # 제목 안에 쉼표가 들어갈 수 있어서다.
    $n = [Math]::Min($b.Name.Length, $opt.Name.Length)
    $len = 0
    while ($len -lt $n -and $b.Name[$len] -eq $opt.Name[$len]) { $len++ }
    if ($len -lt 2 -or $len -ge $b.Name.Length) { continue }
    $title = $b.Name.Substring(0, $len).TrimEnd(',', ' ')
    if (-not $title) { continue }
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($title))
    Write-Output ("ITEM idle open " + $b64)
  }
  exit
}

foreach ($b in $rows) {
  if (-not $b.HasInv -or $b.IsBar) { continue }
  # 같은 줄의 '더 많은 옵션' 단추(누를 수 없는 단추)를 찾는다.
  $opt = $null
  foreach ($o in $rows) {
    if ($o.HasInv -or $o.IsBar) { continue }
    if ([Math]::Abs($o.Y - $b.Y) -le 8 -and $o.X -gt $b.X) { $opt = $o; break }
  }
  if (-not $opt) { continue }
  # 제목 = 대화 이름의 접미사 중 옵션 단추 이름의 접두사인 가장 긴 것.
  # k 를 1 부터 보는 까닭: 앞에 상태 조각이 반드시 있다(k=0 이면 상태가 없는
  # 다른 단추다 - '프로젝트'/'프로젝트 생성' 같은 짝이 걸리는 걸 막는다).
  $title = ''
  for ($k = 1; $k -lt $b.Name.Length - 1; $k++) {
    $suf = $b.Name.Substring($k)
    if ($suf.Length -lt 2) { break }
    if ($opt.Name.StartsWith($suf)) { $title = $suf; break }
  }
  if (-not $title) { continue }
  $run = $false
  foreach ($s in $rows) { if ($s.IsBar -and [Math]::Abs($s.Y - $b.Y) -le 10) { $run = $true; break } }
  # 지금 열어 둔 대화인가. 본문 쪽 제목 단추가 '<제목>, <이름 바꾸기>' 라, 제목
  # 뒤에 쉼표가 붙은 단추가 있으면 그게 열려 있는 것이다. 사이드바 항목은 앞에
  # 상태가 붙어 있고, 옵션 단추는 쉼표가 아니라 다른 말이 붙어 안 걸린다.
  $open = $false
  foreach ($o in $rows) { if ($o.Name.StartsWith($title + ',')) { $open = $true; break } }
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($title))
  Write-Output ("ITEM " + $(if ($run) { 'run' } else { 'idle' }) + " " + $(if ($open) { 'open' } else { 'shut' }) + " " + $b64)
}
`;
}

function readDesktopChats() {
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psDesktopList()],
      { windowsHide: true, timeout: 15000, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return resolve(null);
        const lines = String(stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // 채팅 탭이 아니면 갱신하지 않는다. 사이드바를 접었을 땐(partial) 열어 둔
        // 대화 하나만 알 수 있으니, 목록을 지우지 말라고 표시해서 넘긴다.
        const partial = lines.includes('TAB partial');
        if (!partial && !lines.includes('TAB chat')) return resolve(null);
        const items = [];
        for (const l of lines) {
          const m = /^ITEM (run|idle) (open|shut) (\S+)$/.exec(l);
          if (!m) continue;
          const title = Buffer.from(m[3], 'base64').toString('utf8').trim();
          if (title) items.push({ title, running: m[1] === 'run', open: m[2] === 'open' });
        }
        resolve({ items, partial });
      });
  });
}

async function refreshDesktopChats() {
  if (process.platform !== 'win32') return;
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  const got = await readDesktopChats();
  if (got) desktopCache = { at: Date.now(), partial: got.partial, items: got.items };
}

ipcMain.handle('desktop:get', () => desktopCache);

// ── 세션 창으로 이동 ───────────────────────────────────────────────────────

// 트랜스크립트에는 창 핸들도 PID 도 없다. 있는 건 프로젝트 이름과 진입점뿐이라
// 창 '제목' 으로 찾는 수밖에 없다. 그래서 창 단위까지만 간다 — VSCode 안의 특정
// 탭이나 터미널 탭까지는 못 간다. 검색어(프로젝트 폴더명)는 화면 쪽에서 만들어 준다
// (슬러그를 사람이 읽는 이름으로 바꾸는 규칙이 거기 이미 있다).

// 창을 EnumWindows 로 전부 훑는다. Get-Process 의 MainWindowTitle 은 프로세스당
// 창 하나만 내주는데, VSCode 창을 둘 띄우면 한쪽이 아예 안 보였다(실측).
//
// 검색어를 여러 개 받는다:
//   title   세션 제목 — Claude Code 가 터미널 창 제목으로 걸어준다
//   terms   프로젝트 폴더 이름 후보들(긴 것부터) — VSCode 창 제목에 들어간다
//
// 폴더 이름을 하나로 못 정하는 이유: 슬러그는 경로 구분자와 이름 속 하이픈이
// 똑같이 '-' 로 뭉개져 있어 복원이 불가능하다. 예전엔 이 컴퓨터의 경로 규칙
// ('-home-pc-' 벗기기)을 박아 뒀는데, 남의 컴퓨터에서는 슬러그 모양이 달라
// 어떤 창에도 안 걸렸다(팀원 신고). 그래서 후보를 여러 개 대보고 가장 긴 일치를
// 고른다.
//
// 그리고 SetForegroundWindow 는 '지금 앞에 있는 프로세스' 가 아니면 윈도우가
// 막는다(작업표시줄만 깜빡인다). 입력 스레드를 잠깐 붙였다 떼는 고전적인 우회를
// 쓰고, 마지막에 GetForegroundWindow 로 진짜 넘어갔는지 확인해서 결과를 나눈다 —
// 예전엔 호출만 하고 무조건 OK 라고 답해서 실패를 실패로 못 봤다.
function psFocus(terms, title, entry, selfPid) {
  const clean = (v) => String(v || '').replace(/[^\p{L}\p{N}._\- ]/gu, '').trim();
  const list = (Array.isArray(terms) ? terms : [terms]).map(clean).filter(Boolean);
  // 한글이 든 문자열은 base64 로 실어 보낸다. 인자로 그냥 넘기거나 .ps1 파일에
  // 적으면 코드페이지를 타며 깨진다(실측: 한글 -like 패턴이 통째로 망가져 아무것도
  // 못 찾았다. PowerShell 5.1 은 BOM 없는 UTF-8 파일도 못 읽는다).
  const b64 = (v) => Buffer.from(String(v || ''), 'utf8').toString('base64');
  const psArr = list.length ? list.map((t) => `'${b64(t)}'`).join(',') : "''";
  const t = b64(clean(title));
  const wantCode = entry === 'claude-vscode' ? '$true' : '$false';
  // 데스크톱 앱 세션은 터미널도 VSCode 도 아니다 — Claude 앱 창 자체가 목적지다.
  const wantDesktop = String(entry || '').startsWith('claude-desktop') ? '$true' : '$false';
  // 상위 탭 이름. Code 세션은 'Code' 단추, 채팅/Cowork 대화는 그 옆 단추다.
  // 단추 이름은 UI 언어를 타므로 Code 만 문구로 짚고, 채팅 쪽은 '같은 줄의 다른
  // 단추' 로 구조에서 찾는다.
  const wantChatTab = entry === 'claude-desktop-chat' ? '$true' : '$false';
  return `
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type @"
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;
public class WE {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  public static List<object[]> List() {
    var res = new List<object[]>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      int n = GetWindowTextLength(h); if (n == 0) return true;
      var sb = new StringBuilder(n + 1); GetWindowText(h, sb, sb.Capacity);
      uint pid; GetWindowThreadProcessId(h, out pid);
      res.Add(new object[] { h, sb.ToString(), pid }); return true;
    }, IntPtr.Zero);
    return res;
  }
  // 다른 프로세스 창을 앞으로 끌어오는 고전 우회: 지금 앞에 있는 창의 입력
  // 스레드에 잠깐 붙어서 권한을 빌린 뒤 떼어낸다.
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  // Electron 앱의 내용은 최상위 창이 아니라 자식 렌더러 창의 접근성 트리에 있다.
  // 렌더러 창은 하나가 아니다 — 실측으로 둘이었고 첫 번째는 요소가 1개뿐인 빈
  // 창이었다(그걸 잡는 바람에 아무것도 못 찾았다). 전부 돌려주고 부르는 쪽이
  // 내용이 있는 것을 고른다.
  public static List<IntPtr> Renderers(IntPtr p) {
    var found = new List<IntPtr>();
    EnumChildWindows(p, (h, l) => {
      var sb = new StringBuilder(128); GetClassName(h, sb, 128);
      if (sb.ToString().Contains("RenderWidget")) { found.Add(h); }
      return true; }, IntPtr.Zero);
    return found; }
  public static bool Raise(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    IntPtr fg = GetForegroundWindow();
    uint fgPid; uint fgThread = GetWindowThreadProcessId(fg, out fgPid);
    uint me = GetCurrentThreadId();
    bool attached = (fgThread != 0 && fgThread != me) && AttachThreadInput(me, fgThread, true);
    BringWindowToTop(h);
    bool ok = SetForegroundWindow(h);
    if (attached) AttachThreadInput(me, fgThread, false);
    return ok;
  }
}
"@
function FromB64([string]$s) { if (-not $s) { return '' } return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)) }
# 제목이 늘 똑같지는 않다. 세션 제목은 '가디 주변 미용실 검색' 인데 앱 사이드바에는
# '가디 주변 미용실 찾기' 로 적혀 있는 식이다(실측). 끝 단어를 하나씩 떼면서 맞춰
# 본다 — 앞부분은 대개 같다. 두 단어(또는 여섯 글자) 밑으로는 내려가지 않는다.
function TitleCandidates([string]$t) {
  $out = @()
  if (-not $t) { return $out }
  $w = $t.Split(' ') | Where-Object { $_ }
  for ($n = $w.Count; $n -ge 1; $n--) {
    $c = ($w[0..($n-1)] -join ' ')
    if ($c.Length -ge 6 -or $n -ge 2) { $out += $c }
  }
  return $out
}
$terms = @(${psArr}) | ForEach-Object { FromB64 $_ }
$title = FromB64 '${t}'
$wantCode = ${wantCode}
$wantDesktop = ${wantDesktop}
$wantChatTab = ${wantChatTab}
$term = @('WindowsTerminal','wezterm-gui','wezterm','conhost','powershell','pwsh','cmd','alacritty','kitty')
$best = $null; $bestScore = 0
foreach ($w in [WE]::List()) {
  if ($w[2] -eq ${selfPid}) { continue }
  $wt = [string]$w[1]
  $pname = try { (Get-Process -Id $w[2] -ErrorAction Stop).ProcessName } catch { '' }
  $score = 0
  if ($title -and $wt -like "*$title*") { $score += 6 }
  for ($i = 0; $i -lt $terms.Count; $i++) {
    $cand = [string]$terms[$i]
    if ($cand -and $wt -like "*$cand*") { $score += (5 - $i); break }   # 긴 후보가 먼저 온다
  }
  # 데스크톱 앱은 제목/폴더가 안 맞아도 프로세스 이름만으로 확정할 수 있다.
  # 'Claude' 로 제목을 대면 우리 앱('ClaudeTown')까지 걸리므로 이름을 정확히 본다.
  $isDesktopApp = ($pname -eq 'claude')
  if ($wantDesktop -and $isDesktopApp) { $score += 8 }
  if ($score -eq 0) { continue }
  if ($wantCode -and $pname -eq 'Code') { $score += 2 }
  if (-not $wantCode -and -not $wantDesktop -and $term -contains $pname) { $score += 2 }
  if ($score -gt $bestScore) { $bestScore = $score; $best = @($w[0], $pname, $wt) }
}
if (-not $best) { Write-Output 'NOTFOUND'; exit }
$h = [IntPtr]$best[0]
[void][WE]::Raise($h)
Start-Sleep -Milliseconds 250

# Claude 앱의 단추를 모든 렌더러에서 모아 온다. 어느 렌더러에 사이드바가
# 있는지 정해져 있지 않아 하나만 보면 놓친다.
function ButtonsOf($h, $bcond) {
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($rh in [WE]::Renderers($h)) {
    try {
      $rel = [System.Windows.Automation.AutomationElement]::FromHandle($rh)
      foreach ($e in $rel.FindAll([System.Windows.Automation.TreeScope]::Descendants, $bcond)) { $list.Add($e) }
    } catch { }
  }
  return $list
}

# 사이드바에서 제목이 맞는 대화 단추를 고른다. 항목 이름에는 '유휴 <제목>' 처럼
# 상태가 앞에 붙으므로 '포함' 으로 맞춘다.
function PickConv($btns, $title) {
  foreach ($cand in (TitleCandidates $title)) {
    foreach ($b in $btns) {
      $nm = [string]$b.Current.Name
      if (-not $nm) { continue }
      # 'New session in ...' 과 '...에 대한 더 많은 옵션' 은 대화 자체가 아니다.
      if ($nm.Contains('New session') -or $nm.Length -gt ($cand.Length + 24)) { continue }
      if ($nm.Contains($cand)) { return $b }
    }
  }
  return $null
}

# 창까지 왔으면 탭도 짚어 본다. Windows Terminal 은 탭을 UI 자동화 트리에 내주고
# 탭 이름이 세션 제목과 같다(Claude Code 가 그렇게 걸어준다). 되는 데서만 하고,
# 안 되면 조용히 넘어간다 — 창 단위까지 온 것만으로도 쓸모가 있다.
$tabNote = ''
# Claude 데스크톱 앱: 대화 목록이 렌더러 창의 접근성 트리에 버튼으로 들어 있다.
# 최상위 창을 물으면 창 테두리(14개)만 나오고, Chrome_RenderWidgetHostHWND 를
# 물어야 내용(291개)이 나온다. 사이드바 항목 이름은 '유휴 <제목>' 처럼 상태가
# 앞에 붙으므로 '포함' 으로 맞춘다.
if ($title -and $wantDesktop) {
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
    $bcond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Button)
    # Chromium 은 접근성 클라이언트가 붙는 걸 보고서야 트리를 만든다. 첫 조회가
    # 비어 있을 수 있어 몇 번 다시 본다.
    #
    # 렌더러는 하나가 아니다 - 앱 껍데기(사이드바)와 대화 내용이 각각 다른
    # Chrome_RenderWidgetHostHWND 에 들어 있고, 어느 쪽이 먼저 걸리는지는 그때그때
    # 다르다(실측: 내용 쪽 330개, 사이드바 쪽 308개). 예전엔 내용이 있는 첫 번째
    # 렌더러 하나만 보고 그쳐서, 내용 쪽이 먼저 걸리면 사이드바를 통째로 놓쳤다.
    # 그래서 이제 모든 렌더러의 버튼을 합쳐서 본다.
    $btns = ButtonsOf $h $bcond
    for ($try = 0; $try -lt 6 -and $btns.Count -le 5; $try++) {
      Start-Sleep -Milliseconds 350
      $btns = ButtonsOf $h $bcond
    }
    $hit = PickConv $btns $title
    if (-not $hit -and $btns.Count -gt 5) {
      # 지금 보고 있는 상위 탭('채팅 및 Cowork' / 'Code')에 그 대화가 없다는 뜻이다.
      # 사이드바는 고른 탭의 목록만 보여주므로, 탭을 안 옮기면 영영 못 찾는다.
      # ClaudeTown 이 보여주는 데스크톱 세션은 전부 Code 탭 것이다 - 채팅과
      # Cowork 은 트랜스크립트를 남기지 않아 애초에 화면에 없다.
      #
      # 탭 단추 이름은 'Code' 또는 상태가 붙은 'Code, 작업 중' 이다. 먼저 찾아본
      # 뒤에야 탭을 건드리는 까닭은, 이미 맞는 탭에 있는 사람의 화면을 괜히
      # 옮기지 않기 위해서다.
      $codeTab = $null
      foreach ($b in $btns) {
        $nm = [string]$b.Current.Name
        if ($nm -eq 'Code' -or $nm -like 'Code,*') { $codeTab = $b; break }
      }
      $want = $codeTab
      if ($wantChatTab -and $codeTab) {
        # 채팅/Cowork 탭은 Code 단추와 같은 줄의 왼쪽 단추다. 이름('채팅 및
        # Cowork')은 UI 언어를 타므로 자리로 찾는다.
        $cr = $codeTab.Current.BoundingRectangle
        $want = $null
        foreach ($b in $btns) {
          $br = $b.Current.BoundingRectangle
          if ([Math]::Abs($br.Y - $cr.Y) -le 6 -and $br.X -lt $cr.X) { $want = $b; break }
        }
      }
      if ($want) {
        $inv = $null
        if ($want.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
          $inv.Invoke(); Start-Sleep -Milliseconds 600
        }
      }
      $btns = ButtonsOf $h $bcond
      $hit = PickConv $btns $title
    }
    if ($hit) {
      $inv = $null
      if ($hit.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
        $inv.Invoke(); $tabNote = ' [TAB]'
      }
    }
  } catch { $tabNote = '' }
}
if ($title -and $best[1] -eq 'WindowsTerminal') {
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
    $el = [System.Windows.Automation.AutomationElement]::FromHandle($h)
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::TabItem)
    $cands = TitleCandidates $title
    foreach ($t in $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)) {
      $tn = [string]$t.Current.Name
      $hit = $false
      foreach ($c in $cands) { if ($tn.Contains($c)) { $hit = $true; break } }
      if ($hit) {
        $pat = $null
        if ($t.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pat)) {
          $pat.Select(); $tabNote = ' [TAB]'
        }
        break
      }
    }
  } catch { $tabNote = '' }
}

if ([WE]::GetForegroundWindow() -eq $h) {
  Write-Output ('OK ' + $best[1] + ' :: ' + $best[2] + $tabNote)
} else {
  Write-Output ('NOFOCUS ' + $best[1] + ' :: ' + $best[2])
}
`;
}

// 맥: 창 제목으로 골라 올리려면 System Events 를 거쳐야 하고 손쉬운 사용 권한이
// 필요하다. 권한이 없으면 그 앱을 앞으로 부르는 것까지만 한다 — 창 단위 조준은
// 못 해도 "그 앱으로 간다" 는 되니까. (이 컴퓨터가 윈도우라 실기기 확인은 못 했다.)
function osaFocus(terms, title, entry, selfPid) {
  // 찾을 말들. 세션 제목이 제일 정확하다 — Claude Code 가 터미널 탭 제목으로
  // 그대로 걸어주기 때문이다(실측: custom title = "◐ 마이그레이션 파일 확인").
  // 폴더 이름은 VSCode 창 제목에 들어가므로 뒤에 붙인다.
  const list = [title, ...terms].filter(Boolean)
    .map((t) => String(t).replace(/["\\]/g, ''))
    .filter(Boolean);
  const asList = `{${list.map((t) => `"${t}"`).join(', ')}}`;
  const appName = entry === 'claude-vscode' ? 'Visual Studio Code'
                : entry === 'claude-desktop' ? 'Claude'
                : 'Terminal';
  // 터미널 세션이면 터미널 앱의 사전을 직접 쓴다. System Events 로 창을 훑는
  // 길은 '보조 접근'(손쉬운 사용) 권한을 요구하는데, 권한이 없으면 -1728 로
  // 죽는다 — 예전에는 그 실패를 try 가 삼키고 앱만 앞으로 가져온 뒤 "OK" 라고
  // 답했다(그래서 "위치를 못 찾는다"). 앱 사전을 쓰면 권한이 필요 없고,
  // 덤으로 창이 아니라 **탭**까지 정확히 갈 수 있다.
  const terminalFirst = appName === 'Terminal';
  return `
on run
  set theTerms to ${asList}
  set selfPid to ${Number(selfPid) || 0}

  if ${terminalFirst ? 'true' : 'false'} then
    -- Terminal.app: 탭마다 custom title 이 있다. 권한 없이 읽힌다.
    try
      if application "Terminal" is running then
        tell application "Terminal"
          repeat with w in windows
            repeat with t in tabs of w
              set ct to ""
              try
                set ct to custom title of t
              end try
              set wn to ""
              try
                set wn to name of w
              end try
              repeat with q in theTerms
                if ct contains q or wn contains q then
                  set selected of t to true
                  set index of w to 1
                  activate
                  return "OK Terminal :: " & ct & " [TAB]"
                end if
              end repeat
            end repeat
          end repeat
        end tell
      end if
    end try

    -- iTerm2 도 같은 모양으로 훑는다. 이 컴퓨터엔 없어서 확인해 보지 못했다 —
    -- 실패하면 조용히 다음으로 넘어간다.
    try
      if application "iTerm2" is running then
        tell application "iTerm2"
          repeat with w in windows
            repeat with t in tabs of w
              repeat with ss in sessions of t
                set sn to ""
                try
                  set sn to name of ss
                end try
                repeat with q in theTerms
                  if sn contains q then
                    select w
                    select t
                    select ss
                    activate
                    return "OK iTerm2 :: " & sn & " [TAB]"
                  end if
                end repeat
              end repeat
            end repeat
          end repeat
        end tell
      end if
    end try
  end if

  -- 앱 사전이 없는 쪽(VSCode, Claude 데스크톱)은 창 제목으로 훑는 수밖에 없다.
  -- 여기서만 '보조 접근' 권한이 필요하다.
  set permBlocked to false
  try
    tell application "System Events"
      repeat with pr in (every process whose background only is false)
        set isSelf to false
        try
          if (unix id of pr) is selfPid then set isSelf to true
        end try
        if isSelf then
          -- 우리 창이다. 여기로 오면 제자리걸음이라 건너뛴다.
        else
        repeat with w in (every window of pr)
          set wn to ""
          try
            set wn to name of w
          end try
          repeat with q in theTerms
            if wn contains q then
              set frontmost of pr to true
              perform action "AXRaise" of w
              return "OK " & (name of pr) & " :: " & wn
            end if
          end repeat
        end repeat
        end if
      end repeat
    end tell
  on error errMsg number errNum
    if errNum is -1728 then set permBlocked to true
  end try

  if permBlocked then return "NOPERM"

  -- 창을 못 찾았다. 앱만 앞으로 가져오되, 찾았다고 말하지 않는다.
  try
    if application "${appName}" is running then
      tell application "${appName}" to activate
      return "APPONLY ${appName}"
    end if
  end try
  return "NOTFOUND"
end run`;
}

async function focusWindow(terms, title, entry) {
  const list = (Array.isArray(terms) ? terms : [terms]).filter(Boolean);
  if (!list.length && !title) return { ok: false, reason: '찾을 단서가 없다' };
  try {
    let out;
    if (process.platform === 'win32') {
      const r = await execFileAsync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psFocus(list, title, entry, process.pid)],
        { windowsHide: true, timeout: 10000, maxBuffer: 1 << 20 });
      out = String(r.stdout).trim();
    } else if (process.platform === 'darwin') {
      const r = await execFileAsync('osascript', ['-e', osaFocus(list, title, entry, process.pid)],
        { timeout: 10000, maxBuffer: 1 << 20 });
      out = String(r.stdout).trim();
    } else {
      return { ok: false, reason: '이 운영체제에서는 창 이동을 아직 지원하지 않는다' };
    }
    if (out.startsWith('OK')) {
      const detail = out.slice(3).replace(' [TAB]', '');
      return { ok: true, detail, tab: out.includes('[TAB]') };
    }
    // 창은 찾았는데 윈도우가 포커스 이동을 막은 경우와, 아예 못 찾은 경우를 나눈다.
    if (out.startsWith('NOFOCUS')) {
      return { ok: false, reason: `창은 찾았는데 앞으로 못 옴 (작업표시줄에서 깜빡일 것) — ${out.slice(8)}` };
    }
    if (out === 'NOPERM') {
      return { ok: false, reason: '창 목록을 못 읽는다 — 시스템 설정 > 개인정보 보호와 보안 > 손쉬운 사용에서 ClaudeTown 을 켜라' };
    }
    if (out.startsWith('APPONLY')) {
      return { ok: false, reason: `제목이 맞는 창이 없어 ${out.slice(8)} 앱만 앞으로 가져왔다` };
    }
    return { ok: false, reason: `제목이 맞는 창이 없음 (찾은 말: ${[title, ...list].filter(Boolean).join(', ')})` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

ipcMain.handle('focus-session', (_e, { terms, title, entry }) => focusWindow(terms, title, entry));

// 세션이 답을 마쳐 내 차례가 되면 알린다. 이 앱을 다른 창 뒤에 켜 두는 이유가
// 그거라, 화면을 안 보고 있어도 놓치지 않게 하는 게 핵심 기능이다.
// 알림을 누르면 그 세션 창으로 바로 간다.
ipcMain.handle('notify-waiting', (_e, { label, title, terms, entry, kind }) => {
  if (!Notification.isSupported()) return { ok: false };
  const n = new Notification({
    title: kind === 'ask' ? `${label} — 질문/승인 대기` : `${label} — 응답 대기`,
    body: title || '턴이 끝났습니다',
    icon: ICON,
  });
  n.on('click', () => { focusWindow(terms, title, entry); });
  n.show();
  return { ok: true };
});

// 트레이 툴팁에 대기 인원을 얹는다 — 아이콘만 봐도 알 수 있게.
ipcMain.on('waiting-count', (_e, count) => {
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(count > 0 ? `ClaudeTown — 응답 대기 ${count}` : 'ClaudeTown');
  }
});


// ── 창 ────────────────────────────────────────────────────────────────────

function isOwnOrigin(target) {
  try {
    return new URL(target).origin === ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    icon: ICON,
    webPreferences: {
      preload: PRELOAD,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // 사용자의 transcript 에서 나온 텍스트가 화면에 그대로 나간다 - 이 창이
  // 127.0.0.1:8765 말고 다른 곳으로 튀거나 새 창을 열 방법은 없어야 한다.
  win.webContents.on('will-navigate', (e, target) => {
    if (!isOwnOrigin(target)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 창의 X 는 끄는 게 아니라 트레이로 숨긴다. 진짜 종료는 트레이 메뉴로만.
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });

  win.loadURL(APP_URL);
}

function showWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ── 트레이 ────────────────────────────────────────────────────────────────

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '열기', click: () => showWindow() },
    {
      label: '항상 위',
      type: 'checkbox',
      checked: !!(win && !win.isDestroyed() && win.isAlwaysOnTop()),
      click: (item) => {
        if (win && !win.isDestroyed()) win.setAlwaysOnTop(item.checked);
        refreshTrayMenu();
      },
    },
    {
      // "알림이 안 온다" 는 신고가 앱 문제인지 윈도우 알림 설정 문제인지 가르는
      // 가장 빠른 방법이다. 이게 안 뜨면 앱이 아니라 윈도우 쪽(집중 지원, 앱별
      // 알림 끔)을 봐야 한다.
      label: '알림 테스트',
      click: () => {
        if (!Notification.isSupported()) {
          dialog.showErrorBox('알림', '이 시스템에서는 알림을 지원하지 않습니다.');
          return;
        }
        new Notification({ title: 'ClaudeTown — 알림 테스트', body: '이게 보이면 알림은 정상입니다.', icon: ICON }).show();
      },
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}

function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

// 맥 메뉴 막대에 그릴 아이콘의 논리 크기(pt). 막대 자체는 24pt 라 16 이면
// 위아래로 여백이 남아 다른 아이콘들과 키가 맞는다. 더 키우려면 18, 더 줄이려면 14.
const TRAY_POINT_SIZE = 16;

function createTray() {
  let icon = nativeImage.createFromPath(ICON);
  // 32px 그림을 배율 정보 없이 넘기면 맥은 이걸 32pt 로 읽어서 막대를 꽉 채운다.
  // 같은 그림을 2배 밀도(scaleFactor)로 다시 읽으면 32px ÷ 2 = 16pt 로 작게 표시되고,
  // 정수배라 픽셀도 뭉개지지 않는다.
  if (process.platform === 'darwin') {
    const small = nativeImage.createFromPath(path.join(ASSETS, 'icon-src', 'claudetown-32.png'));
    if (!small.isEmpty()) {
      icon = nativeImage.createFromBuffer(small.toPNG(), { scaleFactor: 32 / TRAY_POINT_SIZE });
    }
  }
  tray = new Tray(icon);
  tray.setToolTip('ClaudeTown');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showWindow());
}

// ── 시작 ──────────────────────────────────────────────────────────────────

// 두 번 켜지면 서버를 두 번 띄우려 들고 트레이 아이콘도 둘이 된다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  // 맥: 창의 X 는 숨기는 것뿐이라, 다시 부르는 길이 Dock 아이콘 클릭이다.
  // 이 핸들러가 없으면 한 번 닫은 뒤 Dock 을 눌러도 아무 일도 안 일어난다
  // (메뉴바 아이콘으로만 되살릴 수 있어서 앱이 죽은 것처럼 보인다).
  app.on('activate', () => showWindow());

  app.whenReady().then(async () => {
    // 창은 이거 하나뿐이라 메뉴바가 필요 없다. 다만 맥에서 메뉴를 null 로 두면
    // Cmd+Q·Cmd+W·복사/붙여넣기 같은 표준 단축키까지 같이 사라진다(가속기가
    // 메뉴 항목에 달려 있어서다). 맥에서는 기본 메뉴를 그대로 둔다.
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    createTray();

    try {
      await startServer();
    } catch (err) {
      // 서버를 못 띄우면 빈 창 대신 이유를 보여주고 끝낸다.
      dialog.showErrorBox(
        'ClaudeTown 서버를 못 띄웠습니다',
        `${err.message}\n\n파이썬 3 이 설치되어 있는지 확인하세요. WSL 에서 Claude Code 를 쓰신다면 WSL 안에도 필요합니다.`
      );
      app.quit();
      return;
    }

    createWindow();

    refreshUsage();
    setInterval(refreshUsage, USAGE_POLL_MS);
    refreshDesktopChats();
    setInterval(refreshDesktopChats, DESKTOP_POLL_MS);
  });

  let quitting = false;
  app.on('before-quit', (e) => {
    if (quitting) return;
    quitting = true;
    app.isQuitting = true;
    e.preventDefault();
    stopServer().finally(() => app.exit(0));
  });

  // 창을 다 닫아도(트레이로 숨긴 것뿐이라도) 앱은 트레이에 남는다.
  app.on('window-all-closed', (e) => { e.preventDefault(); });
}
