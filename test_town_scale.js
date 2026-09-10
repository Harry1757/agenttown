// town.html 의 배율 계산이 0 을 내지 않는지 본다.
//
// 배율 0 은 그리기 루프의 간격을 0 으로 만들어 `x += 0` 무한루프가 되고, JS
// 스레드가 멈춰 앱이 통째로 언다 — 창을 줄이면 얼어붙던 실제 버그다. 캔버스가
// 아무리 작아도(1x1 까지) 배율은 0 보다 커야 한다.
//
// 페이지 전체를 띄우지 않고 이 두 식만 town.html 에서 꺼내 확인한다.
const fs = require('node:fs');
const assert = require('node:assert');

const html = fs.readFileSync(`${__dirname}/town.html`, 'utf8');
const grab = (re, what) => {
  const m = html.match(re);
  assert.ok(m, `town.html 에서 ${what} 를 못 찾았다 — 테스트가 낡았다`);
  return m;
};

const ZOOM_STEP = Number(grab(/const ZOOM_STEP = ([\d.]+);/, 'ZOOM_STEP')[1]);
const MIN_SCALE = Number(grab(/const MIN_SCALE = ([\d.]+);/, 'MIN_SCALE')[1]);
const TILE = Number(grab(/const TILE = (\d+)/, 'TILE')[1]);
const quantZoom = new Function('ZOOM_STEP', 'MIN_SCALE', 'Math',
  'return ' + grab(/const quantZoom = (\(v\) =>[^;]+);/, 'quantZoom')[1]
)(ZOOM_STEP, MIN_SCALE, Math);
const fitBody = grab(/const raw = Math\.min\((.+?)\);\n\s*const fitScale = (.+?);/s, 'fitScale')[0];
const fitScale = new Function('cv', 'availH', 'g', 'TILE', 'MIN_SCALE', 'Math', 'ZOOM_STEP',
  fitBody + '\nreturn fitScale;');

assert.ok(MIN_SCALE > 0, 'MIN_SCALE 은 0 보다 커야 한다');

// 그리드는 방 4칸 x 3줄. 방 하나가 여러 타일이라 실제로는 이보다 크지만,
// 작을수록 배율이 0 에 가까워지므로 작은 쪽으로 잡아도 검증엔 충분하다.
const g = { w: 4 * 14, h: 3 * 12 };
let checked = 0;
for (const w of [1, 2, 8, 40, 120, 320, 504, 684, 1264, 3840]) {
  for (const h of [1, 2, 8, 40, 120, 300, 381, 521, 821, 2160]) {
    const s = fitScale({ width: w, height: h }, Math.max(0, h - 96), g, TILE, MIN_SCALE, Math, ZOOM_STEP);
    assert.ok(s > 0, `fitScale 이 ${w}x${h} 에서 ${s} 를 냈다 — 0 이면 앱이 언다`);
    assert.ok(quantZoom(s) > 0, `quantZoom(${s}) 이 0 이다`);
    checked++;
  }
}
// 사용자가 축소를 끝까지 누른 경우까지: 어떤 입력이 와도 0 은 안 나온다.
for (const v of [0, -1, -0.4, 0.01, 0.124, 0.125, 0.3, 1, 7.9]) {
  assert.ok(quantZoom(v) > 0, `quantZoom(${v}) 이 0 이하다`);
  checked++;
}
console.log(`배율 0 안 나옴 — ${checked}가지 확인`);
