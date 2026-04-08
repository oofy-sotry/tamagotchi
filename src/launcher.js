const petList = document.getElementById('pet-list');
const newPetBtn = document.getElementById('new-pet-btn');
const nameOverlay = document.getElementById('name-overlay');
const newNameInput = document.getElementById('new-name-input');
const nameError = document.getElementById('name-error');
const nameConfirm = document.getElementById('name-confirm');
const nameCancel = document.getElementById('name-cancel');
const closeBtn = document.getElementById('close-btn');

const CREATURE_ICONS = {
  dragon: '🐉',
  fire_lizard: '🦎',
  water_turtle: '🐢',
};

const CREATURE_NAMES = {
  dragon: '용',
  fire_lizard: '불도마뱀',
  water_turtle: '물거북',
};

// ─── 펫 목록 로드 ────────────────────────────────
async function loadPetList() {
  const { success, pets } = await window.api.listPets();
  petList.innerHTML = '';

  if (!pets || pets.length === 0) {
    petList.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🥚</div>
        <div>아직 펫이 없어요<br>새 펫을 만들어보세요!</div>
      </div>
    `;
    return;
  }

  pets.forEach(pet => {
    const card = document.createElement('div');
    card.className = 'pet-card' + (pet.isOpen ? ' is-open' : '') + (pet.isDead ? ' is-dead' : '');

    const icon = CREATURE_ICONS[pet.creatureType] || '🥚';
    const typeName = CREATURE_NAMES[pet.creatureType] || '알';

    let badgeHtml = '';
    if (pet.isOpen) badgeHtml = '<span class="pet-card-badge open">실행중</span>';
    else if (pet.isDead) badgeHtml = '<span class="pet-card-badge dead">사망</span>';

    card.innerHTML = `
      <div class="pet-card-icon">${icon}</div>
      <div class="pet-card-info">
        <div class="pet-card-name">${pet.name}</div>
        <div class="pet-card-detail">Lv.${pet.level} ${typeName}</div>
      </div>
      ${badgeHtml}
      <button class="pet-card-delete" title="삭제">🗑</button>
    `;

    // 클릭 → 펫 열기
    card.addEventListener('click', async (e) => {
      if (e.target.classList.contains('pet-card-delete')) return;
      if (pet.isOpen) return;
      await window.api.openPet(pet.name);
      loadPetList(); // 목록 갱신
    });

    // 삭제 버튼
    card.querySelector('.pet-card-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`"${pet.name}"을(를) 정말 삭제할까요?`)) {
        await window.api.deletePet(pet.name);
        loadPetList();
      }
    });

    petList.appendChild(card);
  });
}

// ─── 새 펫 만들기 ────────────────────────────────
newPetBtn.addEventListener('click', () => {
  nameOverlay.classList.remove('hidden');
  newNameInput.value = '';
  nameError.textContent = '';
  newNameInput.focus();
});

nameCancel.addEventListener('click', () => {
  nameOverlay.classList.add('hidden');
});

nameConfirm.addEventListener('click', createNewPet);
newNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createNewPet();
  if (e.key === 'Escape') nameOverlay.classList.add('hidden');
});

async function createNewPet() {
  const name = newNameInput.value.trim();
  if (!name) {
    nameError.textContent = '이름을 입력해주세요';
    return;
  }

  const result = await window.api.createPet(name);
  if (!result.success) {
    if (result.error === 'name-exists') {
      nameError.textContent = '이미 존재하는 이름이에요';
    } else {
      nameError.textContent = '오류가 발생했어요';
    }
    return;
  }

  nameOverlay.classList.add('hidden');
  loadPetList();
}

// ─── 닫기 버튼 ───────────────────────────────────
closeBtn.addEventListener('click', () => {
  window.api.closeLauncher();
});

// ─── 초기화 ──────────────────────────────────────
loadPetList();

// 3초마다 목록 갱신 (다른 곳에서 펫이 열리거나 닫힐 수 있음)
setInterval(loadPetList, 3000);
