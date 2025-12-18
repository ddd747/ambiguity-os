// ==============================
// Living OS 安装程序 - 脚本逻辑
// ==============================

// 防止已设置用户直接访问
if (localStorage.getItem('ambiguityos:setup_completed') === 'true') {
  alert('初始设置已完成，正在返回桌面...');
  window.location.href = './index.html';
}

let currentStep = 'bios';

// 👇 全局工具函数：检测触屏设备
function isTouchDevice() {
  return ('ontouchstart' in window) || 
         (navigator.maxTouchPoints > 0) ||
         (navigator.msMaxTouchPoints > 0);
}

// 切换步骤并更新 body class
function goToStep(step) {
  // 隐藏当前步骤
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  // 显示新步骤
  document.getElementById(`step-${step}`).classList.add('active');
  // 更新全局状态
  currentStep = step;
  document.body.className = `era-${step}`;

  // 👇【修复】检查是否进入 DOS 步骤（用于触屏提示）
  if (step === 'dos') {
    // 延迟检测触屏设备并显示按钮（需在 DOM 加载后）
    setTimeout(() => {
      const prompt = document.querySelector('#step-dos .touch-prompt');
      if (prompt && isTouchDevice()) {
        prompt.classList.remove('hidden');
      }
    }, 50);
  }
}

// DOS 步骤========== 新 DOS 交互逻辑 ==========
let hasReceivedKey = false;
let dosPromptTimeout = null;

// 监听键盘输入（桌面用户）
document.addEventListener('keydown', (e) => {
  if (currentStep !== 'dos') return;
  hasReceivedKey = true; // 标记：有键盘输入

  const key = e.key.toLowerCase();
  if (key === 'c') {
    goToStep('win31');
  } else if (key === 'q') {
    alert('Living OS 需要完成初始设置才能运行。');
  }
});

// 改造 goToStep：进入 DOS 时启动检测
function goToStep(step) {
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  document.getElementById(`step-${step}`).classList.add('active');
  currentStep = step;
  document.body.className = `era-${step}`;

  // 👇 进入 DOS 步骤时，启动“无键盘检测”
  if (step === 'dos') {
    hasReceivedKey = false;
    // 清除之前的定时器（防止多次进入）
    if (dosPromptTimeout) clearTimeout(dosPromptTimeout);
    // 1 秒后若无键盘输入，则显示按钮
    dosPromptTimeout = setTimeout(() => {
      if (!hasReceivedKey) {
        const prompt = document.querySelector('#step-dos .touch-prompt');
        if (prompt) prompt.classList.remove('hidden');
      }
    }, 1000);
  }
}

// Win3.1：启用“下一步”按钮（当区域已选）
document.getElementById('region-select').addEventListener('change', () => {
  const region = document.getElementById('region-select').value;
  document.getElementById('win31-next').disabled = !region;
});

// XP：启用“下一步”按钮（用户名有效）
document.getElementById('account-name').addEventListener('input', () => {
  const name = document.getElementById('account-name').value.trim();
  const valid = name.length >= 2 && name.length <= 20;
  document.getElementById('xp-next').disabled = !valid;
});

// 完成设置：保存所有选项并跳转
function finishSetup() {
  // 读取所有设置
  const settings = {
    // Step 2: 区域与输入
    region: document.getElementById('region-select').value,
    keyboard: document.getElementById('keyboard-select').value,

    // Step 3: 桌面个性
    startMenuStyle: document.querySelector('input[name="menu-style"]:checked')?.value || 'classic',
    wallpaper: document.querySelector('input[name="wallpaper"]:checked').value,

    // Step 4: 身份
    accountName: document.getElementById('account-name').value.trim(),

    // Step 5: 隐私
    allowLocation: document.getElementById('allow-location').checked,
    allowAnalytics: document.getElementById('allow-analytics').checked,
    allowNetwork: document.getElementById('allow-network').checked,

    // 标记完成
    setup_completed: true,
    setup_version: '1.0.0' // 用于未来升级检测
  };

  // 保存到 localStorage（加前缀避免冲突）
  Object.keys(settings).forEach(key => {
    localStorage.setItem(`ambiguityos:${key}`, String(settings[key]));
  });

  // 👇【新增调试】确认写入成功
  console.log('✅ Setup completed! Saved settings:');
  console.log('ambiguityos:setup_completed =', localStorage.getItem('ambiguityos:setup_completed'));
  console.log('All ambiguityos keys:', 
    Object.keys(localStorage).filter(k => k.startsWith('ambiguityos:'))
  );

  // 进入尾声
  goToStep('final');

  // 倒计时跳转
  let count = 5;
  const countdownEl = document.getElementById('countdown');
  const interval = setInterval(() => {
    count--;
    countdownEl.textContent = count;
    if (count <= 0) {

      // 👇【新增调试】跳转前再检查一次
      console.log('🚀 About to redirect to index.html...');
      console.log('Current setup_completed value:', localStorage.getItem('ambiguityos:setup_completed'));

      clearInterval(interval);
      window.location.href = './index.html';
    }
  }, 1000);
}

// 初始化：确保从 BIOS 开始
document.addEventListener('DOMContentLoaded', () => {
  // 绑定 DOS 按钮点击
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('dos-touch-btn')) {
      const key = e.target.dataset.key;
      if (key === 'c') {
        goToStep('win31');
      } else if (key === 'q') {
        alert('Living OS 需要完成初始设置才能运行。');
      }
    }
  });
});