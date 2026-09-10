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
- 응답 대기 전환 알림. 캐릭터를 더블클릭하거나 알림을 누르면 해당 Codex 작업을 엽니다(데스크톱 앱).
- `apply_patch`로 같은 파일을 수정하는 작업 간 충돌 표시. 셸·임의 스크립트를 통한 수정까지 추적하지는 않습니다.

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
```

`claudetown.py`는 기존 도구 분류·정적 파일·이벤트 전송 코드를 재사용하는 내부 모듈입니다. Codex용 실행 진입점은 `codextown.py`입니다. Claude 전용 사용량 조회 및 Windows 설치 스크립트는 제거했습니다. 현재 배포 검증 대상은 macOS Apple Silicon입니다.

원본의 미커밋 변경까지 보존한 기준 커밋: `a4e3d53`.
별도 원본 백업: `../claudetown-backup-20260910-181812/`.
원본 `~/projects/claudetown`은 수정하지 않았습니다.
