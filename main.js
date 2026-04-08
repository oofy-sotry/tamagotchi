const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── 경로 ────────────────────────────────────────
const DATA_DIR = app.getPath('userData');
const PETS_DIR = path.join(DATA_DIR, 'pets');
const WORLD_PATH = path.join(DATA_DIR, 'world.json');

// 펫 디렉토리 생성
if (!fs.existsSync(PETS_DIR)) fs.mkdirSync(PETS_DIR, { recursive: true });

// ─── 상수 ────────────────────────────────────────
const PET_WIN_W = 380;
const PET_WIN_H = 400;
const LAUNCHER_W = 340;
const LAUNCHER_H = 420;

// ─── 상태 ────────────────────────────────────────
const petWindows = new Map();       // petName → BrowserWindow
const windowPetNames = new Map();   // webContents.id → petName
let launcherWindow = null;
let tray = null;
let petOffsetIndex = 0;

// ═════════════════════════════════════════════════
// 월드 데이터 (친밀도, 결혼 등)
// ═════════════════════════════════════════════════

function loadWorld() {
  try {
    if (fs.existsSync(WORLD_PATH)) {
      return JSON.parse(fs.readFileSync(WORLD_PATH, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { relationships: {}, marriages: [] };
}

function saveWorld(data) {
  fs.writeFileSync(WORLD_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

let worldData = loadWorld();

// ═════════════════════════════════════════════════
// 런처 윈도우
// ═════════════════════════════════════════════════

function createLauncher() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show();
    launcherWindow.focus();
    return;
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  launcherWindow = new BrowserWindow({
    width: LAUNCHER_W,
    height: LAUNCHER_H,
    x: Math.floor(screenW / 2 - LAUNCHER_W / 2),
    y: Math.floor(screenH / 2 - LAUNCHER_H / 2),
    frame: false,
    resizable: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  launcherWindow.loadFile(path.join(__dirname, 'src', 'launcher.html'));

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

// ═════════════════════════════════════════════════
// 펫 윈도우
// ═════════════════════════════════════════════════

function createPetWindow(petName) {
  // 이미 열려있으면 포커스
  if (petWindows.has(petName)) {
    const existing = petWindows.get(petName);
    if (!existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return;
    }
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const offsetX = (petOffsetIndex % 5) * 120;
  petOffsetIndex++;

  const win = new BrowserWindow({
    width: PET_WIN_W,
    height: PET_WIN_H,
    x: Math.floor(screenW / 2 - PET_WIN_W / 2 + offsetX - 240),
    y: Math.floor(screenH - PET_WIN_H),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // URL 쿼리로 펫 이름 전달
  win.loadFile(path.join(__dirname, 'src', 'index.html'), {
    query: { pet: petName },
  });

  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(true, { forward: true });

  // 매핑 등록
  petWindows.set(petName, win);
  windowPetNames.set(win.webContents.id, petName);

  win.on('closed', () => {
    petWindows.delete(petName);
    windowPetNames.delete(win.webContents.id);
    updateTrayMenu();
  });

  updateTrayMenu();
}

// ═════════════════════════════════════════════════
// 트레이
// ═════════════════════════════════════════════════

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
    'mElEQVQ4T2NkoBAwUqifYdAb8P9/A8P/BgYGRkZGBkYmJkYGZmYmBhZWFgZWNjYGVnZ2' +
    'BjYOTgYOLm4GLh5eBl5+AQYBIRFGYVExRglJKUYpaRlGGVk5RjsHJ0YnZxdGF1c3Rnc' +
    'PT0YvHz9Gv6BgxuCQMMbwiCjG6Nh4xoSkFMaUtAzGzOxcxrz8QsaS0nLGCiADABaPMhH' +
    '6yS3mAAAAAElFTkSuQmCC'
  );
  tray = new Tray(icon);
  tray.setToolTip('다마고치');
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const petItems = [];
  for (const [name, win] of petWindows) {
    petItems.push({
      label: `${name} ${win.isVisible() ? '👁' : ''}`,
      click: () => {
        if (win && !win.isDestroyed()) {
          win.show();
          win.focus();
        }
      },
    });
  }

  const template = [
    { label: '펫 관리', click: () => createLauncher() },
    { type: 'separator' },
    ...petItems,
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ═════════════════════════════════════════════════
// IPC 핸들러
// ═════════════════════════════════════════════════

// ── 펫 목록 ──
ipcMain.handle('list-pets', () => {
  try {
    const files = fs.readdirSync(PETS_DIR).filter(f => f.endsWith('.json'));
    const pets = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PETS_DIR, f), 'utf-8'));
        return {
          name: data.petName || f.replace('.json', ''),
          creatureType: data.creatureType,
          colorVariant: data.colorVariant,
          level: data.level || 1,
          stage: data.stage || 'egg',
          isDead: data.isDead || false,
          isOpen: petWindows.has(data.petName || f.replace('.json', '')),
        };
      } catch (e) { return null; }
    }).filter(Boolean);
    return { success: true, pets };
  } catch (e) {
    return { success: true, pets: [] };
  }
});

// ── 펫 저장/불러오기 (sender 기반 라우팅) ──
ipcMain.handle('save-game', (event, data) => {
  const petName = windowPetNames.get(event.sender.id);
  if (!petName) return { success: false, error: 'unknown-window' };
  try {
    const filePath = path.join(PETS_DIR, petName + '.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-game', (event) => {
  const petName = windowPetNames.get(event.sender.id);
  if (!petName) return { success: false, error: 'unknown-window' };
  try {
    const filePath = path.join(PETS_DIR, petName + '.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(raw) };
    }
    return { success: false, error: 'no-save' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── 펫 윈도우 열기/생성 ──
ipcMain.handle('open-pet', (_event, petName) => {
  createPetWindow(petName);
  return { success: true };
});

ipcMain.handle('create-pet', (_event, petName) => {
  // 이름 중복 체크
  const filePath = path.join(PETS_DIR, petName + '.json');
  if (fs.existsSync(filePath)) {
    return { success: false, error: 'name-exists' };
  }
  createPetWindow(petName);
  return { success: true };
});

ipcMain.handle('delete-pet', (_event, petName) => {
  try {
    const filePath = path.join(PETS_DIR, petName + '.json');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // 열린 윈도우도 닫기
    const win = petWindows.get(petName);
    if (win && !win.isDestroyed()) win.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── 펫 이름 조회 (renderer에서 자기 이름 확인) ──
ipcMain.handle('get-pet-name', (event) => {
  return windowPetNames.get(event.sender.id) || null;
});

// ── 런처 닫기 ──
ipcMain.handle('close-launcher', () => {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide();
  }
  return { success: true };
});

// ── 화면/윈도우 관련 (sender 기반) ──
ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

ipcMain.handle('set-window-position', (event, x, y) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle('get-window-position', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});

ipcMain.handle('set-ignore-mouse', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  }
});

ipcMain.handle('get-window-size', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [w, h] = win.getSize();
    return { width: w, height: h };
  }
  return { width: PET_WIN_W, height: PET_WIN_H };
});

// ── 월드 데이터 ──
ipcMain.handle('get-world', () => {
  return worldData;
});

ipcMain.handle('save-world', (_event, data) => {
  worldData = data;
  saveWorld(data);
  return { success: true };
});

// ═════════════════════════════════════════════════
// 위치 감지 (30초마다)
// ═════════════════════════════════════════════════

setInterval(() => {
  if (petWindows.size < 2) return;

  const positions = [];
  for (const [name, win] of petWindows) {
    if (win.isDestroyed()) continue;
    const [x, y] = win.getPosition();
    positions.push({ name, x, y });
  }

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j];
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist < 200) {
        handleNearby(a.name, b.name);
      }
    }
  }
}, 30000);

function getRelationshipKey(name1, name2) {
  return [name1, name2].sort().join(':');
}

function handleNearby(name1, name2) {
  const key = getRelationshipKey(name1, name2);
  if (!worldData.relationships[key]) {
    worldData.relationships[key] = { affinity: 0 };
  }
  const rel = worldData.relationships[key];

  // 근처에 있으면 친밀도 +1
  rel.affinity = Math.min(100, rel.affinity + 1);

  // 랜덤 변동
  if (Math.random() < 0.1) rel.affinity = Math.min(100, rel.affinity + Math.floor(Math.random() * 4) + 2);
  if (Math.random() < 0.05) rel.affinity = Math.max(-100, rel.affinity - Math.floor(Math.random() * 3) - 1);

  saveWorld(worldData);

  // 배틀 체크 (친밀도 < 0)
  if (rel.affinity < 0 && Math.random() < 0.15) {
    triggerBattle(name1, name2);
  }

  // 결혼 체크 (친밀도 >= 80)
  checkMarriage(name1, name2, rel.affinity);

  // 알 체크
  checkEgg(name1, name2);
}

// ═════════════════════════════════════════════════
// 배틀 시스템
// ═════════════════════════════════════════════════

function triggerBattle(name1, name2) {
  const win1 = petWindows.get(name1);
  const win2 = petWindows.get(name2);
  if (!win1 || !win2 || win1.isDestroyed() || win2.isDestroyed()) return;

  // 양쪽에 배틀 알림
  win1.webContents.send('world-event', { type: 'battle-start', opponent: name2 });
  win2.webContents.send('world-event', { type: 'battle-start', opponent: name1 });

  // 1.5초 후 결과 계산
  setTimeout(() => {
    // 펫 데이터 요청 후 계산은 renderer에서 처리
    win1.webContents.send('world-event', { type: 'battle-resolve', opponent: name2 });
    win2.webContents.send('world-event', { type: 'battle-resolve', opponent: name1 });

    const key = getRelationshipKey(name1, name2);
    if (worldData.relationships[key]) {
      worldData.relationships[key].affinity = Math.max(-100, worldData.relationships[key].affinity - 10);
      saveWorld(worldData);
    }
  }, 1500);
}

// ═════════════════════════════════════════════════
// 결혼 시스템
// ═════════════════════════════════════════════════

function checkMarriage(name1, name2, affinity) {
  if (affinity < 80) return;

  // 이미 결혼했는지 체크
  const existing = worldData.marriages.find(m =>
    (m.pet1 === name1 && m.pet2 === name2) || (m.pet1 === name2 && m.pet2 === name1)
  );
  if (existing) return;

  // 결혼 등록
  worldData.marriages.push({
    pet1: name1,
    pet2: name2,
    marriedAt: Date.now(),
    eggLaid: false,
    lastEggCheck: Date.now(),
  });
  saveWorld(worldData);

  // 알림
  const win1 = petWindows.get(name1);
  const win2 = petWindows.get(name2);
  if (win1 && !win1.isDestroyed()) win1.webContents.send('world-event', { type: 'married', partner: name2 });
  if (win2 && !win2.isDestroyed()) win2.webContents.send('world-event', { type: 'married', partner: name1 });
}

// ═════════════════════════════════════════════════
// 알 낳기 시스템 (점진적 확률)
// ═════════════════════════════════════════════════

function checkEgg(name1, name2) {
  const marriage = worldData.marriages.find(m =>
    !m.eggLaid &&
    ((m.pet1 === name1 && m.pet2 === name2) || (m.pet1 === name2 && m.pet2 === name1))
  );
  if (!marriage) return;

  const elapsed = Date.now() - marriage.marriedAt;
  const thirtyMin = 30 * 60 * 1000;
  if (elapsed < thirtyMin) return;

  // 마지막 체크에서 30분 경과했는지
  const sinceLastCheck = Date.now() - (marriage.lastEggCheck || marriage.marriedAt);
  if (sinceLastCheck < thirtyMin) return;

  marriage.lastEggCheck = Date.now();

  // 확률 계산: 50% + (경과 30분 단위 - 1) * 5%, 최대 95%
  const periods = Math.floor(elapsed / thirtyMin);
  const chance = Math.min(0.95, 0.5 + (periods - 1) * 0.05);

  if (Math.random() < chance) {
    marriage.eggLaid = true;
    saveWorld(worldData);

    // 양쪽에 알 이벤트 알림
    const win1 = petWindows.get(name1);
    const win2 = petWindows.get(name2);
    if (win1 && !win1.isDestroyed()) win1.webContents.send('world-event', { type: 'egg-laid', partner: name2 });
    if (win2 && !win2.isDestroyed()) win2.webContents.send('world-event', { type: 'egg-laid', partner: name1 });

    // 새 펫 생성 (부모 데이터 기반)
    createEggPet(name1, name2);
  } else {
    saveWorld(worldData);
  }
}

function createEggPet(parent1Name, parent2Name) {
  try {
    const p1Data = JSON.parse(fs.readFileSync(path.join(PETS_DIR, parent1Name + '.json'), 'utf-8'));
    const p2Data = JSON.parse(fs.readFileSync(path.join(PETS_DIR, parent2Name + '.json'), 'utf-8'));

    // 캐릭터 타입: 부모 중 랜덤
    const creatureType = Math.random() < 0.5 ? p1Data.creatureType : p2Data.creatureType;

    // 색상: 99% 부모 색상, 1% 히든
    let colorVariant;
    if (Math.random() < 0.01) {
      const hiddenColors = ['golden', 'pink', 'black'];
      colorVariant = hiddenColors[Math.floor(Math.random() * hiddenColors.length)];
    } else {
      colorVariant = Math.random() < 0.5 ? p1Data.colorVariant : p2Data.colorVariant;
    }

    // 이름 생성
    const babyName = parent1Name + 'Jr';
    let finalName = babyName;
    let suffix = 2;
    while (fs.existsSync(path.join(PETS_DIR, finalName + '.json'))) {
      finalName = babyName + suffix;
      suffix++;
    }

    // 새 펫 데이터 생성
    const newPet = {
      hunger: 100, happiness: 100, health: 100, cleanliness: 100,
      intimacy: 0, energy: 100,
      creatureType, colorVariant, petName: finalName,
      stage: 'egg', age: 0, evolutionTicks: 0,
      poops: 0, isSick: false, isDead: false, starvingTicks: 0,
      isSleeping: false, level: 1, exp: 0, careScore: 0,
      autoCare: false, birthTime: Date.now(), lastSaveTime: Date.now(),
    };

    fs.writeFileSync(path.join(PETS_DIR, finalName + '.json'), JSON.stringify(newPet, null, 2), 'utf-8');

    // 자동으로 윈도우 열기
    createPetWindow(finalName);
  } catch (e) {
    console.error('Failed to create egg pet:', e);
  }
}

// ═════════════════════════════════════════════════
// 앱 라이프사이클
// ═════════════════════════════════════════════════

app.whenReady().then(() => {
  createTray();
  createLauncher();
});

app.on('window-all-closed', () => {
  // 런처도 닫혀도 트레이에 남아있음
  // macOS에서는 앱 유지
});

app.on('activate', () => {
  createLauncher();
});
