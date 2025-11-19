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

  // ========== 接受共生协议 ==========
  acceptBtn.addEventListener('click', () => {
      // ▼▼▼ 关键：预激活音频上下文 ▼▼▼
  const audio = document.getElementById('startup-audio');
  if (audio) {
    // 尝试播放一个极短静音片段（或重置状态）
    audio.volume = 0.7;
    // 创建 Web Audio Context（更可靠）
    if (typeof window.AudioContext !== 'undefined') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // 不需要实际播放，只需创建上下文即可解锁自动播放
      // 或者：播放一个 0.1 秒静音
    }
    // 同时尝试播放（即使失败也无妨）
    audio.play().catch(() => {
      // 静默失败，后续动画结束时再试一次
    });
  }
  // 隐藏终端和协议窗口
  document.querySelector('.retro-pc').classList.add('hidden');
  windowDialog.classList.add('hidden');

  // 显示开机动画
  const bootScreen = document.getElementById('boot-screen');
  bootScreen.classList.remove('hidden');

  const progressFill = document.getElementById('progress-fill');
  const logoImg = document.querySelector('.boot-logo img');

  let progress = 0;
  const maxProgress = 85; // 先加载到 85%
  const interval = 30; // 初始间隔（ms）

  // 递增函数：越接近 85%，速度越慢
  function loadTo85() {
    if (progress >= maxProgress) {
      // 到达 85%，暂停 4 秒
      setTimeout(() => {
        // 让 logo 移动到进度条 85% 的位置
        const container = document.querySelector('.progress-container');
        const containerRect = container.getBoundingClientRect();
        const logoRect = logoImg.getBoundingClientRect();

        // 计算 85% 位置的绝对坐标（相对于视口）
        const targetX = containerRect.left + containerRect.width * 0.85 - logoRect.width / 2;

        // 当前 logo 中心 X
        const currentLogoCenter = logoRect.left + logoRect.width / 2;
        const distance = targetX - currentLogoCenter;

        // 应用 transform（相对当前位置移动）
        logoImg.style.transform = `translateX(${distance}px)`;

        // 同时补完最后 15%
        let finalProgress = 85;
        const finalInterval = setInterval(() => {
          finalProgress += 1;
          progressFill.style.width = `${finalProgress}%`;
          if (finalProgress >= 100) {
            clearInterval(finalInterval);
            // 动画结束后显示桌面
            setTimeout(() => {
              bootScreen.classList.add('hidden');
              document.getElementById('desktop').classList.remove('hidden');
              
                // ▼▼▼ 新增：播放开机音效 ▼▼▼
               const audio = document.getElementById('startup-audio');
               if (audio) {
                // 尝试播放（需用户交互后才能自动播放）
                audio.currentTime = 0; // 重置
                audio.volume = 0.7;    // 避免过响
                // 某些浏览器要求 play() 在用户手势后才能生效（我们已在 acceptBtn 点击后，所以安全）
                audio.play().catch(e => {
                console.warn("开机音效未播放:", e);
                // 可选：静默失败，不影响体验
                });
              }
              // ▲▲▲ 新增结束 ▲▲▲

              // 初始化系统
              initSystemClock();
              initDesktopIcons();
              initStartMenu();

              // 横屏提示
              if (window.matchMedia("(orientation: landscape)").matches) {
                setTimeout(() => {
                  document.getElementById('window-message').classList.remove('hidden');
                }, 3000);
              }
            }, 300); // 微停顿，让 100% 状态可见
          }
        }, 40); // 最后 15% 用固定速度（约 600ms）
      }, 4000); // 在 85% 处等待 4 秒
      return;
    }

    // 递增进度（非线性减速）
    progress += 1;
    progressFill.style.width = `${progress}%`;

    // 动态延长间隔：越接近 85%，越慢
    const slowdownFactor = 1 + (progress / maxProgress) * 2; // 从 1x 到 3x 慢
    const nextDelay = interval * slowdownFactor;

    setTimeout(loadTo85, nextDelay);
  }

  // 开始加载
  loadTo85();
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