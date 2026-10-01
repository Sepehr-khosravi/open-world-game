import './style.css';
import * as THREE from 'three';

import { World } from './world/World.js';
import { Physics } from './world/Physics.js';
import { Player } from './entities/Player.js';
import { AssetLoader } from './world/AssetLoader.js';
import { VehicleManager } from './world/VehicleManager.js';

import { CharacterSelect } from './ui/CharacterSelect.js';
import { Dashboard } from './ui/Dashboard.js';
import { MobileControls } from './ui/MobileControls.js';

const canvas = document.getElementById('game-canvas');
const loadingEl = document.getElementById('loading');
const menuEl = document.getElementById('settings-menu');
const closeBtn = document.getElementById('close-menu');
const sensInput = document.getElementById('sensitivity');
const sensValue = document.getElementById('sensitivity-value');

/* =========================================================
 * DEVICE
 * ========================================================= */

const isMobile =
  window.matchMedia('(max-width: 900px)').matches ||
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0;

function isLandscape() {
  if (!isMobile) return true;

  return window.innerWidth >= window.innerHeight;
}

/* =========================================================
 * SCENE
 * ========================================================= */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 400, 1500);

/* =========================================================
 * CORE
 * ========================================================= */

const physics = new Physics();
const assets = new AssetLoader();

const world = new World(physics, assets);

/*
 * موبایل:
 * به جای کوچک کردن خود chunk، تعداد chunkهای فعال
 * اطراف بازیکن را کم می‌کنیم.
 *
 * این روش امن‌تر است چون ساختار داخلی City به هم نمی‌ریزد.
 */
if (isMobile) {
  world.city.renderDistance = 1;
}

scene.add(world.group);

const player = new Player(physics);
scene.add(player.mesh);

const vehicles = new VehicleManager(scene, physics, assets);

const dashboard = new Dashboard();

/* =========================================================
 * RENDERER
 * ========================================================= */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 1.5)
);

renderer.setSize(
  window.innerWidth,
  window.innerHeight,
  false
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

/* =========================================================
 * CAMERA
 * ========================================================= */

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  4000
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

/* =========================================================
 * PLAYER VISIBILITY
 * ========================================================= */

function findPlayerParts() {
  headParts = [];

  if (!player.mesh) return;

  player.mesh.traverse((node) => {
    const name = (node.name || '').toLowerCase();

    if (name.includes('head')) {
      headParts.push(node);
    }
  });
}

function applyFirstPersonVisibility() {
  if (!player.mesh) return;

  if (headParts.length === 0) {
    player.mesh.visible = !firstPerson;
    return;
  }

  player.mesh.visible = true;

  for (const p of headParts) {
    p.visible = !firstPerson;
  }
}

/* =========================================================
 * CANVAS / POINTER LOCK
 * ========================================================= */

canvas.tabIndex = 0;
canvas.style.outline = 'none';

window.addEventListener('click', (e) => {
  if (e.target.closest('#settings-menu')) return;
  if (e.target.closest('#character-select')) return;

  /*
   * روی موبایل Pointer Lock نداریم.
   */
  if (isMobile) return;

  if (!isLocked) {
    canvas.focus();
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isLocked =
    document.pointerLockElement === canvas;
});

document.addEventListener('pointerlockerror', () => {
  console.error('[PointerLock] Error');
});

/* =========================================================
 * MOUSE CAMERA
 * ========================================================= */

document.addEventListener('mousemove', (e) => {
  if (!isLocked) return;

  const s = sensitivity * 0.001;

  if (vehicles.isDriving()) {
    driveCamYaw -= e.movementX * s;

    driveCamPitch += e.movementY * s;

    driveCamPitch = Math.max(
      -0.3,
      Math.min(1.2, driveCamPitch)
    );

    return;
  }

  camYaw -= e.movementX * s;
  camPitch += e.movementY * s;

  if (firstPerson) {
    camPitch = Math.max(
      -1.5,
      Math.min(1.5, camPitch)
    );
  } else {
    camPitch = Math.max(
      -0.3,
      Math.min(1.2, camPitch)
    );
  }
});

/* =========================================================
 * MOUSE WHEEL
 * ========================================================= */

canvas.addEventListener(
  'wheel',
  (e) => {
    if (vehicles.isDriving()) {
      driveCamDistance = Math.max(
        2,
        Math.min(
          10,
          driveCamDistance + e.deltaY * 0.01
        )
      );

      return;
    }

    if (firstPerson) return;

    camDistance = Math.max(
      3,
      Math.min(
        15,
        camDistance + e.deltaY * 0.01
      )
    );
  },
  { passive: true }
);

/* =========================================================
 * KEYBOARD
 * ========================================================= */

window.addEventListener('keydown', (e) => {
  if (
    e.key.toLowerCase() === 'c' &&
    !vehicles.isDriving()
  ) {
    firstPerson = !firstPerson;

    if (firstPerson) {
      camPitch = Math.max(
        -1.5,
        Math.min(1.5, camPitch)
      );
    } else {
      camPitch = Math.max(
        -0.3,
        Math.min(1.2, camPitch)
      );
    }

    applyFirstPersonVisibility();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isLocked) {
    openMenu();
  }
});

/* =========================================================
 * SETTINGS MENU
 * ========================================================= */

function openMenu() {
  document.exitPointerLock();
  menuEl.classList.add('open');
}

function closeMenu() {
  menuEl.classList.remove('open');

  if (isMobile) return;

  setTimeout(() => {
    canvas.focus();
    canvas.requestPointerLock();
  }, 200);
}

if (closeBtn) {
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
  });
}

if (sensInput && sensValue) {
  sensInput.addEventListener('input', () => {
    sensitivity = parseFloat(
      sensInput.value
    );

    sensValue.textContent =
      sensitivity.toFixed(1);
  });
}

/* =========================================================
 * CHARACTER SELECT
 * ========================================================= */

const selectUI = new CharacterSelect(
  assets,
  async (letter) => {
    try {
      const {
        model,
        animations,
      } = await assets.loadCharacter(
        `/models/characters/character-${letter}.glb`
      );

      player.setModel(
        model,
        animations
      );

      findPlayerParts();
      applyFirstPersonVisibility();

      if (!isMobile) {
        canvas.focus();
        canvas.requestPointerLock();
      }
    } catch (err) {
      console.error(
        '[CharacterSelect]',
        err
      );
    }
  }
);

/* =========================================================
 * CAR
 * ========================================================= */
function enterCar() {
  if (vehicles.isDriving()) return;

  const pos =
    player.getPosition();

  const v =
    vehicles.findNearestVehicle(
      pos,
      4
    );

  if (!v) {
    return;
  }

  if (!vehicles.enterVehicle(v)) {
    return;
  }

  firstPersonBeforeDriving =
    firstPerson;

  firstPerson = false;

  player.mesh.visible = false;

  player.body.collisionResponse =
    false;

  player.body.velocity.set(
    0,
    0,
    0
  );

  const vp =
    v.getPosition();

  player.body.position.set(
    vp.x,
    vp.y + 1,
    vp.z
  );

  driveCamYaw =
    Math.atan2(
      -v.getForwardVector().x,
      -v.getForwardVector().z
    );

  driveCamPitch = 0.20;

  dashboard.show();

  mobileControls.setDriving(
    true
  );

  /*
   * وقتی داخل ماشینیم،
   * دکمه باید «پیاده شدن» باشد.
   */
  mobileControls.setInteractable(
    true
  );
}
function exitCar() {
  if (!vehicles.isDriving()) {
    return;
  }

  const v =
    vehicles.activeVehicle;

  vehicles.exitVehicle();

  firstPerson =
    firstPersonBeforeDriving;

  applyFirstPersonVisibility();

  player.mesh.visible = true;

  player.body.collisionResponse =
    true;

  if (v) {
    const vp =
      v.getPosition();

    const forward =
      v.getForwardVector();

    player.body.position.set(
      vp.x -
        forward.x * 2.5,
      vp.y + 1,
      vp.z -
        forward.z * 2.5
    );

    player.body.velocity.set(
      0,
      0,
      0
    );
  }

  dashboard.hide();

  mobileControls.setDriving(
    false
  );

  /*
   * بعد از پیاده شدن فقط اگر
   * دوباره کنار ماشین باشیم
   * دکمه ظاهر می‌شود.
   */
  updateMobileInteraction();
}

/* =========================================================
 * MOBILE VEHICLE INTERACTION
 * ========================================================= */

function updateMobileInteraction() {
  if (!isMobile) return;

  if (vehicles.isDriving()) {
    mobileControls.setInteractable(
      true
    );

    return;
  }

  const playerPos =
    player.getPosition();

  const nearest =
    vehicles.findNearestVehicle(
      playerPos,
      4
    );

  mobileControls.setInteractable(
    !!nearest
  );
}

/* =========================================================
 * KEY INPUT
 * ========================================================= */

const keys = {};

window.addEventListener('keydown', (e) => {
  const k =
    e.key.toLowerCase();

  keys[k] = true;

  if (k === 'e') {
    if (vehicles.isDriving()) {
      exitCar();
    } else {
      enterCar();
    }
  }
});

window.addEventListener('keyup', (e) => {
  const k =
    e.key.toLowerCase();

  keys[k] = false;
});

/* =========================================================
 * MOBILE CONTROLS
 * ========================================================= */

const mobileControls =
  new MobileControls({
    onEnterExit: () => {
      if (vehicles.isDriving()) {
        exitCar();
      } else {
        enterCar();
      }
    },

    onCamera: () => {
      if (vehicles.isDriving()) return;

      firstPerson = !firstPerson;

      if (firstPerson) {
        camPitch = Math.max(
          -1.5,
          Math.min(1.5, camPitch)
        );
      } else {
        camPitch = Math.max(
          -0.3,
          Math.min(1.2, camPitch)
        );
      }

      applyFirstPersonVisibility();
    },

    onFullscreen: async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen({
            navigationUI: 'hide',
          });
        }

        if (
          screen.orientation &&
          screen.orientation.lock
        ) {
          try {
            await screen.orientation.lock(
              'landscape'
            );
          } catch {
            // Safari/iOS و بعضی مرورگرها اجازه نمی‌دهند
          }
        }
      } catch (err) {
        console.warn(
          '[Mobile] Fullscreen failed:',
          err
        );
      }
    },

    onJump: () => {
      /*
       * Jump را از input واقعی Player عبور می‌دهیم.
       * اگر Player از space استفاده کند، همین کافی است.
       */
      mobileControls.keys.space = true;

      setTimeout(() => {
        mobileControls.keys.space = false;
      }, 80);
    },

    onSprintChange: (active) => {
      mobileControls.keys.shift = active;
    },

    onLook: (dx, dy) => {
      if (vehicles.isDriving()) {
        driveCamYaw -= dx * sensitivity * 0.004;
        driveCamPitch += dy * sensitivity * 0.004;

        driveCamPitch = Math.max(
          -0.3,
          Math.min(1.2, driveCamPitch)
        );

        return;
      }

      camYaw -= dx * sensitivity * 0.004;
      camPitch += dy * sensitivity * 0.004;

      if (firstPerson) {
        camPitch = Math.max(
          -1.5,
          Math.min(1.5, camPitch)
        );
      } else {
        camPitch = Math.max(
          -0.3,
          Math.min(1.2, camPitch)
        );
      }
    },
  });
/* =========================================================
 * RESIZE
 * ========================================================= */

window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight,
    false
  );
});

/* =========================================================
 * PLAYER CAMERA
 * ========================================================= */

function updatePlayerCamera(dt) {
  const pos =
    player.getPosition();

  if (firstPerson) {
    const eyeY =
      pos.y + EYE_HEIGHT;

    const cosP =
      Math.cos(camPitch);

    const dirX =
      -Math.sin(camYaw) * cosP;

    const dirY =
      -Math.sin(camPitch);

    const dirZ =
      -Math.cos(camYaw) * cosP;

    camera.position.set(
      pos.x,
      eyeY,
      pos.z
    );

    camera.lookAt(
      pos.x + dirX,
      eyeY + dirY,
      pos.z + dirZ
    );

    return;
  }

  const vel =
    player.body.velocity;

  const speed =
    Math.hypot(
      vel.x,
      vel.z
    );

  const speedRatio =
    Math.min(
      1,
      speed / player.sprintSpeed
    );

  const wantsMove =
    !!(
      keys.w ||
      keys.a ||
      keys.s ||
      keys.d
    );

  const targetDist =
    camDistance +
    speedRatio * 0.8 +
    (wantsMove ? 0.2 : 0);

  cameraDistanceSmooth +=
    (
      targetDist -
      cameraDistanceSmooth
    ) *
    (
      1 -
      Math.exp(-8 * dt)
    );

  const target =
    new THREE.Vector3(
      pos.x,
      pos.y + 1.0,
      pos.z
    );

  const cosPitch =
    Math.cos(camPitch);

  const offsetX =
    Math.sin(camYaw) *
    cosPitch *
    cameraDistanceSmooth;

  const offsetY =
    Math.sin(camPitch) *
    cameraDistanceSmooth +
    1.0;

  const offsetZ =
    Math.cos(camYaw) *
    cosPitch *
    cameraDistanceSmooth;

  const desired =
    new THREE.Vector3(
      target.x + offsetX,
      target.y + offsetY,
      target.z + offsetZ
    );

  camera.position.lerp(
    desired,
    1 - Math.exp(-12 * dt)
  );

  camera.lookAt(target);
}

/* =========================================================
 * DRIVING CAMERA
 * ========================================================= */

function updateDrivingCamera(dt) {
  const v =
    vehicles.activeVehicle;

  if (!v) return;

  const vp =
    v.getPosition();

  const target =
    new THREE.Vector3(
      vp.x,
      vp.y + 0.7,
      vp.z
    );

  const horizDist =
    driveCamDistance *
    Math.cos(driveCamPitch);

  const ox =
    Math.sin(driveCamYaw) *
    horizDist;

  const oz =
    Math.cos(driveCamYaw) *
    horizDist;

  const oy =
    driveCamDistance *
    Math.sin(driveCamPitch) +
    0.8;

  const desired =
    new THREE.Vector3(
      vp.x + ox,
      vp.y + oy,
      vp.z + oz
    );

  camera.position.lerp(
    desired,
    1 - Math.exp(-15 * dt)
  );

  camera.lookAt(target);
}

/* =========================================================
 * GAME LOOP
 * ========================================================= */

let last =
  performance.now();

let lastChunkCheck = 0;

let gameStarted = false;

function animate() {
  if (gameStarted === false) {
    return;
  }

  requestAnimationFrame(animate);

  const now =
    performance.now();

  const dt =
    Math.min(
      (now - last) / 1000,
      0.05
    );

  last = now;

  if (!selectUI.isHidden) {
    selectUI.update(dt);
  }

  const driving =
    vehicles.isDriving();

  if (
    isMobile &&
    now - lastChunkCheck > 100
  ) {
    updateMobileInteraction();
  }

  /* =====================================================
   * INPUT
   * ===================================================== */

  if (isLocked || isMobile) {
    const inputKeys =
      isMobile
        ? {
            ...keys,
            ...mobileControls.getKeys(),
          }
        : keys;

    if (driving) {
      const v =
        vehicles.activeVehicle;

      if (v) {
        v.setInput(
          inputKeys,
          v.getForwardSpeed(),
          isMobile
            ? mobileControls.getSteering()
            : null
        );
      }
    } else {
      player.setInput(
        inputKeys,
        camYaw
      );

      player.updateController(
        dt,
        camYaw
      );
    }
  }

  /* =====================================================
   * PHYSICS
   * ===================================================== */

  physics.step(dt);

  /* =====================================================
   * VISUAL SYNC
   * ===================================================== */

  if (driving) {
    const v =
      vehicles.activeVehicle;

    if (v) {
      v.update(dt);
    }
  } else {
    player.syncVisual(dt);

    if (firstPerson) {
      player.mesh.rotation.y =
        camYaw + Math.PI;
    }
  }

  vehicles.update(dt);

  /* =====================================================
   * CAMERA
   * ===================================================== */

  if (driving) {
    updateDrivingCamera(dt);

    const v =
      vehicles.activeVehicle;

    if (v) {
      dashboard.update(
        v.getSpeed(),
        v.getForwardSpeed(),
        v.getCurrentGear(),
        v.gears
      );
    }
  } else if (
    isLocked ||
    isMobile
  ) {
    updatePlayerCamera(dt);
  }

  /* =====================================================
   * WORLD CHUNKS
   * ===================================================== */

if (
  now - lastChunkCheck >
  250
) {
  lastChunkCheck = now;

  if (isMobile) {
    updateMobileInteraction();
  }

  if (
      driving &&
      vehicles.activeVehicle
    ) {
      const carPos =
        vehicles.activeVehicle
          .getPosition();
  
      world.city.updatePlayerPosition(
        new THREE.Vector3(
          carPos.x,
          0,
          carPos.z
        )
      );
  
      vehicles.updateChunks(
        carPos.x,
        carPos.z,
        world.city.chunkSize,
        world.city.renderDistance
      );
    } else {
      const playerPos =
        player.body.position;
  
      world.city.updatePlayerPosition(
        new THREE.Vector3(
          playerPos.x,
          0,
          playerPos.z
        )
      );
  
      vehicles.updateChunks(
        playerPos.x,
        playerPos.z,
        world.city.chunkSize,
        world.city.renderDistance
      );
  
      vehicles.updateActive(
        new THREE.Vector3(
          playerPos.x,
          0,
          playerPos.z
        )
      );
    }
  }

  /* =====================================================
   * RENDER
   * ===================================================== */

  renderer.render(
    scene,
    camera
  );
}

/* =========================================================
 * MOBILE ORIENTATION GATE
 * ========================================================= */

let mobileOrientationMessage = null;

function showPortraitBlocker() {
  if (!isMobile) return;

  if (!mobileOrientationMessage) {
    mobileOrientationMessage =
      document.createElement('div');

    mobileOrientationMessage.id =
      'mobile-orientation-blocker';

    mobileOrientationMessage.innerHTML = `
      <div class="mobile-orientation-content">
        <div class="mobile-orientation-icon">
          ↻
        </div>

        <div class="mobile-orientation-title">
          گوشی را افقی کنید
        </div>

        <div class="mobile-orientation-text">
          برای اجرای بازی، گوشی باید در حالت افقی باشد.
        </div>
      </div>
    `;

    Object.assign(
      mobileOrientationMessage.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '999999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        color: '#fff',
        textAlign: 'center',
        fontFamily: 'sans-serif',
        padding: '24px',
      }
    );

    document.body.appendChild(
      mobileOrientationMessage
    );
  }

  mobileOrientationMessage.style.display =
    'flex';
}

function hidePortraitBlocker() {
  if (
    mobileOrientationMessage
  ) {
    mobileOrientationMessage.style.display =
      'none';
  }
}

/* =========================================================
 * GAME INITIALIZATION
 * ========================================================= */

let initializationStarted = false;

async function startGame() {
  if (initializationStarted) {
    return;
  }

  /*
   * روی موبایل عمودی:
   * اصلاً بازی را Load نکن.
   */
  if (
    isMobile &&
    !isLandscape()
  ) {
    showPortraitBlocker();
    return;
  }

  initializationStarted = true;

  hidePortraitBlocker();

  try {
    console.log(
      '[Main] Loading world...'
    );

    await world.load();

    console.log(
      '[Main] World loaded.'
    );

    const p =
      player.body.position;

    await world.city.updatePlayerPosition(
      new THREE.Vector3(
        p.x,
        0,
        p.z
      )
    );

    console.log(
      '[Main] Loading vehicles...'
    );

    await vehicles.load();

    console.log(
      '[Main] Vehicles loaded.'
    );

    vehicles.updateChunks(
      p.x,
      p.z,
      world.city.chunkSize,
      world.city.renderDistance
    );

    firstPerson = true;

    applyFirstPersonVisibility();

    renderer.render(
      scene,
      camera
    );

    gameStarted = true;

    setTimeout(() => {
      loadingEl.classList.add(
        'hidden'
      );

      last =
        performance.now();

      animate();
    }, 300);

  } catch (err) {
    console.error(
      '[Main] Game initialization failed:',
      err
    );

    /*
     * اگر Load شکست خورد، بازی را الکی
     * با world ناقص اجرا نکن.
     */
    loadingEl.classList.add(
      'hidden'
    );

    const errorEl =
      document.createElement('div');

    errorEl.textContent =
      'خطا در بارگذاری بازی. کنسول مرورگر را بررسی کنید.';

    Object.assign(
      errorEl.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '999998',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        color: '#fff',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '24px',
      }
    );

    document.body.appendChild(
      errorEl
    );
  }
}

/* =========================================================
 * ORIENTATION CHANGE
 * ========================================================= */

window.addEventListener(
  'orientationchange',
  () => {
    setTimeout(() => {
      if (
        isMobile &&
        !isLandscape()
      ) {
        showPortraitBlocker();
        return;
      }

      hidePortraitBlocker();

      /*
       * اگر قبلاً Load نشده بود،
       * الان که گوشی افقی شده شروع کن.
       */
      if (!gameStarted) {
        startGame();
      }
    }, 150);
  }
);

window.addEventListener(
  'resize',
  () => {
    if (
      isMobile &&
      !isLandscape()
    ) {
      showPortraitBlocker();
    } else {
      hidePortraitBlocker();

      if (!gameStarted) {
        startGame();
      }
    }
  }
);

/* =========================================================
 * START
 * ========================================================= */

window.addEventListener(
  'load',
  () => {
    startGame();
  }
);

/* =========================================================
 * DEBUG
 * ========================================================= */

window.__player = player;
window.__world = world;
window.__city = world.city;
window.__camera = camera;
window.__renderer = renderer;
window.__physics = physics;
window.__keys = keys;
window.__vehicles = vehicles;

window.__getLocked =
  () => isLocked;

window.__isFirstPerson =
  () => firstPerson;

window.__enterCar =
  enterCar;

window.__exitCar =
  exitCar;