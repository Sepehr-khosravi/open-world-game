import './style.css';
import * as THREE from 'three';
import { World } from './world/World.js';
import { Physics } from './world/Physics.js';
import { Player } from './entities/Player.js';
import { AssetLoader } from './world/AssetLoader.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { WEAPONS } from './weapons/WeaponData.js';
import { WeaponWheel } from './weapons/WeaponWheel.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';

const canvas = document.getElementById('game-canvas');
const loadingEl = document.getElementById('loading');
const menuEl = document.getElementById('settings-menu');
const closeBtn = document.getElementById('close-menu');
const sensInput = document.getElementById('sensitivity');
const sensValue = document.getElementById('sensitivity-value');

// === صحنه ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 400, 1500);

// === فیزیک ===
const physics = new Physics();

// === دنیا ===
scene.add(new World(physics).group);

// === شخصیت ===
const player = new Player(physics);
scene.add(player.mesh);

// === رندرر ===
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// === دوربین ===
const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 4000
);

// === متغیرهای دوربین ===
let camYaw = 0;
let camPitch = 0.3;
let camDistance = 6;              // پایه‌ی فاصله (کاربر با اسکرول تنظیم می‌کنه)
let cameraDistanceSmooth = 6;     // فاصله‌ی نرم (داینامیک)
let isLocked = false;
let sensitivity = 2.0;

// === Pointer Lock ===
canvas.tabIndex = 0;
canvas.style.outline = 'none';

window.addEventListener('click', (e) => {
  if (e.target.closest('#settings-menu')) return;
  if (e.target.closest('#character-select')) return;
  if (e.target.closest('#weapon-wheel')) return;

  if (!isLocked) {
    canvas.focus();
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === canvas;
});

document.addEventListener('pointerlockerror', () => {
  console.error('Pointer lock error');
});

// === ماوس → چرخش دوربین ===
document.addEventListener('mousemove', (e) => {
  if (!isLocked) return;
  const s = sensitivity * 0.001;
  camYaw -= e.movementX * s;
  camPitch += e.movementY * s;
  camPitch = Math.max(-1.2, Math.min(0.4, camPitch));
});

// === زوم ===
canvas.addEventListener('wheel', (e) => {
  camDistance += e.deltaY * 0.01;
  camDistance = Math.max(3, Math.min(15, camDistance));
}, { passive: true });

// === منو ===
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isLocked) {
    openMenu();
  }
});

function openMenu() {
  document.exitPointerLock();
  menuEl.classList.add('open');
}

function closeMenu() {
  menuEl.classList.remove('open');
  setTimeout(() => {
    canvas.focus();
    canvas.requestPointerLock();
  }, 200);
}

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeMenu();
});

sensInput.addEventListener('input', () => {
  sensitivity = parseFloat(sensInput.value);
  sensValue.textContent = sensitivity.toFixed(1);
});

// === Asset Loader + Weapon ===
const assets = new AssetLoader();
const weaponSystem = new WeaponSystem(scene, player, camera);
const weaponWheel = new WeaponWheel(WEAPONS, (idx, weapon) => {
  weaponSystem.setWeapon(weapon);
});

// === انتخاب شخصیت ===
const selectUI = new CharacterSelect(assets, async (letter) => {
  const { model, animations } = await assets.loadCharacter(
    `/models/characters/character-${letter}.glb`
  );
  player.setModel(model, animations);
  weaponSystem.setWeapon(WEAPONS[0]);

  canvas.focus();
  canvas.requestPointerLock();
});

// === ورودی کیبورد ===
const keys = {};
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (k === 'tab') {
    e.preventDefault();
    if (!weaponWheel.isOpen) weaponWheel.open();
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;

  if (k === 'tab' && weaponWheel.isOpen) {
    weaponWheel.close();
  }
});

// === کلیک شلیک ===
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!isLocked) return;
  if (e.button === 0 || e.button === 2) {
    weaponSystem.tryFire(performance.now());
  }
});

// === ریسایز ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

// === حلقه ===
let last = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!selectUI.isHidden) selectUI.update(dt);

  // === آپدیت بازی ===
  if (isLocked) {
    player.setInput(keys, camYaw);
    player.update(dt, camYaw);
    physics.step(dt);
  }

  // === دوربین سوم شخص داینامیک ===

  // ۱. سرعت واقعی شخصیت
  const vel = player.body.velocity;
  const speed = Math.hypot(vel.x, vel.z);
  const speedRatio = Math.min(1, speed / player.sprintSpeed);

  // ۲. آیا کاربر داره دکمه‌ی حرکت رو نگه می‌داره؟
  const wantsMove = !!(
    keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
    keys['arrowup'] || keys['arrowdown'] ||
    keys['arrowleft'] || keys['arrowright']
  );

  // ۳. فاصله‌ی هدف بر اساس حالت
  const baseDistance = camDistance;
  const speedBonus = speedRatio * 2.5;         // تا ۲.۵ واحد عقب‌تر با سرعت
  const intentBonus = wantsMove ? 0.8 : 0;     // ۰.۸ واحد وقتی می‌خوای حرکت کنی
  const targetDistance = baseDistance + speedBonus + intentBonus;

  // ۴. نرم کردن فاصله
  cameraDistanceSmooth +=
    (targetDistance - cameraDistanceSmooth) * (1 - Math.exp(-6 * dt));

  // ۵. ارتفاع دوربین کمی با سرعت بره بالا
  const heightBonus = speedRatio * 0.6;

  // ۶. موقعیت دوربین
  const pos = player.getPosition();
  const target = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);

  const offsetX = Math.sin(camYaw) * Math.cos(camPitch) * cameraDistanceSmooth;
  const offsetY = Math.sin(camPitch) * cameraDistanceSmooth + 1.5 + heightBonus;
  const offsetZ = Math.cos(camYaw) * Math.cos(camPitch) * cameraDistanceSmooth;

  const desired = new THREE.Vector3(
    target.x + offsetX,
    target.y + offsetY,
    target.z + offsetZ
  );

  camera.position.lerp(desired, 1 - Math.exp(-20 * dt));
  camera.lookAt(target);

  weaponSystem.update(dt);

  renderer.render(scene, camera);
}

window.addEventListener('load', () => {
  renderer.render(scene, camera);
  setTimeout(() => {
    loadingEl.classList.add('hidden');
    animate();
  }, 300);
});

// برای دیباگ
window.__player = player;
window.__keys = keys;
window.__physics = physics;
window.__canvas = canvas;
window.__getLocked = () => isLocked;