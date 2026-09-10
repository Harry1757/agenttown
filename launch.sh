#!/usr/bin/env bash
# ClaudeTown 키오스크 런처.
# 서버(claudetown.py)가 안 떠 있으면 백그라운드로 띄우고, Chrome 을
# --app 모드(주소창·탭 없음)로 연다. 이미 떠 있으면 새로 띄우지 않는다.
#
#   ./launch.sh                서버 확인/시작 + 브라우저 열기
#   ./launch.sh --server-only  서버만 확인/시작하고 끝 (app/ 의 Electron 셸이 씀)
#   ./launch.sh --stop         이 스크립트가 띄운 서버를 종료
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST=127.0.0.1
PORT=8765
URL="http://${HOST}:${PORT}"
PIDFILE="/tmp/claudetown-${PORT}.pid"
LOGFILE="/tmp/claudetown-${PORT}.log"

is_up() {
    curl -fsS -o /dev/null --max-time 1 "$URL/" 2>/dev/null
}

stop_server() {
    if [[ -f "$PIDFILE" ]]; then
        local pid
        pid="$(cat "$PIDFILE" 2>/dev/null || true)"
        # pid 가 살아 있어도 그게 claudetown.py 라는 보장은 없다 — 서버가 죽은 뒤
        # 그 pid 가 완전히 다른 프로세스로 재사용됐을 수 있다. 죽이기 전에
        # 명령줄을 읽어 진짜 claudetown.py 인지 확인한다.
        # macOS 엔 /proc 이 없다. 양쪽에 다 있는 ps 로 본다.
        if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null \
            && ps -p "$pid" -o command= 2>/dev/null | grep -q "claudetown.py"; then
            kill "$pid" 2>/dev/null || true
            echo "ClaudeTown 서버(pid $pid) 종료."
        else
            echo "기록된 pid($pid)가 이미 죽었거나 다른 프로세스로 재사용됐습니다 — 건드리지 않습니다."
        fi
        rm -f "$PIDFILE"
    else
        echo "이 스크립트가 띄운 서버가 없습니다 (pidfile 없음)."
    fi
}

if [[ "${1:-}" == "--stop" ]]; then
    stop_server
    exit 0
fi

if is_up; then
    echo "이미 ${URL} 에서 서버가 응답합니다. 새 서버를 띄우지 않습니다."
else
    echo "서버를 시작합니다..."
    # --no-browser: claudetown.py 는 뜰 때 기본 브라우저를 직접 열려고 한다.
    # 여기서는 뒤이어 Chrome 을 앱모드로 열 것이므로 중복 창을 막는다.
    # '&' 를 'cd ... && nohup ...' 전체에 걸면 $! 가 python 이 아니라 그 compound 를
    # 감싼 중간 서브셸의 pid 다. 그 서브셸은 즉시 죽고 python 은 고아가 되므로
    # pidfile 이 죽은 pid 를 가리켜 --stop 도 트레이 '종료' 도 서버를 못 내린다.
    # '&' 가 nohup 한 줄에만 걸리게 쪼개서 $! 가 진짜 서버 pid 가 되게 한다.
    (
        cd "$REPO_DIR"
        nohup python3 claudetown.py --no-browser >"$LOGFILE" 2>&1 &
        echo $! > "$PIDFILE"
    )

    for _ in $(seq 1 30); do
        is_up && break
        sleep 0.5
    done

    if ! is_up; then
        echo "서버가 응답하지 않습니다. 로그를 확인하세요: $LOGFILE" >&2
        exit 1
    fi
    echo "서버가 떴습니다: $URL"
fi

if [[ "${1:-}" == "--server-only" ]]; then
    exit 0
fi

# --- Chrome/Edge 를 --app 모드로 연다 ---------------------------------------
IS_MAC=false
[[ "$(uname -s)" == "Darwin" ]] && IS_MAC=true

find_browser() {
    local p
    if $IS_MAC; then
        for p in \
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
            "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        do
            [[ -x "$p" ]] && { echo "$p"; return 0; }
        done
        return 1
    fi
    for p in \
        "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
        "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    do
        [[ -x "$p" ]] && { echo "$p"; return 0; }
    done
    for p in /mnt/c/Users/*/AppData/Local/Google/Chrome/Application/chrome.exe; do
        [[ -x "$p" ]] && { echo "$p"; return 0; }
    done
    for p in \
        "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
        "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
    do
        [[ -x "$p" ]] && { echo "$p"; return 0; }
    done
    for p in /mnt/c/Users/*/AppData/Local/Microsoft/Edge/Application/msedge.exe; do
        [[ -x "$p" ]] && { echo "$p"; return 0; }
    done
    return 1
}

if BROWSER_EXE="$(find_browser)"; then
    # 브라우저가 이미 떠 있으면 --app 요청이 기존 창의 새 '탭'으로 흡수돼
    # 버려질 수 있다 (주소창 있는 그냥 탭). 전용 프로필로 띄우면 항상
    # 별도의 진짜 --app 창이 새로 뜬다.
    APP_PROFILE_DIR=""
    if $IS_MAC; then
        APP_PROFILE_DIR="$HOME/Library/Application Support/ClaudeTown/ChromeProfile"
    elif LOCALAPPDATA_WIN="$(cmd.exe /C "echo %LOCALAPPDATA%" 2>/dev/null | tr -d '\r\n')" && [[ -n "$LOCALAPPDATA_WIN" ]]; then
        APP_PROFILE_DIR="${LOCALAPPDATA_WIN}\\ClaudeTown\\ChromeProfile"
    fi

    ARGS=("--app=${URL}" --window-size=1280,860)
    [[ -n "$APP_PROFILE_DIR" ]] && ARGS+=("--user-data-dir=${APP_PROFILE_DIR}" --no-first-run --no-default-browser-check)

    "$BROWSER_EXE" "${ARGS[@]}" >/dev/null 2>&1 &
    disown
    echo "브라우저를 앱모드로 열었습니다: $BROWSER_EXE"
else
    echo "Chrome/Edge 를 찾지 못했습니다. 기본 브라우저로 엽니다 (주소창이 보일 수 있습니다)."
    # 맥은 open, WSL 은 explorer.exe, 그 밖의 리눅스는 xdg-open.
    if $IS_MAC; then
        open "$URL" >/dev/null 2>&1 || echo "open 으로 열지 못했습니다. 직접 열어보세요: $URL" >&2
    elif command -v explorer.exe >/dev/null 2>&1; then
        explorer.exe "$URL" >/dev/null 2>&1 || echo "explorer.exe 로도 열지 못했습니다. 직접 열어보세요: $URL" >&2
    else
        xdg-open "$URL" >/dev/null 2>&1 || echo "직접 열어보세요: $URL" >&2
    fi
fi
