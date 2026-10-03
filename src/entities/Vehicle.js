import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/* =========================================================
 * CAR SPECS
 * ========================================================= */

const CAR_SPECS = {
  sedan: {
    length: 4.0,
    mass: 200,
  },

  'sedan-sports': {
    length: 4.0,
    mass: 180,
  },

  'hatchback-sports': {
    length: 4.0,
    mass: 170,
  },

  taxi: {
    length: 4.0,
    mass: 200,
  },

  police: {
    length: 4.0,
    mass: 220,
  },

  box: {
    length: 4.0,
    mass: 200,
  },

  van: {
    length: 4.5,
    mass: 280,
  },

  suv: {
    length: 4.5,
    mass: 300,
  },

  'suv-luxury': {
    length: 4.5,
    mass: 320,
  },

  delivery: {
    length: 5.0,
    mass: 400,
  },

  ambulance: {
    length: 5.5,
    mass: 500,
  },

  truck: {
    length: 5.5,
    mass: 500,
  },
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

    const spec =
      CAR_SPECS[name] ||
      CAR_SPECS.sedan;

    const targetLength =
      spec.length;

    const mass =
      spec.mass;

    /* =====================================================
     * VISUAL
     * ===================================================== */

    this.group =
      new THREE.Group();

    this.group.name =
      `Vehicle-${name}`;

    const holder =
      new THREE.Group();

    holder.name =
      'VehicleHolder';

    this.group.add(holder);

    const visual =
      bodyModel.clone(true);

    visual.position.set(
      0,
      0,
      0
    );

    visual.rotation.set(
      0,
      0,
      0
    );

    visual.scale.set(
      1,
      1,
      1
    );

    holder.add(visual);

    holder.updateMatrixWorld(
      true
    );

    /* =====================================================
     * MEASURE MODEL
     * ===================================================== */

    let box =
      new THREE.Box3()
        .setFromObject(
          visual
        );

    const size =
      new THREE.Vector3();

    box.getSize(size);

    /*
     * بعضی مدل‌ها طولشان روی X است
     * و بعضی روی Z.
     *
     * بازی ما Z را Forward در نظر می‌گیرد.
     */

    const isAlongX =
      size.x > size.z;

    if (isAlongX) {
      visual.rotation.y =
        Math.PI / 2;

      holder.updateMatrixWorld(
        true
      );

      box.setFromObject(
        visual
      );

      box.getSize(size);
    }

    /* =====================================================
     * SCALE MODEL
     * ===================================================== */

    const scale =
      size.z > 0
        ? targetLength / size.z
        : 1;

    visual.scale.setScalar(
      scale
    );

    holder.updateMatrixWorld(
      true
    );

    box.setFromObject(
      visual
    );

    const finalSize =
      new THREE.Vector3();

    const center =
      new THREE.Vector3();

    box.getSize(
      finalSize
    );

    box.getCenter(
      center
    );

    /* =====================================================
     * PHYSICS DIMENSIONS
     * ===================================================== */

    const chassisL =
      Math.max(
        finalSize.z * 0.92,
        1.0
      );

    const chassisW =
      Math.max(
        finalSize.x * 0.88,
        0.7
      );

    /*
     * نسخه قبلی عملاً chassisH = 0 داشت.
     *
     * این باعث ساخت Box با ضخامت صفر می‌شد.
     *
     * بدنه را عمداً کوتاه‌تر از مدل
     * می‌گیریم تا کف ماشین داخل زمین نرود.
     */

    const chassisH =
      Math.max(
        finalSize.y * 0.32,
        0.45
      );

    this.chassisL =
      chassisL;

    this.chassisW =
      chassisW;

    this.chassisH =
      chassisH;

    /* =====================================================
     * WHEELS / SUSPENSION
     * ===================================================== */

    const wheelRadius =
      Math.max(
        chassisL * 0.14,
        0.22
      );

    const restLength =
      Math.max(
        chassisL * 0.085,
        0.24
      );

    /*
     * ارتفاع chassis:
     *
     * wheelRadius
     * + suspension
     * + مقدار کوچک clearance
     */

    const chassisY =
      wheelRadius +
      restLength +
      0.035;

    this.wheelRadius =
      wheelRadius;

    this.restLength =
      restLength;

    this.chassisY =
      chassisY;

    /* =====================================================
     * FIND WHEELS
     * ===================================================== */

    visual.updateMatrixWorld(
      true
    );

    const visualInverse =
      new THREE.Matrix4()
        .copy(
          visual.matrixWorld
        )
        .invert();

    const rawWheels = [];

    visual.traverse(
      (node) => {
        const nm =
          (
            node.name ||
            ''
          ).toLowerCase();

        const isWheel =
          nm.includes(
            'wheel'
          ) ||
          nm.includes(
            'tyre'
          ) ||
          nm.includes(
            'tire'
          );

        if (!isWheel) {
          return;
        }

        const rejected = [
          'spare',
          'extra',
          'carrier',
          'mount',
          'cover',
        ];

        if (
          rejected.some(
            (word) =>
              nm.includes(word)
          )
        ) {
          return;
        }

        const worldPosition =
          new THREE.Vector3();

        node.getWorldPosition(
          worldPosition
        );

        const localPosition =
          worldPosition
            .clone()
            .applyMatrix4(
              visualInverse
            );

        rawWheels.push({
          node,
          local:
            localPosition,
          name: nm,
        });
      }
    );

    console.log(
      `[Vehicle:${name}] wheel candidates:`,
      rawWheels.map(
        (wheel) =>
          wheel.name
      )
    );

    /* =====================================================
     * PICK FOUR WHEELS
     * ===================================================== */

    const halfW =
      finalSize.x / 2;

    const sideThreshold =
      halfW * 0.25;

    const sideWheels =
      rawWheels.filter(
        (wheel) =>
          Math.abs(
            wheel.local.x
          ) >
          sideThreshold
      );

    const pool =
      sideWheels.length >= 4
        ? sideWheels
        : rawWheels;

    const front =
      pool
        .filter(
          (wheel) =>
            wheel.local.z > 0
        )
        .sort(
          (a, b) =>
            b.local.z -
            a.local.z
        );

    const rear =
      pool
        .filter(
          (wheel) =>
            wheel.local.z <= 0
        )
        .sort(
          (a, b) =>
            a.local.z -
            b.local.z
        );

    const pickLeft =
      (arr) =>
        arr
          .filter(
            (wheel) =>
              wheel.local.x < 0
          )
          .sort(
            (a, b) =>
              a.local.x -
              b.local.x
          )[0];

    const pickRight =
      (arr) =>
        arr
          .filter(
            (wheel) =>
              wheel.local.x > 0
          )
          .sort(
            (a, b) =>
              b.local.x -
              a.local.x
          )[0];

    const picked = [
      {
        wheel:
          pickLeft(front),
        front: true,
        corner: 'FL',
      },

      {
        wheel:
          pickRight(front),
        front: true,
        corner: 'FR',
      },

      {
        wheel:
          pickLeft(rear),
        front: false,
        corner: 'RL',
      },

      {
        wheel:
          pickRight(rear),
        front: false,
        corner: 'RR',
      },
    ].filter(
      (item) =>
        item.wheel
    );

    console.log(
      `[Vehicle:${name}] picked wheels:`,
      picked.map(
        (item) =>
          item.corner
      )
    );

    /* =====================================================
     * WHEEL VISUAL PIVOTS
     * ===================================================== */

    const spinSign =
      isAlongX
        ? -1
        : 1;

    this._wheelPivots =
      [];

    this._wheelSpin =
      0;

    for (
      const item of picked
    ) {
      const wheelNode =
        item.wheel.node;

      const parent =
        wheelNode.parent;

      if (!parent) {
        continue;
      }

      const pivot =
        new THREE.Group();

      pivot.name =
        `wheel-pivot-${item.corner}`;

      pivot.rotation.order =
        'YXZ';

      pivot.position.copy(
        wheelNode.position
      );

      pivot.quaternion.copy(
        wheelNode.quaternion
      );

      pivot.scale.copy(
        wheelNode.scale
      );

      /*
       * Wheel را از parent اصلی
       * جدا و داخل pivot قرار می‌دهیم.
       */

      wheelNode.position.set(
        0,
        0,
        0
      );

      wheelNode.quaternion.identity();

      wheelNode.scale.set(
        1,
        1,
        1
      );

      parent.add(
        pivot
      );

      pivot.add(
        wheelNode
      );

      this._wheelPivots.push({
        pivot,
        wheelNode,
        isFront:
          item.front,
        corner:
          item.corner,
        spinSign,
        baseQuat:
          pivot.quaternion.clone(),
      });
    }

    /* =====================================================
     * CENTER VISUAL
     * ===================================================== */

    visual.position.x -=
      center.x;

    visual.position.z -=
      center.z;

    /*
     * مدل را نسبت به chassis
     * در ارتفاع منطقی قرار می‌دهیم.
     */

    visual.position.y =
      -center.y -
      chassisH / 2 +
      0.08;

    /* =====================================================
     * SHADOWS / MATERIALS
     * ===================================================== */

    visual.traverse(
      (node) => {
        if (!node.isMesh) {
          return;
        }

        node.castShadow =
          true;

        node.receiveShadow =
          true;

        /*
         * برای جلوگیری از مشکلات
         * frustum هنگام chunk loading.
         */

        node.frustumCulled =
          false;

        if (!node.material) {
          return;
        }

        const materials =
          Array.isArray(
            node.material
          )
            ? node.material
            : [node.material];

        for (
          const material of materials
        ) {
          if (
            material.transparent &&
            material.opacity < 1
          ) {
            material.depthWrite =
              false;

            material.side =
              THREE.DoubleSide;
          }
        }
      }
    );

    /* =====================================================
     * CHASSIS PHYSICS
     * ===================================================== */

    const chassisShape =
      new CANNON.Box(
        new CANNON.Vec3(
          chassisW / 2,
          chassisH / 2,
          chassisL / 2
        )
      );

    const chassisBody =
      new CANNON.Body({
        mass,
        material:
          physics.groundMaterial,
      });

    chassisBody.addShape(
      chassisShape
    );

    chassisBody.collisionResponse =
      true;

    chassisBody.position.set(
      x,
      chassisY,
      z
    );

    chassisBody.quaternion.setFromEuler(
      0,
      rotationY,
      0
    );

    /*
     * Damping:
     *
     * linear:
     * کمی کاهش سرعت
     *
     * angular:
     * جلوگیری از چرخیدن غیرطبیعی ماشین
     */

    chassisBody.linearDamping =
      0.08;

    chassisBody.angularDamping =
      0.92;

    chassisBody.allowSleep =
      false;

    /* =====================================================
     * RAYCAST VEHICLE
     * ===================================================== */

    const vehicle =
      new CANNON.RaycastVehicle({
        chassisBody,

        indexRightAxis: 0,

        indexUpAxis: 1,

        indexForwardAxis: 2,
      });

    const wheelWidth =
      Math.max(
        chassisL * 0.05,
        0.08
      );

    const wheelOptions = {
      radius:
        wheelRadius,

      directionLocal:
        new CANNON.Vec3(
          0,
          -1,
          0
        ),

      suspensionStiffness:
        90,

      suspensionRestLength:
        restLength,

      frictionSlip:
        4.5,

      dampingRelaxation:
        3.8,

      dampingCompression:
        6.0,

      maxSuspensionForce:
        mass * 100,

      rollInfluence:
        0.015,

      axleLocal:
        new CANNON.Vec3(
          1,
          0,
          0
        ),

      chassisConnectionPointLocal:
        new CANNON.Vec3(),

      maxSuspensionTravel:
        restLength * 0.9,

      customSlidingRotationalSpeed:
        -30,

      useCustomSlidingRotationalSpeed:
        true,
    };

    /* =====================================================
     * WHEEL POSITIONS
     * ===================================================== */

    const halfWheelX =
      chassisW / 2 +
      wheelWidth * 0.05;

    const halfWheelZ =
      chassisL / 2 -
      wheelRadius * 0.60;

    const wheelPositions = [
      {
        x: -halfWheelX,
        z: halfWheelZ,
      },

      {
        x: halfWheelX,
        z: halfWheelZ,
      },

      {
        x: -halfWheelX,
        z: -halfWheelZ,
      },

      {
        x: halfWheelX,
        z: -halfWheelZ,
      },
    ];

    for (
      const position of wheelPositions
    ) {
      wheelOptions
        .chassisConnectionPointLocal
        .set(
          position.x,
          0,
          position.z
        );

      vehicle.addWheel(
        wheelOptions
      );
    }

    vehicle.addToWorld(
      physics.world
    );

    /* =====================================================
     * VEHICLE STATE
     * ===================================================== */

    this.vehicle =
      vehicle;

    this.chassisBody =
      chassisBody;

    /*
     * Gear system
     */

    this.gears = [
      {
        maxSpeed: 5,
        force: 0.42,
      },

      {
        maxSpeed: 10,
        force: 0.34,
      },

      {
        maxSpeed: 17,
        force: 0.27,
      },

      {
        maxSpeed: 25,
        force: 0.20,
      },

      {
        maxSpeed: 40,
        force: 0.12,
      },
    ];

    /*
     * Engine
     */

    this.maxForce =
      2600;

    /*
     * Brake
     */

    this.maxBrake =
      100;

    /*
     * Maximum front-wheel steering angle.
     */

    this.maxSteer =
      0.5;

    /*
     * Current steering angle.
     */

    this._steerValue =
      0;

    /*
     * Current engine force.
     */

    this._engineForce =
      0;

    /*
     * Current brake force.
     */

    this._brakeForce =
      6;

    /*
     * Last dt.
     */

    this._lastInputDt =
      1 / 60;

    /* =====================================================
     * VISUAL QUATERNIONS
     * ===================================================== */

    this._qSteer =
      new THREE.Quaternion();

    this._qSpin =
      new THREE.Quaternion();

    this._qTotal =
      new THREE.Quaternion();

    this._axisY =
      new THREE.Vector3(
        0,
        1,
        0
      );

    this._axisX =
      new THREE.Vector3(
        1,
        0,
        0
      );

    /* =====================================================
     * SAFETY
     * ===================================================== */

    this._physicsActive =
      true;

    this._lastSafePosition =
      new CANNON.Vec3(
        x,
        chassisY,
        z
      );

    this._lastSafeQuaternion =
      new CANNON.Quaternion(
        0,
        0,
        0,
        1
      );

    this._hasGroundContact =
      false;

    this._recovering =
      false;

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
    /*
     * وقتی بازیکن داخل ماشین نیست،
     * هیچ inputی اعمال نکن.
     */

    if (!this.isDriving) {
      return;
    }

    /* =====================================================
     * DT
     * ===================================================== */

    this._lastInputDt =
      Math.max(
        0.001,
        Math.min(
          dt,
          0.05
        )
      );

    /* =====================================================
     * MOVEMENT INPUT
     * ===================================================== */

    const forward =
      !!(
        keys.w ||
        keys.arrowup
      );

    /*
     * S / ArrowDown هنوز Reverse
     * دسکتاپ است.
     */

    const backward =
      !!(
        keys.s ||
        keys.arrowdown
      );

    /*
     * brake ورودی مستقل است.
     *
     * Mobile:
     *   brake button
     *
     * Desktop:
     *   keys.brake اگر لازم شد
     */

    const brake =
      !!keys.brake;

    /*
     * Space را به عنوان Handbrake
     * نگه می‌داریم.
     */

    const handbrake =
      !!(
        keys[' '] ||
        keys.space
      );

    const speed =
      Math.abs(
        currentSpeed
      );

    /* =====================================================
     * GEAR
     * ===================================================== */

    let gearIndex =
      0;

    for (
      let i = 0;
      i < this.gears.length;
      i++
    ) {
      if (
        speed <
        this.gears[i].maxSpeed
      ) {
        gearIndex =
          i;

        break;
      }

      gearIndex =
        i;
    }

    const gear =
      this.gears[gearIndex];

    /* =====================================================
     * ENGINE / BRAKE
     * ===================================================== */

    /*
     * اولویت:
     *
     * 1. Brake
     * 2. Gas
     * 3. Reverse
     * 4. Idle
     */

    if (brake) {
      /*
       * ترمز واقعی
       *
       * هیچ engine force ای
       * در این حالت اعمال نمی‌کنیم.
       */

      this._engineForce =
        0;

      this._brakeForce =
        this.maxBrake;
    }

    else if (forward) {
      /*
       * Forward / Gas
       */

      this._engineForce =
        -this.maxForce *
        gear.force;

      this._brakeForce =
        0;
    }

    else if (backward) {
      /*
       * Reverse
       *
       * این برای S و ArrowDown
       * روی دسکتاپ است.
       */

      this._engineForce =
        this.maxForce *
        0.4;

      this._brakeForce =
        0;
    }

    else {
      /*
       * هیچ inputی نداریم.
       *
       * مقدار کم brake باعث می‌شود
       * ماشین خیلی سریع ول نشود.
       */

      this._engineForce =
        0;

      this._brakeForce =
        handbrake
          ? this.maxBrake
          : 6;
    }

    /* =====================================================
     * STEERING INPUT
     * ===================================================== */

    /*
     * قرارداد Steering:
     *
     *   +1 = LEFT
     *    0 = CENTER
     *   -1 = RIGHT
     *
     * MobileControls هم همین قرارداد را
     * استفاده می‌کند.
     */

    let steerInput;

    if (
      typeof steeringOverride ===
      'number'
    ) {
      /*
       * Mobile steering wheel
       */

      steerInput =
        THREE.MathUtils.clamp(
          steeringOverride,
          -1,
          1
        );
    }

    else {
      /*
       * Desktop keyboard
       *
       * A = Left
       * D = Right
       */

      steerInput =
        (keys.a ? 1 : 0) -
        (keys.d ? 1 : 0);
    }

    /* =====================================================
     * STEERING TARGET
     * ===================================================== */

    const targetSteer =
      steerInput *
      this.maxSteer;

    /* =====================================================
     * STEERING SMOOTHING
     * ===================================================== */

    /*
     * قبلاً:
     *
     * 1 - exp(-10 / 1000)
     *
     * استفاده شده بود که عملاً
     * smoothing بسیار کمی ایجاد می‌کرد
     * و به FPS وابسته بود.
     *
     * حالا:
     *
     * 1 - exp(-12 * dt)
     *
     * استفاده می‌کنیم.
     */

    const steerT =
      1 -
      Math.exp(
        -12 *
        this._lastInputDt
      );

    this._steerValue +=
      (
        targetSteer -
        this._steerValue
      ) *
      steerT;

    /* =====================================================
     * FRONT WHEEL STEERING
     * ===================================================== */

    this.vehicle.setSteeringValue(
      this._steerValue,
      0
    );

    this.vehicle.setSteeringValue(
      this._steerValue,
      1
    );

    /* =====================================================
     * ENGINE / BRAKE PER WHEEL
     * ===================================================== */

    const perWheelForce =
      this._engineForce /
      4;

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      this.vehicle.applyEngineForce(
        perWheelForce,
        i
      );

      this.vehicle.setBrake(
        this._brakeForce,
        i
      );
    }
  }

  /* =========================================================
   * UPDATE
   * ========================================================= */

  update(dt) {
    /* =====================================================
     * SAFETY RECOVERY
     * ===================================================== */

    if (
      this.chassisBody.position.y <
        -15 &&
      !this._recovering
    ) {
      this._recovering =
        true;

      console.warn(
        `[Vehicle:${this.name}] deep fall recovery`
      );

      /*
       * Return to last safe position.
       */

      this.chassisBody.position.copy(
        this._lastSafePosition
      );

      this.chassisBody.quaternion.copy(
        this._lastSafeQuaternion
      );

      /*
       * Clear velocity.
       */

      this.chassisBody.velocity.set(
        0,
        0,
        0
      );

      this.chassisBody.angularVelocity.set(
        0,
        0,
        0
      );

      /*
       * Reset controls.
       */

      this._steerValue =
        0;

      this._engineForce =
        0;

      this._brakeForce =
        30;

      for (
        let i = 0;
        i < 4;
        i++
      ) {
        this.vehicle.setBrake(
          30,
          i
        );

        this.vehicle.applyEngineForce(
          0,
          i
        );

        this.vehicle.setSteeringValue(
          0,
          i
        );
      }
    }

    /* =====================================================
     * RECOVERY STATE
     * ===================================================== */

    if (
      this._recovering &&
      this.chassisBody.position.y >
        -1
    ) {
      this._recovering =
        false;
    }

    /* =====================================================
     * SAVE SAFE POSITION
     * ===================================================== */

    if (
      this.chassisBody.position.y >
        -1 &&
      Number.isFinite(
        this.chassisBody.position.x
      ) &&
      Number.isFinite(
        this.chassisBody.position.y
      ) &&
      Number.isFinite(
        this.chassisBody.position.z
      )
    ) {
      this._lastSafePosition.copy(
        this.chassisBody.position
      );

      this._lastSafeQuaternion.copy(
        this.chassisBody.quaternion
      );
    }

    /* =====================================================
     * VISUAL SYNC
     * ===================================================== */

    const position =
      this.chassisBody.position;

    const quaternion =
      this.chassisBody.quaternion;

    this.group.position.set(
      position.x,
      position.y,
      position.z
    );

    this.group.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    /* =====================================================
     * WHEEL SPIN
     * ===================================================== */

    const velocity =
      this.chassisBody.velocity;

    const forward =
      this.getForwardVector();

    const forwardSpeed =
      velocity.x *
        forward.x +
      velocity.z *
        forward.z;

    if (
      dt > 0 &&
      this.wheelRadius > 0
    ) {
      this._wheelSpin +=
        (
          forwardSpeed *
          dt
        ) /
        this.wheelRadius;
    }

    /* =====================================================
     * WHEEL VISUALS
     * ===================================================== */

    for (
      const wheel of
        this._wheelPivots
    ) {
      /*
       * Wheel rolling
       */

      this._qSpin.setFromAxisAngle(
        this._axisX,
        wheel.spinSign *
          this._wheelSpin
      );

      /*
       * Front wheel steering
       */

      const steering =
        wheel.isFront
          ? this._steerValue
          : 0;

      this._qSteer.setFromAxisAngle(
        this._axisY,
        steering
      );

      /*
       * Base rotation
       * -> steering
       * -> wheel spin
       */

      this._qTotal.copy(
        wheel.baseQuat
      );

      this._qTotal.multiply(
        this._qSteer
      );

      this._qTotal.multiply(
        this._qSpin
      );

      wheel.pivot.quaternion.copy(
        this._qTotal
      );
    }
  }

  /* =========================================================
   * POSITION
   * ========================================================= */

  getPosition() {
    const position =
      this.chassisBody.position;

    return new THREE.Vector3(
      position.x,
      position.y,
      position.z
    );
  }

  /* =========================================================
   * SPEED
   * ========================================================= */

  getSpeed() {
    const velocity =
      this.chassisBody.velocity;

    return Math.hypot(
      velocity.x,
      velocity.z
    );
  }

  /* =========================================================
   * FORWARD SPEED
   * ========================================================= */

  getForwardSpeed() {
    const velocity =
      this.chassisBody.velocity;

    const forward =
      this.getForwardVector();

    return (
      velocity.x *
        forward.x +
      velocity.z *
        forward.z
    );
  }

  /* =========================================================
   * FORWARD VECTOR
   * ========================================================= */

  getForwardVector() {
    const quaternion =
      this.chassisBody
        .quaternion;

    const forward =
      new THREE.Vector3(
        0,
        0,
        1
      );

    const threeQuaternion =
      new THREE.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );

    forward.applyQuaternion(
      threeQuaternion
    );

    return forward.normalize();
  }

  /* =========================================================
   * CURRENT GEAR
   * ========================================================= */

  getCurrentGear() {
    const speed =
      Math.abs(
        this.getForwardSpeed()
      );

    for (
      let i = 0;
      i < this.gears.length;
      i++
    ) {
      if (
        speed <
        this.gears[i].maxSpeed
      ) {
        return i + 1;
      }
    }

    return this.gears.length;
  }

  /* =========================================================
   * ENTER
   * ========================================================= */

  enter() {
    this.isDriving =
      true;

    /*
     * هنگام ورود هیچ نیرویی
     * از input قبلی باقی نماند.
     */

    this._engineForce =
      0;

    this._brakeForce =
      4;

    this._steerValue =
      0;

    this._recovering =
      false;

    /*
     * Clear all wheel forces.
     */

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      this.vehicle.applyEngineForce(
        0,
        i
      );

      this.vehicle.setBrake(
        4,
        i
      );

      this.vehicle.setSteeringValue(
        0,
        i
      );
    }

    this.chassisBody.wakeUp();
  }

  /* =========================================================
   * EXIT
   * ========================================================= */

  exit() {
    this.isDriving =
      false;

    /*
     * Absolutely stop engine input.
     */

    this._engineForce =
      0;

    /*
     * Apply a small brake so the
     * vehicle doesn't immediately
     * receive stale input.
     */

    this._brakeForce =
      30;

    this._steerValue =
      0;

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      this.vehicle.applyEngineForce(
        0,
        i
      );

      this.vehicle.setBrake(
        this._brakeForce,
        i
      );

      this.vehicle.setSteeringValue(
        0,
        i
      );
    }
  }

  /* =========================================================
   * DESTROY
   * ========================================================= */

  destroy() {
    if (
      this.vehicle.world
    ) {
      this.vehicle.removeFromWorld(
        this.physics.world
      );
    }

    this.group.removeFromParent();
  }
}