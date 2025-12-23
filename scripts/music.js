// music.js - 音频管理模块

// 全局音频对象（挂到 window 或 globalWindow）
const audioManager = {
  currentAudio: null,
  isPlaying: false,

  // 上传并播放本地音频
  uploadBGM(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    // 只允许音频格式
    if (!file.type.startsWith('audio/')) {
      alert('❌ 请选择音频文件（MP3/WAV/OGG 等）');
      return;
    }

    // 如果已有音频，先停止
    this.stop();

    // 创建 URL 并加载
    const url = URL.createObjectURL(file);
    this.currentAudio = new Audio(url);
    this.currentAudio.volume = 0.6; // 默认音量

    // 播放
    this.currentAudio.play().then(() => {
      this.isPlaying = true;
      console.log('🎵 正在播放:', file.name);
      this.updateUI('playing', file.name);
    }).catch(err => {
      console.error('播放失败:', err);
      alert('⚠️ 浏览器阻止了自动播放，请手动点击播放按钮。');
      this.updateUI('paused', file.name);
    });

    // 监听结束
    this.currentAudio.onended = () => {
      this.isPlaying = false;
      this.updateUI('stopped', '');
    };
  },

  // 停止当前音频
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      URL.revokeObjectURL(this.currentAudio.src);
      this.currentAudio = null;
      this.isPlaying = false;
      this.updateUI('stopped', '');
    }
  },

  // 切换播放/暂停
  togglePlayPause() {
    if (!this.currentAudio) return;

    if (this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
      this.updateUI('paused', this.currentAudioName || '未知');
    } else {
      this.currentAudio.play().then(() => {
        this.isPlaying = true;
        this.updateUI('playing', this.currentAudioName || '未知');
      });
    }
  },

  // 更新 UI（可选：显示状态）
  updateUI(status, name = '') {
    const statusEl = document.getElementById('bgm-status');
    if (statusEl) {
      const labels = {
        stopped: '⏹️ 未播放',
        paused: `⏸️ 已暂停: ${name}`,
        playing: `▶️ 播放中: ${name}`
      };
      statusEl.textContent = labels[status] || '⏹️ 未播放';
    }
  },

  // 👇 新增：环境音效管理
  ambientAudio: {
    rain: null,      // 持续雨声
    thunderQueue: [] // 防止雷声重叠（可选）
  },

  // 播放循环雨声（幂等：重复调用不重复创建）
  playRainSound() {
    if (this.ambientAudio.rain) return; // 已在播放

    const rainSound = new Audio('./assets/sounds/rain.mp3');
    rainSound.loop = true;
    rainSound.volume = 0.45; // 可调
    rainSound.play().catch(e => {
      console.warn('🌧️ 雨声自动播放被阻止（需用户交互后才能播放）');
    });
    this.ambientAudio.rain = rainSound;
  },

  // 停止雨声
  stopRainSound() {
    if (this.ambientAudio.rain) {
      this.ambientAudio.rain.pause();
      this.ambientAudio.rain = null;
    }
  },

  // 播放一次雷声（带随机和防重叠）
  playThunderSound() {
    // 可选：限制雷声频率（比如 2 秒内不重复）
    const now = Date.now();
    if (this.lastThunderTime && now - this.lastThunderTime < 2000) return;
    this.lastThunderTime = now;

    const thunderFiles = [
      './assets/sounds/thunder1.mp3',
      './assets/sounds/thunder2.mp3',
      './assets/sounds/thunder3.mp3',
      './assets/sounds/thunder4.mp3',
      './assets/sounds/thunder5.mp3'
    ];
    const file = thunderFiles[Math.floor(Math.random() * thunderFiles.length)];
    const sound = new Audio(file);
    sound.volume = 0.7;
    sound.play().catch(e => console.warn('⚡ 雷声播放失败:', e));
    // 不保存引用（一次性）
  },

  // 停止所有环境音
  stopAllAmbientSounds() {
    this.stopRainSound();
    // 雷声无需显式停止（一次性）
  },

  // 在 music.js 的 audioManager 中新增方法：
seamlessRain: null,
audioContext: null,

async playSeamlessRain() {
  // 单例
  if (this.seamlessRain) return;

  try {
    // 创建 AudioContext（用户交互后才能 resume）
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 加载音频文件
    const response = await fetch('./assets/sounds/rain.mp3');
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // 创建音源并循环
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.connect(this.audioContext.destination);
    source.start(0);

    this.seamlessRain = source;
    console.log('🌧️ 无缝雨声已启动');
  } catch (e) {
    console.error('🌧️ 无缝雨声加载失败，回退到普通 Audio:', e);
    // 回退到普通 Audio（可能有卡顿）
    this.playRainSound(); // 你原有的方法
  }
},

stopSeamlessRain() {
  if (this.seamlessRain) {
    this.seamlessRain.stop();
    this.seamlessRain = null;
  }
  if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = null;
  }
}
};

// 👇 暴露新接口给壁纸使用
window.playRainSound = () => audioManager.playRainSound();
window.stopRainSound = () => audioManager.stopRainSound();
window.playThunderSound = () => audioManager.playThunderSound();
window.stopAllAmbientSounds = () => audioManager.stopAllAmbientSounds();

// 暴露给 HTML 使用（关键！）
window.uploadBGM = (event) => audioManager.uploadBGM(event);
window.toggleBGM = () => audioManager.togglePlayPause();
window.stopBGM = () => audioManager.stop();

window.playSeamlessRain = () => audioManager.playSeamlessRain();
window.stopSeamlessRain = () => audioManager.stopSeamlessRain();

console.log('✅ music.js loaded');

// 自动绑定上传按钮（如果存在）
document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('upload-bgm-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      // 动态创建 input 触发文件选择
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e) => audioManager.uploadBGM(e);
      input.click();
    });
  }

  // 绑定播放/暂停按钮（可选）
  const playPauseBtn = document.getElementById('toggle-bgm-btn');
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => audioManager.togglePlayPause());
  }
});