// src/entities/Vehicle.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/* =========================================================
 * AXES (immutable)
 * ========================================================= */

const AXIS_X = Object.freeze(new THREE.Vector3(1, 0, 0));
const AXIS_Y = Object.freeze(new THREE.Vector3(0, 1, 0));
const AXIS_Z = Object.freeze(new THREE.Vector3(0, 0, 1));

/* =========================================================
 * CAR SPECS
 * ========================================================= */

const CAR_SPECS = {
  sedan:             { length: 4.0, mass: 200 },
  'sedan-sports':    { length: 4.0, mass: 180 },
  'hatchback-sports':{ length: 4.0, mass: 170 },
  taxi:              { length: 4.0, mass: 200 },
  police:            { length: 4.0, mass: 220 },
  box:               { length: 4.0, mass: 200 },
  van:               { length: 4.5, mass: 280 },
  suv:               { length: 4.5, mass: 300 },
  'suv-luxury':      { length: 4.5, mass: 320 },
  delivery:          { length: 5.0, mass: 400 },
  ambulance:         { length: 5.5, mass: 500 },
  truck:             { length: 5.5, mass: 500 },
};

/* =========================================================
 * VEHICLE
 * ========================================================= */

export class Vehicle {
  constructor({
    bodyModel,
    physics,
    x = 0,
    z = 0,
    rotationY = 0,
    name = 'sedan',
  }) {
    this.physics = physics;
    this.isDriving = false;
    this.name = name;

    const spec = CAR_SPECS[name] || CAR_SPECS.sedan;
    const targetLength = spec.length;
    const mass = spec.mass;

    /* =====================================================
     * VISUAL ROOT
     * ===================================================== */

    this.group = new THREE.Group();
    this.group.name = `Vehicle-${name}`;

    const holder = new THREE.Group();
    holder.name = 'VehicleHolder';
    this.group.add(holder);

    const visual = bodyModel.clone(true);
    visual.position.set(0, 0, 0);
    visual.rotation.set(0, 0, 0);
    visual.scale.set(1, 1, 1);
    holder.add(visual);

    holder.updateMatrixWorld(true);

    /* =====================================================
     * MEASURE MODEL
     * ===================================================== */

    let box = new THREE.Box3().setFromObject(visual);
    const size = new THREE.Vector3();
    box.getSize(size);

    /*
     * بعضی مدل‌ها طولشان روی X است و بعضی روی Z.
     * بازی ما Z را Forward در نظر می‌گیرد.
     */

    const isAlongX = size.x > size.z;

    if (isAlongX) {
      visual.rotation.y = Math.PI / 2;
      holder.updateMatrixWorld(true);
      box.setFromObject(visual);
      box.getSize(size);
    }

    this._isAlongX = isAlongX;

    /* =====================================================
     * SCALE MODEL TO TARGET LENGTH
     * ===================================================== */

    const scale = size.z > 0 ? targetLength / size.z : 1;
    visual.scale.setScalar(scale);

    holder.updateMatrixWorld(true);
    box.setFromObject(visual);

    const finalSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(finalSize);
    box.getCenter(center);

    /* =====================================================
     * PHYSICS DIMENSIONS
     * ===================================================== */

    const chassisL = Math.max(finalSize.z * 0.92, 1.0);
    const chassisW = Math.max(finalSize.x * 0.88, 0.7);
    const chassisH = Math.max(finalSize.y * 0.32, 0.45);

    this.chassisL = chassisL;
    this.chassisW = chassisW;
    this.chassisH = chassisH;

    /* =====================================================
     * WHEELS / SUSPENSION DIMENSIONS
     * ===================================================== */

    const wheelRadius = Math.max(chassisL * 0.14, 0.22);
    const restLength = Math.max(chassisL * 0.085, 0.24);

    const chassisY = wheelRadius + restLength + 0.035;

    this.wheelRadius = wheelRadius;
    this.restLength = restLength;
    this.chassisY = chassisY;

    /* =====================================================
     * FIND WHEEL MESHES
     * ===================================================== */

    visual.updateMatrixWorld(true);

    const visualInverse = new THREE.Matrix4()
      .copy(visual.matrixWorld)
      .invert();

    const rawWheels = [];

    visual.traverse((node) => {
      const nm = (node.name || '').toLowerCase();

      const isWheel =
        nm.includes('wheel') ||
        nm.includes('tyre') ||
        nm.includes('tire');

      if (!isWheel) return;

      const rejected = ['spare', 'extra', 'carrier', 'mount', 'cover'];
      if (rejected.some((word) => nm.includes(word))) return;

      const worldPosition = new THREE.Vector3();
      node.getWorldPosition(worldPosition);

      const localPosition = worldPosition
        .clone()
        .applyMatrix4(visualInverse);

      rawWheels.push({
        node,
        local: localPosition,
        name: nm,
      });
    });

    console.log(
      `[Vehicle:${name}] wheel candidates:`,
      rawWheels.map((w) => w.name)
    );

    /* =====================================================
     * PICK FOUR WHEELS (FL / FR / RL / RR)
     * ===================================================== */

    const halfW = finalSize.x / 2;
    const sideThreshold = halfW * 0.25;

    const sideWheels = rawWheels.filter(
      (w) => Math.abs(w.local.x) > sideThreshold
    );

    const pool = sideWheels.length >= 4 ? sideWheels : rawWheels;

    const front = pool
      .filter((w) => w.local.z > 0)
      .sort((a, b) => b.local.z - a.local.z);

    const rear = pool
      .filter((w) => w.local.z <= 0)
      .sort((a, b) => a.local.z - b.local.z);

    const pickLeft = (arr) =>
      arr
        .filter((w) => w.local.x < 0)
        .sort((a, b) => a.local.x - b.local.x)[0];

    const pickRight = (arr) =>
      arr
        .filter((w) => w.local.x > 0)
        .sort((a, b) => b.local.x - a.local.x)[0];

    const picked = [
      { wheel: pickLeft(front),  front: true,  corner: 'FL' },
      { wheel: pickRight(front), front: true,  corner: 'FR' },
      { wheel: pickLeft(rear),   front: false, corner: 'RL' },
      { wheel: pickRight(rear),  front: false, corner: 'RR' },
    ].filter((item) => item.wheel);

    console.log(
      `[Vehicle:${name}] picked wheels:`,
      picked.map((item) => item.corner)
    );

    /* =====================================================
     * WHEEL VISUAL PIVOTS
     * =====================================================
     *
     * استراتژی:
     *
     * چرخ‌ها را از parent اصلی جدا می‌کنیم و زیر
     * یک steerPivot و یک spinPivot که هر دو مستقیم
     * زیر visual هستند قرار می‌دهیم.
     *
     *   visual
     *     └── steerPivot  (rotation.y = فرمان)
     *           └── spinPivot  (rotation.x = چرخش چرخ)
     *                 └── wheelNode  (mesh اصلی چرخ)
     *
     * مزیت‌ها:
     *   - محور Y برای فرمان همیشه در فضای visual ثابت است
     *   - محور X (یا Z اگر isAlongX) برای spin همیشه ثابت است
     *   - rotation اصلی چرخ داخل wheelNode حفظ می‌شود
     *   - دیگر هیچ baseQuat پیچیده‌ای لازم نیست
     */

    const spinSign = isAlongX ? -1 : 1;

    this._wheelPivots = [];
    this._wheelSpin = 0;

    /*
     * یک‌بار matrix world را به روز کن.
     */

    visual.updateMatrixWorld(true);

    for (const item of picked) {
      const wheelNode = item.wheel.node;

      /*
       * bones و skinned meshes را جدا نکن؛ ساختار اسکلت
       * به هم می‌ریزد. اگر مدل از skeleton استفاده می‌کند،
       * پشتیبانی wheel visual محدود می‌شود.
       */

      if (wheelNode.isBone || wheelNode.isSkinnedMesh) {
        console.warn(
          `[Vehicle:${name}] wheel ${item.corner} is bone/skinned, skipping pivot`
        );
        continue;
      }

      /*
       * موقعیت world و rotation چرخ را قبل از جدا کردن
       * ذخیره می‌کنیم.
       */

      const worldPos = new THREE.Vector3();
      wheelNode.getWorldPosition(worldPos);

      const worldQuat = new THREE.Quaternion();
      wheelNode.getWorldQuaternion(worldQuat);

      const worldScale = new THREE.Vector3();
      wheelNode.getWorldScale(worldScale);

      /*
       * موقعیت local نسبت به visual (نه parent چرخ).
       */

      const localPos = worldPos.clone().applyMatrix4(visualInverse);

      /*
       * rotation local نسبت به visual.
       * با این کار wheelNode داخل spinPivot می‌تواند
       * rotation محلی درست را حفظ کند.
       */

      const visualWorldQuat = new THREE.Quaternion();
      visual.getWorldQuaternion(visualWorldQuat);

      const localQuat = visualWorldQuat
        .clone()
        .invert()
        .multiply(worldQuat);

      /*
       * pivot فرمان حول Y.
       */

      const steerPivot = new THREE.Group();
      steerPivot.name = `wheel-steer-${item.corner}`;
      steerPivot.position.copy(localPos);

      /*
       * pivot چرخش حول X.
       */

      const spinPivot = new THREE.Group();
      spinPivot.name = `wheel-spin-${item.corner}`;

      /*
       * جدا کردن wheelNode از parent قبلی.
       */

      wheelNode.removeFromParent();

      /*
       * rotation محلی چرخ را حفظ می‌کنیم.
       * position صفر می‌شود چون در steerPivot قرار دارد.
       */

      wheelNode.position.set(0, 0, 0);
      wheelNode.quaternion.copy(localQuat);
      wheelNode.scale.copy(worldScale);

      spinPivot.add(wheelNode);
      steerPivot.add(spinPivot);
      visual.add(steerPivot);

      this._wheelPivots.push({
        steerPivot,
        spinPivot,
        wheelNode,
        isFront: item.front,
        corner: item.corner,
        spinSign,
      });
    }

    /* =====================================================
     * CENTER VISUAL MODEL
     * ===================================================== */

    visual.position.x -= center.x;
    visual.position.z -= center.z;
    visual.position.y = -center.y - chassisH / 2 + 0.08;

    /* =====================================================
     * SHADOWS / MATERIALS
     * ===================================================== */

    visual.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;

      /*
       * برای جلوگیری از حذف در chunk loading.
       */

      node.frustumCulled = false;

      if (!node.material) return;

      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];

      for (const material of materials) {
        if (material.transparent && material.opacity < 1) {
          material.depthWrite = false;
          material.side = THREE.DoubleSide;
        }
      }
    });

    /* =====================================================
     * CHASSIS PHYSICS
     * ===================================================== */

    const chassisShape = new CANNON.Box(
      new CANNON.Vec3(chassisW / 2, chassisH / 2, chassisL / 2)
    );

    const chassisBody = new CANNON.Body({
      mass,
      material: physics.groundMaterial,
    });

    chassisBody.addShape(chassisShape);
    chassisBody.collisionResponse = true;

    chassisBody.position.set(x, chassisY, z);
    chassisBody.quaternion.setFromEuler(0, rotationY, 0);

    chassisBody.linearDamping = 0.08;
    chassisBody.angularDamping = 0.92;
    chassisBody.allowSleep = false;

    /* =====================================================
     * RAYCAST VEHICLE
     * ===================================================== */

    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelWidth = Math.max(chassisL * 0.05, 0.08);

    const wheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 90,
      suspensionRestLength: restLength,
      frictionSlip: 4.5,
      dampingRelaxation: 3.8,
      dampingCompression: 6.0,
      maxSuspensionForce: mass * 100,
      rollInfluence: 0.015,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: restLength * 0.9,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const halfWheelX = chassisW / 2 + wheelWidth * 0.05;
    const halfWheelZ = chassisL / 2 - wheelRadius * 0.60;

    const wheelPositions = [
      { x: -halfWheelX, z:  halfWheelZ },
      { x:  halfWheelX, z:  halfWheelZ },
      { x: -halfWheelX, z: -halfWheelZ },
      { x:  halfWheelX, z: -halfWheelZ },
    ];

    for (const position of wheelPositions) {
      wheelOptions.chassisConnectionPointLocal.set(
        position.x,
        0,
        position.z
      );
      vehicle.addWheel(wheelOptions);
    }

    vehicle.addToWorld(physics.world);

    /* =====================================================
     * VEHICLE STATE
     * ===================================================== */

    this.vehicle = vehicle;
    this.chassisBody = chassisBody;

    /* Gears */

    this.gears = [
      { maxSpeed: 5,  force: 0.42 },
      { maxSpeed: 10, force: 0.34 },
      { maxSpeed: 17, force: 0.27 },
      { maxSpeed: 25, force: 0.20 },
      { maxSpeed: 40, force: 0.12 },
    ];

    this.maxForce = 2600;
    this.maxBrake = 100;
    this.maxSteer = 0.5;

    this._steerValue = 0;
    this._engineForce = 0;
    this._brakeForce = 6;
    this._lastInputDt = 1 / 60;

    /* =====================================================
     * SAFETY
     * ===================================================== */

    this._physicsActive = true;

    this._lastSafePosition = new CANNON.Vec3(x, chassisY, z);
    this._lastSafeQuaternion = new CANNON.Quaternion(0, 0, 0, 1);

    this._hasGroundContact = false;
    this._recovering = false;

    /* =====================================================
     * INITIAL VISUAL SYNC
     * ===================================================== */

    this.update(0);
  }

  /* =========================================================
   * INPUT
   * ========================================================= */

  setInput(
    keys,
    currentSpeed,
    steeringOverride = null,
    dt = 1 / 60
  ) {
    if (!this.isDriving) return;

    this._lastInputDt = Math.max(
      0.001,
      Math.min(dt, 0.05)
    );

    const forward = !!(keys.w || keys.arrowup);
    const backward = !!(keys.s || keys.arrowdown);
    const brake = !!keys.brake;
    const handbrake = !!(keys[' '] || keys.space);

    const speed = Math.abs(currentSpeed);

    /* Gear selection */

    let gearIndex = 0;
    for (let i = 0; i < this.gears.length; i++) {
      if (speed < this.gears[i].maxSpeed) {
        gearIndex = i;
        break;
      }
      gearIndex = i;
    }
    const gear = this.gears[gearIndex];

    /* Engine / brake priority */

    if (brake) {
      this._engineForce = 0;
      this._brakeForce = this.maxBrake;
    } else if (forward) {
      this._engineForce = -this.maxForce * gear.force;
      this._brakeForce = 0;
    } else if (backward) {
      this._engineForce = this.maxForce * 0.4;
      this._brakeForce = 0;
    } else {
      this._engineForce = 0;
      this._brakeForce = handbrake ? this.maxBrake : 6;
    }

    /* Steering input */

    let steerInput;

    if (typeof steeringOverride === 'number') {
      steerInput = THREE.MathUtils.clamp(steeringOverride, -1, 1);
    } else {
      steerInput = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
    }

    const targetSteer = steerInput * this.maxSteer;

    /* Smooth steering (frame-rate independent) */

    const steerT = 1 - Math.exp(-12 * this._lastInputDt);
    this._steerValue += (targetSteer - this._steerValue) * steerT;

    /* Front wheel steering */

    this.vehicle.setSteeringValue(this._steerValue, 0);
    this.vehicle.setSteeringValue(this._steerValue, 1);

    /* Per-wheel engine + brake */

    const perWheelForce = this._engineForce / 4;

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(perWheelForce, i);
      this.vehicle.setBrake(this._brakeForce, i);
    }
  }

  /* =========================================================
   * UPDATE
   * ========================================================= */

  update(dt) {
    /* Deep fall recovery */

    if (this.chassisBody.position.y < -15 && !this._recovering) {
      this._recovering = true;
      console.warn(`[Vehicle:${this.name}] deep fall recovery`);

      this.chassisBody.position.copy(this._lastSafePosition);
      this.chassisBody.quaternion.copy(this._lastSafeQuaternion);

      this.chassisBody.velocity.set(0, 0, 0);
      this.chassisBody.angularVelocity.set(0, 0, 0);

      this._steerValue = 0;
      this._engineForce = 0;
      this._brakeForce = 30;

      for (let i = 0; i < 4; i++) {
        this.vehicle.setBrake(30, i);
        this.vehicle.applyEngineForce(0, i);
        this.vehicle.setSteeringValue(0, i);
      }
    }

    if (this._recovering && this.chassisBody.position.y > -1) {
      this._recovering = false;
    }

    /* Save safe position */

    if (
      this.chassisBody.position.y > -1 &&
      Number.isFinite(this.chassisBody.position.x) &&
      Number.isFinite(this.chassisBody.position.y) &&
      Number.isFinite(this.chassisBody.position.z)
    ) {
      this._lastSafePosition.copy(this.chassisBody.position);
      this._lastSafeQuaternion.copy(this.chassisBody.quaternion);
    }

    /* Sync visual group to chassis */

    const position = this.chassisBody.position;
    const quaternion = this.chassisBody.quaternion;

    this.group.position.set(position.x, position.y, position.z);
    this.group.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    /* Wheel spin accumulation */

    const velocity = this.chassisBody.velocity;
    const forward = this.getForwardVector();
    const forwardSpeed =
      velocity.x * forward.x + velocity.z * forward.z;

    if (dt > 0 && this.wheelRadius > 0) {
      this._wheelSpin += (forwardSpeed * dt) / this.wheelRadius;
    }

    /* =====================================================
     * WHEEL VISUALS — STEER + SPIN
     * =====================================================
     *
     * steerPivot: فقط حول Y می‌چرخد (فرمان)
     * spinPivot:  فقط حول X می‌چرخد (rolling)
     *
     * چون هر دو pivot مستقل و مستقیم زیر visual هستند،
     * محورهای چرخش همیشه درست کار می‌کنند و چرخ از
     * دید ناپدید نمی‌شود.
     */

    /*
     * اگر مدل روی X بود (isAlongX)، محور طولی ماشین
     * در فضای visual حول Z است، پس spin باید حول Z باشد.
     * در غیر این‌صورت حول X.
     */

    const spinAxis = this._isAlongX ? AXIS_Z : AXIS_X;

    for (const wheel of this._wheelPivots) {
      const steering = wheel.isFront ? this._steerValue : 0;

      wheel.steerPivot.quaternion.setFromAxisAngle(
        AXIS_Y,
        steering
      );

      wheel.spinPivot.quaternion.setFromAxisAngle(
        spinAxis,
        wheel.spinSign * this._wheelSpin
      );
    }
  }

  /* =========================================================
   * POSITION
   * ========================================================= */

  getPosition() {
    const position = this.chassisBody.position;
    return new THREE.Vector3(position.x, position.y, position.z);
  }

  /* =========================================================
   * SPEED
   * ========================================================= */

  getSpeed() {
    const velocity = this.chassisBody.velocity;
    return Math.hypot(velocity.x, velocity.z);
  }

  /* =========================================================
   * FORWARD SPEED
   * ========================================================= */

  getForwardSpeed() {
    const velocity = this.chassisBody.velocity;
    const forward = this.getForwardVector();
    return velocity.x * forward.x + velocity.z * forward.z;
  }

  /* =========================================================
   * FORWARD VECTOR
   * ========================================================= */

  getForwardVector() {
    const quaternion = this.chassisBody.quaternion;

    const forward = new THREE.Vector3(0, 0, 1);

    const threeQuaternion = new THREE.Quaternion(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    forward.applyQuaternion(threeQuaternion);

    return forward.normalize();
  }

  /* =========================================================
   * CURRENT GEAR
   * ========================================================= */

  getCurrentGear() {
    const speed = Math.abs(this.getForwardSpeed());

    for (let i = 0; i < this.gears.length; i++) {
      if (speed < this.gears[i].maxSpeed) return i + 1;
    }

    return this.gears.length;
  }

  /* =========================================================
   * ENTER
   * ========================================================= */

  enter() {
    this.isDriving = true;

    this._engineForce = 0;
    this._brakeForce = 4;
    this._steerValue = 0;
    this._recovering = false;

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(0, i);
      this.vehicle.setBrake(4, i);
      this.vehicle.setSteeringValue(0, i);
    }

    this.chassisBody.wakeUp();
  }

  /* =========================================================
   * EXIT
   * ========================================================= */

  exit() {
    this.isDriving = false;

    this._engineForce = 0;
    this._brakeForce = 30;
    this._steerValue = 0;

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(0, i);
      this.vehicle.setBrake(this._brakeForce, i);
      this.vehicle.setSteeringValue(0, i);
    }
  }

  /* =========================================================
   * DESTROY
   * ========================================================= */

  destroy() {
    if (this.vehicle.world) {
      this.vehicle.removeFromWorld(this.physics.world);
    }

    this.group.removeFromParent();
  }
}