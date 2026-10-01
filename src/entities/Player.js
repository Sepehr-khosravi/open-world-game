import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { KinematicBody } from '../physics/KinematicBody.js';

export class Player {
  constructor(physics) {
    this.physics = physics;

    // =========================
    // Mesh
    // =========================

    this.mesh = new THREE.Group();
    this.mesh.name = 'Player';

    // =========================
    // Physics
    // =========================

    this.body = new CANNON.Body({
      mass: 70,

      material: physics.playerMaterial,

      shape: new CANNON.Sphere(0.5),

      position: new CANNON.Vec3(0, 1, 0),

      linearDamping: 0,
      angularDamping: 1,
    });

    this.body.fixedRotation = true;
    this.body.updateMassProperties();

    this.body.allowSleep = false;

    physics.world.addBody(this.body);

    // =========================
    // Movement controller
    // =========================

    this.controller = new KinematicBody(this.body, {
      maxSpeed: 7,

      // زمان رسیدن به حدود 90% سرعت
      accelTime: 0.35,

      // زمان توقف
      decelTime: 0.22,

      // سرعت تغییر جهت
      turnSpeed: 16,
    });

    this.maxSpeed = 7;
    this.sprintSpeed = 11;

    this.isMoving = false;
    this.isSprinting = false;

    this.moveInput = null;

    // جهت نگاه کاراکتر
    this.facing = 0;

    // =========================
    // Jump
    // =========================

    this.isOnGround = false;

    this.jumpCooldown = 0;

    this.jumpForce = 12;

    this._prevSpace = false;

    // =========================
    // One shot animations
    // =========================

    this.oneShotTimer = 0;
    this.oneShotName = null;

    // =========================
    // Holding animations
    // =========================

    this.holdState = null;

    this._prevKeys = {};

    // =========================
    // Model / animation
    // =========================

    this.model = null;

    this.mixer = null;

    this.actions = {};

    this.currentActionName = null;

    this.fadeTime = 0.12;

    // =========================
    // One-shot key map
    // =========================

    this.keyMap = {
      j: {
        name: 'attack-melee-right',
        duration: 0.42,
      },

      l: {
        name: 'attack-melee-left',
        duration: 0.42,
      },

      k: {
        name: 'attack-kick-right',
        duration: 0.58,
      },

      h: {
        name: 'attack-kick-left',
        duration: 0.58,
      },

      e: {
        name: 'interact-right',
        duration: 0.67,
      },

      q: {
        name: 'interact-left',
        duration: 0.67,
      },

      f: {
        name: 'pick-up',
        duration: 0.33,
      },

      1: {
        name: 'emote-yes',
        duration: 0.67,
      },

      2: {
        name: 'emote-no',
        duration: 0.67,
      },

      3: {
        name: 'die',
        duration: 0.33,
      },

      4: {
        name: 'sit',
        duration: 0.17,
      },

      5: {
        name: 'drive',
        duration: 0.17,
      },
    };

    this.holdKeyMap = {
      z: 'holding-right',
      x: 'holding-left',
      c: 'holding-both',
    };
  }

  // ============================================================
  // MODEL
  // ============================================================

  setModel(model, animations) {
    if (this.model) {
      this.mesh.remove(this.model);
    }

    // -------------------------
    // Normalize model height
    // -------------------------

    const box = new THREE.Box3().setFromObject(model);

    const size = new THREE.Vector3();

    box.getSize(size);

    if (size.y > 0) {
      const scale = 1.8 / size.y;

      model.scale.setScalar(scale);
    }

    // -------------------------
    // Put model feet on origin
    // -------------------------

    const box2 = new THREE.Box3().setFromObject(model);

    const center = new THREE.Vector3();

    box2.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;

    model.position.y -= box2.min.y;

    // -------------------------
    // Shadows
    // -------------------------

    model.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;

      // اگر مدل پیچیده شد، می‌توانی بعداً
      // این را true کنی.
      node.frustumCulled = false;
    });

    this.model = model;

    this.mesh.add(model);

    // -------------------------
    // Animation mixer
    // -------------------------

    this.mixer = new THREE.AnimationMixer(model);

    this.actions = {};

    for (const clip of animations) {
      const name = clip.name.toLowerCase();

      const action = this.mixer.clipAction(clip);

      this.actions[name] = action;
    }

    console.log(
      'Player animations:',
      Object.keys(this.actions)
    );

    this._play('idle', 0);
  }

  // ============================================================
  // ANIMATION
  // ============================================================

  _play(name, fade = this.fadeTime, once = false) {
    const action = this.actions[name];

    if (!action) {
      return;
    }

    if (
      this.currentActionName === name &&
      !once
    ) {
      return;
    }

    const previous =
      this.currentActionName
        ? this.actions[this.currentActionName]
        : null;

    // Reset
    action.reset();

    // Loop configuration
    if (once) {
      action.setLoop(
        THREE.LoopOnce,
        1
      );

      action.clampWhenFinished = true;
    } else {
      action.setLoop(
        THREE.LoopRepeat,
        Infinity
      );

      action.clampWhenFinished = false;
    }

    // جلوگیری از پرش هنگام شروع
    action.enabled = true;

    if (fade > 0) {
      action.fadeIn(fade);
    }

    action.play();

    if (
      previous &&
      previous !== action
    ) {
      if (fade > 0) {
        previous.fadeOut(fade);
      } else {
        previous.stop();
      }
    }

    this.currentActionName = name;
  }

  _triggerOneShot(name, duration) {
    // اجازه نده animation جدید وسط قبلی
    // دائم override شود.
    if (this.oneShotTimer > 0) {
      return;
    }

    if (!this.actions[name]) {
      return;
    }

    this.oneShotName = name;

    this.oneShotTimer = duration;

    this._play(
      name,
      0.08,
      true
    );
  }

  // ============================================================
  // INPUT
  // ============================================================

  setInput(keys, cameraYaw) {
    // -------------------------
    // WASD
    // -------------------------

    const forward =
      (keys.w || keys.arrowup ? 1 : 0) -
      (keys.s || keys.arrowdown ? 1 : 0);

    const strafe =
      (keys.d || keys.arrowright ? 1 : 0) -
      (keys.a || keys.arrowleft ? 1 : 0);

    const length =
      Math.hypot(
        forward,
        strafe
      );

    if (length > 0) {
      this.isMoving = true;

      this.moveInput = {
        forward: forward / length,
        strafe: strafe / length,
      };
    } else {
      this.isMoving = false;

      this.moveInput = null;
    }

    // -------------------------
    // Sprint
    // -------------------------

    this.isSprinting =
      !!keys.shift &&
      this.isMoving;

    // -------------------------
    // Jump
    // -------------------------

    const spaceNow = !!keys[' '];

    if (
      spaceNow &&
      !this._prevSpace &&
      this.isOnGround &&
      this.jumpCooldown <= 0
    ) {
      this._jump();
    }

    this._prevSpace = spaceNow;

    // -------------------------
    // One-shot keys
    // -------------------------

    for (const [
      key,
      info
    ] of Object.entries(this.keyMap)) {
      const pressed = !!keys[key];

      const wasPressed =
        !!this._prevKeys[key];

      if (
        pressed &&
        !wasPressed
      ) {
        this._triggerOneShot(
          info.name,
          info.duration
        );
      }

      this._prevKeys[key] = pressed;
    }

    // -------------------------
    // Holding
    // -------------------------

    let activeHold = null;

    for (const [
      key,
      animation
    ] of Object.entries(this.holdKeyMap)) {
      if (keys[key]) {
        activeHold = animation;
        break;
      }
    }

    this.holdState = activeHold;
  }

  // ============================================================
  // JUMP
  // ============================================================

  _jump() {
    this.body.velocity.y = this.jumpForce;

    this.isOnGround = false;

    this.jumpCooldown = 0.35;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt, cameraYaw) {
    dt = Math.min(dt, 0.05);

    // -------------------------
    // Timers
    // -------------------------

    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= dt;
    }

    // -------------------------
    // Ground detection
    // -------------------------

    /*
     * فعلاً چون body یک Sphere با radius = 0.5 است،
     * مرکز آن وقتی روی زمین است تقریباً y = 0.5 خواهد بود.
     *
     * بعداً بهتر است این قسمت را با raycast/contact
     * جایگزین کنیم.
     */

    const groundY = 0.5;

    this.isOnGround =
      this.body.position.y <= groundY + 0.08 &&
      this.body.velocity.y <= 1.5;

    // -------------------------
    // Movement direction
    // -------------------------

    if (
      this.isMoving &&
      this.moveInput
    ) {
      const sinY = Math.sin(cameraYaw);
      const cosY = Math.cos(cameraYaw);

      // Forward camera direction
      const forwardX = -sinY;
      const forwardZ = -cosY;

      // Right camera direction
      const rightX = cosY;
      const rightZ = -sinY;

      const moveX =
        forwardX * this.moveInput.forward +
        rightX * this.moveInput.strafe;

      const moveZ =
        forwardZ * this.moveInput.forward +
        rightZ * this.moveInput.strafe;

      this.controller.setDirection(
        moveX,
        moveZ,
        true
      );

      this.controller.maxSpeed =
        this.isSprinting
          ? this.sprintSpeed
          : this.maxSpeed;

      // -------------------------
      // Face movement direction
      // -------------------------

      const targetYaw =
        Math.atan2(
          moveX,
          moveZ
        );

      const rotationSpeed =
        this.isSprinting
          ? 15
          : 12;

      const rotationT =
        1 -
        Math.exp(
          -rotationSpeed * dt
        );

      this.facing =
        this._lerpAngle(
          this.facing,
          targetYaw,
          rotationT
        );
    } else {
      this.controller.setDirection(
        0,
        0,
        false
      );
    }

    // -------------------------
    // Physics movement
    // -------------------------

    this.controller.update(dt);

    // -------------------------
    // Animation
    // -------------------------

    this._updateAnimation(dt);

    // -------------------------
    // Mixer
    // -------------------------

    if (this.mixer) {
      this.mixer.update(dt);
    }

    // -------------------------
    // Sync mesh
    // -------------------------

    this._updateMesh(dt);
  }

  // ============================================================
  // ANIMATION STATE
  // ============================================================

  _updateAnimation(dt) {
    // -------------------------
    // One-shot
    // -------------------------

    if (this.oneShotTimer > 0) {
      this.oneShotTimer -= dt;

      if (this.oneShotTimer <= 0) {
        this.oneShotTimer = 0;
        this.oneShotName = null;

        // بعد از animation برگرد
        // به state اصلی
        this._updateLocomotionAnimation();
      }

      return;
    }

    // -------------------------
    // Holding
    // -------------------------

    if (this.holdState) {
      if (
        this.currentActionName !==
        this.holdState
      ) {
        this._play(
          this.holdState,
          0.15
        );
      }

      return;
    }

    // -------------------------
    // Locomotion
    // -------------------------

    this._updateLocomotionAnimation();
  }

  _updateLocomotionAnimation() {
    const speed =
      this.controller.getHorizontalSpeed();

    // threshold کوچک برای جلوگیری از
    // idle/walk flickering
    const moving =
      speed > 0.15;

    if (!moving) {
      if (
        this.currentActionName !== 'idle'
      ) {
        this._play(
          'idle',
          0.15
        );
      }

      return;
    }

    const target =
      this.isSprinting &&
      speed > this.maxSpeed * 0.75
        ? 'sprint'
        : 'walk';

    if (
      this.currentActionName !== target
    ) {
      this._play(
        target,
        0.12
      );
    }
  }

  // ============================================================
  // MESH SYNC
  // ============================================================

  _updateMesh(dt) {
    const targetX =
      this.body.position.x;

    /*
     * چون Sphere مرکز body است و radius آن 0.5 است،
     * mesh را نیم متر پایین‌تر قرار می‌دهیم.
     */
    const targetY =
      this.body.position.y - 0.5;

    const targetZ =
      this.body.position.z;

    /*
     * interpolation مستقل از FPS
     *
     * به جای:
     *
     * position += difference * 0.6
     *
     * که به FPS وابسته است.
     */

    const followSpeed = 20;

    const t =
      1 -
      Math.exp(
        -followSpeed * dt
      );

    this.mesh.position.x +=
      (targetX - this.mesh.position.x) * t;

    this.mesh.position.y +=
      (targetY - this.mesh.position.y) * t;

    this.mesh.position.z +=
      (targetZ - this.mesh.position.z) * t;

    this.mesh.rotation.y =
      this.facing;
  }

  // ============================================================
  // ANGLE LERP
  // ============================================================

  _lerpAngle(a, b, t) {
    let diff = b - a;

    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }

    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }

    return (
      a +
      diff *
      Math.min(1, t)
    );
  }

  // ============================================================
  // POSITION
  // ============================================================

  getPosition() {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
  }

  // ============================================================
  // SPEED
  // ============================================================

  getSpeed() {
    return this.controller.getHorizontalSpeed();
  }
}