'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codextown', {
  focusSession: (_terms, _title, _entry, sid) => ipcRenderer.invoke('focus-session', { sid }),
  notifyWaiting: (label, title, _terms, _entry, kind, sid) => ipcRenderer.invoke('notify-waiting', { label, title, sid, kind }),
  setWaitingCount: count => ipcRenderer.send('waiting-count', count),
});
