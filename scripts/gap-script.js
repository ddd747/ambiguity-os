// scripts/gap-script.js

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  const selectedChar = localStorage.getItem('ambiguity-gap:selected-character');
  
  if (!selectedChar) {
    alert('❌ 未选择角色！请返回主系统选择。');
    window.location.href = 'index.html';
    return;
  }

  // 显示当前角色
  document.getElementById('current-character').textContent = selectedChar;

  // 初始化层级显示
  let currentLevel = 0;
  document.getElementById('current-level').textContent = currentLevel;
  // 示例：未来可从 localStorage 或角色配置读取
  document.getElementById('char-hp').textContent = '100';
  document.getElementById('char-trust').textContent = '50'; // 虽然不用于战斗，但可显示
  document.getElementById('char-skill').textContent = '扫雷直觉';
  // 初始化地图
  initBattleMap();
  initThemeSystem(); // ← 新增：初始化 UI 主题
});

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