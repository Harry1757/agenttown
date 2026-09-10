'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const PORT = Number(process.env.CODEXTOWN_PORT || 8766);
const URL = `http://127.0.0.1:${PORT}`;
const ASSETS = path.join(__dirname, '..', 'assets');
let win, tray, server, quitting = false;
app.setName('CodexTown');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => show());
  app.whenReady().then(start).catch(err => {
    dialog.showErrorBox('CodexTown 실행 실패', err.message);
    app.quit();
  });
}
function health() {
  return new Promise(resolve => {
    const req = http.get(`${URL}/health`, { timeout: 1000 }, res => {
      let body = ''; res.on('data', b => { body += b; });
      res.on('end', () => {
        try { resolve(JSON.parse(body).app === 'codextown'); } catch { resolve(false); }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}
async function startServer() {
  if (await health()) return;
  const packaged = path.join(__dirname, '..', 'server');
  const dir = fs.existsSync(path.join(packaged, 'codextown.py')) ? packaged : path.resolve(__dirname, '../..');
  const candidates = [process.env.CODEXTOWN_PYTHON, '/opt/homebrew/bin/python3', '/usr/local/bin/python3',
    '/usr/bin/python3', 'python3'].filter(Boolean);
  let problem = '';
  for (const binary of candidates) {
    let failed = false;
    server = spawn(binary, [path.join(dir, 'codextown.py'), '--no-browser'], {
      cwd: dir, env: { ...process.env, PYTHONUNBUFFERED: '1' }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
    });
    const child = server;
    child.on('error', err => { failed = true; problem = err.message; });
    child.stderr.on('data', data => { problem = String(data).slice(-1500); });
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (failed || child.exitCode !== null) break;
      if (await health()) {
        child.on('exit', () => {
          if (!quitting && server === child) dialog.showErrorBox('CodexTown 연결 종료', '세션 서버가 종료되었습니다. 앱을 다시 열어 주세요.');
        });
        return;
      }
    }
    child.kill();
  }
  throw new Error(`Python 3 서버를 시작하지 못했습니다.\n${problem}`);
}
function show() { if (win) { win.show(); win.focus(); } }
async function focusSession(sid) {
  if (typeof sid !== 'string' || !/^[a-f0-9-]{36}$/i.test(sid)) return { ok: false, reason: '작업 ID를 찾지 못했습니다' };
  try { await shell.openExternal(`codex://threads/${sid}`); return { ok: true }; }
  catch { return { ok: false, reason: 'Codex 앱을 열지 못했습니다' }; }
}
async function start() {
  await startServer();
  win = new BrowserWindow({ width: 1280, height: 850, minWidth: 680, minHeight: 540, title: 'CodexTown',
    backgroundColor: '#2a2622', icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== `${URL}/`) event.preventDefault(); });
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  await win.loadURL(URL);
  let icon = nativeImage.createFromPath(path.join(ASSETS, 'icon.png')).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('CodexTown');
  tray.on('click', show);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'CodexTown 열기', click: show },
    { label: '항상 위에 표시', type: 'checkbox', click: item => win.setAlwaysOnTop(item.checked) },
    { type: 'separator' }, { label: '종료', click: () => app.quit() },
  ]));
}
ipcMain.handle('focus-session', (_event, { sid }) => focusSession(sid));
ipcMain.handle('notify-waiting', (_event, { title, label, sid }) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: 'CodexTown — 응답 대기', body: String(title || label || '작업이 응답을 마쳤습니다').slice(0, 180) });
  notification.on('click', () => sid ? focusSession(sid) : show());
  notification.show();
});
ipcMain.on('waiting-count', (_event, count) => {
  if (tray) tray.setToolTip(`CodexTown — 응답 대기 ${Math.max(0, Number(count) || 0)}개`);
});
app.on('activate', show);
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; if (server) server.kill(); });
