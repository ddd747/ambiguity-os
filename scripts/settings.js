// scripts/settings.js
// ========== 歧义裂隙 - UI 主题系统 ==========

// --- 工具函数 ---
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToLuminance(rgb) {
  const { r, g, b } = rgb;
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1, hex2) {
  const l1 = rgbToLuminance(hexToRgb(hex1));
  const l2 = rgbToLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function lerpColor(hex1, hex2, t) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const r = Math.round(rgb1.r + t * (rgb2.r - rgb1.r));
  const g = Math.round(rgb1.g + t * (rgb2.g - rgb1.g));
  const b = Math.round(rgb1.b + t * (rgb2.b - rgb1.b));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// --- 预设 ---
const TERMINAL_PRESETS = {
  'black-white': { bg: '#000000', text: '#ffffff', accent: '#ffffff' },
  'white-black': { bg: '#ffffff', text: '#000000', accent: '#0000ff' },
  'black-green': { bg: '#000000', text: '#00ff00', accent: '#00ff88' }
};

const SKY_SEGMENTS = [
  { start: 0,   end: 240,  from: "#0a0e14", to: "#0a0e14" },        // 深夜
  { start: 240, end: 360,  from: "#0a0e14", to: "#4a657a" },        // 黎明
  { start: 360, end: 480,  from: "#4a657a", to: "#ffb347" },        // 日出
  { start: 480, end: 840,  from: "#ffb347", to: "#f0f8ff" },        // 上午→正午
  { start: 840, end: 1080, from: "#f0f8ff", to: "#ff7e5f" },        // 午后
  { start: 1080,end: 1200, from: "#ff7e5f", to: "#8a2be2" },        // 日落
  { start: 1200,end: 1440, from: "#8a2be2", to: "#0a0e14" }         // 夜幕
];

// --- 主题应用逻辑 ---
function applyColors({ bg, text, accent }) {
  document.documentElement.style.setProperty('--bg-color', bg);
  document.documentElement.style.setProperty('--text-color', text);
  document.documentElement.style.setProperty('--accent-color', accent);
  
  // 特殊：如果背景很暗，cell 边框用亮色；否则用暗色
  const isDarkBg = rgbToLuminance(hexToRgb(bg)) < 0.4;
  document.documentElement.style.setProperty('--cell-border', isDarkBg ? '#444' : '#aaa');
}

function getSkyTheme(now = new Date()) {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  for (const seg of SKY_SEGMENTS) {
    if (totalMinutes >= seg.start && totalMinutes <= seg.end) {
      const t = (totalMinutes - seg.start) / (seg.end - seg.start);
      const bg = lerpColor(seg.from, seg.to, t);
      const isDark = rgbToLuminance(hexToRgb(bg)) < 0.4;
      const text = isDark ? '#ffffff' : '#000000';
      // 高亮色：取背景的互补色或提亮
      const accent = isDark ? '#ffcc00' : '#0066cc';
      return { bg, text, accent };
    }
  }
  return { bg: '#0a0e14', text: '#ffffff', accent: '#ffcc00' };
}

function getDefaultTheme() {
  return { bg: '#000000', text: '#ffffff', accent: '#00ff00' };
}

// --- 初始化入口 ---
function initThemeSystem() {
  // 1. 读取保存的主题
  const saved = localStorage.getItem('ambiguity-gap:ui-theme');
  const theme = saved ? JSON.parse(saved) : { mode: 'default' };

  // 2. 根据模式应用颜色
  let colors;
  switch (theme.mode) {
    case 'terminal':
      colors = TERMINAL_PRESETS[theme.preset] || getDefaultTheme();
      break;
    case 'custom':
      colors = {
        bg: theme.colors?.bg || '#000000',
        text: theme.colors?.text || '#ffffff',
        accent: theme.colors?.accent || '#00ff00'
      };
      break;
    case 'sky-follow':
      colors = getSkyTheme();
      // 每分钟更新一次（可选）
      setInterval(() => {
        const newColors = getSkyTheme();
        applyColors(newColors);
      }, 60000);
      break;
    default:
      colors = getDefaultTheme();
  }

  applyColors(colors);
}

// ========== 设置面板交互 ==========
function initSettingsUI() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;

  const openBtn = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close-settings');
  const applyBtn = document.getElementById('apply-theme');
  const modeSelect = document.getElementById('theme-mode');
  const terminalOptions = document.getElementById('terminal-options');
  const skyInfo = document.getElementById('sky-info');

  // 打开面板
  openBtn?.addEventListener('click', () => {
    panel.classList.remove('hidden');
    
    // 初始化表单状态
    const saved = localStorage.getItem('ambiguity-gap:ui-theme');
    const theme = saved ? JSON.parse(saved) : { mode: 'terminal', preset: 'black-green' };
    
    modeSelect.value = theme.mode || 'terminal';
    toggleModeOptions(theme.mode);
  });

  // 关闭
  closeBtn?.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  // 模式切换
  modeSelect?.addEventListener('change', (e) => {
    toggleModeOptions(e.target.value);
  });

  function toggleModeOptions(mode) {
    terminalOptions.classList.toggle('hidden', mode !== 'terminal');
    skyInfo.classList.toggle('hidden', mode !== 'sky-follow');
  }

  // 应用主题
  applyBtn?.addEventListener('click', () => {
    console.log('✅ 应用主题按钮被点击');

    const mode = modeSelect.value;
    let themeData = { mode };

    if (mode === 'terminal') {
      // 获取选中的 preset（默认 black-green）
      const selectedPreset = document.querySelector('#terminal-options button.active')?.dataset.preset || 'black-green';
      themeData.preset = selectedPreset;
    }

    // 保存到 localStorage
    localStorage.setItem('ambiguity-gap:ui-theme', JSON.stringify(themeData));

    // 重新初始化主题
    initThemeSystem();

    // 关键：确保 panel 存在再操作
    const panel = document.getElementById('settings-panel');
    if (panel) {
      console.log('🔒 隐藏设置面板');
      panel.classList.add('hidden');
    } else {
      console.error('❌ 未找到 #settings-panel');
    }
  });

  // 终端预设按钮高亮
  document.querySelectorAll('#terminal-options button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#terminal-options button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

// 在 DOM 加载后初始化设置 UI
document.addEventListener('DOMContentLoaded', initSettingsUI);