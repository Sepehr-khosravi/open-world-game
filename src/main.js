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

scene.fog = new THREE.Fog(
  0x87ceeb,
  400,
  1500
);

/* =========================================================
 * CORE
 * ========================================================= */

const physics = new Physics();
const assets = new AssetLoader();

const world = new World(
  physics,
  assets
);

/*
 * روی موبایل تعداد chunkهای فعال
 * اطراف بازیکن را محدود می‌کنیم.
 */
if (isMobile) {
  world.city.renderDistance = 1;
}

scene.add(world.group);

const player = new Player(
  physics
);

scene.add(player.mesh);

const vehicles =
  new VehicleManager(
    scene,
    physics,
    assets
  );

const dashboard =
  new Dashboard();

/* =========================================================
 * RENDERER
 * ========================================================= */

const renderer =
  new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio,
    1.5
  )
);

renderer.setSize(
  window.innerWidth,
  window.innerHeight,
  false
);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type =
  THREE.PCFShadowMap;

renderer.toneMapping =
  THREE.ACESFilmicToneMapping;

/* =========================================================
 * CAMERA
 * ========================================================= */

const camera =
  new THREE.PerspectiveCamera(
    75,
    window.innerWidth /
      window.innerHeight,
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

/* ---------------------------------------------------------
 * Driving camera
 * --------------------------------------------------------- */

let driveCamDistance = 3.0;
let driveCamPitch = 0.20;
let driveCamYaw = 0;

let firstPersonBeforeDriving = true;

/* ---------------------------------------------------------
 * Player visibility
 * --------------------------------------------------------- */

let headParts = [];

/* =========================================================
 * PLAYER VISIBILITY
 * ========================================================= */

function findPlayerParts() {
  headParts = [];

  if (!player.mesh) {
    return;
  }

  player.mesh.traverse((node) => {
    const name =
      (node.name || '').toLowerCase();

    if (name.includes('head')) {
      headParts.push(node);
    }
  });
}

function applyFirstPersonVisibility() {
  if (!player.mesh) {
    return;
  }

  /*
   * اگر head پیدا نشد،
   * کل مدل را در First Person مخفی می‌کنیم.
   */
  if (headParts.length === 0) {
    player.mesh.visible =
      !firstPerson;

    return;
  }

  player.mesh.visible = true;

  for (const part of headParts) {
    part.visible =
      !firstPerson;
  }
}

/* =========================================================
 * CANVAS / POINTER LOCK
 * ========================================================= */

canvas.tabIndex = 0;
canvas.style.outline = 'none';

window.addEventListener(
  'click',
  (e) => {
    if (
      e.target.closest(
        '#settings-menu'
      )
    ) {
      return;
    }

    if (
      e.target.closest(
        '#character-select'
      )
    ) {
      return;
    }

    /*
     * موبایل Pointer Lock ندارد.
     */
    if (isMobile) {
      return;
    }

    if (!isLocked) {
      canvas.focus();

      canvas.requestPointerLock();
    }
  }
);

document.addEventListener(
  'pointerlockchange',
  () => {
    isLocked =
      document.pointerLockElement ===
      canvas;
  }
);

document.addEventListener(
  'pointerlockerror',
  () => {
    console.error(
      '[PointerLock] Error'
    );
  }
);

/* =========================================================
 * MOUSE CAMERA
 * ========================================================= */

document.addEventListener(
  'mousemove',
  (e) => {
    if (!isLocked) {
      return;
    }

    const s =
      sensitivity * 0.001;

    /*
     * Driving camera
     */
    if (vehicles.isDriving()) {
      driveCamYaw -=
        e.movementX * s;

      driveCamPitch +=
        e.movementY * s;

      driveCamPitch =
        Math.max(
          -0.3,
          Math.min(
            1.2,
            driveCamPitch
          )
        );

      return;
    }

    /*
     * Player camera
     */
    camYaw -=
      e.movementX * s;

    camPitch +=
      e.movementY * s;

    if (firstPerson) {
      camPitch =
        Math.max(
          -1.5,
          Math.min(
            1.5,
            camPitch
          )
        );
    } else {
      camPitch =
        Math.max(
          -0.3,
          Math.min(
            1.2,
            camPitch
          )
        );
    }
  }
);

/* =========================================================
 * MOUSE WHEEL
 * ========================================================= */

canvas.addEventListener(
  'wheel',
  (e) => {
    /*
     * Driving camera zoom
     */
    if (vehicles.isDriving()) {
      driveCamDistance =
        Math.max(
          2,
          Math.min(
            10,
            driveCamDistance +
              e.deltaY * 0.01
          )
        );

      return;
    }

    /*
     * First Person zoom نداریم.
     */
    if (firstPerson) {
      return;
    }

    camDistance =
      Math.max(
        3,
        Math.min(
          15,
          camDistance +
            e.deltaY * 0.01
        )
      );
  },
  {
    passive: true,
  }
);

/* =========================================================
 * KEYBOARD CAMERA
 * ========================================================= */

window.addEventListener(
  'keydown',
  (e) => {
    const key =
      e.key.toLowerCase();

    /*
     * C = First / Third Person
     */
    if (
      key === 'c' &&
      !vehicles.isDriving()
    ) {
      firstPerson =
        !firstPerson;

      if (firstPerson) {
        camPitch =
          Math.max(
            -1.5,
            Math.min(
              1.5,
              camPitch
            )
          );
      } else {
        camPitch =
          Math.max(
            -0.3,
            Math.min(
              1.2,
              camPitch
            )
          );
      }

      applyFirstPersonVisibility();
    }
  }
);

window.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'Escape' &&
      isLocked
    ) {
      openMenu();
    }
  }
);

/* =========================================================
 * SETTINGS MENU
 * ========================================================= */

function openMenu() {
  if (!isMobile) {
    document.exitPointerLock();
  }

  menuEl.classList.add('open');
}

function closeMenu() {
  menuEl.classList.remove(
    'open'
  );

  if (isMobile) {
    return;
  }

  setTimeout(() => {
    canvas.focus();

    canvas.requestPointerLock();
  }, 200);
}

if (closeBtn) {
  closeBtn.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();

      closeMenu();
    }
  );
}

if (sensInput && sensValue) {
  sensInput.addEventListener(
    'input',
    () => {
      sensitivity =
        parseFloat(
          sensInput.value
        );

      sensValue.textContent =
        sensitivity.toFixed(1);
    }
  );
}

/* =========================================================
 * KEY INPUT
 * ========================================================= */

const keys = {};

window.addEventListener(
  'keydown',
  (e) => {
    const key =
      e.key.toLowerCase();

    keys[key] = true;

    /*
     * E:
     * Enter / Exit vehicle
     */
    if (key === 'e') {
      if (vehicles.isDriving()) {
        exitCar();
      } else {
        enterCar();
      }
    }
  }
);

window.addEventListener(
  'keyup',
  (e) => {
    const key =
      e.key.toLowerCase();

    keys[key] = false;
  }
);

/* =========================================================
 * MOBILE VEHICLE INPUT
 * ========================================================= */

/*
 * این دو مقدار مستقل از input بازیکن هستند.
 *
 * gas:
 *   گاز
 *
 * brake:
 *   ترمز واقعی
 *
 * steering:
 *   -1 = راست
 *    0 = صاف
 *   +1 = چپ
 */
let mobileVehicleGas = false;
let mobileVehicleBrake = false;

/* =========================================================
 * MOBILE CONTROLS
 * ========================================================= */

const mobileControls =
  new MobileControls({
    /* -----------------------------------------------------
     * ENTER / EXIT VEHICLE
     * ----------------------------------------------------- */

    onEnterExit: () => {
      if (vehicles.isDriving()) {
        exitCar();
      } else {
        enterCar();
      }
    },

    /* -----------------------------------------------------
     * CAMERA BUTTON
     * ----------------------------------------------------- */

    onCamera: () => {
      /*
       * در ماشین دوربین با Drag کنترل می‌شود.
       */
      if (vehicles.isDriving()) {
        return;
      }

      firstPerson =
        !firstPerson;

      if (firstPerson) {
        camPitch =
          Math.max(
            -1.5,
            Math.min(
              1.5,
              camPitch
            )
          );
      } else {
        camPitch =
          Math.max(
            -0.3,
            Math.min(
              1.2,
              camPitch
            )
          );
      }

      applyFirstPersonVisibility();
    },

    /* -----------------------------------------------------
     * FULLSCREEN
     * ----------------------------------------------------- */

    onFullscreen: async () => {
      try {
        if (
          !document.fullscreenElement
        ) {
          await document.documentElement
            .requestFullscreen({
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
            /*
             * بعضی مرورگرها اجازه
             * orientation lock نمی‌دهند.
             */
          }
        }
      } catch (err) {
        console.warn(
          '[Mobile] Fullscreen failed:',
          err
        );
      }
    },

    /* -----------------------------------------------------
     * JUMP
     * ----------------------------------------------------- */

    onJump: () => {
      /*
       * Player.setInput() کلید Space را
       * به عنوان Jump می‌شناسد.
       *
       * BUG قبلی:
       * mobileControls.key
       *
       * درست:
       * mobileControls.keys
       */

      mobileControls.keys[' '] = true;

      setTimeout(() => {
        mobileControls.keys[' '] = false;
      }, 100);
    },

    /* -----------------------------------------------------
     * SPRINT
     * ----------------------------------------------------- */

    onSprintChange: (active) => {
      mobileControls.keys.shift =
        !!active;
    },

    /* -----------------------------------------------------
     * CAMERA LOOK
     * ----------------------------------------------------- */

    onLook: (dx, dy) => {
      /*
       * وقتی داخل ماشین هستیم:
       * Drag سمت راست/چپ = چرخاندن دوربین ماشین
       */
      if (vehicles.isDriving()) {
        driveCamYaw -=
          dx *
          sensitivity *
          0.004;

        driveCamPitch +=
          dy *
          sensitivity *
          0.004;

        driveCamPitch =
          Math.max(
            -0.3,
            Math.min(
              1.2,
              driveCamPitch
            )
          );

        return;
      }

      /*
       * دوربین بازیکن
       */
      camYaw -=
        dx *
        sensitivity *
        0.004;

      camPitch +=
        dy *
        sensitivity *
        0.004;

      if (firstPerson) {
        camPitch =
          Math.max(
            -1.5,
            Math.min(
              1.5,
              camPitch
            )
          );
      } else {
        camPitch =
          Math.max(
            -0.3,
            Math.min(
              1.2,
              camPitch
            )
          );
      }
    },

    /* -----------------------------------------------------
     * VEHICLE GAS
     * ----------------------------------------------------- */

    onVehicleGas: (active) => {
      mobileVehicleGas =
        !!active;
    },

    /* -----------------------------------------------------
     * VEHICLE BRAKE
     * ----------------------------------------------------- */

    onVehicleBrake: (active) => {
      mobileVehicleBrake =
        !!active;
    },
  });

/* =========================================================
 * VEHICLE CONTROL RESET
 * ========================================================= */

function resetMobileVehicleInput() {
  mobileVehicleGas = false;
  mobileVehicleBrake = false;

  /*
   * MobileControls خودش فرمان را
   * هنگام reset آزاد می‌کند.
   */
  if (
    mobileControls &&
    typeof mobileControls.resetVehicleControls ===
      'function'
  ) {
    mobileControls.resetVehicleControls();
  }
}

/* =========================================================
 * CHARACTER SELECT
 * ========================================================= */

const selectUI =
  new CharacterSelect(
    assets,
    async (letter) => {
      try {
        const {
          model,
          animations,
        } =
          await assets.loadCharacter(
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
 * ENTER CAR
 * ========================================================= */

function enterCar() {
  /*
   * اگر داخل ماشین هستیم،
   * دوباره وارد ماشین نشو.
   */
  if (vehicles.isDriving()) {
    return;
  }

  const playerPosition =
    player.getPosition();

  const vehicle =
    vehicles.findNearestVehicle(
      playerPosition,
      4
    );

  if (!vehicle) {
    return;
  }

  const entered =
    vehicles.enterVehicle(
      vehicle
    );

  if (!entered) {
    return;
  }

  /*
   * ذخیره دوربین بازیکن
   */
  firstPersonBeforeDriving =
    firstPerson;

  /*
   * هنگام رانندگی Third Person
   */
  firstPerson = false;

  /*
   * بازیکن داخل ماشین دیده نشود.
   */
  player.mesh.visible = false;

  /*
   * بازیکن دیگر با world برخورد نکند.
   */
  player.body.collisionResponse =
    false;

  player.body.velocity.set(
    0,
    0,
    0
  );

  /*
   * بازیکن را روی ماشین نگه می‌داریم
   * تا physics/controller آن را
   * جابه‌جا نکند.
   */
  const vehiclePosition =
    vehicle.getPosition();

  player.body.position.set(
    vehiclePosition.x,
    vehiclePosition.y + 1,
    vehiclePosition.z
  );

  /*
   * جهت اولیه دوربین
   * مطابق جهت ماشین.
   */
  driveCamYaw =
    Math.atan2(
      -vehicle
        .getForwardVector()
        .x,
      -vehicle
        .getForwardVector()
        .z
    );

  driveCamPitch = 0.20;

  /*
   * فاصله دوربین را reset می‌کنیم.
   */
  driveCamDistance = 3.0;

  /*
   * مهم:
   * هیچ ورودی قبلی ماشین نباید باقی بماند.
   */
  resetMobileVehicleInput();

  /*
   * Dashboard ماشین
   */
  dashboard.show();

  /*
   * Mobile UI -> Driving Mode
   *
   * در این حالت:
   * - joystick بازیکن مخفی
   * - jump مخفی
   * - sprint مخفی
   * - steering wheel نمایش داده می‌شود
   * - gas نمایش داده می‌شود
   * - brake نمایش داده می‌شود
   */
  mobileControls.setDriving(
    true
  );

  /*
   * دکمه تعامل:
   * E / دکمه موبایل = EXIT
   */
  mobileControls.setInteractable(
    true
  );
}

/* =========================================================
 * EXIT CAR
 * ========================================================= */

function exitCar() {
  if (!vehicles.isDriving()) {
    return;
  }

  const vehicle =
    vehicles.activeVehicle;

  /*
   * اول همه inputهای موبایل را
   * آزاد می‌کنیم تا ماشین بعد از خروج
   * خودش به حرکت ادامه ندهد.
   */
  resetMobileVehicleInput();

  /*
   * خروج از VehicleManager
   */
  vehicles.exitVehicle();

  /*
   * Camera mode را برگردان.
   */
  firstPerson =
    firstPersonBeforeDriving;

  applyFirstPersonVisibility();

  player.mesh.visible = true;

  player.body.collisionResponse =
    true;

  /*
   * بازیکن را پشت ماشین قرار بده.
   */
  if (vehicle) {
    const vehiclePosition =
      vehicle.getPosition();

    const forward =
      vehicle.getForwardVector();

    player.body.position.set(
      vehiclePosition.x -
        forward.x * 2.5,
      vehiclePosition.y + 1,
      vehiclePosition.z -
        forward.z * 2.5
    );

    player.body.velocity.set(
      0,
      0,
      0
    );
  }

  /*
   * Dashboard مخفی
   */
  dashboard.hide();

  /*
   * Mobile UI -> Player Mode
   */
  mobileControls.setDriving(
    false
  );

  /*
   * بررسی اینکه دوباره کنار
   * ماشین هستیم یا نه.
   */
  updateMobileInteraction();
}

/* =========================================================
 * MOBILE VEHICLE INTERACTION
 * ========================================================= */

function updateMobileInteraction() {
  if (!isMobile) {
    return;
  }

  /*
   * داخل ماشین:
   * همیشه دکمه EXIT فعال است.
   */
  if (vehicles.isDriving()) {
    mobileControls.setInteractable(
      true
    );

    return;
  }

  /*
   * بیرون ماشین:
   * فقط وقتی نزدیک ماشین هستیم
   * دکمه ENTER نمایش داده شود.
   */
  const playerPosition =
    player.getPosition();

  const nearestVehicle =
    vehicles.findNearestVehicle(
      playerPosition,
      4
    );

  mobileControls.setInteractable(
    !!nearestVehicle
  );
}

/* =========================================================
 * RESIZE
 * ========================================================= */

window.addEventListener(
  'resize',
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight,
      false
    );
  }
);

/* =========================================================
 * PLAYER CAMERA
 * ========================================================= */

function updatePlayerCamera(dt) {
  const position =
    player.getPosition();

  /* -------------------------------------------------------
   * FIRST PERSON
   * ------------------------------------------------------- */

  if (firstPerson) {
    const eyeY =
      position.y +
      EYE_HEIGHT;

    const cosPitch =
      Math.cos(camPitch);

    const dirX =
      -Math.sin(camYaw) *
      cosPitch;

    const dirY =
      -Math.sin(camPitch);

    const dirZ =
      -Math.cos(camYaw) *
      cosPitch;

    camera.position.set(
      position.x,
      eyeY,
      position.z
    );

    camera.lookAt(
      position.x + dirX,
      eyeY + dirY,
      position.z + dirZ
    );

    return;
  }

  /* -------------------------------------------------------
   * THIRD PERSON
   * ------------------------------------------------------- */

  const velocity =
    player.body.velocity;

  const speed =
    Math.hypot(
      velocity.x,
      velocity.z
    );

  const speedRatio =
    Math.min(
      1,
      speed /
        player.sprintSpeed
    );

  /*
   * نکته مهم:
   *
   * روی موبایل باید joystick را
   * هم در wantsMove لحاظ کنیم.
   */
  const inputKeys =
    isMobile
      ? {
          ...keys,
          ...mobileControls.getKeys(),
        }
      : keys;

  const wantsMove =
    !!(
      inputKeys.w ||
      inputKeys.a ||
      inputKeys.s ||
      inputKeys.d
    );

  const targetDistance =
    camDistance +
    speedRatio * 0.8 +
    (wantsMove ? 0.2 : 0);

  cameraDistanceSmooth +=
    (
      targetDistance -
      cameraDistanceSmooth
    ) *
    (
      1 -
      Math.exp(
        -8 * dt
      )
    );

  const target =
    new THREE.Vector3(
      position.x,
      position.y + 1.0,
      position.z
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
    1 -
      Math.exp(
        -12 * dt
      )
  );

  camera.lookAt(target);
}

/* =========================================================
 * DRIVING CAMERA
 * ========================================================= */

function updateDrivingCamera(dt) {
  const vehicle =
    vehicles.activeVehicle;

  if (!vehicle) {
    return;
  }

  const vehiclePosition =
    vehicle.getPosition();

  /*
   * نقطه‌ای که دوربین به آن نگاه می‌کند.
   */
  const target =
    new THREE.Vector3(
      vehiclePosition.x,
      vehiclePosition.y + 0.7,
      vehiclePosition.z
    );

  const horizontalDistance =
    driveCamDistance *
    Math.cos(
      driveCamPitch
    );

  const offsetX =
    Math.sin(
      driveCamYaw
    ) *
    horizontalDistance;

  const offsetZ =
    Math.cos(
      driveCamYaw
    ) *
    horizontalDistance;

  const offsetY =
    driveCamDistance *
    Math.sin(
      driveCamPitch
    ) +
    0.8;

  const desired =
    new THREE.Vector3(
      vehiclePosition.x +
        offsetX,
      vehiclePosition.y +
        offsetY,
      vehiclePosition.z +
        offsetZ
    );

  camera.position.lerp(
    desired,
    1 -
      Math.exp(
        -15 * dt
      )
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
  if (!gameStarted) {
    return;
  }

  requestAnimationFrame(
    animate
  );

  const now =
    performance.now();

  const dt =
    Math.min(
      (now - last) / 1000,
      0.05
    );

  last = now;

  /* =====================================================
   * CHARACTER SELECT UPDATE
   * ===================================================== */

  if (!selectUI.isHidden) {
    selectUI.update(dt);
  }

  /* =====================================================
   * DRIVING STATE
   * ===================================================== */

  const driving =
    vehicles.isDriving();

  /* =====================================================
   * MOBILE INTERACTION
   * ===================================================== */

  if (
    isMobile &&
    now - lastChunkCheck >
      100
  ) {
    updateMobileInteraction();
  }

  /* =====================================================
   * INPUT
   * ===================================================== */

  if (
    isLocked ||
    isMobile
  ) {
    /*
     * Desktop:
     * فقط keyboard
     *
     * Mobile:
     * keyboard + mobile controls
     */
    const inputKeys =
      isMobile
        ? {
            ...keys,
            ...mobileControls.getKeys(),
          }
        : keys;

    /* ===================================================
     * VEHICLE INPUT
     * =================================================== */

    if (driving) {
      const vehicle =
        vehicles.activeVehicle;

      if (vehicle) {
        /*
         * ورودی ماشین موبایل
         *
         * w:
         *   gas
         *
         * brake:
         *   ترمز واقعی
         *
         * steeringOverride:
         *   فرمان لمسی
         */
        const vehicleInput = {
          ...inputKeys,

          /*
           * گاز موبایل
           */
          w:
            isMobile
              ? mobileVehicleGas
              : inputKeys.w,

          /*
           * ترمز موبایل
           *
           * توجه:
           * این با S فرق دارد.
           * S دسکتاپ همچنان Reverse است.
           */
          brake:
            isMobile
              ? mobileVehicleBrake
              : !!inputKeys.brake,
        };

        /*
         * steering:
         *
         * موبایل:
         * MobileControls.getSteering()
         *
         * دسکتاپ:
         * null -> Vehicle خودش A/D را می‌خواند
         */
        const steeringOverride =
          isMobile
            ? mobileControls.getSteering()
            : null;

        vehicle.setInput(
          vehicleInput,
          vehicle.getForwardSpeed(),
          steeringOverride,
          dt
        );
      }
    }

    /* ===================================================
     * PLAYER INPUT
     * =================================================== */

    else {
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
    const vehicle =
      vehicles.activeVehicle;

    if (vehicle) {
      vehicle.update(dt);
    }
  } else {
    player.syncVisual(dt);

    if (firstPerson) {
      player.mesh.rotation.y =
        camYaw +
        Math.PI;
    }
  }

  /*
   * VehicleManager update
   */
  vehicles.update(dt);

  /* =====================================================
   * CAMERA
   * ===================================================== */

  if (driving) {
    updateDrivingCamera(dt);

    const vehicle =
      vehicles.activeVehicle;

    if (vehicle) {
      dashboard.update(
        vehicle.getSpeed(),
        vehicle.getForwardSpeed(),
        vehicle.getCurrentGear(),
        vehicle.gears
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

    /* ---------------------------------------------------
     * Driving
     * --------------------------------------------------- */

    if (
      driving &&
      vehicles.activeVehicle
    ) {
      const vehiclePosition =
        vehicles.activeVehicle
          .getPosition();

      const cityPosition =
        new THREE.Vector3(
          vehiclePosition.x,
          0,
          vehiclePosition.z
        );

      world.city.updatePlayerPosition(
        cityPosition
      );

      vehicles.updateChunks(
        vehiclePosition.x,
        vehiclePosition.z,
        world.city.chunkSize,
        world.city.renderDistance
      );
    }

    /* ---------------------------------------------------
     * Walking
     * --------------------------------------------------- */

    else {
      const playerPosition =
        player.body.position;

      const cityPosition =
        new THREE.Vector3(
          playerPosition.x,
          0,
          playerPosition.z
        );

      world.city.updatePlayerPosition(
        cityPosition
      );

      vehicles.updateChunks(
        playerPosition.x,
        playerPosition.z,
        world.city.chunkSize,
        world.city.renderDistance
      );

      vehicles.updateActive(
        new THREE.Vector3(
          playerPosition.x,
          0,
          playerPosition.z
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

let mobileOrientationMessage =
  null;

function showPortraitBlocker() {
  if (!isMobile) {
    return;
  }

  if (!mobileOrientationMessage) {
    mobileOrientationMessage =
      document.createElement(
        'div'
      );

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

let initializationStarted =
  false;

async function startGame() {
  if (initializationStarted) {
    return;
  }

  /*
   * روی موبایل عمودی:
   * اصلاً بازی Load نمی‌شود.
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

    const playerPosition =
      player.body.position;

    await world.city
      .updatePlayerPosition(
        new THREE.Vector3(
          playerPosition.x,
          0,
          playerPosition.z
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
      playerPosition.x,
      playerPosition.z,
      world.city.chunkSize,
      world.city.renderDistance
    );

    /*
     * Initial player camera
     */
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

    loadingEl.classList.add(
      'hidden'
    );

    const errorEl =
      document.createElement(
        'div'
      );

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
       * اگر هنوز بازی شروع نشده،
       * بعد از افقی شدن شروعش کن.
       */
      if (!gameStarted) {
        startGame();
      }
    }, 150);
  }
);

/* =========================================================
 * RESIZE / ORIENTATION
 * ========================================================= */

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
window.__mobileControls =
  mobileControls;

window.__getLocked =
  () => isLocked;

window.__isFirstPerson =
  () => firstPerson;

window.__enterCar =
  enterCar;

window.__exitCar =
  exitCar;

window.__getMobileVehicleInput =
  () => ({
    gas: mobileVehicleGas,
    brake: mobileVehicleBrake,
    steering:
      mobileControls.getSteering(),
  });