// ClaudeTown 주: 이 파일은 사용자가 먼저 만든 claude-usage 앱(src/usage.js)에서
// 그대로 가져왔다 — 같은 값을 두 번 짜느니 검증된 쪽을 옮겨 쓴다. ClaudeTown 은
// 별도 저장소라 경로로 require 하지 않고 복사해 자립시켰다. 원문 주석은 그대로 둔다.
'use strict';

// Claude Code 사용량(/usage) 을 가져오는 곳.
//
// 값을 얻는 길이 둘이다.
//
//   1. 앤쓰로픽에 직접 묻는다 (fetchUsage). `/usage` 가 부르는 것과 같은 자리다.
//      Claude Code 가 켜져 있든 말든, 터미널이든 VSCode 든 상관없이 최신값이 온다.
//   2. 안 되면 마지막으로 받아 적어둔 파일을 읽는다 (readUsage).
//      WSL 쪽 Claude Code 상태줄 훅도 같은 파일에 쓴다.
//
// 왜 둘이나 두는가. 이 값이 담겨 나오는 곳은 Claude Code 의 **상태줄 입력 JSON** 뿐이다 -
// 훅 페이로드에도, 세션 기록에도, OTEL 메트릭에도 없고 claude CLI 에 usage 하위 명령도
// 없다. 그런데 VSCode 확장은 커스텀 상태줄을 그리지 않아서 그쪽에서 일할 때는 훅이 아예
// 안 돈다. 그래서 훅만으로는 터미널에서만 맞는 반쪽짜리가 된다. 반대로 직접 묻는 길은
// 공식 문서에 없는 자리라 언젠가 막힐 수 있다. 서로의 구멍을 메우라고 둘 다 둔다.
//
// 경로를 밖에서 받는 까닭은 테스트다 - Electron 을 띄우지 않고 확인할 수 있어야 한다.

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const WINDOWS = [
  { key: 'five_hour', label: '5시간' },
  { key: 'seven_day', label: '7일' },
];

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

// ClaudeTown 주: 실패하면 조용히 null 을 돌려주던 것을, 왜 실패했는지 남기도록
// 바꿨다. 팀원들이 "한도 막대가 안 보인다" 고 했을 때 토큰이 없는 건지 요청이
// 막힌 건지 가릴 방법이 없었다.
let lastError = null;
function usageError() { return lastError; }
const FETCH_TIMEOUT_MS = 8000;

/**
 * 훅이 떨군 파일. 없거나 깨졌으면 null - 아직 Claude Code 를 안 켠 것뿐이라
 * 사고가 아니다. 조용히 "아직 값 없음" 으로 다룬다.
 */
function readUsage(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
  const windows = parsed && parsed.windows;
  if (!windows) return null;

  return {
    at: parsed.at || null,
    windows: WINDOWS.map(({ key, label }) => {
      const w = windows[key] || {};
      const used = Number(w.used);
      const resetsMs = w.resets_at ? Date.parse(w.resets_at) : NaN;
      return {
        key,
        label,
        used: Number.isFinite(used) ? used : 0,
        resetsAt: Number.isFinite(resetsMs) ? resetsMs : null,
      };
    }),
  };
}

/** 읽는 쪽이 반토막 난 파일을 보지 않게, 옆에 다 쓴 뒤 갈아끼운다. store.js 와 같은 방식. */
function writeJson(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

/** 직접 받아온 값을 훅이 쓰는 것과 같은 모양으로 되돌려 적는다. 둘이 파일 하나를 같이 쓴다. */
function writeUsage(filePath, usage) {
  const windows = {};
  for (const w of usage.windows) {
    windows[w.key] = {
      used: w.used,
      resets_at: w.resetsAt ? new Date(w.resetsAt).toISOString() : null,
    };
  }
  writeJson(filePath, { at: usage.at, windows });
}

// ── 앤쓰로픽에 직접 묻기 ───────────────────────────────────────────────────

/**
 * 토큰이 있는 자리. 이 앱은 Windows 에서 돌지만 Claude Code 는 WSL 에서도 쓰므로 둘 다 본다.
 *
 * Windows 쪽을 먼저 보는 까닭은 UNC(\\wsl.localhost) 접근이 꺼져 있는 WSL 을 깨우기
 * 때문이다. Windows 쪽 토큰이 살아 있으면 굳이 깨울 일이 없다.
 *
 * 배포판·계정 이름을 박아둔 것은 상태줄 훅이 경로를 박아둔 것과 같은 이유다 (이 컴퓨터 한 대).
 * 바뀌면 CLAUDE_CREDENTIALS 로 덮어쓴다.
 */
function credentialPaths() {
  if (process.env.CLAUDE_CREDENTIALS) return [process.env.CLAUDE_CREDENTIALS];
  return [path.join(os.homedir(), '.claude', '.credentials.json')];
}

// ClaudeTown 주: 원본은 '\\wsl.localhost\Ubuntu\home\pc\...' 를 박아 뒀다(그 컴퓨터
// 한 대용). 남에게 넘기려면 배포판 이름도 계정 이름도 알 수 없으므로, 파일 경로 대신
// WSL 에게 직접 물어본다. 맥은 파일이 아니라 키체인에 있어서 그쪽도 따로 본다.
function readTokenFromWsl() {
  if (process.platform !== 'win32') return null;
  try {
    // '~' 는 셸이 펴 주는 것이라 bash 를 거쳐야 한다 — wsl.exe -e cat '~/...' 는 실패한다.
    const out = execFileSync('wsl.exe',
      ['-e', 'bash', '-lc', 'cat ~/.claude/.credentials.json'],
      { encoding: 'utf8', timeout: 6000, windowsHide: true });
    return tokenFromJson(out);
  } catch {
    return null;
  }
}

// 맥은 Claude Code 가 토큰을 키체인에 넣는다 — 홈에 .credentials.json 이 없다.
// 이 자리는 이 컴퓨터에서 확인해 볼 수 없어(윈도우) 문서에 있는 항목 이름을 쓴다.
function readTokenFromKeychain() {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execFileSync('security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf8', timeout: 6000 });
    return tokenFromJson(out);
  } catch {
    return null;
  }
}

function tokenFromJson(text) {
  try {
    const oauth = JSON.parse(text).claudeAiOauth;
    if (!oauth || !oauth.accessToken) return null;
    if (oauth.expiresAt && oauth.expiresAt <= Date.now()) return null;
    return oauth.accessToken;
  } catch {
    return null;
  }
}

// 만료된 토큰으로는 부르지 않는다. 새로 받는 것은 Claude Code 몫이다 - 여기서
// refreshToken 을 쓰면 지금 돌고 있는 Claude Code 의 토큰이 무효가 될 수 있다.
function readToken(filePath) {
  try {
    return tokenFromJson(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 응답에서 두 한도만 추린다. 나머지(모델별 한도, 크레딧, 지출)는 이 앱이 안 쓴다.
 * utilization 은 이미 0~100 이고 resets_at 은 ISO 문자열이다.
 */
function parseApiUsage(json) {
  if (!json || (!json.five_hour && !json.seven_day)) return null;
  return WINDOWS.map(({ key, label }) => {
    const w = json[key] || {};
    const used = Number(w.utilization);
    const resetsMs = w.resets_at ? Date.parse(w.resets_at) : NaN;
    return {
      key,
      label,
      used: Number.isFinite(used) ? Math.round(used * 10) / 10 : 0,
      resetsAt: Number.isFinite(resetsMs) ? resetsMs : null,
    };
  });
}

/**
 * `/usage` 가 부르는 자리를 그대로 부른다. 실패하면 null - 부르는 쪽이 파일 값으로 물러난다.
 * 토큰은 이 컴퓨터의 파일에서 읽어 앤쓰로픽 API 에만 실려 나간다.
 */
async function fetchUsage() {
  let token = null;
  for (const p of credentialPaths()) {
    token = readToken(p);
    if (token) break;
  }
  if (!token) token = readTokenFromKeychain();   // 맥
  if (!token) token = readTokenFromWsl();        // 윈도우 + WSL 조합
  if (!token) {
    lastError = '로그인 토큰을 못 찾음 (~/.claude/.credentials.json)';
    return null;
  }

  try {
    const res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      lastError = res.status === 401
        ? '로그인이 만료됨 (Claude Code 에서 다시 로그인하세요)'
        : `요청이 거절됨 (HTTP ${res.status})`;
      return null;
    }
    const windows = parseApiUsage(await res.json());
    if (!windows) { lastError = '응답을 못 읽음'; return null; }
    lastError = null;
    return { at: new Date().toISOString(), windows };
  } catch (err) {
    // 네트워크 끊김, 토큰 거절, WSL 꺼짐. 어느 쪽이든 파일 값으로 물러나면 된다.
    lastError = `연결 실패 (${err && err.name ? err.name : '알 수 없음'})`;
    return null;
  }
}

module.exports = {
  WINDOWS,
  readUsage,
  writeUsage,
  credentialPaths,
  parseApiUsage,
  fetchUsage,
  usageError,
};
