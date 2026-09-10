'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness() {
  const handlers = {}, shown = [], opened = [];
  class Notification {
    static isSupported() { return true; }
    constructor(options) { this.options = options; this.events = {}; }
    on(name, callback) { this.events[name] = callback; }
    show() { shown.push(this); }
  }
  const electron = {
    app: { setName() {}, requestSingleInstanceLock: () => false, quit() {}, on() {} },
    ipcMain: { handle: (name, fn) => handlers[name] = fn, on() {} },
    shell: { openExternal: async url => opened.push(url) }, Notification,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf8'), {
    require: name => name === 'electron' ? electron : require(name),
    __dirname: path.join(__dirname, 'src'), process, console, setTimeout,
  });
  return { handlers, shown, opened };
}
test('question notification requests an answer and opens the exact task', async () => {
  const h = harness(), sid = '01a08a9a-847c-70a0-8a7b-ab6dcd26b65a';
  h.handlers['notify-waiting']({}, { title: '테스트 작업', sid, kind: 'ask' });
  assert.match(h.shown[0].options.title, /응답 요청/);
  assert.equal(h.shown[0].options.silent, true);
  await h.shown[0].events.click();
  assert.equal(h.opened[0], `codex://threads/${sid}`);
});
test('question plus waiting transition produces only one notification', () => {
  const h = harness(), sid = '01a08a9a-847c-70a0-8a7b-ab6dcd26b65a';
  h.handlers['notify-waiting']({}, { title: '테스트', sid, kind: 'ask' });
  h.handlers['notify-waiting']({}, { title: '테스트', sid, kind: 'waiting' });
  assert.equal(h.shown.length, 1);
});
