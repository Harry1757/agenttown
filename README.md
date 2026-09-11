# CodexTown

ClaudeTown의 도트 마을을 유지하면서 **Codex 데스크톱·명령줄 세션과 계정 사용량**을 표시하는 로컬 앱입니다.

## 실행

맥에서는 `/Applications/CodexTown.app`을 열거나 저장소의 `CodexTown.command`를 더블클릭합니다.
창을 닫으면 메뉴 막대에 남습니다. 메뉴의 **종료**로 앱과 앱이 시작한 서버를 종료합니다.

브라우저만으로 실행하려면:

```sh
./launch.sh
```

접속 주소: `http://127.0.0.1:8766`. ClaudeTown의 기본 포트 8765와 다릅니다.

개발·맥 앱 빌드:

```sh
cd app
npm ci
npm start
# 독립 실행 앱 생성
npm run dist:mac
```

## 표시하는 정보

- Codex 작업별 캐릭터, 프로젝트·작업 제목·사용 모델, 작업 중/응답 대기/완료
- 도구 사용에 따른 방 이동, 확대·축소·배회·제스처
- 작업별 누적 토큰과 한국 시간 자정 기준 오늘 토큰. 캐시 입력 포함 입력·출력 합계입니다. 추론 토큰은 출력에 포함되므로 별도로 더하지 않습니다.
- 계정에서 실제로 제공하는 기간별 사용량과 초기화 시각. 기본 Codex와 Spark 등 별도 한도를 모두 표시합니다. 값이 없는 한도를 0%로 만들지 않습니다.
- 사용자 질문이 생기면 **응답 요청**, 답변이 끝나면 **응답 완료** 무음 배너 알림을 보냅니다. 소리는 재생하지 않습니다. 창을 닫아 메뉴 막대에 숨긴 동안에도 동작합니다. 같은 요청은 중복 알림하지 않으며 메뉴에서 **알림 테스트**를 실행할 수 있습니다. macOS 알림 및 집중 모드 설정이 실제 배너 표시에 적용됩니다. 캐릭터를 더블클릭하거나 알림을 누르면 해당 Codex 작업을 엽니다(데스크톱 앱).
- `apply_patch`로 같은 파일을 수정하는 작업 간 충돌 표시. 셸·임의 스크립트를 통한 수정까지 추적하지는 않습니다.

## 작업실 업그레이드

- 숲색 도트 오피스, 화분과 산책로, 인원이 많은 방의 정돈된 배치
- 작업 제목·프로젝트·모델 검색, 상태/프로젝트 필터, 즐겨찾기
- ‘내 응답’에서 실제 질문 요청만 모아 보기. 병행 작업 중에도 요청 표시 유지
- 작업을 클릭하면 모델·최근 도구·토큰 표시. ‘지도에서 찾기’와 ‘Codex에서 열기’
- 헤더에서 무음 배너를 켜고 끌 수 있으며 설정은 재실행 후에도 유지
- `⌘K` / `Ctrl+K`로 검색, `Esc`로 선택 해제, `0`으로 지도 전체 보기
- 동작 줄이기 지원. 창을 숨기거나 최소화하면 지도 그리기를 중지하고 알림 연결은 유지
- 즐겨찾기와 동작 설정은 브라우저/앱의 로컬 저장소에만 저장

## 데이터와 한계

`$CODEX_HOME`(기본 `~/.codex`)의 `sessions/**/*.jsonl`을 읽고 추가된 완전한 줄만 처리합니다. 전체 작업 ID를 사용하여 캐릭터 충돌을 방지합니다. `session_index.jsonl`과 로컬 `state_*.sqlite`를 읽기 전용으로 열어 작업 이름과 보관 상태를 확인합니다.

Codex 공식 [App Server](https://developers.openai.com/codex/app-server)의 `account/rateLimits/read`를 5분마다 호출합니다. 새 모델 작업을 실행하지 않으며 별도 API 키를 요구하지 않습니다. 조회가 실패하면 이전 값 또는 세션 기록을 표시하고 **이전 기록**임을 명시합니다. 한도 비율은 계정 전체 값이며, 로컬 오늘 토큰과 다른 범위입니다.

최근 이틀 안에 기록이 갱신된 세션을 표시합니다. 30분 동안 기록이 없으면 ‘완료’로 추정합니다. 긴 명령 실행 중에도 이 기준이 적용될 수 있습니다. 다른 기기의 작업, 일반 ChatGPT 웹 채팅, 로컬 기록이 없는 클라우드 작업은 이 목록에 포함되지 않습니다. 포크에 복사된 과거 기록이 있으면 로컬 토큰 합계에 포함될 수 있으며 결제 금액을 계산하는 지표는 아닙니다.

HTTP 서버는 `127.0.0.1`에만 열립니다. 명령·코드 본문, 도구 결과, 인증 토큰은 화면에 보내지 않습니다. 작업 제목·프로젝트 경로·도구 이름과 집계값만 전달합니다. 파일 충돌에는 경로를 해시한 식별자를 사용합니다.

환경 변수:

- `CODEX_HOME`: Codex 기록 폴더
- `CODEXTOWN_ROOTS`: 세션 폴더 경로(여러 개는 운영체제 경로 구분자로 연결)
- `CODEXTOWN_PORT`: 포트(기본 8766)
- `CODEXTOWN_CODEX`: Codex 실행 파일
- `CODEXTOWN_PYTHON`: Python 3 실행 파일

## 검증

```sh
python3 -m unittest test_codextown -v
python3 test_claudetown.py
node test_town_scale.js
node test_wander.js
node --test app/test-notifications.js
```

`claudetown.py`는 기존 도구 분류·정적 파일·이벤트 전송 코드를 재사용하는 내부 모듈입니다. Codex용 실행 진입점은 `codextown.py`입니다. Claude 전용 사용량 조회 및 Windows 설치 스크립트는 제거했습니다. macOS Apple Silicon은 실행 검증을 마쳤습니다. Windows x64 설치 파일 구성은 추가했으며, 실제 Windows 빌드 결과와 설치 검증은 별도로 확인해야 합니다.

원본의 미커밋 변경까지 보존한 기준 커밋: `a4e3d53`.
별도 원본 백업: `../claudetown-backup-20260910-181812/`.
원본 `~/projects/claudetown`은 수정하지 않았습니다.


## Windows 설치 파일

Windows x64용 `CodexTown-1.0.0-Windows-x64-Setup.exe`를 만드는 구성이 포함되어 있습니다.
설치 파일에는 Python 실행 엔진이 들어가므로, 받는 사람은 Python이나 Node.js를 따로 설치할 필요가 없습니다.
받는 사람의 PC에 Codex 사용 기록이 있어야 캐릭터가 표시됩니다. 기본 위치는 `%USERPROFILE%\.codex`입니다.
Windows에서 직접 생성된 기록을 대상으로 하며 WSL 내부의 기록은 자동으로 찾지 않습니다.
일반 ChatGPT 웹 대화를 읽는 앱은 아닙니다.

계정 사용량은 로그인된 Codex 명령줄 실행 파일이 있을 때 조회합니다. 자동으로 찾지 못하면
`CODEXTOWN_CODEX`에 실제 `codex.exe` 경로를 지정할 수 있습니다. 계정 조회가 안 되어도 로컬 세션은 표시됩니다.
작업 바로 열기는 `codex://` 주소를 처리하는 Codex 앱이 설치되어 있어야 합니다.
알림은 Windows의 알림 설정과 방해 금지 설정을 따르며 앱은 소리를 요청하지 않습니다.

### Windows에서 빌드

빌드하는 PC에는 Python 3.12와 Node.js 22가 필요합니다. PowerShell에서 저장소 루트를 열고 실행합니다.

```powershell
python -m pip install PyInstaller==6.22.2
npm --prefix app ci
npm --prefix app run dist:win
python tools/check-packaged-server.py app/dist/win-unpacked/resources/backend/codextown-server.exe
```

결과는 `app/dist/` 아래의 `CodexTown-*-Setup.exe`입니다.
동봉 실행 엔진은 Windows에서 빌드해야 합니다. macOS의 Python 실행 파일을 넣어 배포하지 않습니다.

### GitHub에서 빌드

저장소의 Actions → **Windows installer** → **Run workflow**를 실행하면
Windows에서 테스트와 빌드를 수행하고 실행 엔진의 서버·화면·이미지를 확인합니다.
성공한 실행의 `CodexTown-Windows-x64` 파일 묶음에는 설치 파일과 SHA-256 체크섬이 들어 있습니다.
이 묶음은 30일 보관되며 GitHub 로그인이 필요합니다. 누구나 내려받는 링크는 검증한 설치 파일을
공개 Releases 또는 별도 다운로드 페이지에 올려 제공해야 합니다. 이 작업은 자동 공개하지 않습니다.
현재 빌드는 서명 없는 테스트 배포용입니다. 일반 공개용 배포 전에는 Windows에서 설치·삭제,
Codex 세션 인식, 알림과 바로 열기를 확인해야 합니다.
