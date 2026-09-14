// 배회(wander)가 캐릭터를 방 바닥 밖으로 내보내지 않는지 본다.
//
// 목적지는 wanderBox 안으로 클램프해서 정하므로, 이 상자만 맞으면 나머지는 min/max
// 한 줄이다. 덩치(스프라이트 배율 1~2배)가 커질수록 상자가 좁아져야 하고, 아무리
// 커져도 스프라이트 사각형이 벽·책상 구역을 넘으면 안 된다.
//
// 페이지를 띄우지 않고 town.html 에서 상수와 wanderBox 만 꺼내 확인한다(test_town_scale 과 같은 방식).
const fs = require('node:fs');
const assert = require('node:assert');

const html = fs.readFileSync(`${__dirname}/town.html`, 'utf8');
const grab = (re, what) => {
  const m = html.match(re);
  assert.ok(m, `town.html 에서 ${what} 를 못 찾았다 — 테스트가 낡았다`);
  return m;
};

// 한 줄에 여러 개 선언한 것도 있다: `const ROOM_W = 8, ROOM_H = 7;`
const num = (name) => Number(grab(new RegExp(`(?:const|,)\\s*${name} = ([\\d.]+)`), name)[1]);
const ROOM_W = num('ROOM_W'), ROOM_H = num('ROOM_H');
const DESK_CLEAR = num('DESK_CLEAR'), CRAMP_MUL = num('CRAMP_MUL');
const TOK_MAX_MUL = num('TOK_MAX_MUL');

const body = grab(/function wanderBox\(a, h\) \{\n([\s\S]*?)\n\}/, 'wanderBox')[1];
const make = new Function('ROOM_BY_ROLE', 'ROOM_W', 'ROOM_H', 'DESK_CLEAR', 'Math',
  `return function wanderBox(a, h) {\n${body}\n};`);

let checked = 0, widths = [];
for (const gx of [0, 8, 16, 24]) {
  for (const gy of [0, 7, 14]) {
    const wanderBox = make({ r: { gx, gy } }, ROOM_W, ROOM_H, DESK_CLEAR, Math);
    for (let h = 1; h <= TOK_MAX_MUL + 1e-9; h += 0.25) {
      const b = wanderBox({ role: 'r' }, h);
      assert.ok(b, `배율 ${h} 에서 설 자리가 없다 — 방이 그만큼 좁아졌으면 상수를 다시 봐야 한다`);
      assert.ok(b.x0 <= b.x1 && b.y0 <= b.y1, `빈 상자: ${JSON.stringify(b)}`);
      // 스프라이트 사각형(가로 중심 x+0.5, 발 y+1, 크기 h타일)이 실내를 안 벗어난다.
      const eps = 1e-9;
      assert.ok(b.x0 + 0.5 - h / 2 >= gx + 1 - eps, `배율 ${h}: 왼벽을 넘는다`);
      assert.ok(b.x1 + 0.5 + h / 2 <= gx + ROOM_W - 1 + eps, `배율 ${h}: 오른벽을 넘는다`);
      assert.ok(b.y1 + 1 <= gy + ROOM_H - 1 + eps, `배율 ${h}: 아랫벽(출입구)을 넘는다`);
      assert.ok(b.y0 + 1 - h >= gy + 1 - eps, `배율 ${h}: 머리가 윗벽을 넘는다`);
      assert.ok(b.y0 + 1 >= gy + 1 + DESK_CLEAR - eps, `배율 ${h}: 책상 구역을 밟는다`);
      if (gx === 0 && gy === 0) widths.push(b.x1 - b.x0);
      checked++;
    }
  }
}
// 덩치가 커질수록 돌아다닐 폭이 줄어야 한다 — "큰 애는 좁아서 답답하다"의 근거.
for (let i = 1; i < widths.length; i++) {
  assert.ok(widths[i] < widths[i - 1], `배율이 커졌는데 폭이 안 줄었다: ${widths}`);
}
assert.ok(CRAMP_MUL > 1 && CRAMP_MUL < TOK_MAX_MUL, 'CRAMP_MUL 은 1 과 최대 배율 사이여야 한다');

// 걷는 동안 얕게 흔들린다: 서 있으면 0, 걸으면 흔들리고, 도착이 가까우면 잦아든다.
// 점프가 아니어야 한다 — 위로만 튀는 아치(abs(sin))가 아니라 아래로도 같이 간다.
{
  const isMoving = new Function('Math', 'return ' + grab(/const isMoving = (\(a\) =>[^;]+);/, 'isMoving')[1])(Math);
  const bobBody = grab(/function walkBob\(a, now\) \{\n([\s\S]*?)\n\}/, 'walkBob')[1];
  const BOB_PX = num('WALK_BOB_PX');
  const walkBob = new Function('isMoving', 'hashSeed', 'WALK_BOB_MS', 'WALK_BOB_PX', 'layout', 'Math',
    `return function walkBob(a, now) {\n${bobBody}\n};`)(
      isMoving, () => 0, num('WALK_BOB_MS'), BOB_PX, { scale: 1 }, Math);
  const range = (a) => {
    let lo = 9e9, hi = -9e9;
    for (let t = 0; t < 1200; t += 5) { const v = walkBob(a, t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return [lo, hi];
  };
  assert.strictEqual(walkBob({ x: 0, y: 0, tx: 0, ty: 0 }, 0), 0, '서 있는데 흔들린다');
  assert.ok(BOB_PX <= 1.5, `걷기 흔들림이 너무 크다(점프로 읽힌다): ${BOB_PX}px`);
  const [lo, hi] = range({ x: 0, y: 0, tx: 3, ty: 0 });
  assert.ok(hi > BOB_PX * 0.95, `걷는데 안 흔들린다: 최고 ${hi.toFixed(2)}px`);
  assert.ok(lo < -BOB_PX * 0.95, `위로만 튄다 — 점프 아치다: 최저 ${lo.toFixed(2)}px`);
  const [, nearHi] = range({ x: 0, y: 0, tx: 0.1, ty: 0 });
  assert.ok(nearHi < BOB_PX * 0.25, `도착 직전인데 아직 크게 흔들린다: ${nearHi.toFixed(2)}px`);
}

// 실제로 돌려 본다: pickWander + stepAvatars 를 town.html 에서 그대로 꺼내 3명을
// 오래 걷게 하고, (1) 아무도 바닥 밖으로 안 나가고 (2) 다들 실제로 움직이고
// (3) 덩치가 클수록 덜 돌아다니는지 본다.
const grabFn = (name, args) =>
  grab(new RegExp(`function ${name}\\(${args}\\) \\{\\n([\\s\\S]*?)\\n\\}`), name)[1];

const avatars = {};
const room = { gx: 8, gy: 7 };
const env = {
  stepDuels: () => {}, // Pair encounters have their own lifecycle/bounds tests.
  stepDuelAftermath: () => false, clearDuelAftermath: () => {},
  window: {},
  ROOM_BY_ROLE: { r: room }, ROOM_W, ROOM_H, DESK_CLEAR, Math,
  WANDER: true, WANDER_PAUSE: JSON.parse(grab(/const WANDER_PAUSE = (\[[^\]]+\])/, 'WANDER_PAUSE')[1]),
  WANDER_TRIP: num('WANDER_TRIP'), WANDER_MIN: num('WANDER_MIN'),
  WALK_SPEED: num('WALK_SPEED'), WALK_ROOM_SPEED: num('WALK_ROOM_SPEED'),
  WALK_MAX_S: num('WALK_MAX_S'), lastStep: 0,
  CRAMP_MUL, avatars, workerState: (a) => a.st || 'working',
  wanderBox: make({ r: room }, ROOM_W, ROOM_H, DESK_CLEAR, Math),
  tokenSizeMul: (t) => t, tokensOf: (a) => a.mul,   // 배율을 바로 넣는다
  roomOccCount: (role) => Object.values(avatars).filter(a => a.role === role).length,
};
const bind = (name, args, body) =>
  new Function(...Object.keys(env), `return function ${name}(${args}) {\n${body}\n};`)(...Object.values(env));
env.isMoving = new Function('Math', 'return ' + grab(/const isMoving = (\(a\) =>[^;]+);/, 'isMoving')[1])(Math);
env.pickWander = bind('pickWander', 'a, now', grabFn('pickWander', 'a, now'));
const stepAvatars = bind('stepAvatars', '', grabFn('stepAvatars', ''));

for (const [i, mul] of [1, 1.5, 2].entries()) {
  const homeX = room.gx + 1.8 + i * 1.5, homeY = room.gy + 1 + 2.7;
  avatars['a' + i] = { role: 'r', mul, homeX, homeY, x: homeX, y: homeY, tx: homeX, ty: homeY, face: 1, span: [9e9, -9e9], moved: 0 };
}
let now = 0;
for (let frame = 0; frame < 40000; frame++) {
  now += 16;
  global.performance = { now: () => now };
  stepAvatars();
  for (const a of Object.values(avatars)) {
    if (frame < 120) continue;   // 처음엔 슬롯이 상자 밖일 수 있다(큰 애는 벽에서 밀려난다)
    const b = env.wanderBox(a, a.mul);
    const slack = 0.01;
    assert.ok(a.x >= b.x0 - slack && a.x <= b.x1 + slack, `배율 ${a.mul} 이 가로로 새어나갔다: ${a.x}`);
    assert.ok(a.y >= b.y0 - slack && a.y <= b.y1 + slack, `배율 ${a.mul} 이 세로로 새어나갔다: ${a.y}`);
    a.span = [Math.min(a.span[0], a.x), Math.max(a.span[1], a.x)];
    // drawWorker 가 '걷는 중'으로 보는 것과 같은 기준.
    if (Math.abs(a.tx - a.x) > 0.02 || Math.abs(a.ty - a.y) > 0.02) a.moved++;
  }
}
const spans = Object.values(avatars).map(a => a.span[1] - a.span[0]);
for (const [i, w] of spans.entries()) assert.ok(w > 0.3, `${i}번은 거의 안 움직였다: ${w}`);
assert.ok(spans[2] < spans[0], `덩치 큰 쪽이 더 많이 돌아다녔다: ${spans.map(v => v.toFixed(2))}`);
// 한 명만 움직이는 것처럼 보이면 안 된다: 각자 시간의 얼마쯤은 걷고 있어야 한다.
// 그렇다고 쉬지 않고 걸으면 방 몸짓(끄덕임·기지개·말풍선)이 아예 안 나온다.
const duty = Object.values(avatars).map(a => a.moved / (40000 - 120));
for (const [i, d] of duty.entries()) {
  assert.ok(d > 0.1, `${i}번이 거의 서 있다 — 다 같이 멈춰 보인다: ${d.toFixed(2)}`);
  assert.ok(d < 0.45, `${i}번이 쉬질 않는다 — 부산스럽고, 서 있을 때 나오는 몸짓도 안 보인다: ${d.toFixed(2)}`);
}
// 방을 옮길 때는 어슬렁거리지 않는다 — 산책(a.strolling)만 느리고, 자리 배치로 잡힌
// 목적지는 빠르게 간다. 아무리 멀어도 WALK_MAX_S 안에 도착한다.
{
  for (const k of Object.keys(avatars)) delete avatars[k];
  const m = { role: 'r', mul: 1, x: 0, y: 0, tx: 12, ty: 0, face: 1, strolling: false };
  avatars.m = m;   // homeX 가 없으니 pickWander 가 가로채지 않는다
  let frames = 0, minStep = 9e9;
  while (m.x !== m.tx && frames < 2000) {
    now += 16;
    global.performance = { now: () => now };
    const px = m.x;
    stepAvatars();
    const moved = m.x - px;
    if (m.x !== m.tx) minStep = Math.min(minStep, moved);   // 마지막 한 프레임은 짧다
    frames++;
  }
  const secs = frames * 0.016;
  assert.ok(m.x === m.tx, `방 이동이 안 끝난다: ${m.x}`);
  assert.ok(secs <= num('WALK_MAX_S') + 0.05, `방 이동이 너무 오래 걸린다: ${secs.toFixed(2)}초`);
  assert.ok(minStep > num('WALK_SPEED') * 0.016 * 1.5,
    `방 이동인데 산책 속도로 간다: 프레임당 ${minStep.toFixed(4)} 타일`);
}

// 완료(done)는 자리에 선다 — 끝난 세션이 계속 돌아다니면 아직 일하는 줄로 읽힌다.
{
  const d = { role: 'r', st: 'done', mul: 1, homeX: room.gx + 4, homeY: room.gy + 3.7, face: 1 };
  d.x = d.tx = d.homeX; d.y = d.ty = d.homeY;
  for (const k of Object.keys(avatars)) delete avatars[k];
  avatars.d = d;
  for (let frame = 0; frame < 3000; frame++) {
    now += 16;
    global.performance = { now: () => now };
    stepAvatars();
  }
  assert.strictEqual(d.x, d.homeX, '완료인데 돌아다닌다');
  assert.strictEqual(d.y, d.homeY, '완료인데 돌아다닌다');
}

// 혼자 있는 방(제일 흔한 경우)은 방을 두루 쓴다 — 한 번에 가는 거리만 짧다.
for (const k of Object.keys(avatars)) delete avatars[k];
const solo = { role: 'r', mul: 1, homeX: room.gx + 4, homeY: room.gy + 3.7, face: 1, span: [9e9, -9e9] };
solo.x = solo.tx = solo.homeX; solo.y = solo.ty = solo.homeY;
avatars.solo = solo;
solo.ySpan = [9e9, -9e9];
let travelX = 0, travelY = 0, maxStep = 0, lastT = null;
const frameSteps = [];
// 걸음이 짧고 느린 만큼 방을 다 훑는 데 시간이 걸린다 — 16분쯤 지켜본다.
// (WALK_SPEED 를 더 낮추거나 WANDER_PAUSE 를 더 늘리면 이 창도 같이 늘려야 한다.)
for (let frame = 0; frame < 60000; frame++) {
  now += 16;
  global.performance = { now: () => now };
  const px = solo.x, py = solo.y;
  stepAvatars();
  travelX += Math.abs(solo.x - px); travelY += Math.abs(solo.y - py);
  const moved = Math.hypot(solo.x - px, solo.y - py);
  if (moved > 0) frameSteps.push(moved);
  const t = `${solo.tx},${solo.ty}`;
  if (t !== lastT) { lastT = t; maxStep = Math.max(maxStep, Math.hypot(solo.tx - px, solo.ty - py)); }
  solo.span = [Math.min(solo.span[0], solo.x), Math.max(solo.span[1], solo.x)];
  solo.ySpan = [Math.min(solo.ySpan[0], solo.y), Math.max(solo.ySpan[1], solo.y)];
  const b = env.wanderBox(solo, solo.mul);
  assert.ok(solo.y >= b.y0 - 0.01 && solo.y <= b.y1 + 0.01, `세로로 새어나갔다: ${solo.y}`);
}
const soloSpan = solo.span[1] - solo.span[0], soloYSpan = solo.ySpan[1] - solo.ySpan[0];
assert.ok(soloSpan > 3, `한자리만 맴돈다: ${soloSpan.toFixed(2)} 타일`);
// 한 걸음은 짧아야 한다 — 방을 가로지르며 뛰어다니면 부산스럽다.
assert.ok(maxStep < num('WANDER_TRIP') + 0.01, `한 번에 너무 멀리 간다: ${maxStep.toFixed(2)} 타일`);
// 좌우로만 튕기면 안 된다 — 위아래·대각선으로도 가야 한다.
assert.ok(soloYSpan > 1, `세로로 거의 안 움직인다: ${soloYSpan.toFixed(2)} 타일`);
assert.ok(travelY / travelX > 0.2, `걸은 거리가 거의 가로다: 세로/가로 ${(travelY / travelX).toFixed(2)}`);
// 걷기는 등속이다. lerp 였을 때는 한 프레임 이동량이 처음엔 크고 갈수록 0 에 수렴해서
// '한 번에 훅 갔다가 기어드는' 걸로 보였다 — 매 프레임 같은 거리를 가야 걷는 걸로 읽힌다.
// (목적지 직전 한 프레임만 짧다: 지나치지 않게 딱 세우느라 남은 만큼만 간다.)
{
  const want = num('WALK_SPEED') * 0.016;   // 이 시뮬레이션의 프레임 간격
  const onPace = frameSteps.filter(v => Math.abs(v - want) < want * 0.01).length / frameSteps.length;
  assert.ok(onPace > 0.9, `걸음 폭이 들쭉날쭉하다 — 등속이 아니다: ${(onPace * 100).toFixed(0)}%`);
  assert.ok(Math.max(...frameSteps) <= want * 1.001, `한 프레임에 너무 멀리 간다: ${Math.max(...frameSteps).toFixed(4)}`);
}

// 방 바닥을 거의 다 쓴다 — 슬롯 주변만 맴돌면 '자유롭게'가 아니다.
{
  const b = env.wanderBox(solo, solo.mul);
  assert.ok(soloSpan > (b.x1 - b.x0) * 0.85, `가로로 방을 다 안 쓴다: ${soloSpan.toFixed(2)} / ${(b.x1 - b.x0).toFixed(2)}`);
  assert.ok(soloYSpan > (b.y1 - b.y0) * 0.85, `세로로 방을 다 안 쓴다: ${soloYSpan.toFixed(2)} / ${(b.y1 - b.y0).toFixed(2)}`);
}

console.log(`10분치 걸어봄 — 혼자 가로 ${soloSpan.toFixed(2)} x 세로 ${soloYSpan.toFixed(2)} 타일`
  + ` (걸은 거리 세로/가로 ${(travelY / travelX).toFixed(2)}), 셋이면 가로 ${spans.map(v => v.toFixed(2)).join(' / ')} 타일`
  + `, 걷는 시간 비율 ${duty.map(v => Math.round(v * 100) + '%').join(' / ')} (배율 1 / 1.5 / 2)`);

// <script> 블록이 통째로 문법에 맞는지도 한 번 본다 — 이 파일은 브라우저에서만 도는
// 코드라 오타 하나가 앱을 흰 화면으로 만든다.
const js = grab(/<script id="town-renderer">([\s\S]*?)<\/script>/, '<script> 블록')[1];
new Function(js.replace(/^\s*tick\(\);\s*$/m, ''));   // 파싱만 한다, 실행은 안 한다

console.log(`배회 범위 정상 — ${checked}가지 확인, 폭 ${widths[0].toFixed(2)} -> ${widths[widths.length - 1].toFixed(2)} 타일`);
