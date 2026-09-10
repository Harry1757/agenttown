'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codextown', {
  focusSession: (_terms, _title, _entry, sid) => ipcRenderer.invoke('focus-session', { sid }),
  notifyWaiting: (label, title, _terms, _entry, kind, sid) => ipcRenderer.invoke('notify-waiting', { label, title, sid, kind }),
  getNotifications: () => ipcRenderer.invoke('notifications:get'),
  setNotifications: enabled => ipcRenderer.invoke('notifications:set', enabled),
  testNotification: () => ipcRenderer.invoke('notifications:test'),
  onVisibility: callback => ipcRenderer.on('town-visibility', (_event, visible) => callback(visible)),
  setWaitingCount: count => ipcRenderer.send('waiting-count', count),
});
