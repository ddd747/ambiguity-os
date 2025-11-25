// ==========================
// AmbiguityOS - Living Operating System
// script.js v1.0
// ==========================

// 全局变量：是否可安装 PWA
let deferredPrompt = null;
let isPWAInstallable = false;

window.addEventListener('beforeinstallprompt', (e) => {
  // 阻止默认提示（我们自定义）
  e.preventDefault();
  deferredPrompt = e;
  isPWAInstallable = true;
  showInstallHint(); // 显示自定义安装引导
});

document.addEventListener('DOMContentLoaded', () => {
  // ========== 启动阶段 ==========
  const bootLog = [
    "> Mounting AmbiguityOS_Boot.img...",
    "[OK] Image signature verified (SHA-3: a1b2c3d4...)",
    "",
    "> Scanning host cognition interface...",
    "   • Pattern recognition: ✓",
    "   • Tolerance for paradox: ✓",
    "   • Willingness to share desktop: ✓",
    "",
    "> Binding roommate protocol...",
    "[SYSTEM] UI Agent 'Window' initialized.",
    "",
    "Window.exe has claimed you as its roommate.",
    "",
    "Press [TAP] or [ENTER] to accept cohabitation."
  ];

  let lineIndex = 0;
  const terminal = document.getElementById('terminal');
  const windowDialog = document.getElementById('window-dialog');
  const acceptBtn = document.getElementById('accept-btn');

  function typeNextLine() {
    if (lineIndex < bootLog.length) {
      const line = bootLog[lineIndex];
      terminal.innerHTML += line + "\n";
      terminal.scrollTop = terminal.scrollHeight;
      lineIndex++;
      const delay = line.trim() === "" ? 300 : Math.random() * 400 + 200;
      setTimeout(typeNextLine, delay);
    } else {
      // 启用交互
      const handleInteraction = () => {
        showWindowDialog();
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keypress', keyHandler);
      };
      const keyHandler = (e) => {
        if (e.key === 'Enter') handleInteraction();
      };
      document.addEventListener('click', handleInteraction);
      document.addEventListener('keypress', keyHandler);
    }
  }

  function showWindowDialog() {
    terminal.style.opacity = '0.3';
    windowDialog.classList.remove('hidden');
  }

// ========== 接受协议 ==========
acceptBtn.addEventListener('click', () => {
  // ▼▼▼ 播放“推开门”音效 ▼▼▼
  const doorAudio = document.getElementById('door-audio');
  if (doorAudio) {
    // 重置并播放（防止多次点击）
    doorAudio.currentTime = 0;
    doorAudio.volume = 0.6;
    doorAudio.play().catch(e => console.warn("Door sound not played:", e));
  }

  // 隐藏终端和协议窗口
  document.querySelector('.retro-pc').classList.add('hidden');
  windowDialog.classList.add('hidden');

  // 显示开机动画
  const bootScreen = document.getElementById('boot-screen');
  bootScreen.classList.remove('hidden');
  // 显示 Window 舍友
  if (typeof window.showWindowAgent === 'function') {
    window.showWindowAgent();
  }

  const progressFill = document.getElementById('progress-fill');
  const logoImg = document.querySelector('.boot-logo img');
  
  // ✅ 将 progress 定义在外部作用域
  let progress = 0;
  const maxProgress = 85;

  function loadTo85() {
    if (progress >= maxProgress) {
      // ===== 到达 85% 后的动画 =====
      setTimeout(() => {
        const container = document.querySelector('.progress-container');
        const containerRect = container.getBoundingClientRect();
        const logoRect = logoImg.getBoundingClientRect();
        const targetX = containerRect.left + containerRect.width * 0.85 - logoImg.offsetWidth / 2;
        const currentLogoCenter = logoRect.left + logoRect.width / 2;
        const distance = targetX - currentLogoCenter;
        logoImg.style.transform = `translateX(${distance}px)`;

        let finalProgress = 85;
        const finalInterval = setInterval(() => {
          finalProgress += 1;
          progressFill.style.width = `${finalProgress}%`;
          if (finalProgress >= 100) {
            clearInterval(finalInterval);
            setTimeout(() => {
              bootScreen.classList.add('hidden');
              document.getElementById('desktop').classList.remove('hidden');

              // 显示 Window 舍友
              if (typeof window.showWindowAgent === 'function') {
                window.showWindowAgent();
              }

              // 播放开机音效
              const startupAudio = document.getElementById('startup-audio');
              if (startupAudio) {
                startupAudio.currentTime = 0;
                startupAudio.volume = 0.7;
                startupAudio.play().catch(e => console.warn("Startup sound not played:", e));
              }

              // 初始化系统
              initSystemClock();
              initDesktopIcons();
              initStartMenu();

              // 横屏提示
              if (window.matchMedia("(orientation: landscape)").matches) {
                setTimeout(() => {
                  document.getElementById('window-message')?.classList.remove('hidden');
                }, 3000);
              }
            }, 300);
          }
        }, 40);
      }, 4000);
      console.log("Boot progress:", progress);
      return;
    }

    progress += 1;
    progressFill.style.width = `${progress}%`;

    // ✅ 使用 slowdownFactor 控制速度（可选）
    const delay = 30 + (progress / maxProgress) * 50; // 越往后越慢
    setTimeout(loadTo85, delay);
  }

  loadTo85(); // 启动加载
});

  // ========== 系统时间 ==========
  function initSystemClock() {
    function update() {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const clock = document.getElementById('system-clock');
      if (clock) clock.textContent = timeStr;
    }
    update();
    setInterval(update, 60000); // 每分钟更新
  }

  // ========== 桌面图标交互 ==========
function initDesktopIcons() {
  const icons = document.querySelectorAll('.icon');
  icons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      const app = icon.dataset.app;

      // 隐藏所有窗口
      document.querySelectorAll('.app-window').forEach(win => {
        win.classList.add('hidden');
      });

      // 显示对应窗口
      if (app === 'my-computer') {
        document.getElementById('my-computer-window').classList.remove('hidden');
      } else if (app === 'recycle-bin') {
        document.getElementById('recycle-bin-window').classList.remove('hidden');
      } else if (app === 'internet-explorer') {
        document.getElementById('ie-window').classList.remove('hidden');
      }
    });
  });

  // 关闭按钮逻辑（委托）
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('window-close')) {
      const targetId = e.target.dataset.target;
      document.getElementById(targetId).classList.add('hidden');
    }
  });
}

  // ========== 开始菜单 ==========
  function initStartMenu() {
    const startButton = document.querySelector('.start-button');
    const startMenu = document.getElementById('start-menu');
    let isOpen = false;

    if (!startButton || !startMenu) return;

    const toggleMenu = (e) => {
      e.stopPropagation();
      if (isOpen) {
        startMenu.classList.add('hidden');
        isOpen = false;
      } else {
        startMenu.classList.remove('hidden');
        isOpen = true;
      }
    };

    const closeMenu = () => {
      if (isOpen) {
        startMenu.classList.add('hidden');
        isOpen = false;
      }
    };

    // 绑定事件
    startButton.removeEventListener('click', toggleMenu);
    startButton.addEventListener('click', toggleMenu);

    document.removeEventListener('click', closeMenu);
    document.addEventListener('click', closeMenu);

    startMenu.removeEventListener('click', (e) => e.stopPropagation());
    startMenu.addEventListener('click', (e) => e.stopPropagation());

    // 菜单项点击
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const app = item.dataset.app;
        if (app === 'ambiguity-gap') {
          alert("《歧义裂隙》尚未完全加载……\nLiving OS 正在后台编译你的命运。");
        } else {
          alert(`打开 ${item.textContent}...`);
        }
      });
    });
  }

  // ========== Window 消息关闭 ==========
  const msgClose = document.getElementById('msg-close');
  if (msgClose) {
    msgClose.addEventListener('click', () => {
      document.getElementById('window-message').classList.add('hidden');
    });
  }

  // ========== 启动终端动画 ==========
  typeNextLine();

// 发送消息
document.getElementById('send-chat')?.addEventListener('click', () => {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (msg) {
    alert(`Window 收到: "${msg}"`);
    input.value = '';
  }
});

// 启动裂隙
document.getElementById('launch-gap')?.addEventListener('click', () => {
  alert("《歧义裂隙》尚未完全加载……\nLiving OS 正在后台编译你的命运。");
});

// 关闭聊天窗口 + Window 回 idle
document.getElementById('close-chat')?.addEventListener('click', () => {
  document.getElementById('roommate-chat').classList.add('hidden');
  setWindowState('idle');
});
});

function showInstallHint() {
  const hint = document.getElementById('install-hint');
  if (hint) {
    hint.classList.remove('hidden');
  }
}

document.getElementById('install-btn')?.addEventListener('click', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('用户已安装 PWA');
      }
      deferredPrompt = null;
      document.getElementById('install-hint').classList.add('hidden');
    });
  }
});

document.getElementById('dismiss-install')?.addEventListener('click', () => {
  document.getElementById('install-hint').classList.add('hidden');
});

// 检测是否为受限环境
function checkBrowserSupport() {
  const ua = navigator.userAgent;
  const isWechat = /MicroMessenger/i.test(ua);
  const isQQ = /QQ\//i.test(ua);
  const isOldSamsung = /SamsungBrowser\/[1-9]\./i.test(ua);

  if (isWechat || isQQ || isOldSamsung) {
    document.getElementById('browser-warning')?.classList.remove('hidden');
  }
}

// 在 DOMContentLoaded 中调用
checkBrowserSupport();

// ========== Window 实体 - 可拖动舍友 ==========
(function() {
  let isDragging = false;
  let offsetX, offsetY;

  function initWindowAgent() {
    const agent = document.getElementById('window-agent');
    if (!agent) return;

    agent.classList.remove('hidden');
    setWindowState('idle');

    // 设置默认位置：右下角床位
    function setDefaultPosition() {
      const x = window.innerWidth - 120;   // 距离右边 120px
      const y = window.innerHeight * 0.82; // 床位高度
      agent.style.left = x + 'px';
      agent.style.top = y + 'px';
    }

    setDefaultPosition();
    // 点击 Window 显示气泡
  agent.addEventListener('click', (e) => {
  if (agent.classList.contains('away')) return;

  const bubble = document.getElementById('window-bubble');
  if (!bubble) return;

  // 计算气泡位置（在 Window 左上方）
  const agentRect = agent.getBoundingClientRect();
  const bubbleX = agentRect.left - 150; // 左侧偏移
  const bubbleY = agentRect.top - 80;   // 上方偏移

  // 边界保护：不能超出屏幕
  const finalX = Math.max(10, Math.min(bubbleX, window.innerWidth - 160));
  const finalY = Math.max(10, Math.min(bubbleY, window.innerHeight - 120));

  bubble.style.left = finalX + 'px';
  bubble.style.top = finalY + 'px';
  bubble.classList.remove('hidden');

  // 阻止冒泡
  e.stopPropagation();
  });

    // 拖动开始
    agent.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = agent.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      agent.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // 拖动中
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      // 限制范围：不能拖到屏幕外 or 天花板
      const minX = 0;
      const maxX = window.innerWidth - agent.offsetWidth;
      const minY = window.innerHeight * 0.3; // 地面（30%）
      const maxY = window.innerHeight * 0.9; // 天花板（90%）

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      x = Math.max(minX, Math.min(x, maxX));
      y = Math.max(minY, Math.min(y, maxY));

      agent.style.left = x + 'px';
      agent.style.top = y + 'px';
    });

    // 拖动结束
    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        agent.style.cursor = 'grab';
      }
    };
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('mouseleave', stopDrag);

    // 窗口缩放时重置床位（可选）
    window.addEventListener('resize', setDefaultPosition);
  }

  function setWindowState(state) {
  const agent = document.getElementById('window-agent');
  if (!agent) return;
  
  // 清除状态类
  agent.className = 'window-agent';

  const face = agent.querySelector('.window-face');
  if (!face) return;

  if (state === 'walking') {
    agent.classList.add('walking');
    // 表情保持 idle（闭眼）
    face.innerHTML = `
      <path d="M6 12 L10 12 M14 12 L18 12" stroke="#333" stroke-width="2"/>
      <path d="M9 16 Q12 17 15 16" fill="none" stroke="#333" stroke-width="1.5"/>
    `;
  } else if (state === 'talking') {
    agent.classList.add('talking');
    face.innerHTML = `
      <circle cx="9" cy="10" r="2" fill="#333"/>
      <circle cx="15" cy="10" r="2" fill="#333"/>
      <path d="M9 16 Q12 18 15 16" fill="none" stroke="#333" stroke-width="1.5"/>
    `;
  } else if (state === 'away') {
    agent.classList.add('away');
  } else {
    agent.classList.add('idle');
    face.innerHTML = `
      <path d="M6 12 L10 12 M14 12 L18 12" stroke="#333" stroke-width="2"/>
      <path d="M9 16 Q12 17 15 16" fill="none" stroke="#333" stroke-width="1.5"/>
    `;
  }
}

  // 随机离开
  function scheduleRandomAway() {
    if (Math.random() > 0.6) {
      setWindowState('away');
      setTimeout(() => {
        if (document.getElementById('window-agent')?.classList.contains('away')) {
          setWindowState('idle');
        }
      }, 30000);
    }
  }

  // 对外接口
  window.showWindowAgent = function() {
    initWindowAgent();
    setTimeout(scheduleRandomAway, 5000);
  };
})();

// 点击外部关闭气泡
document.addEventListener('click', (e) => {
  const bubble = document.getElementById('window-bubble');
  if (bubble && !bubble.classList.contains('hidden') && !bubble.contains(e.target)) {
    bubble.classList.add('hidden');
  }
});

// 气泡选项处理器
document.querySelectorAll('#window-bubble .bubble-options li').forEach(li => {
  li.addEventListener('click', () => {
    const action = li.getAttribute('data-action');
    if (action === 'chat') {
      document.getElementById('roommate-chat').classList.remove('hidden');
        if (chatWin) {
          chatWin.classList.remove('hidden');
          setWindowState('talking');
        } else {
          console.error("❌ 聊天窗口 #roommate-chat 未找到！");
        }
    } else if (action === 'move-to-window') {
      moveToWindowSide();
    }
    // 关闭气泡
    document.getElementById('window-bubble').classList.add('hidden');
  });
});

function moveToWindowSide() {
  const agent = document.getElementById('window-agent');
  if (!agent) return;

  // 开始行走动画
  setWindowState('walking'); // 新增 walking 状态

  const startX = parseFloat(agent.style.left) || 0;
  const startY = parseFloat(agent.style.top) || 0;
  const targetX = window.innerWidth - 120;
  const targetY = window.innerHeight * 0.82;

  const duration = 1200; // 1.2秒
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 缓动函数（ease-out）
    const easeProgress = 1 - Math.pow(1 - progress, 2);

    const x = startX + (targetX - startX) * easeProgress;
    const y = startY + (targetY - startY) * easeProgress;

    agent.style.left = x + 'px';
    agent.style.top = y + 'px';

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // 到达后停止行走
      setWindowState('idle');
    }
  }

  requestAnimationFrame(animate);
}
