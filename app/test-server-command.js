'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { serverCommands } = require('./src/server-command');
const base = { resourcesPath: '/App Resources', dir: '/App Resources/server', env: {}, exists: () => false };
test('Windows installer uses bundled engine without Python on PATH', () => {
  const commands = serverCommands({ ...base, platform: 'win32', exists: () => true });
  assert.equal(commands.length, 1);
  assert.match(commands[0].binary, /backend.*codextown-server\.exe$/);
  assert.deepEqual(commands[0].args, ['--no-browser']);
});
test('Windows source launch supports Python launcher and paths containing spaces', () => {
  const commands = serverCommands({ ...base, platform: 'win32', env: { CODEXTOWN_PYTHON: 'C:\\My Python\\python.exe' } });
  assert.equal(commands[0].binary, 'C:\\My Python\\python.exe');
  assert.equal(commands[0].args[0], '/App Resources/server/codextown.py');
  assert.deepEqual(commands.at(-1).args, ['-3', '/App Resources/server/codextown.py', '--no-browser']);
});
test('Mac retains existing interpreter discovery', () => {
  const commands = serverCommands({ ...base, platform: 'darwin' });
  assert.equal(commands[0].binary, '/opt/homebrew/bin/python3');
  assert.equal(commands.at(-1).binary, 'python3');
});
