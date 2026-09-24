import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { KinematicBody } from '../physics/KinematicBody.js';

export class Player {
  constructor(physics) {
    this.physics = physics;

    this.mesh = new THREE.Group();
    this.mesh.name = 'Player';

    // === فیزیک ===
    this.body = new CANNON.Body({
      mass: 70,
      material: physics.playerMaterial,
      shape: new CANNON.Sphere(0.5),
      position: new CANNON.Vec3(0, 1, 0),
      linearDamping: 0.0,
      angularDamping: 1,
    });
    this.body.fixedRotation = true;
    this.body.updateMassProperties();
    this.body.allowSleep = false;
    physics.world.addBody(this.body);

    this.controller = new KinematicBody(this.body, {
      maxSpeed: 7,
      accelTime: 0.4,   // ۰.۴ ثانیه تا ۹۰٪ سرعت (نرم)
      decelTime: 0.3,   // ۰.۳ ثانیه برای توقف
    });

    // === حالت ===
    this.maxSpeed = 7;
    this.sprintSpeed = 11;
    this.isMoving = false;
    this.isSprinting = false;
    this.facing = 0;

    // === پرش ===
    this.isOnGround = false;
    this.jumpCooldown = 0;
    this._prevSpace = false;

    // === اکشن یک‌باره ===
    this.oneShotTimer = 0;
    this.oneShotName = null;

    // === holding ===
    this.holdState = null;
    this._prevKeys = {};

    // === مدل و انیمیشن ===
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.currentActionName = null;
    this.fadeTime = 0.15;

    // === نقشه‌ی کلید → انیمیشن ===
    this.keyMap = {
      'j': { name: 'attack-melee-right', duration: 0.42 },
      'l': { name: 'attack-melee-left', duration: 0.42 },
      'k': { name: 'attack-kick-right', duration: 0.58 },
      'h': { name: 'attack-kick-left', duration: 0.58 },
      'e': { name: 'interact-right', duration: 0.67 },
      'q': { name: 'interact-left', duration: 0.67 },
      'f': { name: 'pick-up', duration: 0.33 },
      '1': { name: 'emote-yes', duration: 0.67 },
      '2': { name: 'emote-no', duration: 0.67 },
      '3': { name: 'die', duration: 0.33 },
      '4': { name: 'sit', duration: 0.17 },
      '5': { name: 'drive', duration: 0.17 },
    };

    this.holdKeyMap = {
      'z': 'holding-right',
      'x': 'holding-left',
      'c': 'holding-both',
    };
  }

  setModel(model, animations) {
    if (this.model) this.mesh.remove(this.model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 1.8 / size.y;
    model.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;

    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });

    this.model = model;
    this.mesh.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      this.actions[clip.name.toLowerCase()] = action;
    });

    console.log('Actions ready:', Object.keys(this.actions).length);
    this._play('idle');
  }

  _play(name, fade = this.fadeTime, once = false) {
    const action = this.actions[name];
    if (!action) return;
    if (this.currentActionName === name && !once) return;

    const prev = this.currentActionName ? this.actions[this.currentActionName] : null;

    action.reset();
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    action.fadeIn(fade);
    action.play();

    if (prev && prev !== action) prev.fadeOut(fade);

    this.currentActionName = name;
  }

  _triggerOneShot(name, duration) {
    if (this.oneShotTimer > 0.1) return;
    this.oneShotName = name;
    this.oneShotTimer = duration;
    this._play(name, 0.08, true);
  }

  setInput(keys, _cameraYaw) {
    const forward =
      (keys['w'] || keys['arrowup'] ? 1 : 0) -
      (keys['s'] || keys['arrowdown'] ? 1 : 0);
    const strafe =
      (keys['d'] || keys['arrowright'] ? 1 : 0) -
      (keys['a'] || keys['arrowleft'] ? 1 : 0);

    const len = Math.hypot(forward, strafe);
    if (len > 0) {
      this.isMoving = true;
      this.moveInput = { forward: forward / len, strafe: strafe / len };
    } else {
      this.isMoving = false;
      this.moveInput = null;
    }

    this.isSprinting = !!keys['shift'] && this.isMoving;

    const spaceNow = !!keys[' '];
    if (spaceNow && !this._prevSpace && this.isOnGround && this.jumpCooldown <= 0) {
      this._jump();
    }
    this._prevSpace = spaceNow;

    for (const [key, info] of Object.entries(this.keyMap)) {
      const pressed = !!keys[key];
      const wasPressed = !!this._prevKeys[key];
      if (pressed && !wasPressed) {
        this._triggerOneShot(info.name, info.duration);
      }
      this._prevKeys[key] = pressed;
    }

    let activeHold = null;
    for (const [key, animName] of Object.entries(this.holdKeyMap)) {
      if (keys[key]) {
        activeHold = animName;
        break;
      }
    }
    this.holdState = activeHold;
  }

  _jump() {
    this.body.velocity.y = 12;
    this.isOnGround = false;
    this.jumpCooldown = 0.35;
  }

  update(dt, cameraYaw) {
    // === تشخیص زمین ===
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

    if (this.body.position.y < 0.65 && Math.abs(this.body.velocity.y) < 2) {
      this.isOnGround = true;
    } else {
      this.isOnGround = false;
    }

    // === جهت حرکت ===
    if (this.isMoving && this.moveInput) {
      const sinY = Math.sin(cameraYaw);
      const cosY = Math.cos(cameraYaw);

      const forwardX = -sinY;
      const forwardZ = -cosY;
      const rightX = cosY;
      const rightZ = -sinY;

      const mx = forwardX * this.moveInput.forward + rightX * this.moveInput.strafe;
      const mz = forwardZ * this.moveInput.forward + rightZ * this.moveInput.strafe;

      this.controller.setDirection(mx, mz, true);
      this.controller.maxSpeed = this.isSprinting ? this.sprintSpeed : this.maxSpeed;

      const targetYaw = Math.atan2(mx, mz);
      this.facing = this._lerpAngle(this.facing, targetYaw, dt * 12);
    } else {
      this.controller.setDirection(0, 0, false);
    }

    // ⚠️ کنترلر سرعت رو با شتاب آپدیت می‌کنه
    this.controller.update(dt);

    // === اولویت انیمیشن ===
    if (this.oneShotTimer > 0) {
      this.oneShotTimer -= dt;
      if (this.oneShotTimer <= 0) {
        this.oneShotTimer = 0;
        this.oneShotName = null;
      }
    } else if (this.holdState) {
      if (this.currentActionName !== this.holdState) this._play(this.holdState, 0.2);
    } else if (this.isMoving) {
      const target = this.isSprinting ? 'sprint' : 'walk';
      if (this.currentActionName !== target) this._play(target);
    } else {
      if (this.currentActionName !== 'idle') this._play('idle');
    }

    if (this.mixer) this.mixer.update(dt);

    // === موقعیت mesh با درون‌یابی ===
    const targetX = this.body.position.x;
    const targetY = this.body.position.y - 0.5;
    const targetZ = this.body.position.z;

    // ضریب درون‌یابی — هرچی بزرگ‌تر، سریع‌تر هماهنگ می‌شه
    // 0.5 = خیلی نرم ولی با تأخیر
    // 0.9 = هماهنگ، تقریباً بدون تأخیر
    const meshLerp = 0.6;

    this.mesh.position.x += (targetX - this.mesh.position.x) * meshLerp;
    this.mesh.position.y += (targetY - this.mesh.position.y) * meshLerp;
    this.mesh.position.z += (targetZ - this.mesh.position.z) * meshLerp;

    this.mesh.rotation.y = this.facing;
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * Math.min(1, t);
  }

  getPosition() {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
  }
}