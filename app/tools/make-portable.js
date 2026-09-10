'use strict';

// 팀원에게 넘길 폴더를 만든다.
//
// 설치본(%LOCALAPPDATA%\ClaudeTown)은 그대로 주면 실행이 불편하다 —
// node_modules\electron\dist\electron.exe 를 찾아 폴더 경로를 인자로 넘겨야 뜬다.
// 그래서 더블클릭 하나로 뜨는 실행 파일과, 시작 메뉴에 등록하는 배치를 같이 넣는다.
//
//   node tools/make-portable.js [출력폴더]
//
// 기본 출력은 %USERPROFILE%\ClaudeTown-portable 이다.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const APP = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(os.homedir(), 'ClaudeTown-portable');

// electron 바이너리까지 통째로 담아야 받는 쪽이 npm install 을 안 한다.
const COPY = ['src', 'server', 'assets', 'node_modules', 'package.json'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of COPY) {
  const src = path.join(APP, name);
  if (!fs.existsSync(src)) throw new Error(`없음: ${src} (먼저 npm run sync-server)`);
  fs.cpSync(src, path.join(OUT, name), { recursive: true });
}

// 콘솔 창이 안 뜨게 vbs 로 띄운다. 경로를 박지 않고 자기 위치를 기준으로 잡는다.
fs.writeFileSync(path.join(OUT, 'ClaudeTown.vbs'), [
  'Set fso = CreateObject("Scripting.FileSystemObject")',
  'Set sh = CreateObject("WScript.Shell")',
  'here = fso.GetParentFolderName(WScript.ScriptFullName)',
  'exe = here & "\\node_modules\\electron\\dist\\electron.exe"',
  'If Not fso.FileExists(exe) Then',
  '  MsgBox "electron.exe 를 못 찾았습니다. 압축을 통째로 풀었는지 확인하세요.", 16, "ClaudeTown"',
  'Else',
  '  sh.Run """" & exe & """ """ & here & """", 0, False',
  'End If',
].join('\r\n'), 'utf8');

// 시작 메뉴에 바로가기를 만든다(선택). 복사 없이 지금 자리를 가리킨다.
fs.writeFileSync(path.join(OUT, '시작메뉴에 등록.bat'), [
  '@echo off',
  'chcp 65001 >nul',
  'powershell -NoProfile -ExecutionPolicy Bypass -Command ^',
  '  "$here = Split-Path -Parent \'%~f0\';" ^',
  '  "$sc = (New-Object -ComObject WScript.Shell).CreateShortcut(' +
  '\\"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\ClaudeTown.lnk\\");" ^',
  '  "$sc.TargetPath = Join-Path $here \'ClaudeTown.vbs\';" ^',
  '  "$sc.WorkingDirectory = $here;" ^',
  '  "$sc.IconLocation = (Join-Path $here \'assets\\claudetown.ico\') + \',0\';" ^',
  '  "$sc.Save();"',
  'echo 시작 메뉴에 등록했습니다.',
  'pause',
].join('\r\n'), 'utf8');

fs.writeFileSync(path.join(OUT, '읽어보기.txt'), [
  'ClaudeTown — Claude Code 세션을 도트 맵으로 보는 뷰어',
  '',
  '실행',
  '  ClaudeTown.vbs 를 더블클릭하세요. 창이 뜨고 트레이에도 아이콘이 생깁니다.',
  '  시작 메뉴에 두고 싶으면 "시작메뉴에 등록.bat" 을 한 번 실행하세요.',
  '',
  '필요한 것',
  '  파이썬 3. Claude Code 를 쓰는 쪽에 있으면 됩니다 —',
  '  WSL 에서 쓰신다면 WSL 안에, Windows 에서 쓰신다면 Windows 에.',
  '  (앱이 최근에 쓴 기록이 있는 쪽을 찾아 거기서 서버를 띄웁니다.)',
  '',
  '안 뜰 때',
  '  - "파이썬 3 을 못 찾았습니다" → 위의 파이썬을 설치하세요.',
  '  - 창은 뜨는데 아무도 없음 → 아직 Claude Code 세션 기록이 없는 것입니다.',
  '    한 번 쓰고 나면 나타납니다(이틀 넘게 조용한 세션은 안 보입니다).',
  '',
  '보이는 것',
  '  방 12개 — 앞의 10개는 업무 구역, 마지막 둘은 응답 대기 / 완료.',
  '  캐릭터 하나가 세션 하나입니다. 크기는 그 세션이 쓴 토큰량.',
  '  이름표 왼쪽 점: 초록=작업 중, 노랑=응답 대기(내 차례), 주황=멈춤?, 회색=완료.',
  '  캐릭터를 더블클릭하면 그 세션을 연 창이 앞으로 옵니다.',
  '  오른쪽 아래 버튼으로 쓰다듬기 / 때리기(연출입니다. 진짜 세션엔 영향 없음).',
  '',
  '내 차례가 되면 Windows 알림이 뜹니다. 눌러서 바로 그 세션으로 갈 수 있습니다.',
].join('\r\n'), 'utf8');

const size = (p) => {
  let n = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const q = path.join(p, e.name);
    n += e.isDirectory() ? size(q) : fs.statSync(q).size;
  }
  return n;
};
console.log(`만들었습니다: ${OUT}  (${(size(OUT) / 1e6).toFixed(0)} MB)`);
console.log('이 폴더를 통째로 압축해 넘기면 됩니다.');
