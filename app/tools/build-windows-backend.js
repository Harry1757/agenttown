'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (process.platform !== 'win32') throw new Error('Windows 실행 엔진은 Windows에서 빌드해야 합니다. GitHub Actions의 Windows installer 작업을 사용하세요.');
const repo = path.resolve(__dirname, '../..');
const result = spawnSync(process.env.CODEXTOWN_PYTHON || 'python', [
  '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--console',
  '--name', 'codextown-server',
  '--distpath', path.join(repo, 'app/backend-dist'),
  '--workpath', path.join(repo, 'app/backend-build'),
  '--specpath', path.join(repo, 'app/backend-build'),
  '--add-data', `${path.join(repo, 'app/server')}${path.delimiter}.`,
  path.join(repo, 'codextown.py'),
], { cwd: repo, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
