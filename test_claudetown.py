"""ClaudeTown 자체 점검. 프레임워크 없음. python3 test_claudetown.py 로 실행."""
import struct
import json
import tempfile
import os
import time
from pathlib import Path
import claudetown as ct

HERE = Path(__file__).parent
ROLES = {"explore", "frontend", "backend", "infra", "qa",
         "release", "plan", "design", "research", "meeting"}


def png_size(path):
    """PNG 헤더에서 (width, height) 를 읽는다."""
    with open(path, "rb") as f:
        f.read(16)
        return struct.unpack(">II", f.read(8))


def test_assets_present_and_correct_size():
    expected = {
        "town.png": (192, 176),      # 12x11, stride 16
        "dungeon.png": (192, 176),   # 12x11, stride 16
        "indoor.png": (458, 305),    # 26x17, stride 17
    }
    for name, size in expected.items():
        p = HERE / "assets" / name
        assert p.exists(), f"에셋 없음: {name} — ./fetch_assets.sh 를 먼저 실행"
        assert png_size(p) == size, f"{name} 크기가 {png_size(p)}, 기대값 {size}"
    assert (HERE / "assets" / "LICENSE.txt").exists()


def test_bash_verb_skips_cd_chain():
    assert ct.bash_verb("cd /a/b && git status") == "git"
    assert ct.bash_verb("cd ~/x && python3 run.py") == "python3"


def test_bash_verb_skips_env_assignment():
    assert ct.bash_verb("FOO=1 BAR=2 python3 x.py") == "python3"


def test_bash_verb_uses_basename():
    assert ct.bash_verb("/usr/bin/grep -r foo .") == "grep"


def test_bash_verb_empty_when_nothing_left():
    assert ct.bash_verb("cd /tmp") == ""
    assert ct.bash_verb("") == ""


def test_role_for_bash_categories():
    assert ct.role_for("Bash", {"command": "pytest -q"}) == "qa"
    assert ct.role_for("Bash", {"command": "git commit -m x"}) == "release"
    assert ct.role_for("Bash", {"command": "docker ps"}) == "infra"
    assert ct.role_for("Bash", {"command": "curl https://x"}) == "research"
    assert ct.role_for("Bash", {"command": "cd x && ls -la"}) == "explore"


def test_unknown_bash_falls_back_to_explore():
    # for/do 같은 셸 루프는 파싱하지 않는다. 알 수 없는 동사는 탐색으로 보낸다.
    assert ct.role_for("Bash", {"command": "for f in *; do echo $f; done"}) == "explore"


def test_role_for_native_tools():
    assert ct.role_for("Read", {"file_path": "/a/b.py"}) == "backend"
    assert ct.role_for("Edit", {"file_path": "/a/src/app.tsx"}) == "frontend"
    assert ct.role_for("WebSearch", None) == "research"
    assert ct.role_for("Agent", None) == "meeting"
    assert ct.role_for("Task", None) == "meeting"
    assert ct.role_for("TodoWrite", None) == "plan"


def test_mcp_tools_route_by_name_or_default_research():
    assert ct.role_for("mcp__plugin_context7_context7__query-docs", None) == "research"
    assert ct.role_for("mcp__unknown_thing__do", None) == "research"


def test_unknown_native_tool_defaults_to_explore():
    # AskUserQuestion 93회, ToolSearch 65회가 여기 해당한다. 무시할 양이 아니다.
    assert ct.role_for("AskUserQuestion", None) == "plan"
    assert ct.role_for("ToolSearch", None) == "research"


def test_bash_verb_unwraps_sudo():
    assert ct.bash_verb("sudo git push") == "git"
    assert ct.role_for("Bash", {"command": "sudo git push"}) == "release"


def test_bash_verb_skips_wrapper_numeric_and_option_args():
    assert ct.bash_verb("timeout 30 python3 run.py") == "python3"
    assert ct.bash_verb("env -i node x.js") == "node"


def test_bash_verb_not_cmd_word_falls_to_next_segment():
    assert ct.bash_verb("cd /a/b && git status") == "git"
    assert ct.bash_verb("cd /a/b") == ""


def test_bash_verb_strips_subshell_parens():
    assert ct.bash_verb("(ls)") == "ls"
    assert ct.role_for("Bash", {"command": "(ls)"}) == "explore"


def test_build_verb_splits_qa_vs_infra_by_args():
    assert ct.role_for("Bash", {"command": "pnpm test"}) == "qa"
    assert ct.role_for("Bash", {"command": "cargo build"}) == "infra"


def test_label_prefers_filename():
    assert ct.label_for("Edit", {"file_path": "/home/pc/x/src/app.tsx"}) == "src/app.tsx"
    assert ct.label_for("Read", {"file_path": "/a/b/c/d/e/f.py"}) == "e/f.py"


def test_label_truncates_long_command():
    long = "python3 " + "x" * 200
    out = ct.label_for("Bash", {"command": long})
    assert len(out) <= ct.LABEL_MAX
    assert out.startswith("python3 ")


def test_label_collapses_whitespace():
    assert ct.label_for("Bash", {"command": "ls   -la\n  /tmp"}) == "ls -la /tmp"


def test_label_never_leaks_prompt_body():
    # Write 의 content 는 파일 본문이다. 절대 나가면 안 된다.
    out = ct.label_for("Write", {"file_path": "/a/b.py", "content": "SECRET_TOKEN=abc"})
    assert "SECRET" not in out
    assert out == "a/b.py"


def test_normalize_extracts_tool_use():
    row = {
        "type": "assistant", "timestamp": "2026-08-27T05:00:00.000Z",
        "sessionId": "9498b2af-1111", "entrypoint": "claude-vscode",
        "isSidechain": False, "attributionSkill": "superpowers:brainstorming",
        "message": {"content": [
            {"type": "text", "text": "무시되어야 함"},
            {"type": "tool_use", "name": "Edit", "input": {"file_path": "/p/src/a.ts"}},
        ]},
    }
    evs = ct.normalize(row)
    assert len(evs) == 1
    e = evs[0]
    assert e["name"] == "Edit"
    assert e["role"] == "frontend"
    assert e["label"] == "src/a.ts"
    assert e["sid"] == "9498b2af"          # 앞 8자로 줄인다
    assert e["entry"] == "claude-vscode"
    assert e["skill"] == "superpowers:brainstorming"
    assert e["sub"] is False
    assert "무시되어야 함" not in str(e)     # text 블록은 새어나가면 안 된다


def test_normalize_handles_multiple_tool_uses():
    row = {
        "type": "assistant", "timestamp": "2026-08-27T05:00:00.000Z",
        "sessionId": "abcd1234", "message": {"content": [
            {"type": "tool_use", "name": "Read", "input": {"file_path": "/a.py"}},
            {"type": "tool_use", "name": "Bash", "input": {"command": "git log"}},
        ]},
    }
    evs = ct.normalize(row)
    assert [e["role"] for e in evs] == ["backend", "release"]


def test_normalize_marks_subagent():
    row = {
        "type": "assistant", "timestamp": "t", "sessionId": "s", "isSidechain": True,
        "message": {"content": [{"type": "tool_use", "name": "Read", "input": {}}]},
    }
    assert ct.normalize(row)[0]["sub"] is True


def test_normalize_ignores_non_tool_rows():
    assert ct.normalize({"type": "user", "message": {"content": "안녕"}}) == []
    assert ct.normalize({"type": "mode", "mode": "x"}) == []
    assert ct.normalize({}) == []


def test_label_truncates_long_path():
    # c896f8f 회귀 방지: 마지막 두 세그먼트 합이 LABEL_MAX 를 넘는 경로
    long_path = "/home/pc/" + "a" * 30 + "/" + "b" * 30 + ".py"
    out = ct.label_for("Read", {"file_path": long_path})
    assert len(out) <= ct.LABEL_MAX, f"길이 {len(out)}"


def test_label_survives_non_dict_input():
    for bad in (["a", "b"], "문자열", 42, None):
        out = ct.label_for("Bash", bad)
        assert isinstance(out, str) and len(out) <= ct.LABEL_MAX


def test_normalize_survives_non_dict_tool_input():
    row = {"sessionId": "s", "timestamp": "t", "message": {"content": [
        {"type": "tool_use", "name": "Bash", "input": ["a", "b"]}]}}
    evs = ct.normalize(row)
    assert len(evs) == 1
    assert isinstance(evs[0]["label"], str)
    assert evs[0]["role"] in ROLES


def test_normalize_survives_non_dict_message_and_row():
    assert ct.normalize({"message": "oops"}) == []
    assert ct.normalize({"message": ["a"]}) == []
    assert ct.normalize("문자열 한 줄") == []
    assert ct.normalize([1, 2, 3]) == []


def _write_line(path, obj):
    with open(path, "a") as f:
        f.write(json.dumps(obj) + "\n")


def _row(tool="Read", cmd=None, sid="sess1234"):
    inp = {"command": cmd} if cmd else {"file_path": "/a/b.py"}
    return {"type": "assistant", "timestamp": "2026-08-27T05:00:00.000Z",
            "sessionId": sid, "entrypoint": "cli",
            "message": {"content": [{"type": "tool_use", "name": tool, "input": inp}]}}


def test_tailer_reads_only_new_lines():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-home-pc-demo"
        proj.mkdir()
        f = proj / "sess1234.jsonl"
        _write_line(f, _row())
        t = ct.Tailer([root])
        first = t.scan()
        assert len(first) == 1, f"첫 스캔에서 1개여야 하는데 {len(first)}개"

        second = t.scan()
        assert second == [], "같은 줄을 두 번 읽으면 안 된다"

        _write_line(f, _row(tool="Bash", cmd="git status"))
        third = t.scan()
        assert len(third) == 1 and third[0]["role"] == "release"


def test_tailer_fills_project_slug():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-home-pc-baros-next"
        proj.mkdir()
        _write_line(proj / "s.jsonl", _row())
        evs = ct.Tailer([root]).scan()
        assert evs[0]["proj"] == "-home-pc-baros-next"


def test_tailer_ignores_partial_trailing_line():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "s.jsonl"
        _write_line(f, _row())
        with open(f, "a") as fh:            # 개행 없는 잘린 줄
            fh.write('{"type":"assistant","mess')
        t = ct.Tailer([root])
        assert len(t.scan()) == 1           # 잘린 줄은 아직 처리하지 않는다

        with open(f, "a") as fh:            # 나머지가 도착
            fh.write('age":{"content":[{"type":"tool_use","name":"Edit","input":{}}]}}\n')
        rest = t.scan()
        assert len(rest) == 1 and rest[0]["role"] == "explore"


def test_tailer_survives_bad_json():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "s.jsonl"
        with open(f, "a") as fh:
            fh.write("깨진 줄입니다\n")
        _write_line(f, _row())
        assert len(ct.Tailer([root]).scan()) == 1   # 깨진 줄은 건너뛴다


def test_tailer_missing_root_is_not_an_error():
    assert ct.Tailer([Path("/없는/경로")]).scan() == []


def test_sessions_reports_active_by_mtime():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        fresh = proj / "fresh.jsonl"
        stale = proj / "stale.jsonl"
        _write_line(fresh, _row(sid="fresh"))
        _write_line(stale, _row(sid="stale"))
        os.utime(stale, (time.time() - 9999, time.time() - 9999))

        t = ct.Tailer([root])
        t.scan()
        rooms = t.sessions()["-p"]
        by_sid = {r["sid"]: r for r in rooms}
        assert by_sid["fresh"]["active"] is True
        assert by_sid["stale"]["active"] is False


def test_bash_verb_survives_non_string_command():
    for bad in (["ls", "-la"], {"a": 1}, 42, None, True):
        assert ct.bash_verb(bad) == ""


def test_label_for_does_not_dump_non_string_values():
    # str(dict) 덤프 경로 차단 — 프라이버시 경계
    out = ct.label_for("Bash", {"command": {"secret": "TOKEN123"}})
    assert "TOKEN" not in out and "secret" not in out
    assert isinstance(out, str) and len(out) <= ct.LABEL_MAX


def test_normalize_survives_non_string_command():
    row = {"sessionId": "s", "timestamp": "t", "message": {"content": [
        {"type": "tool_use", "name": "Bash", "input": {"command": ["ls", "-la"]}}]}}
    evs = ct.normalize(row)
    assert len(evs) == 1 and evs[0]["role"] == "explore"


def test_scan_skips_bad_row_without_losing_neighbours():
    # offset 이 파싱 앞에서 전진하므로, 행 하나가 터지면 청크 전체가 영구 손실된다.
    # 앞 행과 뒤 행이 모두 살아 나와야 한다.
    good = {"type": "assistant", "timestamp": "t", "sessionId": "sess0001",
            "entrypoint": "cli", "message": {"content": [
                {"type": "tool_use", "name": "Read", "input": {"file_path": "/a/b.py"}}]}}
    bad = {"type": "assistant", "timestamp": "t", "sessionId": "sess0001",
           "entrypoint": "cli", "message": {"content": [
               {"type": "tool_use", "name": "Bash", "input": {"command": ["ls", "-la"]}}]}}
    with tempfile.TemporaryDirectory() as d:
        root = Path(d); proj = root / "-p"; proj.mkdir()
        with open(proj / "s.jsonl", "w") as f:
            for row in (good, bad, good):
                f.write(json.dumps(row) + "\n")
        evs = ct.Tailer([root]).scan()
    assert len(evs) >= 2, f"앞뒤 행이 살아야 하는데 {len(evs)}개"
    assert all(isinstance(e["label"], str) for e in evs)


def test_safe_asset_path_blocks_traversal():
    assert ct.safe_asset("town.png") is not None
    assert ct.safe_asset("../claudetown.py") is None
    assert ct.safe_asset("../../etc/passwd") is None
    assert ct.safe_asset("/etc/passwd") is None
    assert ct.safe_asset("sub/../../x") is None


def test_sse_format():
    out = ct.sse("tool", {"a": 1})
    assert out == 'event: tool\ndata: {"a": 1}\n\n'


def test_safe_asset_never_raises():
    # 보안 경계는 어떤 입력에도 예외를 던지지 않고 None 을 돌려줘야 한다
    for bad in ("town.png\x00.txt", "", ".", "..", "a" * 5000, "/", "\x00"):
        assert ct.safe_asset(bad) is None, f"{bad!r} 가 None 이 아님"


def test_asset_content_type_by_suffix():
    assert ct.asset_content_type("town.png") == "image/png"
    assert ct.asset_content_type("LICENSE.txt").startswith("text/plain")
    assert ct.asset_content_type("x.bin") == "application/octet-stream"


def test_sessions_sorted_newest_first_and_capped():
    # 클라이언트가 이 순서를 그대로 방 배치 순서로 쓴다. 정렬이 깨지면 조용히 틀린다.
    import json as _json, tempfile as _tf, os as _os, time as _time
    from pathlib import Path as _P
    row = {"type": "assistant", "timestamp": "t", "entrypoint": "cli",
           "message": {"content": [{"type": "tool_use", "name": "Read",
                                    "input": {"file_path": "/a/b.py"}}]}}
    with _tf.TemporaryDirectory() as d:
        root = _P(d); proj = root / "-p"; proj.mkdir()
        now = _time.time()
        for i in range(6):
            f = proj / f"s{i}.jsonl"
            r = dict(row, sessionId=f"sess{i:04d}")
            f.write_text(_json.dumps(r) + "\n")
            _os.utime(f, (now - i * 100, now - i * 100))   # s0 가 가장 최근
        t = ct.Tailer([root])
        t.scan()
        rooms = t.sessions()["-p"]
    assert len(rooms) == ct.MAX_ROOMS, f"상한 {ct.MAX_ROOMS} 인데 {len(rooms)}개"
    sids = [r["sid"] for r in rooms]
    assert sids == sorted(sids, key=lambda s: int(s[4:]) if s[4:].isdigit() else 0), sids
    assert sids[0].startswith("sess0000"[:8]), sids


def test_label_strips_leading_env_assignments():
    # 인라인 환경변수가 화면과 SSE 로 나가면 안 된다 (설계서 6장)
    out = ct.label_for("Bash", {"command": "GITHUB_TOKEN=ghp_1234567890abcdefXYZ gh pr list"})
    assert "ghp_" not in out and "TOKEN" not in out, out
    assert out.startswith("gh pr list"), out
    # 앞에 붙지 않은 = 는 인자다. 지우면 안 된다.
    keep = ct.label_for("Bash", {"command": "pytest --maxfail=1 -q"})
    assert "--maxfail=1" in keep, keep


def test_assets_path_is_absolute():
    # 다른 cwd 에서 실행해도 에셋 전제조건 검사가 맞아야 한다
    assert ct.ASSETS.is_absolute(), ct.ASSETS
    assert (ct.ASSETS / "town.png").is_file()


def test_role_for_always_returns_one_of_ten_roles():
    spread = [
        ("Read", {"file_path": "/a/b.py"}),
        ("Edit", {"file_path": "/a/src/app.tsx"}),
        ("Bash", {"command": "docker compose up"}),
        ("Bash", {"command": "curl https://x"}),
        ("Bash", {"command": ""}),
        ("mcp__plugin_context7_context7__query-docs", {}),
        ("mcp__unknown_thing__do", {}),
        ("Agent", {}),
        ("Task", {}),
        ("TodoWrite", {}),
        ("WebSearch", {}),
        ("Skill", {}),
        ("AskUserQuestion", {}),
        ("SomeUnknownTool", {}),
        (None, None),
        ("Bash", None),
        ("Bash", ["not", "a", "dict"]),
        (123, {"file_path": 42}),
        ("Read", "문자열 입력"),
    ]
    for name, inp in spread:
        role = ct.role_for(name, inp)
        assert role in ROLES, f"{name!r} -> {role!r}"
    # skill 인자도 junk 를 견뎌야 한다
    assert ct.role_for("Skill", {}, skill=None) in ROLES
    assert ct.role_for("Skill", {}, skill=42) in ROLES


def test_role_for_find_not_path_is_explore_not_release():
    # 1차 분류기의 회귀: 명령 전체를 정규식으로 훑으면 -not -path 가 release 로 잘못 걸렸다.
    assert ct.role_for("Bash", {"command": 'find ~ -not -path "*/.git/*"'}) == "explore"


def test_role_for_test_substring_in_path_is_not_qa():
    # 경로에 "test" 문자열이 있다고 QA 가 아니다 — 파일이 테스트 파일이어야 QA.
    assert ct.role_for("Edit", {"file_path": "/home/pc/latest/app.tsx"}) == "frontend"
    assert ct.role_for("Edit", {"file_path": "/home/pc/proj/test_app.py"}) == "qa"


def test_role_for_ext_before_bash_verb():
    # 파일 확장자가 Bash 동사보다 먼저 본다 — Bash 인데 file_path 가 있으면
    # 동사(cat -> explore)보다 확장자(.py -> backend)가 이긴다.
    assert ct.role_for("Bash", {"file_path": "/a/server.py", "command": "cat server.py"}) == "backend"


def _title_row(sid, title):
    return {"type": "ai-title", "sessionId": sid, "aiTitle": title}


def test_sessions_reports_title_from_ai_title_row():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "titled.jsonl"
        _write_line(f, _row(sid="titled"))
        _write_line(f, _title_row("titled", "재밌는 거 만들기"))
        t = ct.Tailer([root])
        t.scan()
        rooms = t.sessions()["-p"]
        by_sid = {r["sid"]: r for r in rooms}
        assert by_sid["titled"]["title"] == "재밌는 거 만들기"


def test_sessions_title_defaults_to_empty_string():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "untitled.jsonl"
        _write_line(f, _row(sid="untitled"))
        t = ct.Tailer([root])
        t.scan()
        rooms = t.sessions()["-p"]
        assert rooms[0]["title"] == ""


def test_mcp_role_parses_server_segment_not_substring():
    # 버그 2 회귀: ('plugin','infra') 를 MCP 툴 이름에 substring 매칭하면
    # 'plugin_...' 이 낀 이름은 거의 다 infra 로 잘못 간다. 구조적으로 서버
    # 세그먼트만 뽑아야 한다.
    assert ct.role_for("mcp__plugin_playwright_playwright__browser_click", None) == "qa"
    assert ct.role_for("mcp__plugin_serena_serena__find_symbol", None) != "infra"
    assert ct.role_for("mcp__plugin_serena_serena__find_symbol", None) == "explore"
    assert ct.role_for("mcp__plugin_serena_serena__initial_instructions", None) == "explore"
    assert ct.role_for("mcp__github__create_pr", None) == "release"


def test_role_for_runner_verb_checks_test_invocation_args():
    # 버그 3: 'python3 -m pytest' 는 _segments 가 verb=python3 만 내서 backend 로
    # 떨어졌다. -m 다음 토큰, 혹은 플래그 자체(대시 뗀 이름)를 봐야 한다.
    assert ct.role_for("Bash", {"command": "python3 -m pytest"}) == "qa"
    assert ct.role_for("Bash", {"command": "python -m unittest"}) == "qa"
    assert ct.role_for("Bash", {"command": "node --test"}) == "qa"


def test_label_redacts_export_assignment_credential():
    out = ct.label_for("Bash", {"command": "export ANTHROPIC_API_KEY=sk-ant-abc123def456 gh pr list"})
    assert "sk-ant" not in out, out
    assert "abc123def456" not in out, out


def test_label_redacts_bearer_token():
    out = ct.label_for("Bash", {"command": 'curl -H "Authorization: Bearer sk-live-abcdef123456" https://x'})
    assert "sk-live-abcdef123456" not in out, out


def test_label_redacts_url_userinfo_password():
    out = ct.label_for("Bash", {"command": 'psql "postgres://admin:hunter2@db/x"'})
    assert "hunter2" not in out, out


def test_server_binds_loopback_only():
    # 이 앱에서 가장 중요한 불변식인데도 지금까지 테스트가 없었다 — 서버가
    # 0.0.0.0 같은 걸로 바인드되면 로컬 전용이라는 전제가 통째로 깨진다.
    # 실제로 소켓을 열어 뭐에 바인드됐는지 확인한다. 포트 0 은 OS 가 빈 포트를
    # 골라주므로 8765(사용자의 실제 서버)는 건드리지 않는다.
    srv = ct.ThreadingHTTPServer(("127.0.0.1", 0), ct.Handler)
    try:
        assert srv.server_address[0] == "127.0.0.1"
    finally:
        srv.server_close()


def test_turn_signal_only_reacts_to_turn_rows():
    # 메타 줄(attachment/ai-title/last-prompt)은 턴과 무관하다 — 이것들이 상태를
    # 건드리면 세션 하나가 계속 '작업 중'과 '응답 대기' 사이를 오간다.
    assert ct.Tailer._turn_signal({"type": "system", "subtype": "turn_duration"}) is True
    assert ct.Tailer._turn_signal({"type": "assistant"}) is False
    assert ct.Tailer._turn_signal({"type": "user"}) is False
    for meta in ("attachment", "ai-title", "last-prompt", "mode", "file-history-snapshot"):
        assert ct.Tailer._turn_signal({"type": meta}) is None, meta
    assert ct.Tailer._turn_signal({"type": "system", "subtype": "stop_hook_summary"}) is None


def test_sessions_state_working_waiting_done():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()

        working = proj / "working.jsonl"      # 방금 툴을 돌렸다 -> 작업 중
        _write_line(working, _row(sid="working"))

        waiting = proj / "waiting.jsonl"      # 턴이 끝났다 -> 사용자 차례
        _write_line(waiting, _row(sid="waiting"))
        with open(waiting, "a") as f:
            f.write(json.dumps({"type": "system", "subtype": "turn_duration",
                                "sessionId": "waiting"}) + "\n")

        done = proj / "done.jsonl"            # DONE_AFTER 넘게 조용하다 -> 완료
        _write_line(done, _row(sid="done"))

        t = ct.Tailer([root])
        t.scan()
        old = time.time() - ct.DONE_AFTER - 60
        os.utime(done, (old, old))

        by_sid = {r["sid"]: r for r in t.sessions()["-p"]}
        assert by_sid["working"]["state"] == "working", by_sid["working"]
        assert by_sid["waiting"]["state"] == "waiting", by_sid["waiting"]
        assert by_sid["done"]["state"] == "done", by_sid["done"]
        # active 는 working 하고만 같은 뜻이어야 한다 (기존 화면이 이걸 쓴다)
        assert by_sid["working"]["active"] is True
        assert by_sid["waiting"]["active"] is False
        assert by_sid["done"]["active"] is False


def test_sessions_state_returns_to_working_after_new_user_turn():
    # 턴이 끝난 뒤 사용자가 다시 말을 걸면 '작업 중'으로 돌아와야 한다.
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "s.jsonl"
        _write_line(f, _row(sid="s"))
        with open(f, "a") as fh:
            fh.write(json.dumps({"type": "system", "subtype": "turn_duration", "sessionId": "s"}) + "\n")
        t = ct.Tailer([root])
        t.scan()
        assert t.sessions()["-p"][0]["state"] == "waiting"

        with open(f, "a") as fh:
            fh.write(json.dumps({"type": "user", "sessionId": "s"}) + "\n")
        t.scan()
        assert t.sessions()["-p"][0]["state"] == "working"


def test_sessions_state_is_working_until_turn_ends():
    # 상태를 가르는 건 시간이 아니라 '턴이 끝났나' 다. 조용해도 턴이 안 끝났으면
    # 일하는 중이고(예전엔 이걸 stuck 으로 따로 뒀다가 뺐다), 턴이 끝나면 내 차례다.
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "s.jsonl"
        _write_line(f, _row(sid="s"))          # 툴 이벤트 = 턴 진행 중
        t = ct.Tailer([root])
        t.scan()
        assert t.sessions()["-p"][0]["state"] == "working"

        quiet = time.time() - 600               # 10분 조용해도 턴이 안 끝났으면 working
        os.utime(f, (quiet, quiet))
        assert t.sessions()["-p"][0]["state"] == "working"

        with open(f, "a") as fh:
            fh.write(json.dumps({"type": "system", "subtype": "turn_duration", "sessionId": "s"}) + "\n")
        t.scan()
        os.utime(f, (quiet, quiet))
        assert t.sessions()["-p"][0]["state"] == "waiting"


def test_kst_day_shifts_utc_by_nine_hours():
    # 트랜스크립트 시각은 UTC 다. 그대로 자르면 한국 시간 오전 9시에 날이 바뀐다.
    assert ct.kst_day("2026-08-27T14:00:00.000Z") == "2026-08-27"   # KST 23시
    assert ct.kst_day("2026-08-27T15:00:00.000Z") == "2026-08-28"   # KST 자정
    assert ct.kst_day("2026-08-27T20:00:00.000Z") == "2026-08-28"   # KST 새벽 5시
    assert ct.kst_day("") == ""                                     # 못 읽으면 빈 문자열
    assert ct.kst_day("깨진값") == ""


def test_tokens_today_counts_only_today_kst():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        proj = root / "-p"
        proj.mkdir()
        f = proj / "s.jsonl"
        today = ct.kst_day()
        # 오늘 것 하나, 확실히 지난 날 것 하나.
        for ts, tok in ((f"{today}T01:00:00.000Z", 100), ("2020-01-01T01:00:00.000Z", 999)):
            with open(f, "a") as fh:
                fh.write(json.dumps({
                    "type": "assistant", "sessionId": "s", "timestamp": ts,
                    "message": {"usage": {"input_tokens": tok, "output_tokens": 0,
                                          "cache_creation_input_tokens": 0},
                                "content": [{"type": "tool_use", "name": "Read",
                                             "input": {"file_path": "a.txt"}}]},
                }) + "\n")
        t = ct.Tailer([root])
        t.scan()
        row = t.sessions()["-p"][0]
        assert row["tokens"] == 1099, row          # 전체 누계는 둘 다
        assert row["tokensToday"] == 100, row      # 오늘치는 오늘 것만


# 새 테스트는 반드시 이 줄보다 위에 정의한다.
# 아래 러너는 globals() 로 test_* 이름을 수집하므로, 이 줄 밑에 두면 실행되지 않는다.
if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    if not tests:
        print("테스트를 하나도 수집하지 못했습니다 — 러너 앞에 정의됐는지 확인하세요")
        raise SystemExit(1)
    fails = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  ok   {name}")
        except AssertionError as e:
            fails += 1
            print(f"  FAIL {name}: {e}")
        except Exception as e:
            fails += 1
            print(f"  FAIL {name}: {type(e).__name__}: {e}")
    print(f"{len(tests)}개 중 {len(tests) - fails}개 통과")
    raise SystemExit(fails)
