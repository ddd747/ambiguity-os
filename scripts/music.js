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
  }
};

// 暴露给 HTML 使用（关键！）
window.uploadBGM = (event) => audioManager.uploadBGM(event);
window.toggleBGM = () => audioManager.togglePlayPause();
window.stopBGM = () => audioManager.stop();

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