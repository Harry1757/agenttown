'use strict';
const path = require('node:path');

// Each candidate is an executable plus arguments, never a shell command.
function serverCommands({ platform, resourcesPath, dir, env, exists }) {
  const script = path.join(dir, 'codextown.py');
  const candidates = [];
  if (platform === 'win32') {
    const bundled = path.join(resourcesPath, 'backend', 'codextown-server.exe');
    if (exists(bundled)) return [{ binary: bundled, args: ['--no-browser'] }];
    const python = path.join(resourcesPath, 'python', 'python.exe');
    if (exists(python)) return [{ binary: python, args: [script, '--no-browser'] }];
  }
  if (env.CODEXTOWN_PYTHON) candidates.push({ binary: env.CODEXTOWN_PYTHON, args: [script, '--no-browser'] });
  const binaries = platform === 'win32' ? ['python', 'python3'] : ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3', 'python3'];
  for (const binary of binaries) candidates.push({ binary, args: [script, '--no-browser'] });
  if (platform === 'win32') candidates.push({ binary: 'py', args: ['-3', script, '--no-browser'] });
  return candidates;
}
module.exports = { serverCommands };
