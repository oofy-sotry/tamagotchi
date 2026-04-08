const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 펫 관리
  listPets: () => ipcRenderer.invoke('list-pets'),
  openPet: (name) => ipcRenderer.invoke('open-pet', name),
  createPet: (name) => ipcRenderer.invoke('create-pet', name),
  deletePet: (name) => ipcRenderer.invoke('delete-pet', name),
  getPetName: () => ipcRenderer.invoke('get-pet-name'),
  closeLauncher: () => ipcRenderer.invoke('close-launcher'),

  // 게임 저장/불러오기 (sender 기반 라우팅)
  saveGame: (data) => ipcRenderer.invoke('save-game', data),
  loadGame: () => ipcRenderer.invoke('load-game'),

  // 윈도우 제어
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('set-window-position', x, y),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),

  // 월드 데이터
  getWorld: () => ipcRenderer.invoke('get-world'),
  saveWorldData: (data) => ipcRenderer.invoke('save-world', data),

  // 월드 이벤트 수신
  onWorldEvent: (callback) => ipcRenderer.on('world-event', (_event, data) => callback(data)),
});
