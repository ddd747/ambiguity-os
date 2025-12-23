// scripts/gap-script.js
// ========== 歧义裂隙本体 ==========

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('📍 URL:', window.location.href);
  console.log('🔍 #battle-grid exists:', !!document.getElementById('battle-grid'));
  console.log('📦 localStorage.selected:', localStorage.getItem('ambiguity-gap:selected-character'));
  const isGamePage = document.querySelector('#battle-grid') !== null;
  if (!isGamePage) { /* ... */ return; }

  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  console.log('🎮 Detected mode:', mode); // 👈 关键！

  if (mode === 'tutorial') {
    initCharacter('Windown');
    document.getElementById('network-status').textContent = '训练营';
    document.getElementById("connection-status").textContent = 'Never Gonna Give You Up';
    initBattleMap(); // 👈 关键：初始化地图
    showTutorialHint(); // ✅ 显示提示
 } else if (mode === 'single') {
  let char = localStorage.getItem('ambiguity-gap:selected-character');
  if (!char) {
    console.warn('⚠️ 未检测到已选角色，使用默认角色 "通用"');
    char = '通用';
    // 可选：自动保存，避免下次再出错
    localStorage.setItem('ambiguity-gap:selected-character', '通用');
  }
    initCharacter(char);
    document.getElementById('network-status').textContent = '单机模式';
    document.getElementById('connection-status').textContent = '欸嘿';
    initBattleMap();
  } else if (mode === 'network') {
    // 联网模式暂不初始化（等连接后）
    const char = localStorage.getItem('ambiguity-gap:selected-character') || '未选择';
    initCharacter(char);
    document.getElementById('network-status').textContent = '等待加入...';
    document.getElementById("connection-status").textContent = '联网中';
    // 不调用 initBattleMap()
  }
});

function initCharacter(name) {
  document.getElementById('current-character').textContent = name; // 顶部状态栏
  document.getElementById('char-name').textContent = name;        // 角色面板
  // 初始化游戏层级为 0（数字）
  document.getElementById('current-level').textContent = '0';
}

function showTutorialHint() {
  const hint = document.createElement('div');
  hint.textContent = '🎓 欢迎来到训练营！点击地雷学习机制。';
  hint.style.position = 'absolute';
  hint.style.top = '10px';
  hint.style.left = '50%';
  hint.style.transform = 'translateX(-50%)';
  hint.style.background = 'rgba(0,0,0,0.7)';
  hint.style.color = 'white';
  hint.style.padding = '6px 12px';
  hint.style.borderRadius = '4px';
  hint.style.zIndex = '1000';
  document.body.appendChild(hint);
  
  setTimeout(() => hint.remove(), 5000);
}

// ========== 扫雷地图逻辑 ==========
function initBattleMap() {
  const grid = document.getElementById('battle-grid');
  const size = 9;
  const mineCount = 10; // 地雷数量

  // 创建空网格
  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i));
    grid.appendChild(cell);
    cells.push(cell);
  }

  // 随机布雷
  const mines = new Set();
  while (mines.size < mineCount) {
    mines.add(Math.floor(Math.random() * (size * size)));
  }

  // 计算数字
  for (let i = 0; i < size * size; i++) {
    if (mines.has(i)) {
      cells[i].dataset.isMine = 'true';
      continue;
    }

    let count = 0;
    const row = Math.floor(i / size);
    const col = i % size;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const ni = nr * size + nc;
          if (mines.has(ni)) count++;
        }
      }
    }
    cells[i].dataset.adjacent = count;
  }
}

function handleCellClick(index) {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  if (cell.classList.contains('revealed')) return;

  cell.classList.add('revealed');

 // gap-script.js → handleCellClick
if (cell.dataset.isMine === 'true') {
  cell.textContent = '⚠️';
  cell.style.background = '#300'; // 地雷背景可保留固定色
  cell.classList.add('mine');
} else {
  const count = cell.dataset.adjacent;
  if (count > 0) {
    cell.textContent = count;
    // 不再设置 style.color！让 CSS 控制
  }
}
}

// ========== 返回桌面按钮 ==========
document.getElementById('back-to-desktop')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});