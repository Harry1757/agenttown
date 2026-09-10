'use strict';

// 페이지에 딱 하나만 열어준다: "이 세션을 연 창을 앞으로 가져와 줘".
// 인자는 프로젝트 슬러그와 진입점뿐이고, 돌려받는 것도 성공 여부 한 줄이다 —
// contextIsolation 을 켠 채로 필요한 최소 통로만 뚫는다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudetown', {
  focusSession: (terms, title, entry) => ipcRenderer.invoke('focus-session', { terms, title, entry }),
  notifyWaiting: (label, title, terms, entry, kind) =>
    ipcRenderer.invoke('notify-waiting', { label, title, terms, entry, kind }),
  setWaitingCount: (count) => ipcRenderer.send('waiting-count', count),
  getUsage: () => ipcRenderer.invoke('usage:get'),
  getDesktopChats: () => ipcRenderer.invoke('desktop:get'),
});
