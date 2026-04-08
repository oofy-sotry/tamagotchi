// ─── 상수 ────────────────────────────────────────
const TICK_INTERVAL = 5000; // 5초마다 틱
const GAUGE_DECAY = 1;     // 틱당 게이지 감소량
const POOP_CHANCE = 0.08;  // 틱당 똥 확률 (8%)
const SICK_THRESHOLD = 20; // 청결도 이 이하면 아픔
const STARVE_DEATH_TICKS = 24; // 배고픔 0 상태로 24틱(~2분) 유지 시 사망

// ─── 시간 스케일 ────────────────────────────────
// 리얼타임 1시간 = 게임 내 1일(1살)
const MS_PER_GAME_DAY = 1000 * 60 * 60; // 1시간 = 1일

// ─── 자연사 시스템 ──────────────────────────────
const NATURAL_DEATH_START_AGE = 100;  // 100살부터 자연사 확률 시작
const NATURAL_DEATH_BASE_CHANCE = 0.01; // 100살 이후 매일 +1%

// ─── 배틀 부상 시스템 ───────────────────────────
// 패배 시 부상 등급 확률: 하 60%, 중 30%, 상 10%
const INJURY_GRADES = {
  light:  { chance: 0.60, label: '경상', healthLoss: 15, deathChance: 0 },
  medium: { chance: 0.30, label: '중상', healthLoss: 35, deathChance: 0.03 },  // 3% 사망
  severe: { chance: 0.10, label: '위독', healthLoss: 60, deathChance: 0.15 },  // 15% 사망
};

function rollInjury() {
  const r = Math.random();
  if (r < INJURY_GRADES.light.chance) return 'light';
  if (r < INJURY_GRADES.light.chance + INJURY_GRADES.medium.chance) return 'medium';
  return 'severe';
}

// ─── 피로도(에너지) 시스템 ───────────────────────
const ENERGY_DECAY = 1.5;       // 깨어있을 때 틱당 에너지 감소
const ENERGY_RECOVER = 4;       // 잠잘 때 틱당 에너지 회복
const AUTO_SLEEP_THRESHOLD = 5; // 에너지가 이 이하면 자동 수면
const AUTO_WAKE_THRESHOLD = 95; // 에너지가 이 이상이면 자동 기상

// ─── 10단계 진화 ─────────────────────────────────
const STAGES = [
  'egg',           // 0: 알
  'cracked-egg',   // 1: 금이 간 알
  'hatchling',     // 2: 부화 직후
  'baby-dragon',   // 3: 아기 용
  'young-dragon',  // 4: 어린 용
  'juvenile',      // 5: 소년 용
  'adolescent',    // 6: 청년 용
  'adult-dragon',  // 7: 성체 용
  'elder-dragon',  // 8: 고대 용
  'legendary',     // 9: 전설의 용
];

const ALL_STAGE_NAMES = {
  dragon: {
    'egg': '알', 'cracked-egg': '금이 간 알', 'hatchling': '부화 직후',
    'baby-dragon': '아기 용', 'young-dragon': '어린 용', 'juvenile': '소년 용',
    'adolescent': '청년 용', 'adult-dragon': '성체 용', 'elder-dragon': '고대 용',
    'legendary': '전설의 용',
  },
  fire_lizard: {
    'egg': '알', 'cracked-egg': '금이 간 알', 'hatchling': '부화 직후',
    'baby-dragon': '아기 도마뱀', 'young-dragon': '어린 도마뱀', 'juvenile': '소년 도마뱀',
    'adolescent': '청년 도마뱀', 'adult-dragon': '성체 도마뱀', 'elder-dragon': '고대 도마뱀',
    'legendary': '전설의 도마뱀',
  },
  water_turtle: {
    'egg': '알', 'cracked-egg': '금이 간 알', 'hatchling': '부화 직후',
    'baby-dragon': '아기 거북', 'young-dragon': '어린 거북', 'juvenile': '소년 거북',
    'adolescent': '청년 거북', 'adult-dragon': '성체 거북', 'elder-dragon': '고대 거북',
    'legendary': '전설의 거북',
  },
};

// 각 단계에서 다음 진화까지 필요한 틱 수
const EVOLUTION_TICKS = {
  'egg': 40,            // ~3분 20초
  'cracked-egg': 30,    // ~2분 30초
  'hatchling': 60,      // ~5분
  'baby-dragon': 120,   // ~10분
  'young-dragon': 180,  // ~15분
  'juvenile': 240,      // ~20분
  'adolescent': 360,    // ~30분
  'adult-dragon': 480,  // ~40분
  'elder-dragon': 600,  // ~50분
  // legendary는 최종 단계 — 진화 없음
};

// ─── 레벨 시스템 ─────────────────────────────────
const BASE_EXP = 20;      // 레벨1→2 필요 경험치
const EXP_GROWTH = 1.3;   // 레벨당 경험치 증가 배율

function expForLevel(level) {
  return Math.floor(BASE_EXP * Math.pow(EXP_GROWTH, level - 1));
}

// ─── 성장 등급 시스템 ────────────────────────────
const GROWTH_GRADES = {
  low:  { label: '하', levelRange: [1, 3], evoRange: [3, 5] },
  mid:  { label: '중', levelRange: [4, 7], evoRange: [6, 10] },
  high: { label: '상', levelRange: [8, 10], evoRange: [11, 15] },
};

function rollGrowthGrade() {
  const r = Math.random();
  if (r < 0.6) return 'low';   // 60%
  if (r < 0.9) return 'mid';   // 30%
  return 'high';                // 10%
}

function rollInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rollGrowthValues(grade) {
  const [min, max] = GROWTH_GRADES[grade].levelRange;
  return { attack: rollInRange(min, max), defense: rollInRange(min, max), speed: rollInRange(min, max) };
}

function rollInitialStats() {
  return { attack: rollInRange(1, 10), defense: rollInRange(1, 10), speed: rollInRange(1, 10) };
}

function rollEvoBonus(grade) {
  const [min, max] = GROWTH_GRADES[grade].evoRange;
  return { attack: rollInRange(min, max), defense: rollInRange(min, max), speed: rollInRange(min, max) };
}

// ─── 코인 보상 ──────────────────────────────────
const ACTION_COINS = {
  feed: 2, play: 5, waterPlay: 3, ballPlay: 4,
  clean: 3, pet: 1, medicine: 2, cleanPoop: 2,
};

// ─── 상점 아이템 ────────────────────────────────
const SHOP_ITEMS = {
  // 소모품 (즉시 스탯 적용)
  'atk-potion-s': { name: '공격력 물약(소)', type: 'consumable', stat: 'attack', value: 3, price: 20, icon: '⚗️' },
  'atk-potion-m': { name: '공격력 물약(중)', type: 'consumable', stat: 'attack', value: 8, price: 50, icon: '⚗️' },
  'def-potion-s': { name: '방어력 물약(소)', type: 'consumable', stat: 'defense', value: 3, price: 20, icon: '🧪' },
  'def-potion-m': { name: '방어력 물약(중)', type: 'consumable', stat: 'defense', value: 8, price: 50, icon: '🧪' },
  'spd-potion-s': { name: '속도 물약(소)', type: 'consumable', stat: 'speed', value: 3, price: 20, icon: '💨' },
  // 무기 (장착)
  'wooden-sword':  { name: '나무 검',     type: 'weapon', attack: 3,  price: 30,  icon: '🗡️', pixel: 'sword_wood' },
  'iron-sword':    { name: '철 검',       type: 'weapon', attack: 8,  price: 80,  icon: '⚔️', pixel: 'sword_iron' },
  'flame-sword':   { name: '화염 검',     type: 'weapon', attack: 15, price: 200, icon: '🔥', pixel: 'sword_flame' },
  'legend-sword':  { name: '전설의 검',   type: 'weapon', attack: 30, price: 500, icon: '✨', pixel: 'sword_legend' },
  // 악세사리 (장착)
  'wooden-shield': { name: '나무 방패',   type: 'accessory', defense: 3,  price: 30,  icon: '🛡️', pixel: 'shield_wood' },
  'iron-shield':   { name: '철 방패',     type: 'accessory', defense: 8,  price: 80,  icon: '🛡️', pixel: 'shield_iron' },
  'ribbon':        { name: '리본',        type: 'accessory', speed: 5,   price: 40,  icon: '🎀', pixel: 'ribbon' },
  'crown':         { name: '왕관',        type: 'accessory', defense: 5, speed: 5, price: 300, icon: '👑', pixel: 'crown' },
};

// 행동별 경험치
const ACTION_EXP = {
  feed: 5,
  play: 8,
  waterPlay: 6,
  ballPlay: 7,
  sleep: 3,
  clean: 4,
  medicine: 10,
  pet: 2,
  cleanPoop: 3,
  work: 12,
};

// ─── 일하기 시스템 ──────────────────────────────
const WORK_COINS_BASE = 15;      // 기본 코인
const WORK_HEALTH_COST = 30;     // 체력 소모
const WORK_ENERGY_COST = 40;     // 에너지 소모
const WORK_HUNGER_COST = 20;     // 배고픔 소모
const WORK_HAPPINESS_COST = 10;  // 행복 소모

// ─── 게이지 최대치 성장 ─────────────────────────
// 기본 100, 레벨당 +5, 진화당 +20
const BASE_GAUGE_MAX = 100;
const GAUGE_PER_LEVEL = 5;
const GAUGE_PER_EVOLUTION = 20;

// ─── 자동 돌봄 ──────────────────────────────────
const AUTO_CARE_INTERVAL = 5;  // 5틱(25초)마다 자동 돌봄 체크
const AUTO_FEED_THRESHOLD = 60;
const AUTO_HAPPY_THRESHOLD = 60;
const AUTO_CLEAN_THRESHOLD = 50;
const AUTO_HEALTH_THRESHOLD = 60;
const AUTO_MEDICINE = true;

// ─── 기본 상태 ───────────────────────────────────
function createDefaultState() {
  return {
    hunger: 100,
    happiness: 100,
    health: 100,
    cleanliness: 100,
    intimacy: 0,
    stage: 'egg',
    age: 0,
    poops: 0,
    isSick: false,
    energy: 100,       // 피로도 (100=활력 넘침, 0=탈진)
    isSleeping: false,
    isDead: false,
    starvingTicks: 0,      // 배고픔 0 유지 틱 카운터
    birthTime: Date.now(),
    lastSaveTime: Date.now(),
    evolutionTicks: 0,     // 현재 진화 단계에서 쌓인 틱
    careScore: 0,
    // 레벨 시스템
    level: 1,
    exp: 0,
    autoCare: false,   // 자동 돌봄 on/off
    isWorking: false,  // 일 중 여부
    gaugeMax: 100,     // 게이지 최대치 (레벨/진화로 성장)
    creatureType: null, // 캐릭터 타입 (null = 미선택)
    colorVariant: null, // 색상 변형 (null = 미선택)
    petName: '',        // 펫 이름
    // 전투 스탯
    combatStats: { attack: 0, defense: 0, speed: 0 },
    growthGrade: null,    // 'low' | 'mid' | 'high'
    growthRolls: { attack: 0, defense: 0, speed: 0 },
    // 경제 & 장비
    coins: 0,
    equippedWeapon: null,     // 아이템 ID
    equippedAccessory: null,  // 아이템 ID
    inventory: [],            // 보유 아이템 ID 목록
  };
}

// ─── 게임 클래스 ─────────────────────────────────
class TamagotchiGame {
  constructor() {
    this.state = createDefaultState();
    this.tickTimer = null;
    this.onUpdate = null;
    this.onNotify = null;
    this.onLevelUp = null;     // 레벨업 콜백
    this.onEvolve = null;      // 진화 콜백
  }

  // --- 초기화 / 저장 / 불러오기 ---

  async init() {
    const result = await window.api.loadGame();
    if (result.success && result.data.creatureType) {
      this.state = { ...createDefaultState(), ...result.data };
      if (!this.state.creatureType) this.state.creatureType = 'dragon';
      setCreatureType(this.state.creatureType);
      setColorVariant(this.state.colorVariant || 'orange');
      this.applyOfflineDecay(result.data.lastSaveTime);
      this.startTick();
      return { needsSelection: false };
    }
    return { needsSelection: true };
  }

  selectCreature(type, colorVariant, petName) {
    this.state = createDefaultState();
    this.state.creatureType = type;
    this.state.colorVariant = colorVariant || 'orange';
    this.state.petName = petName || '';
    // 성장 등급 & 초기 스탯 결정
    this.state.growthGrade = rollGrowthGrade();
    this.state.growthRolls = rollGrowthValues(this.state.growthGrade);
    this.state.combatStats = rollInitialStats();
    setCreatureType(type);
    setColorVariant(this.state.colorVariant);
    this.save();
    this.startTick();
    this.emitUpdate();
  }

  applyOfflineDecay(lastSave) {
    if (!lastSave) return;
    const elapsed = Date.now() - lastSave;
    const missedTicks = Math.floor(elapsed / TICK_INTERVAL);
    const decay = Math.min(missedTicks * GAUGE_DECAY, 50);
    this.state.hunger = Math.max(0, this.state.hunger - decay);
    this.state.happiness = Math.max(0, this.state.happiness - decay);
    this.state.cleanliness = Math.max(0, this.state.cleanliness - decay * 0.5);
  }

  async save() {
    this.state.lastSaveTime = Date.now();
    await window.api.saveGame(this.state);
  }

  reset() {
    this.state = createDefaultState();
    this.save();
    this.emitUpdate();
  }

  // --- 틱 시스템 ---

  startTick() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  stopTick() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  tick() {
    const s = this.state;
    if (s.isDead) return;

    s.age++;

    if (s.isSleeping) {
      s.health = Math.min(s.gaugeMax || 100, s.health + 3);
      s.hunger = Math.max(0, s.hunger - GAUGE_DECAY * 0.5);
      s.energy = Math.min(s.gaugeMax || 100, s.energy + ENERGY_RECOVER);

      // 에너지 충전 완료 → 자동 기상
      if (s.energy >= AUTO_WAKE_THRESHOLD) {
        s.isSleeping = false;
        s.energy = 100;
        this.notify('💪 푹 잤어요! 기운이 넘쳐요!');
      }

      this.emitUpdate();
      this.autoSave();
      return;
    }

    // 게이지 감소
    s.hunger = Math.max(0, s.hunger - GAUGE_DECAY);
    s.happiness = Math.max(0, s.happiness - GAUGE_DECAY * 0.5);
    s.health = Math.max(0, s.health - GAUGE_DECAY * 0.3);
    s.cleanliness = Math.max(0, s.cleanliness - GAUGE_DECAY * 0.4);
    s.energy = Math.max(0, s.energy - ENERGY_DECAY);

    // 에너지 고갈 → 자동 수면
    if (s.energy <= AUTO_SLEEP_THRESHOLD) {
      s.isSleeping = true;
      s.energy = 0;
      this.notify('😴 너무 피곤해서 쓰러졌어요...');
    }

    // 똥
    if (Math.random() < POOP_CHANCE) {
      s.poops++;
      s.cleanliness = Math.max(0, s.cleanliness - 5);
    }

    // 아픔 체크
    if (s.cleanliness <= SICK_THRESHOLD && !s.isSick) {
      s.isSick = true;
      this.notify('아파요! 약을 주세요!');
    }
    if (s.isSick) {
      s.health = Math.max(0, s.health - 2);
    }

    if (s.hunger <= 20 && s.hunger > 0) {
      this.notify('배고파요!');
    }

    // 굶주림 사망 체크
    if (s.hunger <= 0) {
      s.starvingTicks++;
      if (s.starvingTicks >= STARVE_DEATH_TICKS) {
        s.isDead = true;
        s.deathCause = 'starve';
        this.notify(`${s.petName || '펫'}이(가) 굶어서 떠났어요... 😢`);
      } else if (s.starvingTicks === 1) {
        this.notify('⚠️ 배고픔이 바닥났어요! 빨리 밥을 주세요!');
      } else if (s.starvingTicks === Math.floor(STARVE_DEATH_TICKS / 2)) {
        this.notify('🚨 위험! 곧 쓰러질 것 같아요!');
      }
    } else {
      s.starvingTicks = 0;
    }

    // 자동 돌봄
    if (s.autoCare && s.age % AUTO_CARE_INTERVAL === 0) {
      this.doAutoCare();
    }

    // 진화 체크
    this.checkEvolution();

    // 자연사 체크 (720틱 = 1시간 = 1게임일 마다)
    const ticksPerDay = Math.floor(MS_PER_GAME_DAY / TICK_INTERVAL);
    if (s.age % ticksPerDay === 0 && s.age > 0) {
      this.checkNaturalDeath();
    }

    this.emitUpdate();
    this.autoSave();
  }

  // --- 진화 시스템 ---

  checkEvolution() {
    const s = this.state;
    const stageIdx = STAGES.indexOf(s.stage);
    if (stageIdx >= STAGES.length - 1) return; // 전설의 용이면 끝

    s.evolutionTicks++;
    const needed = EVOLUTION_TICKS[s.stage];
    if (needed && s.evolutionTicks >= needed) {
      const newStage = STAGES[stageIdx + 1];
      s.stage = newStage;
      s.evolutionTicks = 0;
      // 진화 시 스탯 보너스
      if (s.growthGrade && s.combatStats) {
        const bonus = rollEvoBonus(s.growthGrade);
        s.combatStats.attack += bonus.attack;
        s.combatStats.defense += bonus.defense;
        s.combatStats.speed += bonus.speed;
      }
      s.coins = (s.coins || 0) + 30;
      s.gaugeMax = (s.gaugeMax || 100) + GAUGE_PER_EVOLUTION; // 게이지 최대치 대폭 성장
      const names = ALL_STAGE_NAMES[s.creatureType || 'dragon'];
      const name = (names && names[newStage]) || newStage;
      this.notify(`✨ ${name}(으)로 진화! (최대치 ${s.gaugeMax})`);
      if (this.onEvolve) this.onEvolve(newStage, name);
    }
  }

  // --- 자연사 시스템 ---

  checkNaturalDeath() {
    const age = this.getAgeDays();
    if (age <= NATURAL_DEATH_START_AGE) return;

    // 100살 이후: (나이 - 100) * 1% 확률, 최대 51%
    const deathChance = Math.min(0.51, (age - NATURAL_DEATH_START_AGE) * NATURAL_DEATH_BASE_CHANCE);
    if (Math.random() < deathChance) {
      this.state.isDead = true;
      this.state.deathCause = 'natural';
      this.notify(`🕊️ ${this.state.petName}이(가) ${age}살에 편안히 눈을 감았어요...`);
    } else if (age >= 95 && age < NATURAL_DEATH_START_AGE) {
      this.notify(`👴 ${age}살... 노년에 접어들었어요`);
    }
  }

  // --- 배틀 부상 처리 ---

  applyBattleInjury(opponentName) {
    const grade = rollInjury();
    const injury = INJURY_GRADES[grade];

    this.state.health = Math.max(0, this.state.health - injury.healthLoss);
    this.state.happiness = Math.max(0, this.state.happiness - 15);

    // 사망 판정
    if (injury.deathChance > 0 && Math.random() < injury.deathChance) {
      this.state.isDead = true;
      this.state.deathCause = 'battle';
      this.notify(`💀 ${opponentName}와(과)의 싸움에서 치명상... ${this.state.petName}이(가) 쓰러졌어요`);
      return { grade, dead: true };
    }

    return { grade, dead: false, label: injury.label, healthLoss: injury.healthLoss };
  }

  // --- 레벨 / 경험치 ---

  gainExp(amount) {
    const s = this.state;
    s.exp += amount;
    const needed = expForLevel(s.level);
    if (s.exp >= needed) {
      s.exp -= needed;
      s.level++;
      // 렙업 시 스탯 상승 (growthRolls 만큼 고정 상승)
      if (s.growthRolls && s.combatStats) {
        s.combatStats.attack += s.growthRolls.attack;
        s.combatStats.defense += s.growthRolls.defense;
        s.combatStats.speed += s.growthRolls.speed;
      }
      s.coins = (s.coins || 0) + 10;
      s.gaugeMax = (s.gaugeMax || 100) + GAUGE_PER_LEVEL; // 게이지 최대치 성장
      this.notify(`🎉 레벨 ${s.level} (최대치 ${s.gaugeMax}) 달성!`);
      if (this.onLevelUp) this.onLevelUp(s.level);
    }
  }

  getExpNeeded() {
    return expForLevel(this.state.level);
  }

  getExpPercent() {
    return Math.floor((this.state.exp / this.getExpNeeded()) * 100);
  }

  getGaugeMax() {
    return this.state.gaugeMax || 100;
  }

  capGauge(value) {
    return Math.min(this.getGaugeMax(), Math.max(0, value));
  }

  // --- 자동 돌봄 ---

  doAutoCare() {
    const s = this.state;
    if (s.isDead || s.isSleeping) return;

    if (s.hunger < AUTO_FEED_THRESHOLD) {
      this.feed();
      this.notify('🤖 자동으로 밥을 먹었어요');
    }
    if (s.happiness < AUTO_HAPPY_THRESHOLD) {
      // 쓰다듬기로 행복 올리기 (체력 소모 없음)
      this.pet();
      this.notify('🤖 자동으로 쓰다듬었어요');
    }
    if (s.cleanliness < AUTO_CLEAN_THRESHOLD) {
      this.clean();
      this.notify('🤖 자동으로 씻었어요');
    }
    if (s.poops > 0) {
      this.cleanPoop();
      this.notify('🤖 자동으로 똥을 치웠어요');
    }
    if (s.isSick && AUTO_MEDICINE) {
      this.medicine();
      this.notify('🤖 자동으로 약을 먹었어요');
    }
    // 체력이 낮으면 자동 휴식
    if (s.health < AUTO_HEALTH_THRESHOLD) {
      s.health = Math.min(s.gaugeMax || 100, s.health + 15);
      this.notify('🤖 자동으로 휴식했어요');
    }
    // 컨디션 좋으면 자동 일하기
    if (s.health >= 70 && s.energy >= 60 && s.hunger >= 40) {
      const result = this.work();
      if (result.success) this.notify('🤖 ' + result.msg);
    }
  }

  toggleAutoCare() {
    this.state.autoCare = !this.state.autoCare;
    this.emitUpdate();
    return this.state.autoCare;
  }

  // --- 행동 ---

  earnCoins(action) {
    const amount = ACTION_COINS[action] || 0;
    if (amount) this.state.coins = (this.state.coins || 0) + amount;
  }

  feed() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.hunger = Math.min(100, this.state.hunger + 25);
    this.state.careScore++;
    this.gainExp(ACTION_EXP.feed);
    this.earnCoins('feed');
    this.emitUpdate();
  }

  play() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.happiness = Math.min(100, this.state.happiness + 20);
    this.state.health = Math.max(0, this.state.health - 5);
    this.state.energy = Math.max(0, this.state.energy - 8);
    this.state.careScore++;
    this.gainExp(ACTION_EXP.play);
    this.earnCoins('play');
    this.emitUpdate();
  }

  waterPlay() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.happiness = Math.min(100, this.state.happiness + 3);
    this.state.cleanliness = Math.min(100, this.state.cleanliness + 2);
    this.gainExp(ACTION_EXP.waterPlay);
    this.earnCoins('waterPlay');
    this.emitUpdate();
  }

  ballPlay() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.happiness = Math.min(100, this.state.happiness + 2);
    this.state.energy = Math.max(0, this.state.energy - 3);
    this.gainExp(ACTION_EXP.ballPlay);
    this.earnCoins('ballPlay');
    this.emitUpdate();
  }

  sleep() {
    if (this.state.isDead) return;
    this.state.isSleeping = !this.state.isSleeping;
    if (this.state.isSleeping) this.gainExp(ACTION_EXP.sleep);
    this.emitUpdate();
  }

  clean() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.cleanliness = Math.min(100, this.state.cleanliness + 30);
    this.state.careScore++;
    this.gainExp(ACTION_EXP.clean);
    this.earnCoins('clean');
    this.emitUpdate();
  }

  medicine() {
    if (this.state.isDead || this.state.isSleeping) return;
    if (this.state.isSick) {
      this.state.isSick = false;
      this.state.health = Math.min(100, this.state.health + 20);
      this.state.careScore++;
      this.gainExp(ACTION_EXP.medicine);
      this.earnCoins('medicine');
    }
    this.emitUpdate();
  }

  pet() {
    if (this.state.isDead || this.state.isSleeping) return;
    this.state.intimacy = Math.min(100, this.state.intimacy + 5);
    this.state.happiness = Math.min(100, this.state.happiness + 5);
    this.gainExp(ACTION_EXP.pet);
    this.earnCoins('pet');
    this.emitUpdate();
  }

  // --- 일하기 ---

  work() {
    if (this.state.isDead || this.state.isSleeping) return { success: false, msg: '지금은 일할 수 없어요' };
    if (this.state.energy < WORK_ENERGY_COST) return { success: false, msg: '에너지가 부족해요!' };
    if (this.state.health < WORK_HEALTH_COST) return { success: false, msg: '체력이 부족해요!' };

    const s = this.state;
    s.health = Math.max(0, s.health - WORK_HEALTH_COST);
    s.energy = Math.max(0, s.energy - WORK_ENERGY_COST);
    s.hunger = Math.max(0, s.hunger - WORK_HUNGER_COST);
    s.happiness = Math.max(0, s.happiness - WORK_HAPPINESS_COST);

    // 코인 = 기본 + 레벨 보너스
    const earned = WORK_COINS_BASE + Math.floor(s.level * 2);
    s.coins = (s.coins || 0) + earned;

    this.gainExp(ACTION_EXP.work);
    this.emitUpdate();
    return { success: true, msg: `💼 일 완료! +${earned}코인 (체력 -${WORK_HEALTH_COST})` };
  }

  // --- 상점 & 장비 ---

  buyItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return { success: false, msg: '아이템을 찾을 수 없어요' };
    if ((this.state.coins || 0) < item.price) return { success: false, msg: '코인이 부족해요' };

    this.state.coins -= item.price;

    if (item.type === 'consumable') {
      // 소모품: 즉시 스탯 적용
      if (this.state.combatStats && item.stat) {
        this.state.combatStats[item.stat] += item.value;
      }
      return { success: true, msg: `${item.name} 사용! ${item.stat} +${item.value}` };
    } else {
      // 장비: 인벤토리에 추가
      if (!this.state.inventory) this.state.inventory = [];
      this.state.inventory.push(itemId);
      return { success: true, msg: `${item.name} 구매 완료!` };
    }
  }

  equipItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;
    if (!this.state.inventory || !this.state.inventory.includes(itemId)) return;

    if (item.type === 'weapon') {
      this.state.equippedWeapon = itemId;
    } else if (item.type === 'accessory') {
      this.state.equippedAccessory = itemId;
    }
    this.emitUpdate();
  }

  unequipItem(slot) {
    if (slot === 'weapon') this.state.equippedWeapon = null;
    else if (slot === 'accessory') this.state.equippedAccessory = null;
    this.emitUpdate();
  }

  getTotalPower() {
    const s = this.state;
    const base = (s.combatStats ? s.combatStats.attack + s.combatStats.defense + s.combatStats.speed : 0);
    let bonus = 0;
    if (s.equippedWeapon && SHOP_ITEMS[s.equippedWeapon]) {
      const w = SHOP_ITEMS[s.equippedWeapon];
      bonus += (w.attack || 0) + (w.defense || 0) + (w.speed || 0);
    }
    if (s.equippedAccessory && SHOP_ITEMS[s.equippedAccessory]) {
      const a = SHOP_ITEMS[s.equippedAccessory];
      bonus += (a.attack || 0) + (a.defense || 0) + (a.speed || 0);
    }
    return base + bonus;
  }

  cleanPoop() {
    if (this.state.poops > 0) {
      this.state.poops--;
      this.state.cleanliness = Math.min(100, this.state.cleanliness + 10);
      this.gainExp(ACTION_EXP.cleanPoop);
      this.emitUpdate();
    }
  }

  revive() {
    if (!this.state.isDead) return;
    const type = this.state.creatureType;
    const color = this.state.colorVariant;
    this.state = createDefaultState();
    this.state.creatureType = type;
    this.state.colorVariant = color;
    setCreatureType(type);
    setColorVariant(color);
    this.save();
    this.startTick();
    this.emitUpdate();
  }

  // --- 감정 계산 ---

  getEmotion() {
    const s = this.state;
    if (s.isDead) return 'dead';
    if (s.isSleeping) return 'sleeping';
    if (s.isSick) return 'sick';
    if (s.hunger <= 20) return 'hungry';
    if (s.energy <= 20) return 'tired';  // 에너지 낮으면 졸린 표정
    if (s.happiness <= 20) return 'sad';
    if (s.health <= 30) return 'tired';
    if (s.happiness >= 80 && s.hunger >= 60) return 'happy';
    return 'normal';
  }

  // --- 나이 (일 수) ---

  getAgeDays() {
    const elapsed = Date.now() - this.state.birthTime;
    return Math.floor(elapsed / MS_PER_GAME_DAY); // 1시간 = 1살
  }

  getStageName() {
    const names = ALL_STAGE_NAMES[this.state.creatureType || 'dragon'];
    return (names && names[this.state.stage]) || this.state.stage;
  }

  // --- 유틸 ---

  emitUpdate() {
    if (this.onUpdate) this.onUpdate(this.state, this.getEmotion());
  }

  notify(msg) {
    if (this.onNotify) this.onNotify(msg);
  }

  autoSave() {
    if (this.state.age % 10 === 0) this.save();
  }
}

window.TamagotchiGame = TamagotchiGame;
