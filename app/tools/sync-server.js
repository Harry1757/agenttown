'use strict';

// 서버 파일(claudetown.py + 화면 + 타일시트)을 app/server/ 로 복사한다.
//
// 앱이 저장소 경로를 알 필요가 없게 하려는 것이다. 예전에는 main.js 가
// "WSL 의 ~/projects/claudetown" 을 전제로 launch.sh 를 불렀는데, 남에게 넘기는
// 순간 그 전제가 깨진다. 이제 앱 폴더 안에 서버를 같이 담고, main.js 는
// app/server 가 있으면 그걸, 없으면(개발 중) 저장소 루트를 쓴다.

const fs = require('node:fs');
const path = require('node:path');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..');
const OUT = path.join(APP, 'server');

const FILES = ['claudetown.py', 'town.html', 'tiles.html'];
const DIRS = ['assets'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of FILES) {
  const src = path.join(REPO, f);
  if (!fs.existsSync(src)) throw new Error(`없는 파일: ${src}`);
  fs.copyFileSync(src, path.join(OUT, f));
}
for (const d of DIRS) {
  const src = path.join(REPO, d);
  if (!fs.existsSync(src)) throw new Error(`없는 폴더: ${src}`);
  fs.cpSync(src, path.join(OUT, d), { recursive: true });
}

const n = fs.readdirSync(OUT).length;
console.log(`app/server 로 복사 완료 (${n}개 항목)`);
