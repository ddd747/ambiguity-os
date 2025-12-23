// scripts/wallpaper-stormy-night.js

let isActive = false;
let flashTimeout = null;
const rainDrops = []; // 存储当前雨滴元素

let stormyOverlay = null;

function createStormyOverlay() {
  if (stormyOverlay) return;
  stormyOverlay = document.createElement('div');
  stormyOverlay.id = 'stormy-overlay';
  Object.assign(stormyOverlay.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.85)', // 深灰黑，保留一点细节
    zIndex: '9996', // 低于雨滴(9997)和闪电(9998)，高于模型
    pointerEvents: 'none'
  });
  document.body.appendChild(stormyOverlay);
}

function removeStormyOverlay() {
  if (stormyOverlay) {
    stormyOverlay.remove();
    stormyOverlay = null;
  }
}

function activateStormyNight() {
  if (isActive) return;
  isActive = true;

  console.log('⚡️ [Stormy Night] 激活中...');

  // 🔍 调试 1: 记录 body 当前背景
  const computedStyle = getComputedStyle(document.body);
  console.log('🔍 [BEFORE] body background:', {
    styleBgColor: document.body.style.backgroundColor,
    computedBgColor: computedStyle.backgroundColor,
    styleBgImage: document.body.style.backgroundImage,
    computedBgImage: computedStyle.backgroundImage
  });

  // ✅ 1. 强制黑屏（用 !important 级别）
  document.body.style.backgroundColor = '#000';
  document.body.style.backgroundImage = 'none';
  // 👇 新增：用 CSS 变量或 class 作为兜底（可选）
  document.body.classList.add('stormy-night-active');

  // 🔍 调试 2: 立即检查是否生效
  setTimeout(() => {
    const afterStyle = getComputedStyle(document.body);
    console.log('🔍 [AFTER] body background:', {
      styleBgColor: document.body.style.backgroundColor,
      computedBgColor: afterStyle.backgroundColor,
      styleBgImage: document.body.style.backgroundImage,
      computedBgImage: afterStyle.backgroundImage
    });

    // 检查是否有其他元素遮挡（如 #filter-overlay, canvas 等）
    const overlay = document.getElementById('filter-overlay');
    if (overlay) {
      console.log('🔍 filter-overlay display:', overlay.style.display, 'class:', overlay.className);
    }

    const rainCanvas = document.getElementById('rain-canvas');
    if (rainCanvas) {
      console.log('🔍 rain-canvas display:', rainCanvas.style.display);
    }
  }, 50);

  // ✅ 2. 播放无缝雨声
  if (typeof playSeamlessRain === 'function') {
    playSeamlessRain();
  } else if (typeof playRainSound === 'function') {
    playRainSound(); // 回退
  }

  // ✅ 3. 启动闪电
  scheduleNextFlash();

  // ✅ 4. 启动屏幕雨滴
  startScreenRain();

    // 👇 新增：全屏暗化遮罩
  createStormyOverlay();
  
  console.log('✅ [Stormy Night] 已激活');
}

function deactivateStormyNight() {
  console.log('🌙 [Stormy Night] 停用中...');
  isActive = false;
  clearTimeout(flashTimeout);

  // 停止雨声
  if (typeof stopSeamlessRain === 'function') {
    stopSeamlessRain();
  } else if (typeof stopRainSound === 'function') {
    stopRainSound();
  }

  // 清理雨滴
  stopScreenRain();
  // 👇 新增：全屏暗化遮罩
  removeStormyOverlay()
  // 恢复背景
  document.body.style.backgroundColor = '';
  document.body.style.backgroundImage = '';
  document.body.classList.remove('stormy-night-active');

  console.log('✅ [Stormy Night] 已停用');
}

// 👇 新增：屏幕雨滴效果（滴在屏幕上，几秒消失）
function startScreenRain() {
  if (!isActive) return;

  // 随机生成雨滴（每 300~800ms 一个）
  const createDrop = () => {
    if (!isActive) return;

    const drop = document.createElement('div');
    drop.style.position = 'fixed';
    drop.style.zIndex = '9997'; // 低于闪电（9998），高于模型
    drop.style.pointerEvents = 'none';
    drop.style.width = '4px';
    drop.style.height = '12px';
    drop.style.borderRadius = '2px';
    drop.style.backgroundColor = 'rgba(180, 200, 255, 0.6)';
    drop.style.boxShadow = '0 0 4px rgba(150, 180, 255, 0.8)';

    // 随机位置（避开边缘）
    const x = Math.random() * (window.innerWidth - 20) + 10;
    const y = Math.random() * (window.innerHeight - 50) + 20;
    drop.style.left = `${x}px`;
    drop.style.top = `${y}px`;

    document.body.appendChild(drop);
    rainDrops.push(drop);

    // 淡出并移除（持续 2~4 秒）
    const duration = 2000 + Math.random() * 2000;
    setTimeout(() => {
      drop.style.transition = 'opacity 0.8s ease-out';
      drop.style.opacity = '0';
      setTimeout(() => {
        if (drop.parentNode) drop.parentNode.removeChild(drop);
        const index = rainDrops.indexOf(drop);
        if (index > -1) rainDrops.splice(index, 1);
      }, 800);
    }, duration);
  };

  // 启动雨滴生成器
  const interval = setInterval(() => {
    if (!isActive) {
      clearInterval(interval);
      return;
    }
    createDrop();
  }, 300 + Math.random() * 500); // 随机间隔

  // 保存引用以便清理
  screenRainInterval = interval;
}

function stopScreenRain() {
  if (screenRainInterval) {
    clearInterval(screenRainInterval);
    screenRainInterval = null;
  }
  // 移除所有雨滴
  rainDrops.forEach(drop => {
    if (drop.parentNode) drop.parentNode.removeChild(drop);
  });
  rainDrops.length = 0;
}

function scheduleNextFlash() {
  if (!isActive) return;
  const delay = 3000 + Math.random() * 7000;
  flashTimeout = setTimeout(() => {
    triggerFlash();
    scheduleNextFlash();
  }, delay);
}

function triggerFlash() {
  if (!isActive) return;

  // 创建闪光层（CSS 动画）
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed',
    top: '0', left: '0',
    width: '100%', height: '100%',
    background: 'rgba(220, 230, 255, 0.75)',
    pointerEvents: 'none',
    zIndex: '9998',
    opacity: '0',
    transition: 'opacity 0.1s'
  });
  document.body.appendChild(flash);

  // 触发雷声
  if (typeof playThunderSound === 'function') {
    playThunderSound();
  }

  // 闪光动画
  requestAnimationFrame(() => {
    flash.style.opacity = '1';
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 100);
    }, 120);
  });
}

// 全局引用
let screenRainInterval = null;

// 暴露给主程序
window.activateStormyNight = activateStormyNight;
window.deactivateStormyNight = deactivateStormyNight;

// 👇 新增：强制 CSS 规则（兜底方案）
(function injectStormyCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* 确保 stormy night 模式下 body 一定是黑的 */
    body.stormy-night-active {
      background-color: #000 !important;
      background-image: none !important;
    }
  `;
  document.head.appendChild(style);
})();