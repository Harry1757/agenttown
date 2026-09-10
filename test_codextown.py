import json
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone
from codextown import Tailer, usage_windows

class CodexTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.file = self.root / 'sessions/2026/09/10/rollout.jsonl'
        self.file.parent.mkdir(parents=True)
        self.ts = datetime.now(timezone.utc).isoformat()
        self.t = Tailer([self.root / 'sessions'], codex_home=self.root)

    def add(self, kind, payload, partial=False):
        with self.file.open('a') as f:
            f.write(json.dumps({'timestamp': self.ts, 'type': kind, 'payload': payload}) + ('' if partial else '\n'))

    def meta(self, sid='01a08a9a-847c-70a0-8a7b-ab6dcd26b65a'):
        self.add('session_meta', {'id': sid, 'cwd': '/work/project', 'originator': 'Codex Desktop', 'source':'vscode'})

    def row(self):
        return next(iter(self.t.sessions().values()))[0]

    def test_full_id_project_and_text_only_session(self):
        self.meta(); self.add('event_msg', {'type':'task_started'})
        self.t.seed()
        self.assertEqual(self.row()['sid'], '01a08a9a-847c-70a0-8a7b-ab6dcd26b65a')
        self.assertEqual(self.row()['state'], 'working')
        self.assertEqual(self.row()['cwd'], '/work/project')
        self.add('event_msg', {'type':'task_complete'})
        self.t.scan(); self.assertEqual(self.row()['state'], 'waiting')

    def test_cumulative_usage_not_double_counted(self):
        self.meta()
        for n in [100,100,180]:
            self.add('event_msg', {'type':'token_count','info':{'total_token_usage':{'total_tokens':n}}})
        self.t.seed()
        self.assertEqual(self.row()['tokens'],180)
        self.assertEqual(self.row()['tokensToday'],180)
        self.t.scan(); self.assertEqual(self.row()['tokens'],180)

    def test_partial_line_and_truncate(self):
        self.meta(); self.t.seed()
        self.add('event_msg', {'type':'task_complete'}, partial=True)
        self.t.scan(); self.assertEqual(self.row()['state'],'working')
        with self.file.open('a') as f:f.write('\n')
        self.t.scan(); self.assertEqual(self.row()['state'],'waiting')
        self.file.write_text(''); self.meta('new-session')
        self.t.scan(); self.assertEqual(self.row()['sid'],'new-session')
        self.assertEqual(self.row()['tokens'],0)

    def test_tool_mapping_does_not_expose_code(self):
        self.meta()
        self.add('response_item', {'type':'custom_tool_call','name':'exec','input':'text(await tools.exec_command({cmd:"npm test"})); // PRIVATE_SENTINEL'})
        ev=self.t.scan()[-1]
        self.assertEqual(ev['role'],'qa')
        self.assertNotIn('PRIVATE_SENTINEL',json.dumps(ev))

    def test_titles_archive_and_no_first_prompt_leak(self):
        import sqlite3
        self.meta()
        with sqlite3.connect(self.root / 'state_5.sqlite') as conn:
            conn.execute('CREATE TABLE threads (id TEXT, name TEXT, title TEXT, archived INTEGER)')
            conn.execute('INSERT INTO threads VALUES (?,?,?,?)', ('01a08a9a-847c-70a0-8a7b-ab6dcd26b65a','실제 작업 제목','PRIVATE PROMPT',0))
        self.t.seed()
        self.assertEqual(self.row()['title'],'실제 작업 제목')
        with sqlite3.connect(self.root / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET archived=1')
        self.t._index_at = 0
        self.assertEqual(self.t.sessions(),{})

    def test_patch_fingerprints_and_subagent(self):
        self.add('session_meta', {'id':'child','cwd':'/work/project','source':{'subagent':{'thread_spawn':{'parent_thread_id':'parent'}}}})
        self.add('response_item', {'type':'custom_tool_call','name':'apply_patch','input':'*** Begin Patch\n*** Update File: src/app.py\n+PRIVATE CODE\n*** End Patch'})
        event = self.t.scan()[-1]
        self.assertTrue(event['sub'])
        self.assertEqual(len(event['writes']),1)
        self.assertNotIn('PRIVATE CODE',json.dumps(event))
        self.assertTrue(self.row()['sub'])

    def test_pending_question_survives_background_tools_until_user_reply(self):
        self.meta()
        self.add('response_item', {'type':'function_call','name':'request_user_input_async','arguments':'{}'})
        self.t.scan()
        self.assertTrue(self.row()['needsInput'])
        self.add('response_item', {'type':'function_call','name':'exec_command','arguments':'{"cmd":"ls"}'})
        self.t.scan()
        self.assertTrue(self.row()['needsInput'])
        self.assertEqual(self.row()['state'],'waiting')
        self.add('response_item', {'type':'message','role':'user','content':[]})
        self.t.scan()
        self.assertFalse(self.row()['needsInput'])
        self.assertEqual(self.row()['state'],'working')

    def test_windows_keep_missing_unknown_and_multiple_buckets(self):
        out=usage_windows({'rateLimitsByLimitId':{
            'codex':{'primary':{'usedPercent':12,'windowDurationMins':10080,'resetsAt':123}},
            'spark':{'limitName':'Spark','primary':{'usedPercent':0,'windowDurationMins':300},'secondary':None}}})
        self.assertEqual(len(out),2)
        self.assertEqual(out[0]['used'],12)
        self.assertEqual(out[0]['resetsAt'],123000)
        self.assertIn('7일',out[0]['label'])
        self.assertEqual(usage_windows({'rateLimits':{'primary':{'usedPercent':None}}}),[])

if __name__=='__main__':unittest.main()
