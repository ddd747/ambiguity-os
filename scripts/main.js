// ==========================
// AmbiguityOS - Living Operating System
// main.js v2.0 (Extended Pose Editor)
// ==========================
/**
 * @typedef {Object} Window3D
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {HTMLElement} container
 */


// ===== 新增：骨骼控制项类型 =====
/**
 * @typedef {Object} BoneControl
 * @property {string} boneName
 * @property {string} axis
 * @property {string} id
 */

// ===== 扩展全局 Window 类型 =====
/**
 * @typedef {Window & {
 *   window3D?: Window3D,
 *   cameraPosition?: THREE.Vector3,
 *   activeBoneControls?: BoneControl[],
 *   fullSkeleton?: THREE.Bone[],
 *   currentModel?: any,
 *   modelLookAtTarget?: THREE.Vector3,
 *   THREE?: typeof import('../lib/three.module.js'),
 *   setWindowState?: (state: string) => void,
 *   showWindowAgent?: () => void,
 *   mainLoaded?: boolean
 * }} ExtendedWindow
 */
// 告诉 TypeScript window 有 window3D 属性
/** @type {Window & { window3D?: Window3D }} */
const globalWindow = window;


// main.js（开头）
import * as THREE from '../lib/three.module.js';
import { MMDLoader } from '../lib/three/examples/jsm/loaders/MMDLoader.js';
//import { OrbitControls } from './lib/three/examples/jsm/controls/OrbitControls.js'; // 可选，调试用

// 暴露 THREE 到全局（仅用于控制台调试）
globalWindow.THREE = THREE;

// ========== 全局动画状态 ==========
let blinkTimer = 0;
const clock = new THREE.Clock();

// 全局变量：用于记录 D 盘的事件监听器，便于清理
let poseEditorActiveListeners = [];

// 全局变量：是否可安装 PWA
let deferredPrompt = null;
let isPWAInstallable = false;

let windowBones = null;
let window3D = null; // 存储场景、相机、渲染器等


  function bringToFront(windowElement) {
  const allWindows = document.querySelectorAll('.app-window');
  let maxZ = 100;
  allWindows.forEach(w => {
    const z = parseInt(getComputedStyle(w).zIndex) || 100;
    if (z > maxZ) maxZ = z;
  });
  windowElement.style.zIndex = maxZ + 10;
}

// 在每个窗口打开时调用
document.getElementById('open-pose-editor')?.addEventListener('click', () => {
  const win = document.getElementById('pose-editor-window');
  win.classList.remove('hidden');
  bringToFront(win); // 👈 关键
});

// ===== 新增：姿势驱动器状态 =====
const MAX_CONTROLS = 6;

// 声明后立即挂载
let activeBoneControls = [];// [{ boneName, axis, id }]
let cameraPosition = new THREE.Vector3(0, 1.5, 5); // 初始位置（X, Y, Z）
// ========== 通用动画循环 ==========
function startAnimationLoop(scene, camera, renderer, mesh) {
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 呼吸
    if (mesh) {
      mesh.position.y = -2 + Math.sin(time * 1.2) * 0.05;

      // 歪头
      if (mesh.skeleton?.bones) {
        const headBone = mesh.skeleton.bones.find(b => 
          b.name.includes('頭') || b.name.includes('Head')
        );
        if (headBone) {
          headBone.rotation.z = Math.sin(time * 0.8) * 0.03;
        }
      }

      // 眨眼
      blinkTimer -= clock.getDelta() * 1000;
      if (blinkTimer <= 0) {
        mesh.traverse(child => {
          if (child.isMesh && (child.name.includes('Eye') || child.name.includes('目'))) {
            const orig = child.material.opacity || 1;
            child.material.opacity = 0.1;
            setTimeout(() => child.material.opacity = orig, 80);
          }
        });
        blinkTimer = 3000 + Math.random() * 4000;
      }
    }

    renderer.render(scene, camera);
  }
  animate();
}

// ========== 手臂自然下垂 ==========
function poseArmsDown(mesh) {
  if (!mesh.skeleton?.bones) return;
  const bones = mesh.skeleton.bones;

  windowBones = {
    leftShoulder: bones.find(b => b.name === '左肩'),
    rightShoulder: bones.find(b => b.name === '右肩'),
    leftUpperArm: bones.find(b => b.name === '左腕'),
    rightUpperArm: bones.find(b => b.name === '右腕')
  };

  const saved = localStorage.getItem('window-pose');
  if (saved) {
    applyPoseToBones(JSON.parse(saved));
  }
}

// ========== 舍友配置表 ==========
const ROOMMATES = {
  'windown': {
    name: 'Windown',
    modelPath: 'models/window/model.pmx',
    fxPath: 'models/window/Windown.fx',     // ✅ 有 FX
    scale: 0.2,
    position: [0, -2, 0]
  },
  'generic': {
    name: '通用',
    modelPath: 'models/generic/model.pmx',
    fxPath: null,                        // ❌ 无 FX
    scale: 0.2,
    position: [0, -2, 0]
  },
  'yinian': {
    name: '［意念］',
    modelPath: 'models/yinian/model.pmx',
    fxPath: 'models/yinian/［意念］.fx',     // ✅ 有 FX
    scale: 0.2,
    position: [0, -2, 0]
  }
};

let currentRoommateId = 'windown'; // 默认舍友

// ========== 骨骼名称中文化映射表 ==========
const BONE_NAME_TRANSLATIONS = {
  // ====== 【核心通用骨骼】======
  'センター': '中心',
  'Center': '中心',
  'Root': '中心',

  '下半身': '下半身',
  'Pelvis': '骨盆',
  'LowerBody': '下半身',

  '上半身': '上半身',
  'Spine': '脊柱',
  'UpperBody': '上半身',

  '上半身2': '胸部',
  'Chest': '胸部',
  'UpperBody2': '胸部',

  '首': '脖子',
  'Neck': '脖子',

  '頭': '头部',
  'Head': '头部',
  // ====== 【左臂】======
  '左肩': '左肩',
  'LeftShoulder': '左肩',
  '左腕': '左臂',
  'LeftArm': '左臂',
  '左ひじ': '左肘',
  'LeftElbow': '左肘',
  '左手首': '左手腕',
  'LeftWrist': '左手腕',
  // ====== 【右臂】======
  '右肩': '右肩',
  'RightShoulder': '右肩',
  '右腕': '右臂',
  'RightArm': '右臂',
  '右ひじ': '右肘',
  'RightElbow': '右肘',
  '右手首': '右手腕',
  'RightWrist': '右手腕',
  // ====== 【左腿】======
  '左足': '左腿',
  'LeftLeg': '左腿',
  '左ひざ': '左膝',
  'LeftKnee': '左膝',
  '左足首': '左踝',
  'LeftAnkle': '左踝',
  '左つま先': '左脚趾',
  'LeftToe': '左脚趾',
  // ====== 【右腿】======
  '右足': '右腿',
  'RightLeg': '右腿',
  '右ひざ': '右膝',
  'RightKnee': '右膝',
  '右足首': '右踝',
  'RightAnkle': '右踝',
  '右つま先': '右脚趾',

  'left hand': '左手',
  'right hand': '右手',
  // 可继续补充...
};

// 全局状态：是否启用中文化
let useChineseBoneNames = false;

// 工具函数：获取显示用的骨骼名
function getDisplayBoneName(originalName) {
  if (useChineseBoneNames && BONE_NAME_TRANSLATIONS[originalName]) {
    return BONE_NAME_TRANSLATIONS[originalName];
  }
  return originalName;
}

// 更新所有已存在的骨骼滑块标签
function updateAllBoneLabels() {
  document.querySelectorAll('.pose-slider-group label').forEach(label => {
    const originalName = label.dataset.originalName;
    if (originalName) {
      const axisPart = label.innerHTML.replace(/^[^•]+ • /, '');
      const displayName = getDisplayBoneName(originalName);
      label.innerHTML = `${displayName} • ${axisPart}`;
    }
  });
}

function applyAllBoneControls() {
  if (!window.fullSkeleton) return;
  activeBoneControls.forEach(ctrl => {
    const bone = window.fullSkeleton.find(b => b.name === ctrl.boneName);
    if (bone) {
      bone.rotation[ctrl.axis] = parseFloat(document.getElementById(ctrl.id)?.value || 0);
    }
  });
}

// ✅【修复】将 removeBoneControl 提升为全局函数
function removeBoneControl(id) {
  // 1. 从 activeBoneControls 中移除
  activeBoneControls = activeBoneControls.filter(c => c.id !== id);
  
 // 2. 从 DOM 移除整个滑块组
  const group = document.getElementById(id)?.closest('.pose-slider-group');
  if (group) {
    group.remove(); // ✅ 安全移除
  }
  
  // 3. 【可选】重新应用剩余骨骼（通常不需要，因为用户只删不改）
  // applyAllBoneControls(); // 👈 不要在这里调用！
}

// ✅【增强版】createSliderGroup：同时生成滑块（PC）和数字输入框（手机）
function createSliderGroup(boneName, axis, value, id) {
  const div = document.createElement('div');
  div.className = 'pose-slider-group';

  // 标签
  const label = document.createElement('label');
  label.dataset.originalName = boneName;
  label.innerHTML = `${getDisplayBoneName(boneName)} • ${axis.toUpperCase()}轴: <span id="${id}-val">${parseFloat(value).toFixed(2)}</span>`;
  
  // === 滑块（PC）===
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = id; // 保留原 ID 给 applyAllBoneControls 使用
  slider.min = '-3.14';
  slider.max = '3.14';
  slider.step = '0.01';
  slider.value = String(value);
  slider.className = 'slider desktop-only'; // ← 关键：仅 PC 显示

  // === 数字输入框（手机）===
  const numeric = document.createElement('input');
  numeric.type = 'number';
  numeric.id = `${id}-input`; // 新 ID，避免冲突
  numeric.min = '-3.14';
  numeric.max = '3.14';
  numeric.step = '0.01';
  numeric.value = String(value);
  numeric.className = 'numeric mobile-only'; // ← 关键：仅手机显示
  numeric.style.width = '80px'; // 手机上更紧凑

  // 删除按钮
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-bone-btn';
  removeBtn.textContent = '✕';

  // 组装
  div.appendChild(label);
  div.appendChild(slider);
  div.appendChild(numeric);
  div.appendChild(removeBtn);

  return { div, slider, numeric, removeBtn };
}

function addBoneControlFromSaved(boneName, axis, value) {
  // 确保 value 是有效数字
  const initialValue = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
  
  const id = `bone-${Date.now()}-${boneName}-${axis}`;
  activeBoneControls.push({ boneName, axis, id });

  // 👇 关键：把 initialValue 传给 createSliderGroup
  const { div, slider, numeric, removeBtn } = createSliderGroup(boneName, axis, initialValue, id);

  // 同步滑块 → 数字框
  slider.addEventListener('input', () => {
    numeric.value = slider.value;
    updateBoneDisplay(id);
    applyAllBoneControls();
  });

  // 同步数字框 → 滑块
  numeric.addEventListener('change', () => {
    let val = parseFloat(numeric.value);
    if (isNaN(val)) val = 0;
    val = Math.max(-3.14, Math.min(3.14, val));
    slider.value = val;
    numeric.value = val.toFixed(2);
    updateBoneDisplay(id);
    applyAllBoneControls();
  });

  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeBoneControl(id);
  });

  const container = document.getElementById('dynamic-sliders');
  if (container) container.appendChild(div);
  
  // 立即应用初始值
  updateBoneDisplay(id);
  applyAllBoneControls(); // 可选：立即生效
}

window.addEventListener('beforeinstallprompt', (e) => {
  // 阻止默认提示（我们自定义）
  e.preventDefault();
  deferredPrompt = e;
  isPWAInstallable = true;
  showInstallHint(); // 显示自定义安装引导
});

// 应用从 localStorage 保存的完整姿势（骨骼 + 相机）
function applySavedPose() {
  // 👇 使用与 saveFullPose 相同的 key
  const key = `ambiguity-gap:pose-${currentRoommateId || 'default'}`;
  const saved = localStorage.getItem(key);
  
  if (saved) {
    try {
      const data = JSON.parse(saved);

      // 清空现有控制（可选，避免重复）
      activeBoneControls = [];
      const slidersContainer = document.getElementById('dynamic-sliders');
      if (slidersContainer) slidersContainer.innerHTML = '';

      // 恢复骨骼控制
      if (data.boneControls && Array.isArray(data.boneControls)) {
        data.boneControls.forEach(ctrl => {
          // 👇 传入保存的 value
          addBoneControlFromSaved(ctrl.boneName, ctrl.axis, ctrl.value);
        });
      }

      // 恢复相机位置
      if (data.cameraPosition) {
        // 假设 cameraPosition 是 THREE.Vector3 或普通对象
        if (typeof cameraPosition.set === 'function') {
          cameraPosition.set(
            data.cameraPosition.x,
            data.cameraPosition.y,
            data.cameraPosition.z
          );
        } else {
          cameraPosition.x = data.cameraPosition.x;
          cameraPosition.y = data.cameraPosition.y;
          cameraPosition.z = data.cameraPosition.z;
        }
        updateCameraDisplay();
        if (typeof updateCameraPosition === 'function') {
          updateCameraPosition();
        }
      }
    } catch (e) {
      console.warn('加载姿势失败:', e);
    }
  }
}

// 保存姿势（按舍友 ID 区分）
function saveFullPose() {
  localStorage.removeItem('ambiguity-gap:default-pose');
  const key = `ambiguity-gap:pose-${currentRoommateId || 'default'}`; // 👈 必须和 applySavedPose 一致！

  // 获取骨骼值（通过 ID 安全读取）
  const boneControls = activeBoneControls.map(ctrl => {
    const el = document.getElementById(ctrl.id) || 
               document.getElementById(`${ctrl.id}-input`);
    return {
      boneName: ctrl.boneName,
      axis: ctrl.axis,
      value: el ? parseFloat(el.value) : 0
    };
  });

  const poseData = {
    boneControls,
    cameraPosition: {
      x: cameraPosition.x,
      y: cameraPosition.y,
      z: cameraPosition.z
    },
    timestamp: Date.now()
  };
    
  localStorage.setItem(key, JSON.stringify(poseData));
  showTemporaryMessage('姿势已保存', '#4CAF50');
}

// 通用提示函数（复用现有系统弹窗）
function showSystemMessage(text, duration = 2000) {
  const msg = document.getElementById('system-message');
  if (msg) {
    msg.querySelector('.dialog-body').textContent = text;
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), duration);
  } else {
    // 临时创建（如果不存在）
    alert(text);
  }
}

function resetFullPose() {
  if (window.fullSkeleton) {
    window.fullSkeleton.forEach(bone => bone.rotation.set(0, 0, 0));
  }
  activeBoneControls = [];
  updateCameraDisplay();
  updateCameraPosition();
}

// 更新显示函数
function updateCameraDisplay() {
  ['x', 'y', 'z'].forEach(axis => {
    const val = cameraPosition[axis];
    const el = document.getElementById(`cam-${axis}-val`);
    if (el) el.textContent = val.toFixed(2);
  });
}

function updateCameraPosition() {
  if (!globalWindow.window3D?.camera) return;
  
  // 设置相机位置
  globalWindow.window3D.camera.position.copy(globalWindow.cameraPosition);
  
  // 看向模型（使用之前计算的 modelLookAtTarget）
  const target = window.modelLookAtTarget || new THREE.Vector3(0, 0, 0);
  globalWindow.window3D.camera.lookAt(target);
}

function addBoneControl() {
  console.log('addBoneControl called');
  if (activeBoneControls.length >= MAX_CONTROLS) {
    alert(`最多只能控制 ${MAX_CONTROLS} 个骨骼！`);
    return;
  }

  const boneName = document.getElementById('bone-selector')?.value;
  const axis = document.getElementById('axis-selector')?.value;
  if (!boneName || !axis) {
    alert('请选择骨骼和轴！');
    return;
  }

  if (activeBoneControls.some(c => c.boneName === boneName && c.axis === axis)) {
    alert('该骨骼轴已存在！');
    return;
  }

  const id = `bone-${Date.now()}`;
  activeBoneControls.push({ boneName, axis, id });

 const { div, slider, numeric, removeBtn } = createSliderGroup(boneName, axis, 0, id);

// === 同步滑块 → 数字框 ===
slider.addEventListener('input', () => {
  numeric.value = slider.value;
  updateBoneDisplay(id);
  applyAllBoneControls();
});

// === 同步数字框 → 滑块 ===
numeric.addEventListener('change', () => {
  let val = parseFloat(numeric.value);
  if (isNaN(val)) val = 0;
  val = Math.max(-3.14, Math.min(3.14, val));
  slider.value = val;
  numeric.value = val.toFixed(2);
  updateBoneDisplay(id);
  applyAllBoneControls();
});

  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeBoneControl(id);
  });

  document.getElementById('dynamic-sliders')?.appendChild(div);
  updateBoneDisplay(id);
}

function updateBoneDisplay(id) {
  const input = document.getElementById(id);
  const valEl = document.getElementById(`${id}-val`);
  if (input && valEl) valEl.textContent = parseFloat(input.value).toFixed(2);
}

async function loadRoommate(roommateId) {
  const config = ROOMMATES[roommateId];
  if (!config) return;

  const { scene, camera } = globalWindow.window3D || {};
  if (!scene || !camera) return;

  // === 1. 清理旧模型 ===
  if (window.currentModel) {
    scene.remove(window.currentModel);
    window.currentModel = null;
    window.fullSkeleton = null;
    activeBoneControls = [];
    document.getElementById('dynamic-sliders').innerHTML = '';
  }

  // === 2. 加载新模型 ===
  const loader = new MMDLoader();
  try {
    const mesh = await loader.loadAsync(config.modelPath);
    mesh.scale.setScalar(config.scale);
    mesh.position.fromArray(config.position);

    // === 3. 应用手臂姿势 & 骨骼引用 ===
    poseArmsDown(mesh);
    window.fullSkeleton = mesh.skeleton?.bones || [];
    window.currentModel = mesh;

    scene.add(mesh);

    // === 4. 尝试加载 .fx 文件（仅用于控制台或未来扩展）===
    if (config.fxPath) {
      try {
        const fxResponse = await fetch(config.fxPath);
        if (fxResponse.ok) {
          const fxText = await fxResponse.text();
          console.log(`✅ ${config.name} 的 FX 文件已加载（长度: ${fxText.length} 字符）`);
          // TODO: 后续可解析 fxText 并初始化粒子系统
        }
      } catch (fxError) {
        console.warn(`⚠️ 无法加载 ${config.name} 的 FX 文件:`, fxError);
      }
    }

   // === 5. 计算相机对焦目标 ===
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  window.modelLookAtTarget = new THREE.Vector3(
    center.x,
    center.y + 0.3, // 胸部偏上（可根据模型调整）
    center.z
  );

    // === 6. 恢复保存的姿势（延迟确保 DOM 就绪）===
    setTimeout(() => {
      applySavedPose(); // 这个函数应基于 currentRoommateId 读取对应姿势
      updateCameraPosition();
    }, 100);

    // === 7. 输出骨骼列表（调试）===
    if (window.fullSkeleton) {
      const boneNames = window.fullSkeleton.map(b => b.name);
      console.log(`🦴 ${config.name} 的骨骼列表:`, boneNames);
    }

    // === 8. 重置眨眼计时器 ===
    blinkTimer = 3000 + Math.random() * 4000;

    console.log(`✅ ${config.name} 加载完成！`);
  } catch (error) {
    console.error(`❌ 加载 ${config.name} 失败:`, error);
    alert(`模型加载失败：${error.message}`);
  }
  // 应用保存的姿势（含相机）
  setTimeout(() => {
  applySavedPose();
  updateCameraPosition(); // 👈 确保执行
  }, 100);
}

// ========== 网络邻居功能（必须在 DOMContentLoaded 外部！） ==========
function openNetworkNeighbors() {
  const win = document.getElementById('network-neighbors-window');
  if (win) {
    win.classList.remove('hidden');
    bringToFront(win);
    makeDraggable(win);
  }
  registerTaskbarWindow('network-neighbors-window', '🌐', '网络邻居');
}

function createNetworkRoom() {
  const char = localStorage.getItem('ambiguity-gap:selected-character');
  if (!char) {
    alert('请先通过“我的电脑 → E盘”选择角色！');
    openProcessSelector();
    return;
  }
  const roomId = 'gap-' + Date.now().toString(36).slice(-6);
  window.open(`./ambiguity-gap.html?mode=network&room=${roomId}`, '_blank');
  alert(`✅ 房间已创建\nID: ${roomId}`);
}

function joinNetworkRoom() {
  const char = localStorage.getItem('ambiguity-gap:selected-character');
  if (!char) {
    alert('请先通过“我的电脑 → E盘”选择角色！');
    openProcessSelector();
    return;
  }
  
  const roomId = document.getElementById('join-room-id')?.value.trim();
  if (!roomId) {
    alert('请输入房间ID！');
    return;
  }
  
  // 👇 关键修复：确保包含 .html 和 mode 参数
  window.open(`/ambiguity-gap.html?mode=network&room=${roomId}`, '_blank');
  
  // 清空输入框
  document.getElementById('join-room-id').value = '';
}


// ========== 增强版拖拽（支持 mouse + touch） ==========
function makeDraggable(win) {
  if (!win || win.dataset.dragInitialized) return;
  const titlebar = win.querySelector('.window-titlebar');
  if (!titlebar) return;

  let isDragging = false;
  let startX, startY, initialX, initialY;

  const startDrag = (clientX, clientY) => {
    isDragging = true;
    const rect = win.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    startX = clientX;
    startY = clientY;
    win.style.pointerEvents = 'none'; // 防止子元素干扰
    titlebar.style.cursor = 'grabbing';
    titlebar.style.userSelect = 'none';
  };

  const doDrag = (clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    let newX = initialX + dx;
    let newY = initialY + dy;

    // 边界限制
    newX = Math.max(0, Math.min(newX, window.innerWidth - win.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - win.offsetHeight));

    win.style.left = newX + 'px';
    win.style.top = newY + 'px';
  };

  const stopDrag = () => {
    if (isDragging) {
      isDragging = false;
      win.style.pointerEvents = '';
      titlebar.style.cursor = '';
      titlebar.style.userSelect = '';
    }
  };

  // 鼠标事件
  titlebar.addEventListener('mousedown', (e) => {
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  });

  // 触摸事件（关键！）
  titlebar.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault(); // 阻止滚动
    }
  }, { passive: false });

  // 全局移动/结束（mouse + touch）
  document.addEventListener('mousemove', (e) => doDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', stopDrag);

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      doDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', stopDrag);
  document.addEventListener('touchcancel', stopDrag);

  win.dataset.dragInitialized = 'true';
}

// 存储已绑定的监听器引用（便于移除）
let poseEditorListeners = [];

function cleanupPoseEditor() {
  // 1. 移除所有事件监听器
  poseEditorListeners.forEach(({ el, type, fn }) => {
    el.removeEventListener(type, fn);
  });
  poseEditorListeners = [];

  // 2. 清空骨骼控制数据
  activeBoneControls = [];

  // 3. 清空动态滑块区域（可选）
  const slidersContainer = document.getElementById('dynamic-sliders');
  if (slidersContainer) {
    slidersContainer.innerHTML = '';
  }

  // 4. 重置拖拽状态（如果 makeDraggable 有副作用）
  const container = document.getElementById('pose-editor-container');
  if (container) {
    delete container.dataset.dragInitialized;
  }
}

// 临时消息提示（轻量级，无需额外 DOM）
function showTemporaryMessage(text, bgColor = '#2196F3') {
  const msg = document.createElement('div');
  msg.textContent = text;
  msg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(msg);
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transition = 'opacity 0.3s';
    setTimeout(() => msg.remove(), 300);
  }, 2000);
}

// ========== 任务栏窗口管理器 ==========
const openWindows = new Map(); // key: containerId, value: { title, emoji, element }

function registerTaskbarWindow(containerId, emoji, title) {
  if (openWindows.has(containerId)) return;
  
  const element = document.getElementById(containerId);
  if (!element) return;
  
  openWindows.set(containerId, { emoji, title, element });
  renderTaskbarIcons();
}

function unregisterTaskbarWindow(containerId) {
  openWindows.delete(containerId);
  renderTaskbarIcons();
}

function renderTaskbarIcons() {
  const container = document.getElementById('taskbar-windows');
  if (!container) return;
  
  container.innerHTML = '';
  openWindows.forEach(({ emoji, title, element }, id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title; // 鼠标悬停提示
    btn.textContent = emoji;
    btn.style.cssText = `
      background: #d4d0c8;
      border: 1px solid #000;
      padding: 2px 6px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      cursor: pointer;
      min-width: 24px;
      text-align: center;
    `;
    
    btn.onclick = (e) => {
      e.stopPropagation();
      element.classList.remove('hidden');
      bringToFront(element.querySelector('.app-window'));
    };
    
    container.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // >>>>> 【新增】首次启动检测 + 调试 <<<<<
  const setupCompleted = localStorage.getItem('ambiguityos:setup_completed');
  console.log('🔍 main.js loaded. Checking setup status...');
  console.log('ambiguityos:setup_completed =', setupCompleted);

  if (setupCompleted !== 'true') {
    console.warn('⚠️ Setup not completed. Redirecting to setup-wizard.html');
    window.location.href = './setup-wizard.html';
    return;
  }
  console.log('✅ Setup confirmed. Proceeding to boot...');

  // 读取用户名（默认 fallback 到“舍友”）
  const savedName = localStorage.getItem('ambiguityos:accountName') || '舍友';
  // 替换开始菜单中的文本
  document.querySelector('.start-menu .user-name').textContent = savedName;
  // >>>>> 【新增】应用开始菜单风格 <<<<<
  const menuStyle = localStorage.getItem('ambiguityos:startMenuStyle') || 'classic';
  if (menuStyle === 'taskbar') {
    document.body.classList.add('taskbar-menu');
  } else {
    document.body.classList.remove('taskbar-menu');
  }
  // <<< 【新增结束】 <<<

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
    initWindow3D();
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
                initWindow3D();
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
              initMyComputer();
              initMyDocuments();
              initWindow3D();
              loadDefaultPose(); // 👈 在 3D 场景初始化后调用
              loadSavedPose(); 
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
  // ========== 打开应用窗口（增强版：适配手机） ==========
function openAppWindow(appId) {
  const container = document.getElementById(appId + '-window');
  if (!container) return;

  const win = container.querySelector('.app-window');
  if (!win) return;

  // 显示窗口
  container.classList.remove('hidden');
  bringToFront(win);

  // 👇 初始化拖拽（仅一次）
  if (!container.dataset.dragInitialized) {
    makeDraggable(win);
    container.dataset.dragInitialized = 'true';
  }

  // 👇 关键：动态居中窗口（适配手机横屏/竖屏）
  setTimeout(() => {
    // 强制获取真实尺寸
    const rect = win.getBoundingClientRect();
    const maxWidth = Math.min(window.innerWidth * 0.95, 600); // 最大宽度
    const maxHeight = window.innerHeight * 0.85; // 避开任务栏

    // 调整窗口尺寸（如果太宽/太高）
    if (rect.width > maxWidth) {
      win.style.width = maxWidth + 'px';
    }
    if (rect.height > maxHeight) {
      win.style.height = 'auto'; // 允许高度自适应
      win.style.maxHeight = maxHeight + 'px';
    }

    // 计算居中位置
    const x = Math.max(10, Math.min(
      (window.innerWidth - win.offsetWidth) / 2,
      window.innerWidth - win.offsetWidth - 10
    ));
    const y = Math.max(10, Math.min(
      (window.innerHeight - win.offsetHeight) / 2,
      window.innerHeight - win.offsetHeight - 60 // 底部留出任务栏空间
    ));

    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.style.transform = 'none'; // 移除可能的 transform 居中
  }, 50);

  // 👇 注册到任务栏（带 Emoji）
  const appMap = {
    'my-computer': { emoji: '💻', title: '我的电脑' },
    'recycle-bin': { emoji: '🗑️', title: '回收站' },
    'ie': { emoji: '🇮🇪 ', title: 'Internet Explorer' },
    'downloads': { emoji: '📥', title: '下载' },
    'documents': { emoji: '📄', title: '文档' },
    'music': { emoji: '🎵', title: '音乐' },
    'videos': { emoji: '🎬', title: '视频' }
  };
  if (appMap[appId]) {
    registerTaskbarWindow(container.id, appMap[appId].emoji, appMap[appId].title);
  }
}

function initDesktopIcons() {
  // 桌面图标
  document.querySelectorAll('.icon').forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      const app = icon.dataset.app;
      if (app === 'my-computer') openAppWindow('my-computer');
      else if (app === 'recycle-bin') openAppWindow('recycle-bin');
      else if (app === 'internet-explorer') openAppWindow('ie');
      else if (app === 'network-neighbors') {
        openNetworkNeighbors();
      };
    });
  });

// 菜单项点击
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const app = item.dataset.app;
    const action = item.dataset.action;

    // 👇 新增：处理 re-setup
    if (action === 're-setup') {
      if (confirm('⚠️ 这将清除所有初始设置并重启安装向导。\n\n你的角色、姿势等数据不会丢失，但区域、壁纸、用户名会重置。\n\n继续？')) {
        // 清除 setup 标记
        localStorage.removeItem('ambiguityos:setup_completed');
        // 可选：清除其他 setup 数据（保留角色等）
        // localStorage.removeItem('ambiguityos:accountName');
        // localStorage.removeItem('ambiguityos:wallpaper');
        // ...
        alert('即将重启安装向导...');
        window.location.href = './setup-wizard.html';
      }
      return;
    }

    // 新增：开始菜单统一入口
    if (app === 'downloads') {
      openAppWindow('downloads');
    } else if (app === 'documents') {
      openAppWindow('documents');
    } else if (app === 'music') {
      openAppWindow('music');
    } else if (app === 'videos') {
      openAppWindow('videos');
    } 
    // 原有逻辑
    else if (app === 'my-documents') {
      openAppWindow('my-documents');
    } else if (app === 'ambiguity-gap') {
      // 检查是否已选角色
      const selected = localStorage.getItem('ambiguity-gap:selected-character');
      if (selected) {
        // 👇 添加 mode=single 参数
        console.log('🚀 Opening single mode with char:', localStorage.getItem('ambiguity-gap:selected-character'));
        window.open('./ambiguity-gap.html?mode=single', '_blank');
      } else {
        alert('请先在“进程选择器”中选择一个角色！');
        openProcessSelector(); // 自动打开 E 盘
      }
    } else {
      alert(`打开 ${item.textContent}...`);
    }
  });
});

  // 全局关闭按钮处理（含任务栏同步）
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('window-close')) return;

  const container = e.target.closest('.window-container');
  if (!container || !container.id) {
    console.warn('❌ 关闭按钮未关联有效 window-container');
    return;
  }

  // 隐藏窗口
  container.classList.add('hidden');

  // 👇 关键：注销任务栏图标
  unregisterTaskbarWindow(container.id);

  // 特殊清理
  if (container.id === 'pose-editor-container') {
    cleanupPoseEditor();
  }
});
}

function loadDefaultPose() {
  const saved = localStorage.getItem('ambiguity-gap:default-pose');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.camera) {
        Object.assign(cameraPosition, data.camera);
        // 刷新 UI（如果 D 盘开着，会自动同步；否则下次打开时同步）
        if (typeof updateCameraDisplay === 'function') {
          updateCameraDisplay();
        }
        if (typeof updateCameraPosition === 'function') {
          updateCameraPosition();
        }
      }
    } catch (e) {
      console.warn('加载默认姿势失败', e);
    }
  }
}

// 👇 使用事件委托：监听整个 document，只绑一次
document.addEventListener('click', function(e) {
  if (!e.target.classList.contains('window-close')) return;

  // 获取容器 ID（优先级：data-target > .window-container.id）
  const container = e.target.closest('.window-container');
  if (!container || !container.id) {
    console.warn('关闭按钮未关联有效 window-container');
    return;
  }

  const targetId = container.id;

  // 隐藏窗口
  container.classList.add('hidden');

  // 👇 新增：注销任务栏图标（关键！）
  unregisterTaskbarWindow(targetId);

  // 特殊清理
  if (targetId === 'pose-editor-container') {
    cleanupPoseEditorListeners();
  }
});

// ========== 我的电脑初始化 ==========
function initMyComputer() {
  // 暂时留空，后续可添加逻辑
  console.log("✅ My Computer initialized");
}
 function initMyDocuments() {
  // 暂时留空，后续可添加逻辑
  console.log("✅ My Documents initialized");
}
  // ========== 开始菜单（增强版：支持任务栏翻页模式） ==========
function initStartMenu() {
  const startButton = document.querySelector('.start-button');
  const startMenu = document.getElementById('start-menu');
  if (!startButton || !startMenu) return;

  let isOpen = false;
  let scrollX = 0; // 当前滚动偏移（仅用于 taskbar 模式）

  // 获取任务栏菜单相关元素
  const isTaskbarMode = document.body.classList.contains('taskbar-menu');
  const wrapper = isTaskbarMode ? startMenu.querySelector('.menu-items-wrapper') : null;
  const prevBtn = isTaskbarMode ? startMenu.querySelector('.menu-nav-btn.prev') : null;
  const nextBtn = isTaskbarMode ? startMenu.querySelector('.menu-nav-btn.next') : null;

  // 更新翻页按钮可见性（仅 taskbar 模式）
  function updateNavButtons() {
    if (!isTaskbarMode || !wrapper || !prevBtn || !nextBtn) return;
    const containerWidth = wrapper.parentElement.clientWidth;
    const contentWidth = wrapper.scrollWidth;
    prevBtn.classList.toggle('hidden', scrollX <= 0);
    nextBtn.classList.toggle('hidden', scrollX >= contentWidth - containerWidth);
  }

  // 平滑滚动函数
  function scrollToOffset(newScrollX) {
    if (!wrapper) return;
    scrollX = Math.max(0, Math.min(newScrollX, wrapper.scrollWidth - wrapper.parentElement.clientWidth));
    wrapper.style.transform = `translateX(-${scrollX}px)`;
    updateNavButtons();
  }

  // 绑定翻页按钮事件（仅 taskbar 模式）
  if (isTaskbarMode && prevBtn && nextBtn) {
    // 估算一个“合理”的滚动步长（约 1.5 个图标）
    const getScrollStep = () => {
      const firstItem = wrapper.querySelector('.menu-item');
      return firstItem ? firstItem.offsetWidth * 1.5 : 120;
    };

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToOffset(scrollX - getScrollStep());
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToOffset(scrollX + getScrollStep());
    });

    // 初始更新按钮状态
    setTimeout(updateNavButtons, 100); // 等待渲染
  }

  // 切换菜单显示
  const toggleMenu = (e) => {
    e.stopPropagation();
    if (isOpen) {
      startMenu.classList.add('hidden');
      isOpen = false;
      // 重置滚动位置（可选）
      if (isTaskbarMode) {
        scrollX = 0;
        if (wrapper) wrapper.style.transform = 'translateX(0)';
        updateNavButtons();
      }
    } else {
      startMenu.classList.remove('hidden');
      isOpen = true;
      if (isTaskbarMode) updateNavButtons();
    }
  };

  const closeMenu = () => {
    if (isOpen) {
      startMenu.classList.add('hidden');
      isOpen = false;
      if (isTaskbarMode) {
        scrollX = 0;
        if (wrapper) wrapper.style.transform = 'translateX(0)';
        updateNavButtons();
      }
    }
  };

  // 绑定事件
  startButton.removeEventListener('click', toggleMenu);
  startButton.addEventListener('click', toggleMenu);

  document.removeEventListener('click', closeMenu);
  document.addEventListener('click', closeMenu);

  startMenu.removeEventListener('click', (e) => e.stopPropagation());
  startMenu.addEventListener('click', (e) => e.stopPropagation());

  // 窗口缩放时更新按钮状态（仅 taskbar）
  if (isTaskbarMode) {
    window.addEventListener('resize', () => {
      if (isOpen) updateNavButtons();
    });
  }
}

  // ========== Window 消息关闭 ==========
  const msgClose = document.getElementById('msg-close');
  if (msgClose) {
    msgClose.addEventListener('click', () => {
      document.getElementById('window-message').classList.add('hidden');
    });
  }

  // ========== 骨骼名称中文化功能初始化 ==========

  // C. 初始化时读取用户自定义映射
  const savedCustomMapping = localStorage.getItem('custom-bone-mappings');
  if (savedCustomMapping) {
    try {
      const custom = JSON.parse(savedCustomMapping);
      // 合并到默认映射表
      Object.assign(BONE_NAME_TRANSLATIONS, custom);
    } catch (e) {
      console.warn('⚠️ 自定义骨骼映射表加载失败:', e);
    }
  }

  // 读取中文化开关状态
  const savedPref = localStorage.getItem('useChineseBoneNames');
  if (savedPref === 'true') {
    useChineseBoneNames = true;
    const toggleEl = document.getElementById('chinese-bone-names-toggle');
    if (toggleEl) toggleEl.checked = true;
  }

  // B. 绑定“编辑映射表”按钮事件
  document.getElementById('edit-mapping-btn')?.addEventListener('click', () => {
    const currentMapping = JSON.stringify(BONE_NAME_TRANSLATIONS, null, 2);
    const newMappingStr = prompt(
      '✏️ 编辑骨骼名称中文化映射表\n' +
      '格式: {"原始骨骼名": "中文名", ...}\n' +
      '注意：请保持有效的 JSON 格式！',
      currentMapping
    );
    
    if (newMappingStr) {
      try {
        const newMapping = JSON.parse(newMappingStr);
        // 保存到 localStorage
        localStorage.setItem('custom-bone-mappings', JSON.stringify(newMapping));
        // 更新全局映射表
        Object.assign(BONE_NAME_TRANSLATIONS, newMapping);
        alert('✅ 骨骼映射表已更新并保存！');
        // 刷新界面上所有现有滑块的标签
        updateAllBoneLabels();
      } catch (e) {
        alert('❌ JSON 格式错误！\n请检查括号、引号是否匹配。\n错误: ' + e.message);
      }
    }
  });

  // 绑定中文化开关事件
  document.getElementById('chinese-bone-names-toggle')?.addEventListener('change', (e) => {
    useChineseBoneNames = e.target.checked;
    localStorage.setItem('useChineseBoneNames', useChineseBoneNames.toString());
    updateAllBoneLabels();
  });
  // >>>>> 【结束】 <<<<<

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

// 启动裂隙训练营
// 原有代码（main.js 第 2800 行左右）
document.getElementById('launch-gap')?.addEventListener('click', () => {
  // 改为：启动训练营（固定角色，无需选角）
  window.open('./ambiguity-gap.html?mode=tutorial', '_blank');
});

// 关闭聊天窗口 + Window 回 idle
document.getElementById('close-chat')?.addEventListener('click', () => {
  document.getElementById('roommate-chat').classList.add('hidden');
  setWindowState('idle');
});
// 在 DOMContentLoaded 回调末尾添加
document.getElementById('msg-close')?.addEventListener('click', () => {
  document.getElementById('window-message').classList.add('hidden');
});

// 绑定切换开关事件
document.getElementById('chinese-bone-names-toggle')?.addEventListener('change', (e) => {
  useChineseBoneNames = e.target.checked;
  
  // 可选：保存用户偏好到 localStorage
  localStorage.setItem('useChineseBoneNames', useChineseBoneNames.toString());

  // 立即更新所有现有滑块的标签
  updateAllBoneLabels();
});

// ========== 进程选择器（E盘功能） ==========
function openProcessSelector() {
  const container = document.getElementById('process-selector-container');
  const win = container.querySelector('.app-window');
  const listEl = document.getElementById('character-list');

  // 👇 新增：注册到任务栏
  registerTaskbarWindow('process-selector-container', '⚙️', '进程选择器 (E:)');

  // 渲染角色列表（安全：每次重建）
  const available = ['通用', 'Windown'];
  if (localStorage.getItem('ambiguity-gap:unlocked-zhao')) available.push('赵雅懿');
  if (localStorage.getItem('ambiguity-gap:unlocked-luolie')) available.push('逻裂体');

  listEl.innerHTML = '';
  available.forEach((name, i) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.margin = '6px 0';
    label.innerHTML = `
      <input type="radio" name="selected-char" value="${name}" ${i === 0 ? 'checked' : ''}>
      ${name}
    `;
    listEl.appendChild(label);
  });

  // 显示窗口
  container.classList.remove('hidden');
  bringToFront(container);

  // 初始化拖拽（仅一次）
  if (!container.dataset.dragInitialized) {
    makeDraggable(win);
    container.dataset.dragInitialized = 'true';
  }

  // ========== 关键：使用 addEventListener + 标志位防重复 ==========
  const confirmBtn = document.getElementById('confirm-select-btn');
  const cancelBtn = document.getElementById('cancel-select-btn');

  if (!confirmBtn.dataset.bound) {
    const handler = () => {
      const selected = document.querySelector('input[name="selected-char"]:checked');
      if (selected) {
        const char = selected.value;
        localStorage.setItem('ambiguity-gap:selected-character', char);
        localStorage.setItem('ambiguity-gap:trust', '50');
        alert(`✅ 主进程已设为：${char}\n现在可启动《歧义裂隙》！`);
      }
      container.classList.add('hidden'); // 👈 直接隐藏，依赖统一关闭逻辑
    };
    confirmBtn.addEventListener('click', handler);
    confirmBtn.dataset.bound = 'true'; // 标记已绑定
  }

  if (!cancelBtn.dataset.bound) {
    const handler = () => {
      container.classList.add('hidden');
    };
    cancelBtn.addEventListener('click', handler);
    cancelBtn.dataset.bound = 'true';
  }
}


// ========== 3D Window 舍友 ==========
function initWindow3D() {
  const container = document.getElementById('window-3d-container');
  container.classList.remove('hidden');
  container.innerHTML = ''; // 清空

  const scene = new THREE.Scene();
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  // 光照
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1, 1, 1).normalize();
  scene.add(dirLight);

  // 自适应
  function onResize() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.25;
    const width = size * 1.5;
    const height = size * 1.5;
    renderer.setSize(width, height);
    renderer.domElement.style.width = width + 'px';
    renderer.domElement.style.height = height + 'px';
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', onResize);
  onResize();

  container.appendChild(renderer.domElement);

  // 保存全局引用
  window.window3D = { scene, camera, renderer, container };

  // 👇 关键：启动空场景动画（等待模型加载）
  startAnimationLoop(scene, camera, renderer, null);

  // 👇 加载默认舍友
  loadRoommate(currentRoommateId);
}

function loadSavedPose() {
  const saved = localStorage.getItem('ambiguity-gap:default-pose');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.camera) {
        Object.assign(cameraPosition, data.camera);
        updateCameraDisplay();
        updateCameraPosition();
      }
    } catch (e) {
      console.warn('加载默认姿势失败', e);
    }
  }
}



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

  // 控制 3D 容器
  const container3D = document.getElementById('window-3d-container');

  if (state === 'away') {
    agent.classList.add('away');
    // 隐藏 3D
    if (container3D) {
      container3D.style.opacity = '0';
      container3D.style.pointerEvents = 'none';
    }
  } else {
    // idle / walking / talking
    agent.classList.add(state || 'idle');
    
    // 显示 3D
    if (container3D) {
      container3D.style.opacity = '1';
      container3D.style.pointerEvents = 'none';
    }

    // 设置对应表情
    if (state === 'walking') {
      face.innerHTML = `<path d="M6 12 L10 12 M14 12 L18 12" stroke="#333" stroke-width="2"/><path d="M9 16 Q12 17 15 16" fill="none" stroke="#333" stroke-width="1.5"/>`;
    } else if (state === 'talking') {
      face.innerHTML = `<circle cx="9" cy="10" r="2" fill="#333"/><circle cx="15" cy="10" r="2" fill="#333"/><path d="M9 16 Q12 18 15 16" fill="none" stroke="#333" stroke-width="1.5"/>`;
    } else {
      face.innerHTML = `<path d="M6 12 L10 12 M14 12 L18 12" stroke="#333" stroke-width="2"/><path d="M9 16 Q12 17 15 16" fill="none" stroke="#333" stroke-width="1.5"/>`;
    }
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

  // === 暴露到全局 ===
  window.setWindowState = setWindowState; // 👈 关键！
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

// ========== 扩展后的姿势编辑器（D:） ==========
function openPoseEditor() {
  const container = document.getElementById('pose-editor-container');
  const win = container.querySelector('.app-window');
  
  container.classList.remove('hidden');
  bringToFront(container);

  // 👇 新增：注册到任务栏
  registerTaskbarWindow('pose-editor-container', '💾', '姿势驱动器 (D:)');

  // 初始化拖拽
  if (!container.dataset.dragInitialized) {
    makeDraggable(win);
    container.dataset.dragInitialized = 'true';
  }

  // 👇 关键：每次打开前先清理（防御性）
  cleanupPoseEditor();

  // 填充骨骼选择器...
  const boneSelect = document.getElementById('bone-selector');
  boneSelect.innerHTML = '';
  if (window.fullSkeleton) {
    window.fullSkeleton.forEach(bone => {
      if (bone.name && !bone.name.includes('IK')) {
        const opt = document.createElement('option');
        opt.value = bone.name;
        opt.textContent = useChineseBoneNames ? translateBoneName(bone.name) : bone.name;
        boneSelect.appendChild(opt);
      }
    });
  }

  // ========== 绑定相机滑块 ==========
  ['x', 'y', 'z'].forEach(axis => {
    const slider = document.getElementById(`cam-${axis}`);
    const input = document.getElementById(`cam-${axis}-input`);
    
    const handler = (e) => {
      const value = parseFloat(e.target.value);
      cameraPosition[axis] = value;
      updateCameraDisplay();
      updateCameraPosition();
    };

    if (slider) {
      slider.addEventListener('input', handler);
      poseEditorListeners.push({ el: slider, type: 'input', fn: handler });
    }
    if (input) {
      input.addEventListener('change', handler);
      poseEditorListeners.push({ el: input, type: 'change', fn: handler });
    }
  });

  // ========== 绑定保存/重置按钮 ==========
  const saveBtn = document.getElementById('pose-save-btn');
  const saveHandler = () => saveFullPose();
  saveBtn.addEventListener('click', saveHandler);
  poseEditorListeners.push({ el: saveBtn, type: 'click', fn: saveHandler });

  const resetBtn = document.getElementById('pose-reset-btn');
  const resetHandler = () => resetFullPose();
  resetBtn.addEventListener('click', resetHandler);
  poseEditorListeners.push({ el: resetBtn, type: 'click', fn: resetHandler });

  // 刷新相机显示
  if (typeof cameraPosition !== 'undefined') {
    document.getElementById('cam-x').value = cameraPosition.x;
    document.getElementById('cam-y').value = cameraPosition.y;
    document.getElementById('cam-z').value = cameraPosition.z;
    updateCameraDisplay();
  }
}

// 清理 D 盘所有监听器
function cleanupPoseEditorListeners() {
  poseEditorActiveListeners.forEach(({ el, type, fn }) => {
    el.removeEventListener(type, fn);
  });
  poseEditorActiveListeners = [];
}

// ========== 在 DOMContentLoaded 回调末尾绑定新事件 ==========

// ========== 绑定网络邻居窗口事件 ==========
document.getElementById('create-room-btn')?.addEventListener('click', createNetworkRoom);
document.getElementById('join-room-btn')?.addEventListener('click', joinNetworkRoom);

// ========== 舍友切换 ==========
document.querySelectorAll('.roommate-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    
    // 更新激活状态
    document.querySelectorAll('.roommate-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 加载舍友
    loadRoommate(id);
  });
});

// ✅【修复 + 增强】姿势编辑器：重置 (兼容旧版 + 安全检查 + 相机重置)
document.getElementById('pose-reset-btn')?.addEventListener('click', () => {
  // 1. 重置旧版滑块（如果存在）
  const sliders = [
    'pe-l-shoulder-y', 'pe-r-shoulder-y',
    'pe-l-arm-x', 'pe-r-arm-x',
    'pe-l-arm-z', 'pe-r-arm-z'
  ];
  sliders.forEach(id => {
    const sliderEl = document.getElementById(id);
    if (sliderEl) {
      sliderEl.value = '0';
    }
  });
  updatePoseDisplay();
  applyPoseToBones({
    lShoulderY: 0, rShoulderY: 0,
    lArmX: 0, rArmX: 0,
    lArmZ: 0, rArmZ: 0
  });

  // 2. 【新增】重置新版姿势和相机
  resetFullPose(); // 这个函数已经包含了重置骨骼和相机的逻辑
});

// 滑块实时更新 (兼容旧版)
['l-shoulder-y', 'r-shoulder-y', 'l-arm-x', 'r-arm-x', 'l-arm-z', 'r-arm-z'].forEach(key => {
  document.getElementById(`pe-${key}`)?.addEventListener('input', () => {
    updatePoseDisplay();
    const pose = {
      lShoulderY: document.getElementById('pe-l-shoulder-y').value,
      rShoulderY: document.getElementById('pe-r-shoulder-y').value,
      lArmX: document.getElementById('pe-l-arm-x').value,
      rArmX: document.getElementById('pe-r-arm-x').value,
      lArmZ: document.getElementById('pe-l-arm-z').value,
      rArmZ: document.getElementById('pe-r-arm-z').value
    };
    applyPoseToBones(pose);
  });
});

// ========== 新增：姿势驱动器事件 ==========
document.getElementById('add-bone-control')?.addEventListener('click', addBoneControl);
document.getElementById('pose-save-btn')?.addEventListener('click', saveFullPose);
document.getElementById('pose-reset-btn')?.addEventListener('click', resetFullPose);

// ========== 相机控制事件绑定 ==========
// 自动绑定所有相机控制（无论滑块还是输入框）
['x', 'y', 'z'].forEach(axis => {
  const slider = document.getElementById(`cam-${axis}`);
  const input = document.getElementById(`cam-${axis}-input`);
  
  const updateCamera = (value) => {
    globalWindow.cameraPosition[axis] = parseFloat(value);
    updateCameraDisplay();
    updateCameraPosition();
  };

  if (slider) {
    slider.addEventListener('input', e => updateCamera(e.target.value));
  }
  if (input) {
    // 手机用 'change' 避免频繁触发（或用 'input' 实时）
    input.addEventListener('change', e => updateCamera(e.target.value));
  }
});

updateCameraDisplay();

}); // End of DOMContentLoaded


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


// ========== 兼容旧版函数 ==========
function updatePoseDisplay() {
  // 可为空或保留占位符，如果旧版UI还在用
}


function applyPoseToBones(pose) {
  if (!windowBones) return;
  if (windowBones.leftShoulder) windowBones.leftShoulder.rotation.y = pose.lShoulderY * (Math.PI / 180);
  if (windowBones.rightShoulder) windowBones.rightShoulder.rotation.y = pose.rShoulderY * (Math.PI / 180);
  if (windowBones.leftUpperArm) windowBones.leftUpperArm.rotation.x = pose.lArmX * (Math.PI / 180);
  if (windowBones.rightUpperArm) windowBones.rightUpperArm.rotation.x = pose.rArmX * (Math.PI / 180);
  if (windowBones.leftUpperArm) windowBones.leftUpperArm.rotation.z = pose.lArmZ * (Math.PI / 180);
  if (windowBones.rightUpperArm) windowBones.rightUpperArm.rotation.z = pose.rArmZ * (Math.PI / 180);
}

// 暴露调试接口
globalWindow.cameraPosition = cameraPosition;
globalWindow.activeBoneControls = activeBoneControls;
globalWindow.updateCameraPosition = updateCameraPosition;
globalWindow.saveFullPose = saveFullPose;
globalWindow.resetFullPose = resetFullPose;

console.log("✅ main.js loaded successfully");
window.mainLoaded = true;