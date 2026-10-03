import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { KinematicBody } from '../physics/KinematicBody.js';

export class Player {
  constructor(physics) {
    this.physics = physics;

    // ============================================================
    // VISUAL
    // ============================================================

    this.mesh = new THREE.Group();
    this.mesh.name = 'Player';

    // ============================================================
    // PHYSICS BODY
    // ============================================================

    this.body = new CANNON.Body({
      mass: 70,
      material: physics.playerMaterial,

      shape: new CANNON.Sphere(0.5),

      position: new CANNON.Vec3(
        0,
        1,
        0
      ),

      linearDamping: 0,
      angularDamping: 1,

      fixedRotation: true,
      allowSleep: false,
    });

    this.body.updateMassProperties();

    physics.world.addBody(this.body);

    // ============================================================
    // MOVEMENT
    // ============================================================

    this.controller = new KinematicBody(
      this.body,
      {
        maxSpeed: 6,
        accelTime: 0.2,
        decelTime: 0.14,
        turnSpeed: 12,
      }
    );

    this.maxSpeed = 6;
    this.sprintSpeed = 10;

    this.isMoving = false;
    this.isSprinting = false;

    this.moveInput = null;
    this.facing = 0;

    // ============================================================
    // JUMP
    // ============================================================

    this.playerRadius = 0.5;

    /*
     * Gravity is handled by Cannon.
     *
     * With gravity = -12 and jumpForce = 8.5:
     *
     * Time to apex:
     *     8.5 / 12 ≈ 0.71 sec
     *
     * Total jump:
     *     ≈ 1.42 sec
     *
     * This gives the player noticeably more time in the air.
     */
    this.jumpForce = 6.5;

    this.isOnGround = false;

    this.jumpCooldown = 0;

    this.jumpCooldownDuration = 0.12;

    this._prevSpace = false;

    /*
     * This remains true from jump until we actually
     * touch the ground again.
     */
    this._isJumping = false;

    /*
     * Prevents ground detection from changing state
     * during the same frame as the jump.
     */
    this._justJumped = false;

    // ============================================================
    // ANIMATION
    // ============================================================

    this.oneShotTimer = 0;
    this.oneShotName = null;
    this.holdState = null;

    this.model = null;
    this.mixer = null;

    this.actions = {};
    this.currentActionName = null;

    this.fadeTime = 0.12;

    // ============================================================
    // ONE SHOT KEYS
    // ============================================================

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
    };

    // ============================================================
    // HOLD KEYS
    // ============================================================

    this.holdKeyMap = {
      z: 'holding-right',
      x: 'holding-left',
      v: 'holding-both',
    };

    this._prevKeys = {};
  }

  // ============================================================
  // MODEL
  // ============================================================

  setModel(model, animations = []) {
    if (this.model) {
      this.mesh.remove(this.model);
    }

    // ------------------------------------------------------------
    // Normalize model size
    // ------------------------------------------------------------

    const box =
      new THREE.Box3().setFromObject(model);

    const size =
      new THREE.Vector3();

    box.getSize(size);

    if (size.y > 0) {
      const scale =
        1.5 / size.y;

      model.scale.setScalar(scale);
    }

    // ------------------------------------------------------------
    // Put feet on local Y = 0
    // ------------------------------------------------------------

    const box2 =
      new THREE.Box3().setFromObject(model);

    const center =
      new THREE.Vector3();

    box2.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;

    model.rotation.set(
      0,
      0,
      0
    );

    // ------------------------------------------------------------
    // Shadows
    // ------------------------------------------------------------

    model.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;

      node.frustumCulled = false;
    });

    // ------------------------------------------------------------
    // Store model
    // ------------------------------------------------------------

    this.model = model;

    this.mesh.add(model);

    // ------------------------------------------------------------
    // Animation mixer
    // ------------------------------------------------------------

    this.mixer =
      new THREE.AnimationMixer(model);

    this.actions = {};

    for (const clip of animations) {
      const name =
        clip.name.toLowerCase();

      const action =
        this.mixer.clipAction(clip);

      this.actions[name] = action;
    }

    console.log(
      '[Player] Animations:',
      Object.keys(this.actions)
    );

    this._play(
      'idle',
      0
    );
  }

  // ============================================================
  // PLAY ANIMATION
  // ============================================================

  _play(
    name,
    fade = this.fadeTime,
    once = false
  ) {
    const action =
      this.actions[name];

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
        ? this.actions[
            this.currentActionName
          ]
        : null;

    action.reset();

    if (once) {
      action.setLoop(
        THREE.LoopOnce,
        1
      );

      action.clampWhenFinished =
        true;
    } else {
      action.setLoop(
        THREE.LoopRepeat,
        Infinity
      );

      action.clampWhenFinished =
        false;
    }

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

  // ============================================================
  // ONE SHOT
  // ============================================================

  _triggerOneShot(
    name,
    duration
  ) {
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

  setInput(
    keys,
    cameraYaw
  ) {
    // ==========================================================
    // MOVEMENT
    // ==========================================================

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
        forward:
          forward / length,

        strafe:
          strafe / length,
      };
    } else {
      this.isMoving = false;
      this.moveInput = null;
    }

    // ==========================================================
    // SPRINT
    // ==========================================================

    this.isSprinting =
      !!keys.shift &&
      this.isMoving;

    // ==========================================================
    // JUMP
    // ==========================================================

  const spaceNow =
    !!keys[' '] ||
    !!keys.space;
  
  const jumpPressed =
    spaceNow &&
    !this._prevSpace;

    if (
      jumpPressed &&
      this.isOnGround &&
      this.jumpCooldown <= 0
    ) {
      this._jump();
    }

    this._prevSpace =
      spaceNow;

    // ==========================================================
    // ONE SHOT ANIMATIONS
    // ==========================================================

    for (
      const [key, info]
      of Object.entries(this.keyMap)
    ) {
      const pressed =
        !!keys[key];

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

      this._prevKeys[key] =
        pressed;
    }

    // ==========================================================
    // HOLD ANIMATIONS
    // ==========================================================

    let activeHold = null;

    for (
      const [key, animation]
      of Object.entries(
        this.holdKeyMap
      )
    ) {
      if (keys[key]) {
        activeHold = animation;
        break;
      }
    }

    this.holdState =
      activeHold;
  }

  // ============================================================
  // JUMP
  // ============================================================

  _jump() {
    /*
     * Completely replace vertical velocity.
     *
     * If Cannon has a small downward velocity while standing,
     * it must not weaken the jump.
     */
    this.body.velocity.y =
      this.jumpForce;

    this.isOnGround =
      false;

    this._isJumping =
      true;

    this._justJumped =
      true;

    this.jumpCooldown =
      this.jumpCooldownDuration;

    this.body.wakeUp();

    console.log(
      '[Player] JUMP',
      'velocityY:',
      this.body.velocity.y
    );
  }

  // ============================================================
  // GROUND DETECTION
  // ============================================================

  _updateGroundState() {
    const body =
      this.body;

    // ----------------------------------------------------------
    // Jump protection
    // ----------------------------------------------------------

    /*
     * If we're moving upward, we're definitely not grounded.
     */
    if (
      body.velocity.y > 0.2
    ) {
      this.isOnGround = false;
      return;
    }

    /*
     * Immediately after jumping, don't let the raycast
     * flip us back to grounded.
     */
    if (this._justJumped) {
      this.isOnGround = false;

      /*
       * Clear this flag once the physics has had a chance
       * to process the jump.
       */
      this._justJumped = false;

      return;
    }

    // ----------------------------------------------------------
    // Raycast
    // ----------------------------------------------------------

    const from =
      new CANNON.Vec3(
        body.position.x,
        body.position.y -
          this.playerRadius +
          0.08,
        body.position.z
      );

    const to =
      new CANNON.Vec3(
        body.position.x,
        body.position.y -
          this.playerRadius -
          0.18,
        body.position.z
      );

    let foundGround =
      false;

    let closestDistance =
      Infinity;

    this.physics.world.raycastAll(
      from,
      to,
      {
        skipBackfaces: true,
      },
      (result) => {
        if (!result.hasHit) {
          return;
        }

        if (
          result.body ===
          this.body
        ) {
          return;
        }

        /*
         * We only care about surfaces that are actually
         * below the player.
         */
        const normal =
          result.hitNormalWorld;

        if (
          normal &&
          normal.y < 0.5
        ) {
          return;
        }

        const distance =
          result.hitPointWorld.distanceTo(
            from
          );

        if (
          distance <
          closestDistance
        ) {
          closestDistance =
            distance;

          foundGround =
            true;
        }
      }
    );

    // ----------------------------------------------------------
    // Ground state
    // ----------------------------------------------------------

    if (
      foundGround &&
      closestDistance <= 0.20 &&
      body.velocity.y <= 0.2
    ) {
      this.isOnGround = true;
      this._isJumping = false;
    } else {
      this.isOnGround = false;
    }
  }

  // ============================================================
  // UPDATE CONTROLLER
  // ============================================================

  updateController(
    dt,
    cameraYaw
  ) {
    dt =
      Math.min(
        dt,
        0.05
      );

    // ----------------------------------------------------------
    // Cooldown
    // ----------------------------------------------------------

    if (
      this.jumpCooldown > 0
    ) {
      this.jumpCooldown -= dt;

      if (
        this.jumpCooldown < 0
      ) {
        this.jumpCooldown = 0;
      }
    }

    // ----------------------------------------------------------
    // Horizontal movement
    // ----------------------------------------------------------

    if (
      this.isMoving &&
      this.moveInput
    ) {
      const sinY =
        Math.sin(cameraYaw);

      const cosY =
        Math.cos(cameraYaw);

      const forwardX =
        -sinY;

      const forwardZ =
        -cosY;

      const rightX =
        cosY;

      const rightZ =
        -sinY;

      const moveX =
        forwardX *
          this.moveInput.forward +
        rightX *
          this.moveInput.strafe;

      const moveZ =
        forwardZ *
          this.moveInput.forward +
        rightZ *
          this.moveInput.strafe;

      this.controller.setDirection(
        moveX,
        moveZ,
        true
      );

      this.controller.maxSpeed =
        this.isSprinting
          ? this.sprintSpeed
          : this.maxSpeed;

      const targetYaw =
        Math.atan2(
          moveX,
          moveZ
        );

      const rotationT =
        1 -
        Math.exp(
          -10 * dt
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

    /*
     * IMPORTANT:
     *
     * KinematicBody only modifies X/Z.
     * It must never modify velocity.y.
     */
    this.controller.update(dt);

    // ----------------------------------------------------------
    // Ground check AFTER controller
    // ----------------------------------------------------------

    this._updateGroundState();
  }

  // ============================================================
  // VISUAL SYNC
  // ============================================================

  syncVisual(dt = 0) {
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y -
        this.playerRadius,
      this.body.position.z
    );

    this.mesh.rotation.y =
      this.facing;

    this._updateAnimation(dt);

    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  // ============================================================
  // ANIMATION UPDATE
  // ============================================================

  _updateAnimation(dt) {
    if (
      this.oneShotTimer > 0
    ) {
      this.oneShotTimer -= dt;

      if (
        this.oneShotTimer <= 0
      ) {
        this.oneShotTimer = 0;
        this.oneShotName = null;

        this._updateLocomotionAnimation();
      }

      return;
    }

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

    this._updateLocomotionAnimation();
  }

  // ============================================================
  // LOCOMOTION
  // ============================================================

  _updateLocomotionAnimation() {
    // ----------------------------------------------------------
    // Air
    // ----------------------------------------------------------

    if (!this.isOnGround) {
      if (
        this.body.velocity.y > 0.5 &&
        this.actions.jump
      ) {
        if (
          this.currentActionName !==
          'jump'
        ) {
          this._play(
            'jump',
            0.08
          );
        }

        return;
      }

      if (
        this.body.velocity.y < -0.5 &&
        this.actions.fall
      ) {
        if (
          this.currentActionName !==
          'fall'
        ) {
          this._play(
            'fall',
            0.08
          );
        }

        return;
      }
    }

    // ----------------------------------------------------------
    // Speed
    // ----------------------------------------------------------

    const speed =
      this.controller.getHorizontalSpeed();

    if (speed <= 0.15) {
      if (
        this.currentActionName !==
        'idle'
      ) {
        this._play(
          'idle',
          0.15
        );
      }

      return;
    }

    // ----------------------------------------------------------
    // Walk / sprint
    // ----------------------------------------------------------

    const target =
      this.isSprinting &&
      speed >
        this.maxSpeed * 0.75
        ? 'sprint'
        : 'walk';

    if (
      this.currentActionName !==
      target
    ) {
      this._play(
        target,
        0.12
      );
    }
  }

  // ============================================================
  // ANGLE LERP
  // ============================================================

  _lerpAngle(
    a,
    b,
    t
  ) {
    let diff =
      b - a;

    while (
      diff > Math.PI
    ) {
      diff -=
        Math.PI * 2;
    }

    while (
      diff < -Math.PI
    ) {
      diff +=
        Math.PI * 2;
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