// ─── DOM 요소 ────────────────────────────────────
const petContainer = document.getElementById('pet-container');
const petEl = document.getElementById('pet');
const petCanvas = document.getElementById('pet-canvas');
const petCtx = petCanvas.getContext('2d');
const statusPanel = document.getElementById('status-panel');
const notification = document.getElementById('notification');
const poopContainer = document.getElementById('poop-container');
const deathScreen = document.getElementById('death-screen');
const reviveBtn = document.getElementById('revive-btn');

const hungerBar = document.getElementById('hunger-bar');
const happinessBar = document.getElementById('happiness-bar');
const healthBar = document.getElementById('health-bar');
const cleanlinessBar = document.getElementById('cleanliness-bar');
const energyBar = document.getElementById('energy-bar');
const expBar = document.getElementById('exp-bar');
const levelLabel = document.getElementById('level-label');
const stageLabel = document.getElementById('stage-label');
const ageLabel = document.getElementById('age-label');

// ─── 게임 초기화 ─────────────────────────────────
const game = new TamagotchiGame();
const charSelect = document.getElementById('char-select');

game.onUpdate = (state, emotion) => {
  renderState(state, emotion);
};

game.onNotify = (msg) => {
  showNotification(msg);
};

game.onEvolve = (stage, name) => {
  petEl.style.transition = 'none';
  petEl.style.filter = 'brightness(2)';
  setTimeout(() => {
    petEl.style.transition = 'filter 0.8s';
    petEl.style.filter = 'brightness(1)';
  }, 100);
};

// ─── 펫 이름 (URL 쿼리에서 읽기) ────────────────
const urlParams = new URLSearchParams(window.location.search);
const myPetName = urlParams.get('pet') || '';

// ─── 캐릭터 선택 (새 펫일 때만) ─────────────────
function showCharacterSelect() {
  charSelect.classList.remove('hidden');
  petContainer.style.display = 'none';
  window.api.setIgnoreMouse(false);

  CREATURE_TYPES.forEach(type => {
    const canvas = document.getElementById('preview-' + type);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawPixelSprite(ctx, 'baby-dragon', 'normal', type, 'orange');
  });

  document.querySelectorAll('.char-option').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      const normalColors = COLOR_VARIANTS.filter(v => !v.hidden);
      const randomColor = normalColors[Math.floor(Math.random() * normalColors.length)];
      charSelect.classList.add('hidden');
      petContainer.style.display = '';
      game.selectCreature(type, randomColor.id, myPetName);
      updatePetName(myPetName);
      startGame();
    });
  });
}

function updatePetName(name) {
  const el = document.getElementById('pet-name');
  if (el) el.textContent = name || '';
}

function startGame() {
  window.api.setIgnoreMouse(true);
  startWandering();
}

async function boot() {
  const { needsSelection } = await game.init();
  if (needsSelection) {
    showCharacterSelect();
  } else {
    updatePetName(game.state.petName || myPetName);
    startGame();
  }
}

// 월드 이벤트 수신 (배틀, 결혼, 알)
window.api.onWorldEvent((data) => {
  if (data.type === 'battle-start') {
    showNotification(`⚔️ ${data.opponent}와(과) 싸움 발생!`);
  } else if (data.type === 'battle-resolve') {
    const stolen = data.stolenCoins || 0;
    if (!data.won) {
      // 패배 → 부상 + 코인 빼앗김
      game.state.coins = Math.max(0, (game.state.coins || 0) - stolen);
      const result = game.applyBattleInjury(data.opponent);
      if (result.dead) {
        // 사망 (applyBattleInjury에서 알림)
      } else {
        showNotification(`😵 ${data.opponent}에게 패배! [${result.label}] 체력-${result.healthLoss}${stolen > 0 ? ` 💰-${stolen}` : ''}`);
      }
    } else {
      // 승리 → 코인 약탈
      game.state.happiness = game.capGauge(game.state.happiness + 5);
      game.state.coins = (game.state.coins || 0) + stolen;
      game.gainExp(15);
      showNotification(`💪 ${data.opponent}를 이겼어요!${stolen > 0 ? ` 💰+${stolen}코인 약탈!` : ''}`);
    }
  } else if (data.type === 'married') {
    showNotification(`💕 ${data.partner}와(과) 결혼했어요!`);
  } else if (data.type === 'egg-laid') {
    showNotification(`🥚 ${data.partner}와(과) 사이에서 알이 생겼어요!`);
  }
});

// ─── 친밀도 표시 ─────────────────────────────────
let cachedRelations = null;
let lastRelationFetch = 0;

async function updateRelations() {
  const now = Date.now();
  // 10초마다 갱신
  if (now - lastRelationFetch < 10000 && cachedRelations) {
    renderRelations(cachedRelations);
    return;
  }
  lastRelationFetch = now;

  try {
    const world = await window.api.getWorld();
    cachedRelations = world.relationships || {};
    renderRelations(cachedRelations);
  } catch (e) { /* ignore */ }
}

function renderRelations(relationships) {
  const container = document.getElementById('relations-list');
  if (!container) return;

  const name = myPetName || (game.state && game.state.petName) || '';
  if (!name) { container.classList.add('hidden'); return; }

  // 내가 포함된 관계만 필터
  const myRelations = [];
  for (const [key, rel] of Object.entries(relationships)) {
    const [a, b] = key.split(':');
    if (a === name) myRelations.push({ partner: b, affinity: rel.affinity });
    else if (b === name) myRelations.push({ partner: a, affinity: rel.affinity });
  }

  if (myRelations.length === 0) { container.classList.add('hidden'); return; }

  container.classList.remove('hidden');
  container.innerHTML = myRelations.map(r => {
    const aff = r.affinity;
    const isPositive = aff >= 0;
    const pct = Math.abs(aff); // -100~100 → 0~100
    let icon = '😐';
    if (aff >= 80) icon = '💕';
    else if (aff >= 40) icon = '😊';
    else if (aff >= 0) icon = '🙂';
    else if (aff >= -40) icon = '😤';
    else icon = '😡';

    // 결혼 체크
    const married = (cachedRelations && Object.keys(cachedRelations).length) ? false : false; // 간소화

    return `<div class="relation-row">
      <span class="relation-icon">${icon}</span>
      <span class="relation-name">${r.partner}</span>
      <div class="relation-bar">
        <div class="relation-fill ${isPositive ? 'positive' : 'negative'}" style="width:${pct}%"></div>
      </div>
      <span class="relation-value" style="color:${isPositive ? '#43a047' : '#e53935'}">${aff >= 0 ? '+' : ''}${aff}</span>
    </div>`;
  }).join('');
}

// ─── 상점 UI ─────────────────────────────────────
const shopPanel = document.getElementById('shop-panel');
const shopItems = document.getElementById('shop-items');
const shopCoinDisplay = document.getElementById('shop-coin-display');
let currentShopTab = 'consumable';

function openShop() {
  shopPanel.classList.remove('hidden');
  window.api.setIgnoreMouse(false);
  document.body.style.pointerEvents = 'auto';
  shopCoinDisplay.textContent = game.state.coins || 0;
  renderShopItems(currentShopTab);
}

function closeShop() {
  shopPanel.classList.add('hidden');
  document.body.style.pointerEvents = '';
  window.api.setIgnoreMouse(true);
  mouseOverInteractive = 0;
}

document.getElementById('shop-close').addEventListener('click', closeShop);

document.querySelectorAll('.shop-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentShopTab = tab.dataset.tab;
    renderShopItems(currentShopTab);
  });
});

function renderShopItems(tabType) {
  shopItems.innerHTML = '';
  const items = Object.entries(SHOP_ITEMS).filter(([, item]) => item.type === tabType);

  items.forEach(([id, item]) => {
    const div = document.createElement('div');
    div.className = 'shop-item';

    // 효과 설명
    let desc = '';
    if (item.type === 'consumable') desc = `${item.stat} +${item.value}`;
    else {
      const parts = [];
      if (item.attack) parts.push(`공격 +${item.attack}`);
      if (item.defense) parts.push(`방어 +${item.defense}`);
      if (item.speed) parts.push(`속도 +${item.speed}`);
      desc = parts.join(' ');
    }

    const owned = game.state.inventory && game.state.inventory.includes(id);
    const equipped = game.state.equippedWeapon === id || game.state.equippedAccessory === id;
    const canAfford = (game.state.coins || 0) >= item.price;

    let btnHtml = '';
    if (item.type === 'consumable') {
      btnHtml = `<button class="shop-item-btn buy" ${!canAfford ? 'disabled' : ''} data-action="buy" data-id="${id}">${item.price}💰</button>`;
    } else if (equipped) {
      btnHtml = `<button class="shop-item-btn unequip" data-action="unequip" data-id="${id}" data-slot="${item.type === 'weapon' ? 'weapon' : 'accessory'}">해제</button>`;
    } else if (owned) {
      btnHtml = `<button class="shop-item-btn equip" data-action="equip" data-id="${id}">장착</button>`;
    } else {
      btnHtml = `<button class="shop-item-btn buy" ${!canAfford ? 'disabled' : ''} data-action="buy" data-id="${id}">${item.price}💰</button>`;
    }

    div.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${desc}</div>
      </div>
      ${btnHtml}
    `;

    div.querySelector('.shop-item-btn').addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const itemId = e.target.dataset.id;

      if (action === 'buy') {
        const result = game.buyItem(itemId);
        if (result.success) {
          showNotification(result.msg);
          game.save();
        } else {
          showNotification(result.msg);
        }
      } else if (action === 'equip') {
        game.equipItem(itemId);
        showNotification(`${SHOP_ITEMS[itemId].name} 장착!`);
        game.save();
      } else if (action === 'unequip') {
        game.unequipItem(e.target.dataset.slot);
        showNotification('장비 해제');
        game.save();
      }

      shopCoinDisplay.textContent = game.state.coins || 0;
      renderShopItems(currentShopTab);
    });

    shopItems.appendChild(div);
  });
}

// 상점 패널에 마우스 이벤트 등록
shopPanel.addEventListener('mouseenter', onInteractiveEnter);
shopPanel.addEventListener('mouseleave', onInteractiveLeave);

boot();

// ─── 놀이 모드 상태 ─────────────────────────────
let playMode = null; // null | 'water' | 'ball'

// ─── 상태 렌더링 ─────────────────────────────────
function renderState(state, emotion) {
  const gm = state.gaugeMax || 100;
  const pct = (v) => Math.floor((v / gm) * 100) + '%';
  hungerBar.style.width = pct(state.hunger);
  happinessBar.style.width = pct(state.happiness);
  healthBar.style.width = pct(state.health);
  cleanlinessBar.style.width = pct(state.cleanliness);
  energyBar.style.width = pct(state.energy);

  expBar.style.width = game.getExpPercent() + '%';
  levelLabel.textContent = 'Lv.' + state.level;

  stageLabel.textContent = game.getStageName();
  ageLabel.textContent = game.getAgeDays() + '살';

  // 성격 + MBTI 표시
  const personalityLabel = document.getElementById('personality-label');
  if (personalityLabel) {
    const p = state.personality ? PERSONALITIES.find(pp => pp.id === state.personality) : null;
    const pText = p ? p.emoji + p.name : '';
    const mText = state.mbti || '';
    personalityLabel.textContent = [pText, mText].filter(Boolean).join(' ');
  }

  // 부모 정보
  const parentsInfo = document.getElementById('parents-info');
  if (parentsInfo && state.parents) {
    parentsInfo.classList.remove('hidden');
    parentsInfo.textContent = `👨‍👩‍👧 ${state.parents.parent1} ♥ ${state.parents.parent2}`;
  }

  // 친밀도 목록 업데이트
  updateRelations();

  // 전투력 / 코인 / 등급
  const powerLabel = document.getElementById('power-label');
  const coinLabel = document.getElementById('coin-label');
  const gradeLabel = document.getElementById('grade-label');
  if (powerLabel) powerLabel.textContent = game.getTotalPower();
  if (coinLabel) coinLabel.textContent = state.coins || 0;
  if (gradeLabel && state.growthGrade) {
    const grades = { low: '하', mid: '중', high: '상' };
    gradeLabel.textContent = grades[state.growthGrade] || '';
    gradeLabel.className = 'grade-badge grade-' + state.growthGrade;
  }

  // 픽셀아트 스프라이트 그리기
  drawPixelSprite(petCtx, state.stage, emotion);

  // 장비 오버레이
  const spriteData = ALL_SPRITES[currentCreatureType] && ALL_SPRITES[currentCreatureType][state.stage];
  if (spriteData && spriteData.face) {
    const weaponPixel = state.equippedWeapon && SHOP_ITEMS[state.equippedWeapon] ? SHOP_ITEMS[state.equippedWeapon].pixel : null;
    const accPixel = state.equippedAccessory && SHOP_ITEMS[state.equippedAccessory] ? SHOP_ITEMS[state.equippedAccessory].pixel : null;
    drawEquipment(petCtx, spriteData.face, weaponPixel, accPixel);
  }

  // 알 단계 흔들림 애니메이션
  petEl.className = 'pet';
  if (state.stage === 'egg') {
    petEl.classList.add('egg-wobble');
  } else if (state.stage === 'cracked-egg') {
    petEl.classList.add('egg-shake');
  } else if (!isWalking && emotion !== 'sleeping' && emotion !== 'dead') {
    petEl.classList.add('idle');
  }

  renderPoops(state.poops);
  deathScreen.classList.toggle('hidden', !state.isDead);

  // 사망 사인 표시
  if (state.isDead) {
    const deathMsg = document.getElementById('death-msg');
    const deathCause = document.getElementById('death-cause');
    const name = state.petName || '펫';
    const age = game.getAgeDays();
    const causes = {
      natural: `🕊️ ${name}이(가) ${age}살에 편안히 눈을 감았어요`,
      battle: `⚔️ ${name}이(가) 전투 중 쓰러졌어요`,
      starve: `${name}이(가) 굶어서 떠났어요`,
    };
    if (deathMsg) deathMsg.textContent = causes[state.deathCause] || `${name}이(가) 떠났어요...`;
    if (deathCause) deathCause.textContent = `향년 ${age}살`;
  }
}

// ─── 똥 렌더링 ───────────────────────────────────
function renderPoops(count) {
  const current = poopContainer.children.length;
  if (count > current) {
    for (let i = current; i < count; i++) {
      const poop = document.createElement('div');
      poop.className = 'poop';
      poop.textContent = '💩';
      poop.addEventListener('click', () => game.cleanPoop());
      poopContainer.appendChild(poop);
    }
  } else if (count < current) {
    while (poopContainer.children.length > count) {
      poopContainer.lastChild.remove();
    }
  }
}

// ─── 알림 말풍선 ─────────────────────────────────
let notifyTimer = null;
function showNotification(msg) {
  notification.textContent = msg;
  notification.classList.remove('hidden');
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// ─── 클릭 통과 ──────────────────────────────────
// body는 pointer-events:none → 투명 영역 클릭이 OS로 통과
// 인터랙티브 요소만 pointer-events:auto
// mouseenter/mouseleave로 Electron ignore 토글

let mouseOverInteractive = 0; // 레퍼런스 카운트

function onInteractiveEnter() {
  mouseOverInteractive++;
  if (mouseOverInteractive === 1) {
    window.api.setIgnoreMouse(false);
  }
}

function onInteractiveLeave() {
  mouseOverInteractive--;
  if (mouseOverInteractive <= 0) {
    mouseOverInteractive = 0;
    if (!isDragging && !playMode) {
      window.api.setIgnoreMouse(true);
    }
  }
}

// 펫, 상태패널, 똥, 사망화면에 enter/leave 등록
[petContainer, statusPanel, poopContainer, deathScreen].forEach(el => {
  el.addEventListener('mouseenter', onInteractiveEnter);
  el.addEventListener('mouseleave', onInteractiveLeave);
});

// ─── 상태 패널 토글 (호버) ───────────────────────
// 캐릭터(petEl)에 마우스를 올렸을 때만 상태창 표시
petEl.addEventListener('mouseenter', () => {
  statusPanel.classList.remove('hidden');
});

petEl.addEventListener('mouseleave', () => {
  // 상태창 위에 있으면 유지
  setTimeout(() => {
    if (!statusPanel.matches(':hover') && !petEl.matches(':hover')) {
      statusPanel.classList.add('hidden');
    }
  }, 100);
});

statusPanel.addEventListener('mouseleave', () => {
  if (!petEl.matches(':hover')) {
    statusPanel.classList.add('hidden');
  }
});

// ═════════════════════════════════════════════════
// 우클릭 메뉴 (놀아주기 서브메뉴 포함)
// ═════════════════════════════════════════════════
let contextMenu = null;

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.removeEventListener('mouseenter', onInteractiveEnter);
    contextMenu.removeEventListener('mouseleave', onInteractiveLeave);
    contextMenu.remove();
    contextMenu = null;
    // 메뉴 닫힘 → body 클릭 통과 복원
    document.body.style.pointerEvents = '';
    window.api.setIgnoreMouse(true);
    mouseOverInteractive = 0;
  }
}

function createMenuItem(icon, label, action, options = {}) {
  const div = document.createElement('div');
  div.className = 'context-menu-item';
  if (options.disabled) {
    div.style.opacity = '0.4';
    div.style.pointerEvents = 'none';
  }
  if (options.active) {
    div.style.background = 'rgba(0,120,255,0.1)';
    div.style.fontWeight = 'bold';
  }
  div.innerHTML = `<span>${icon}</span><span>${label}</span>`;
  if (options.hasSubmenu) {
    div.innerHTML += `<span style="margin-left:auto;opacity:0.4">▸</span>`;
  }
  div.addEventListener('click', (e) => {
    e.stopPropagation();
    action(e);
  });
  return div;
}

function createSeparator() {
  const sep = document.createElement('div');
  sep.className = 'context-menu-separator';
  return sep;
}

petContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  removeContextMenu();

  // 놀이 모드 중이면 → 놀이 종료
  if (playMode) {
    exitPlayMode();
    return;
  }

  const state = game.state;
  if (state.isDead) return;

  // 메뉴 열림 → body 클릭 활성화 (바깥 클릭으로 닫기 위해)
  document.body.style.pointerEvents = 'auto';
  window.api.setIgnoreMouse(false);

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';

  // 밥 주기
  contextMenu.appendChild(createMenuItem('🍖', '밥 주기', () => {
    game.feed();
    removeContextMenu();
  }));

  // 놀아주기 → 서브메뉴
  contextMenu.appendChild(createMenuItem('🎾', '놀아주기', (e) => {
    showPlaySubmenu(e);
  }, { hasSubmenu: true }));

  // 재우기/깨우기
  contextMenu.appendChild(createMenuItem('😴', state.isSleeping ? '깨우기' : '재우기', () => {
    game.sleep();
    removeContextMenu();
  }));

  // 씻기기
  contextMenu.appendChild(createMenuItem('🛁', '씻기기', () => {
    game.clean();
    removeContextMenu();
  }));

  // 약
  contextMenu.appendChild(createMenuItem('💊', '약 주기', () => {
    game.medicine();
    removeContextMenu();
  }, { disabled: !state.isSick }));

  // 쓰다듬기
  contextMenu.appendChild(createMenuItem('🤚', '쓰다듬기', () => {
    game.pet();
    removeContextMenu();
  }));

  contextMenu.appendChild(createSeparator());

  // 자동 돌봄 토글
  contextMenu.appendChild(createMenuItem('🤖', '자동 돌봄', () => {
    const on = game.toggleAutoCare();
    showNotification(on ? '🤖 자동 돌봄 ON' : '🤖 자동 돌봄 OFF');
    removeContextMenu();
  }, { active: state.autoCare }));

  // 일하기
  contextMenu.appendChild(createMenuItem('💼', '일하기', () => {
    const result = game.work();
    showNotification(result.msg);
    removeContextMenu();
  }));

  // 상점
  contextMenu.appendChild(createMenuItem('💰', '상점', () => {
    openShop();
    removeContextMenu();
  }));

  // 위치
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  document.body.appendChild(contextMenu);
  contextMenu.addEventListener('mouseenter', onInteractiveEnter);
  contextMenu.addEventListener('mouseleave', onInteractiveLeave);

  requestAnimationFrame(() => {
    if (!contextMenu) return;
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      contextMenu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      contextMenu.style.top = (window.innerHeight - rect.height - 5) + 'px';
    }
  });
});

// ─── 놀아주기 서브메뉴 ───────────────────────────
function showPlaySubmenu(e) {
  removeContextMenu();

  // 서브메뉴도 body 활성화 유지
  document.body.style.pointerEvents = 'auto';
  window.api.setIgnoreMouse(false);

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';

  contextMenu.appendChild(createMenuItem('💧', '물뿌리기', () => {
    removeContextMenu();
    enterWaterMode();
  }));

  contextMenu.appendChild(createMenuItem('⚽', '공튀기기', () => {
    removeContextMenu();
    enterBallMode();
  }));

  contextMenu.appendChild(createSeparator());

  contextMenu.appendChild(createMenuItem('◂', '뒤로', () => {
    removeContextMenu();
  }));

  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  document.body.appendChild(contextMenu);
  contextMenu.addEventListener('mouseenter', onInteractiveEnter);
  contextMenu.addEventListener('mouseleave', onInteractiveLeave);

  // 화면 밖으로 나가면 위치 조정
  requestAnimationFrame(() => {
    if (!contextMenu) return;
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      contextMenu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      contextMenu.style.top = (window.innerHeight - rect.height - 5) + 'px';
    }
    if (rect.left < 0) contextMenu.style.left = '5px';
    if (rect.top < 0) contextMenu.style.top = '5px';
  });
}

document.addEventListener('click', (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    removeContextMenu();
  }
});

// ═════════════════════════════════════════════════
// 물뿌리기 모드
// ═════════════════════════════════════════════════
let waterEffectCount = 0;

function enterWaterMode() {
  playMode = 'water';
  waterEffectCount = 0;
  stopWandering();
  // 놀이 모드: 전체 영역 클릭 수신
  document.body.style.pointerEvents = 'auto';
  window.api.setIgnoreMouse(false);
  document.body.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><text y=\'24\' font-size=\'24\'>🚿</text></svg>") 16 16, crosshair';
  showNotification('🚿 물뿌리기 모드! 클릭으로 물 뿌리기 (우클릭으로 종료)');

  document.addEventListener('mousedown', onWaterClick);
  document.addEventListener('keydown', onPlayEscape);
}

function onWaterClick(e) {
  if (e.button !== 0 || playMode !== 'water') return;

  // 물 파티클 이펙트
  for (let i = 0; i < 6; i++) {
    const drop = document.createElement('div');
    drop.className = 'water-drop';
    drop.style.left = (e.clientX + (Math.random() - 0.5) * 40) + 'px';
    drop.style.top = (e.clientY + (Math.random() - 0.5) * 40) + 'px';
    document.body.appendChild(drop);
    setTimeout(() => drop.remove(), 600);
  }

  waterEffectCount++;
  // 3번 클릭마다 게임 효과 적용
  if (waterEffectCount % 3 === 0) {
    game.waterPlay();
  }
}

// ═════════════════════════════════════════════════
// 공튀기기 모드
// ═════════════════════════════════════════════════
let ballFollowInterval = null;
let ballTicks = 0;

function enterBallMode() {
  playMode = 'ball';
  ballTicks = 0;
  stopWandering();
  // 놀이 모드: 전체 영역 클릭 수신
  document.body.style.pointerEvents = 'auto';
  window.api.setIgnoreMouse(false);
  document.body.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><text y=\'26\' font-size=\'26\'>⚽</text></svg>") 16 16, pointer';
  showNotification('⚽ 공튀기기 모드! 용이 따라와요 (우클릭으로 종료)');

  // 용이 마우스를 따라오게
  document.addEventListener('mousemove', onBallMove);
  document.addEventListener('keydown', onPlayEscape);

  // 일정 간격으로 경험치 + 행복
  ballFollowInterval = setInterval(() => {
    if (playMode !== 'ball') return;
    ballTicks++;
    if (ballTicks % 4 === 0) {
      game.ballPlay();
    }
  }, 1000);
}

async function onBallMove(e) {
  if (playMode !== 'ball') return;

  const winSize = await window.api.getWindowSize();
  // 공(마우스) 위치 기준으로 창을 이동 — 용이 공을 쫓는 느낌
  const targetX = e.screenX - winSize.width / 2;
  const targetY = e.screenY - winSize.height / 2;

  const winPos = await window.api.getWindowPosition();

  // 부드럽게 따라가기 (즉시 이동 대신 보간)
  const lerp = 0.15;
  const newX = winPos.x + (targetX - winPos.x) * lerp;
  const newY = winPos.y + (targetY - winPos.y) * lerp;

  // 방향에 따라 좌우 반전 (캔버스에만 적용해서 상태창은 뒤집히지 않게)
  if (targetX < winPos.x) {
    petCanvas.style.transform = 'scaleX(-1)';
  } else {
    petCanvas.style.transform = 'scaleX(1)';
  }

  petEl.classList.add('walking');
  petEl.classList.remove('idle');

  window.api.setWindowPosition(newX, newY);
}

// ─── 놀이 모드 공통 종료 ─────────────────────────
function onPlayEscape(e) {
  if (e.key === 'Escape') {
    exitPlayMode();
  }
}

function exitPlayMode() {
  if (playMode === 'water') {
    document.removeEventListener('mousedown', onWaterClick);
  }
  if (playMode === 'ball') {
    document.removeEventListener('mousemove', onBallMove);
    if (ballFollowInterval) {
      clearInterval(ballFollowInterval);
      ballFollowInterval = null;
    }
  }
  document.removeEventListener('keydown', onPlayEscape);

  playMode = null;
  document.body.style.cursor = '';
  document.body.style.pointerEvents = '';
  petEl.classList.remove('walking');
  petEl.classList.add('idle');
  window.api.setIgnoreMouse(true); // 놀이 종료: 클릭 통과 복원
  mouseOverInteractive = 0;
  showNotification('놀이 끝!');
  startWandering();
}

// ─── 쓰다듬기 (더블클릭) ─────────────────────────
petContainer.addEventListener('dblclick', () => {
  if (playMode) return;
  game.pet();
  showNotification('💕');
});

// ─── 드래그 이동 ─────────────────────────────────
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

petContainer.addEventListener('mousedown', async (e) => {
  if (e.button !== 0 || playMode) return;
  isDragging = true;
  stopWandering();
  // 드래그 중: 전체 영역에서 마우스 수신
  document.body.style.pointerEvents = 'auto';
  window.api.setIgnoreMouse(false);

  const winPos = await window.api.getWindowPosition();
  dragOffsetX = e.screenX - winPos.x;
  dragOffsetY = e.screenY - winPos.y;
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const x = e.screenX - dragOffsetX;
  const y = e.screenY - dragOffsetY;
  window.api.setWindowPosition(x, y);
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.pointerEvents = '';
    window.api.setIgnoreMouse(true);
    mouseOverInteractive = 0;
    startWandering();
  }
});

// ─── 자유 이동 (화면 전체 돌아다니기) ────────────
let isWalking = false;
let wanderTimer = null;
let moveInterval = null;

async function wander() {
  if (isDragging || game.state.isDead || game.state.isSleeping || isWalking || playMode) return;

  const screenSize = await window.api.getScreenSize();
  const winSize = await window.api.getWindowSize();
  const winPos = await window.api.getWindowPosition();

  const margin = 50;
  const maxX = screenSize.width - winSize.width - margin;
  const maxY = screenSize.height - winSize.height - margin;

  let targetX, targetY;
  if (Math.random() < 0.7) {
    targetX = margin + Math.random() * maxX;
    targetY = margin + Math.random() * maxY;
  } else {
    targetX = winPos.x + (Math.random() - 0.5) * 200;
    targetY = winPos.y + (Math.random() - 0.5) * 100;
  }

  targetX = Math.max(0, Math.min(maxX + margin, targetX));
  targetY = Math.max(0, Math.min(maxY + margin, targetY));

  const dx = targetX - winPos.x;
  const dy = targetY - winPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (dx < 0) {
    petCanvas.style.transform = 'scaleX(-1)';
  } else {
    petCanvas.style.transform = 'scaleX(1)';
  }

  isWalking = true;
  petEl.classList.add('walking');
  petEl.classList.remove('idle');

  const steps = Math.max(10, Math.floor(distance / 15));
  const stepX = dx / steps;
  const stepY = dy / steps;
  let step = 0;

  moveInterval = setInterval(() => {
    step++;
    window.api.setWindowPosition(
      winPos.x + stepX * step,
      winPos.y + stepY * step
    );
    if (step >= steps) {
      clearInterval(moveInterval);
      moveInterval = null;
      isWalking = false;
      petEl.classList.remove('walking');
      petEl.classList.add('idle');
    }
  }, 40);
}

function startWandering() {
  if (wanderTimer || playMode) return;
  function scheduleNext() {
    const willRest = Math.random() < 0.7;
    const delay = willRest
      ? 8000 + Math.random() * 12000
      : 6000 + Math.random() * 4000;

    wanderTimer = setTimeout(() => {
      if (!willRest) wander();
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function stopWandering() {
  if (wanderTimer) {
    clearTimeout(wanderTimer);
    wanderTimer = null;
  }
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
    isWalking = false;
    petEl.classList.remove('walking');
    petEl.classList.add('idle');
  }
}

// ─── 부활 버튼 ───────────────────────────────────
reviveBtn.addEventListener('click', () => {
  game.revive();
  startWandering();
});

// ─── 종료 시 저장 ────────────────────────────────
window.addEventListener('beforeunload', () => {
  game.save();
});
