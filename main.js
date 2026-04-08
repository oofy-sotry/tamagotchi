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
          personality: data.personality || null,
          parents: data.parents || null,
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

// ─── 성격 궁합 (game.js와 동일) ──────────────────
const COMPAT_MAP = {
  'brave:gentle':1,'brave:proud':-1,'brave:shy':1,'brave:lazy':-1,
  'gentle:caring':1,'gentle:greedy':-1,'gentle:playful':1,
  'playful:lazy':-1,'playful:playful':1,'playful:proud':-1,
  'lazy:lazy':1,'lazy:caring':-1,
  'proud:proud':-1,'proud:shy':0,
  'shy:caring':1,'shy:greedy':-1,
  'greedy:greedy':-1,'greedy:brave':0,
  'caring:caring':1,
};

function getCompatibility(p1, p2) {
  const k1 = p1+':'+p2, k2 = p2+':'+p1;
  if (COMPAT_MAP[k1] !== undefined) return COMPAT_MAP[k1];
  if (COMPAT_MAP[k2] !== undefined) return COMPAT_MAP[k2];
  return 0;
}

function getPetTraits(name) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(PETS_DIR, name + '.json'), 'utf-8'));
    return { personality: data.personality || null, mbti: data.mbti || null };
  } catch (e) { return { personality: null, mbti: null }; }
}

// MBTI 궁합 (game.js와 동일 로직)
function getMbtiCompat(m1, m2) {
  if (!m1 || !m2 || m1.length !== 4 || m2.length !== 4) return 0;
  let score = 0;
  const weights = [0.1, -0.2, -0.4, -0.2]; // E/I, S/N, T/F, J/P 반대일때
  for (let i = 0; i < 4; i++) {
    score += (m1[i] === m2[i]) ? 0.5 : weights[i];
  }
  return score;
}

function handleNearby(name1, name2) {
  const key = getRelationshipKey(name1, name2);
  if (!worldData.relationships[key]) {
    worldData.relationships[key] = { affinity: 0 };
  }
  const rel = worldData.relationships[key];

  // 성격 + MBTI 궁합 확인
  const t1 = getPetTraits(name1);
  const t2 = getPetTraits(name2);
  const pCompat = (t1.personality && t2.personality) ? getCompatibility(t1.personality, t2.personality) : 0;
  const mCompat = getMbtiCompat(t1.mbti, t2.mbti);
  const totalCompat = pCompat + mCompat; // -1.3 ~ +3.0

  // 총 궁합에 따라 친밀도 변화
  if (totalCompat >= 1.5) {
    rel.affinity = Math.min(100, rel.affinity + 3);  // 최고 궁합
  } else if (totalCompat >= 0.5) {
    rel.affinity = Math.min(100, rel.affinity + 2);  // 좋은 궁합
  } else if (totalCompat >= -0.5) {
    rel.affinity = Math.min(100, rel.affinity + 1);  // 보통
  } else {
    rel.affinity = Math.max(-100, rel.affinity - 1);  // 나쁜 궁합
  }

  // 랜덤 변동 (궁합에 따라 확률 조절)
  const positiveChance = totalCompat >= 1.0 ? 0.25 : totalCompat >= 0 ? 0.10 : 0.03;
  const negativeChance = totalCompat <= -0.5 ? 0.20 : totalCompat <= 0 ? 0.08 : 0.02;

  if (Math.random() < positiveChance) rel.affinity = Math.min(100, rel.affinity + Math.floor(Math.random() * 4) + 2);
  if (Math.random() < negativeChance) rel.affinity = Math.max(-100, rel.affinity - Math.floor(Math.random() * 4) - 1);

  saveWorld(worldData);

  // 배틀 체크 (친밀도 < 0, 가족 제외)
  if (rel.affinity < 0 && Math.random() < 0.15 && !isFamily(name1, name2)) {
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

  // 1.5초 후 결과 계산 (상대 전투력 포함)
  setTimeout(() => {
    const getPetData = (name) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PETS_DIR, name + '.json'), 'utf-8'));
        const stats = data.combatStats || { attack: 0, defense: 0, speed: 0 };
        return { power: stats.attack + stats.defense + stats.speed, coins: data.coins || 0 };
      } catch (e) { return { power: 0, coins: 0 }; }
    };
    const d1 = getPetData(name1);
    const d2 = getPetData(name2);

    // 전투력 비교 → 승자 결정 + 약탈 금액 계산
    const p1 = d1.power + Math.random() * 20;
    const p2 = d2.power + Math.random() * 20;
    let winner, loser, winName, loseName;
    if (p1 >= p2) {
      winner = d1; loser = d2; winName = name1; loseName = name2;
    } else {
      winner = d2; loser = d1; winName = name2; loseName = name1;
    }
    // 패배자 코인의 10~50% 약탈
    const stolenCoins = Math.floor(loser.coins * (0.1 + Math.random() * 0.4));

    win1.webContents.send('world-event', {
      type: 'battle-resolve', opponent: name2,
      won: winName === name1, stolenCoins,
    });
    win2.webContents.send('world-event', {
      type: 'battle-resolve', opponent: name1,
      won: winName === name2, stolenCoins,
    });

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

function isAlreadyMarried(name) {
  return worldData.marriages.some(m => m.pet1 === name || m.pet2 === name);
}

function isFamily(name1, name2) {
  // 부부인지 체크
  const married = worldData.marriages.some(m =>
    (m.pet1 === name1 && m.pet2 === name2) || (m.pet1 === name2 && m.pet2 === name1)
  );
  if (married) return true;

  // 부모-자식인지 체크 (세이브 파일에서 parents 확인)
  try {
    const check = (parent, child) => {
      const childPath = path.join(PETS_DIR, child + '.json');
      if (!fs.existsSync(childPath)) return false;
      const data = JSON.parse(fs.readFileSync(childPath, 'utf-8'));
      return data.parents && (data.parents.parent1 === parent || data.parents.parent2 === parent);
    };
    if (check(name1, name2) || check(name2, name1)) return true;
  } catch (e) { /* ignore */ }

  return false;
}

function checkMarriage(name1, name2, affinity) {
  if (affinity < 80) return;

  // 일부일처: 둘 중 하나라도 이미 결혼했으면 불가
  if (isAlreadyMarried(name1) || isAlreadyMarried(name2)) return;

  // 결혼 등록
  worldData.marriages.push({
    pet1: name1,
    pet2: name2,
    marriedAt: Date.now(),
    lastEggTime: 0, // 마지막 알 낳은 시간 (0 = 아직 안 낳음)
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

// 1게임일 = 1시간
const EGG_COOLDOWN_DAYS = 20; // 알 낳은 후 20일(20시간) 쿨타임
const EGG_MIN_MARRIAGE_DAYS = 10; // 결혼 후 최소 10일(10시간) 경과
const EGG_BASE_CHANCE = 0.50; // 시작 확률 50%
const EGG_DAILY_INCREASE = 0.01; // 하루당 +1%
const EGG_MAX_CHANCE = 0.95;
const ONE_GAME_DAY = 60 * 60 * 1000; // 1시간 = 1게임일

function checkEgg(name1, name2) {
  const marriage = worldData.marriages.find(m =>
    ((m.pet1 === name1 && m.pet2 === name2) || (m.pet1 === name2 && m.pet2 === name1))
  );
  if (!marriage) return;

  const now = Date.now();

  // 결혼 후 최소 1일 경과해야 함
  const marriageDays = (now - marriage.marriedAt) / ONE_GAME_DAY;
  if (marriageDays < EGG_MIN_MARRIAGE_DAYS) return;

  // 알 쿨타임 체크 (마지막 알 낳은 후 20일)
  if (marriage.lastEggTime) {
    const sinceLast = (now - marriage.lastEggTime) / ONE_GAME_DAY;
    if (sinceLast < EGG_COOLDOWN_DAYS) return;
  }

  // 확률 계산: 기준 시점부터 경과 일수로 확률 증가
  const baseTime = marriage.lastEggTime || marriage.marriedAt;
  const daysSinceBase = Math.floor((now - baseTime) / ONE_GAME_DAY);
  const extraDays = marriage.lastEggTime
    ? Math.max(0, daysSinceBase - EGG_COOLDOWN_DAYS)
    : Math.max(0, daysSinceBase - EGG_MIN_MARRIAGE_DAYS);
  const chance = Math.min(EGG_MAX_CHANCE, EGG_BASE_CHANCE + extraDays * EGG_DAILY_INCREASE);

  if (Math.random() < chance) {
    marriage.lastEggTime = now;
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

// ─── 아기 이름 자동 생성 ─────────────────────────
const BABY_NAMES = [
  '꼬미','뭉치','콩이','별이','달이','해피','초코','모찌','두부','구름',
  '봄이','여름','가을','겨울','하늘','바다','솜이','호두','밤이','도토리',
  '보리','찹쌀','인절미','떡이','꿀이','사탕','젤리','푸딩','쿠키','마카롱',
  '루비','진주','토파즈','에메','사파이어','다이아','오팔','자수정','호박','옥이',
];

function generateBabyName() {
  const shuffled = BABY_NAMES.sort(() => Math.random() - 0.5);
  for (const name of shuffled) {
    if (!fs.existsSync(path.join(PETS_DIR, name + '.json'))) return name;
  }
  // 모든 이름이 사용 중이면 번호 붙이기
  let i = 1;
  while (fs.existsSync(path.join(PETS_DIR, '아기' + i + '.json'))) i++;
  return '아기' + i;
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

    const finalName = generateBabyName();

    // 새 펫 데이터 생성 (부모 정보 포함)
    const newPet = {
      hunger: 100, happiness: 100, health: 100, cleanliness: 100,
      intimacy: 0, energy: 100,
      creatureType, colorVariant, petName: finalName,
      stage: 'egg', age: 0, evolutionTicks: 0,
      poops: 0, isSick: false, isDead: false, starvingTicks: 0,
      isSleeping: false, level: 1, exp: 0, careScore: 0,
      autoCare: false, birthTime: Date.now(), lastSaveTime: Date.now(),
      gaugeMax: 100,
      combatStats: { attack: 0, defense: 0, speed: 0 },
      growthGrade: null, growthRolls: { attack: 0, defense: 0, speed: 0 },
      coins: 0, equippedWeapon: null, equippedAccessory: null, inventory: [],
      // 부모 정보
      personality: ['brave','gentle','playful','lazy','proud','shy','greedy','caring'][Math.floor(Math.random()*8)],
      mbti: ['EI','SN','TF','JP'].map(a => a[Math.random()<0.5?0:1]).join(''),
      parents: { parent1: parent1Name, parent2: parent2Name },
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
