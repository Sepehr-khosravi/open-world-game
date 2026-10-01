import './style.css';
import * as THREE from 'three';

import { World } from './world/World.js';
import { Physics } from './world/Physics.js';
import { Player } from './entities/Player.js';
import { AssetLoader } from './world/AssetLoader.js';
import { VehicleManager } from './world/VehicleManager.js';

import { CharacterSelect } from './ui/CharacterSelect.js';
import { Dashboard } from './ui/Dashboard.js';

const canvas = document.getElementById('game-canvas');
const loadingEl = document.getElementById('loading');
const menuEl = document.getElementById('settings-menu');
const closeBtn = document.getElementById('close-menu');
const sensInput = document.getElementById('sensitivity');
const sensValue = document.getElementById('sensitivity-value');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 400, 1500);

const physics = new Physics();
const assets = new AssetLoader();
const world = new World(physics, assets);
scene.add(world.group);

const player = new Player(physics);
scene.add(player.mesh);

const vehicles = new VehicleManager(scene, physics, assets);
const dashboard = new Dashboard();

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.05, 4000
);

let camYaw = 0;
let camPitch = 0;
let camDistance = 2.4;
let cameraDistanceSmooth = 2.4;

let isLocked = false;
let sensitivity = 2.0;

let firstPerson = true;
const EYE_HEIGHT = 1.25;

let driveCamDistance = 3.0;
let driveCamPitch = 0.20;
let driveCamYaw = 0;

let firstPersonBeforeDriving = true;

let headParts = [];

function findPlayerParts() {
  headParts = [];
  if (!player.mesh) return;
  player.mesh.traverse((node) => {
    const name = (node.name || '').toLowerCase();
    if (name.includes('head')) headParts.push(node);
  });
}

function applyFirstPersonVisibility() {
  if (!player.mesh) return;
  if (headParts.length === 0) {
    player.mesh.visible = !firstPerson;
    return;
  }
  player.mesh.visible = true;
  for (const p of headParts) p.visible = !firstPerson;
}

canvas.tabIndex = 0;
canvas.style.outline = 'none';

window.addEventListener('click', (e) => {
  if (e.target.closest('#settings-menu')) return;
  if (e.target.closest('#character-select')) return;
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

document.addEventListener('mousemove', (e) => {
  if (!isLocked) return;
  const s = sensitivity * 0.001;

  if (vehicles.isDriving()) {
    driveCamYaw -= e.movementX * s;
    driveCamPitch += e.movementY * s;
    driveCamPitch = Math.max(-0.3, Math.min(1.2, driveCamPitch));
    return;
  }

  camYaw -= e.movementX * s;
  camPitch += e.movementY * s;

  if (firstPerson) {
    camPitch = Math.max(-1.5, Math.min(1.5, camPitch));
  } else {
    camPitch = Math.max(-0.3, Math.min(1.2, camPitch));
  }
});

canvas.addEventListener('wheel', (e) => {
  if (vehicles.isDriving()) {
    driveCamDistance = Math.max(2, Math.min(10, driveCamDistance + e.deltaY * 0.01));
    return;
  }
  if (firstPerson) return;
  camDistance = Math.max(3, Math.min(15, camDistance + e.deltaY * 0.01));
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'c' && !vehicles.isDriving()) {
    firstPerson = !firstPerson;
    if (firstPerson) {
      camPitch = Math.max(-1.5, Math.min(1.5, camPitch));
    } else {
      camPitch = Math.max(-0.3, Math.min(1.2, camPitch));
    }
    applyFirstPersonVisibility();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isLocked) openMenu();
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

const selectUI = new CharacterSelect(assets, async (letter) => {
  try {
    const { model, animations } = await assets.loadCharacter(
      `/models/characters/character-${letter}.glb`
    );
    player.setModel(model, animations);
    findPlayerParts();
    applyFirstPersonVisibility();
    canvas.focus();
    canvas.requestPointerLock();
  } catch (err) {
    console.error('[CharacterSelect]', err);
  }
});

function enterCar() {
  if (vehicles.isDriving()) return;
  const pos = player.getPosition();
  const v = vehicles.findNearestVehicle(pos, 4);
  if (!v) return;
  if (!vehicles.enterVehicle(v)) return;

  firstPersonBeforeDriving = firstPerson;
  firstPerson = false;
  player.mesh.visible = false;

  // Disable player physics while in the car
  player.body.collisionResponse = false;
  player.body.velocity.set(0, 0, 0);

  // Move body into the car (only ONCE, not every frame)
  const vp = v.getPosition();
  player.body.position.set(vp.x, vp.y + 1, vp.z);

  driveCamYaw = Math.atan2(-v.getForwardVector().x, -v.getForwardVector().z);
  driveCamPitch = 0.20;
  dashboard.show();
}

function exitCar() {
  if (!vehicles.isDriving()) return;
  const v = vehicles.activeVehicle;
  vehicles.exitVehicle();

  firstPerson = firstPersonBeforeDriving;
  applyFirstPersonVisibility();
  player.mesh.visible = true;
  player.body.collisionResponse = true;

  if (v) {
    const vp = v.getPosition();
    // Place player NEXT TO the car
    player.body.position.set(vp.x + 2.5, vp.y + 1, vp.z);
    player.body.velocity.set(0, 0, 0);
  }

  dashboard.hide();
}

const keys = {};
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'e') {
    if (vehicles.isDriving()) exitCar();
    else enterCar();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

function updatePlayerCamera(dt) {
  const pos = player.getPosition();

  if (firstPerson) {
    const eyeY = pos.y + EYE_HEIGHT;
    const cosP = Math.cos(camPitch);
    const dirX = -Math.sin(camYaw) * cosP;
    const dirY = -Math.sin(camPitch);
    const dirZ = -Math.cos(camYaw) * cosP;

    camera.position.set(pos.x, eyeY, pos.z);
    camera.lookAt(pos.x + dirX, eyeY + dirY, pos.z + dirZ);
    return;
  }

  const vel = player.body.velocity;
  const speed = Math.hypot(vel.x, vel.z);
  const speedRatio = Math.min(1, speed / player.sprintSpeed);

  const wantsMove = !!(keys.w || keys.a || keys.s || keys.d);

  const targetDist = camDistance + speedRatio * 0.8 + (wantsMove ? 0.2 : 0);
  cameraDistanceSmooth += (targetDist - cameraDistanceSmooth) * (1 - Math.exp(-8 * dt));

  const target = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z);

  const cosPitch = Math.cos(camPitch);
  const offsetX = Math.sin(camYaw) * cosPitch * cameraDistanceSmooth;
  const offsetY = Math.sin(camPitch) * cameraDistanceSmooth + 1.0;
  const offsetZ = Math.cos(camYaw) * cosPitch * cameraDistanceSmooth;

  const desired = new THREE.Vector3(
    target.x + offsetX,
    target.y + offsetY,
    target.z + offsetZ
  );

  camera.position.lerp(desired, 1 - Math.exp(-12 * dt));
  camera.lookAt(target);
}

function updateDrivingCamera(dt) {
  const v = vehicles.activeVehicle;
  if (!v) return;
  const vp = v.getPosition();
  const target = new THREE.Vector3(vp.x, vp.y + 0.7, vp.z);

  const horizDist = driveCamDistance * Math.cos(driveCamPitch);
  const ox = Math.sin(driveCamYaw) * horizDist;
  const oz = Math.cos(driveCamYaw) * horizDist;
  const oy = driveCamDistance * Math.sin(driveCamPitch) + 0.8;

  const desired = new THREE.Vector3(vp.x + ox, vp.y + oy, vp.z + oz);
  camera.position.lerp(desired, 1 - Math.exp(-15 * dt));
  camera.lookAt(target);
}

let last = performance.now();
let lastChunkCheck = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!selectUI.isHidden) selectUI.update(dt);

  const driving = vehicles.isDriving();

  // ==========================================
  // 1. INPUT
  // ==========================================
  if (isLocked) {
    if (driving) {
      const v = vehicles.activeVehicle;
      if (v) v.setInput(keys, v.getForwardSpeed());
    } else {
      player.setInput(keys, camYaw);
      player.updateController(dt, camYaw);
    }
  }

  // ==========================================
  // 2. PHYSICS
  // ==========================================
  physics.step(dt);

  // ==========================================
  // 3. VISUAL SYNC
  // ==========================================
  if (driving) {
    const v = vehicles.activeVehicle;
    if (v) v.update(dt);
    // NOTE: Do NOT teleport player to car every frame.
  } else {
    player.syncVisual(dt);

    if (firstPerson) {
      player.mesh.rotation.y = camYaw + Math.PI;
    }
  }

  vehicles.update(dt);

  // ==========================================
  // 4. CAMERA
  // ==========================================
  if (driving) {
    updateDrivingCamera(dt);
    const v = vehicles.activeVehicle;
    if (v) dashboard.update(v.getSpeed(), v.getForwardSpeed(), v.getCurrentGear(), v.gears);
  } else if (isLocked) {
    updatePlayerCamera(dt);
  }

  // ==========================================
  // 5. WORLD CHUNKS
  // ==========================================
  if (now - lastChunkCheck > 500) {
    lastChunkCheck = now;
    const p = player.body.position;
    world.city.updatePlayerPosition(new THREE.Vector3(p.x, 0, p.z));
    vehicles.updateChunks(p.x, p.z, world.city.chunkSize, world.city.renderDistance);
  }

  // 5b. Activate physics only near player
  if (!driving) {
    const p = player.body.position;
    vehicles.updateActive(new THREE.Vector3(p.x, 0, p.z));
  }

  // ==========================================
  // 6. RENDER
  // ==========================================
  renderer.render(scene, camera);
}

window.addEventListener('load', async () => {
  try {
    await world.load();

    const p = player.body.position;
    await world.city.updatePlayerPosition(new THREE.Vector3(p.x, 0, p.z));

    await vehicles.load();
    vehicles.updateChunks(p.x, p.z, world.city.chunkSize, world.city.renderDistance);

    firstPerson = true;
    applyFirstPersonVisibility();

    renderer.render(scene, camera);

    setTimeout(() => {
      loadingEl.classList.add('hidden');
      animate();
    }, 300);
  } catch (err) {
    console.error('[Main] World failed:', err);
    loadingEl.classList.add('hidden');
    animate();
  }
});

window.__player = player;
window.__world = world;
window.__city = world.city;
window.__camera = camera;
window.__renderer = renderer;
window.__physics = physics;
window.__keys = keys;
window.__vehicles = vehicles;
window.__getLocked = () => isLocked;
window.__isFirstPerson = () => firstPerson;
window.__enterCar = enterCar;
window.__exitCar = exitCar;
