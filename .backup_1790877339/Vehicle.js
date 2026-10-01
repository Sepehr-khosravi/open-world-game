import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const CAR_SPECS = {
  sedan:            { length: 4.0, mass: 200 },
  'sedan-sports':   { length: 4.0, mass: 180 },
  'hatchback-sports': { length: 4.0, mass: 170 },
  taxi:             { length: 4.0, mass: 200 },
  police:           { length: 4.0, mass: 220 },
  box:              { length: 4.0, mass: 200 },
  van:              { length: 4.5, mass: 280 },
  suv:              { length: 4.5, mass: 300 },
  'suv-luxury':     { length: 4.5, mass: 320 },
  delivery:         { length: 5.0, mass: 400 },
  ambulance:        { length: 5.5, mass: 500 },
  truck:             { length: 5.5, mass: 500 },
};

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

    const targetLength = spec.length;
    const mass = spec.mass;

    // ============================================================
    // VISUAL
    // ============================================================

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

    let box =
      new THREE.Box3().setFromObject(
        visual
      );

    const size =
      new THREE.Vector3();

    box.getSize(size);

    // Some models are exported along X.
    const isAlongX =
      size.x > size.z;

    if (isAlongX) {
      visual.rotation.y =
        Math.PI / 2;

      holder.updateMatrixWorld(true);

      box.setFromObject(visual);
      box.getSize(size);
    }

    // Normalize car length.
    const scale =
      size.z > 0
        ? targetLength / size.z
        : 1;

    visual.scale.setScalar(scale);

    holder.updateMatrixWorld(true);

    box.setFromObject(visual);

    const finalSize =
      new THREE.Vector3();

    box.getSize(finalSize);

    const center =
      new THREE.Vector3();

    box.getCenter(center);

    // ============================================================
    // PHYSICS DIMENSIONS
    // ============================================================

    /*
     * The physics chassis is deliberately a little smaller
     * than the visual car.
     *
     * This prevents the body from catching sidewalks/buildings.
     */

    const chassisL =
      finalSize.z * 0.92;

    const chassisW =
      finalSize.x * 0.88;

    const chassisH =
      Math.max(
        finalSize.y * 0.35,
        0.45
      );

    this.chassisL = chassisL;
    this.chassisW = chassisW;
    this.chassisH = chassisH;

    // ============================================================
    // WHEELS / SUSPENSION
    // ============================================================

    const wheelRadius =
      Math.max(
        chassisL * 0.14,
        0.22
      );

    const restLength =
      Math.max(
        chassisL * 0.075,
        0.22
      );

    /*
     * IMPORTANT:
     *
     * Connection point is at chassis center.
     *
     * Therefore:
     *
     * chassisY =
     *     wheelRadius
     *   + restLength
     */

    const chassisY =
      wheelRadius +
      restLength;

    this.wheelRadius =
      wheelRadius;

    this.restLength =
      restLength;

    this.chassisY =
      chassisY;

    // ============================================================
    // FIND WHEELS
    // ============================================================

    visual.updateMatrixWorld(true);

    const visualInverse =
      new THREE.Matrix4()
        .copy(visual.matrixWorld)
        .invert();

    const rawWheels = [];

    visual.traverse((node) => {
      const name =
        (node.name || '')
          .toLowerCase();

      const isWheel =
        name.includes('wheel') ||
        name.includes('tyre') ||
        name.includes('tire');

      if (!isWheel) return;

      const rejected = [
        'spare',
        'extra',
        'carrier',
        'mount',
        'cover',
      ];

      if (
        rejected.some(
          (x) => name.includes(x)
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
        local: localPosition,
        name,
      });
    });

    console.log(
      `[Vehicle:${name}] wheel candidates:`,
      rawWheels.map(
        (w) => w.name
      )
    );

    // ============================================================
    // PICK FOUR WHEELS
    // ============================================================

    const halfW =
      finalSize.x / 2;

    const sideThreshold =
      halfW * 0.25;

    const sideWheels =
      rawWheels.filter(
        (wheel) =>
          Math.abs(
            wheel.local.x
          ) > sideThreshold
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

    const pickLeft = (list) =>
      list
        .filter(
          (wheel) =>
            wheel.local.x < 0
        )
        .sort(
          (a, b) =>
            a.local.x -
            b.local.x
        )[0];

    const pickRight = (list) =>
      list
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
        wheel: pickLeft(front),
        front: true,
        corner: 'FL',
      },
      {
        wheel: pickRight(front),
        front: true,
        corner: 'FR',
      },
      {
        wheel: pickLeft(rear),
        front: false,
        corner: 'RL',
      },
      {
        wheel: pickRight(rear),
        front: false,
        corner: 'RR',
      },
    ].filter(
      (x) => x.wheel
    );

    console.log(
      `[Vehicle:${name}] picked wheels:`,
      picked.map(
        (x) => x.corner
      )
    );

    // ============================================================
    // WHEEL VISUAL PIVOTS
    // ============================================================

    const spinSign =
      isAlongX
        ? -1
        : 1;

    this._wheelPivots = [];
    this._wheelSpin = 0;

    for (const item of picked) {
      const wheelNode =
        item.wheel.node;

      const parent =
        wheelNode.parent;

      if (!parent) continue;

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

      parent.add(pivot);

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

    // ============================================================
    // CENTER VISUAL
    // ============================================================

    visual.position.x -=
      center.x;

    visual.position.z -=
      center.z;

    /*
     * Visual bottom should approximately
     * line up with the chassis bottom.
     */

    visual.position.y =
      -center.y -
      chassisH / 2;

    visual.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      if (node.material) {
        const materials =
          Array.isArray(
            node.material
          )
            ? node.material
            : [node.material];

        for (const material of materials) {
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
    });

    // ============================================================
    // CHASSIS
    // ============================================================

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
        shape:
          chassisShape,
      });

    /*
     * The chassis itself is intentionally
     * non-colliding.
     *
     * RaycastVehicle controls the car.
     */

    chassisBody.collisionResponse =
      false;

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

    chassisBody.linearDamping =
      0.08;

    chassisBody.angularDamping =
      0.92;

    chassisBody.allowSleep =
      false;

    // ============================================================
    // RAYCAST VEHICLE
    // ============================================================

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
        80,

      suspensionRestLength:
        restLength,

      frictionSlip:
        4.0,

      dampingRelaxation:
        3.5,

      dampingCompression:
        5.5,

      maxSuspensionForce:
        mass * 80,

      rollInfluence:
        0.02,

      axleLocal:
        new CANNON.Vec3(
          1,
          0,
          0
        ),

      chassisConnectionPointLocal:
        new CANNON.Vec3(),

      maxSuspensionTravel:
        restLength * 0.75,

      customSlidingRotationalSpeed:
        -30,

      useCustomSlidingRotationalSpeed:
        true,
    };

    /*
     * IMPORTANT:
     *
     * Connection point is at Y = 0.
     *
     * chassis center is at:
     *
     * wheelRadius + restLength
     *
     * So the wheel ray naturally reaches
     * the ground at Y = 0.
     */

    const halfWheelX =
      chassisW / 2 +
      wheelWidth * 0.15;

    const halfWheelZ =
      chassisL / 2 -
      wheelRadius * 0.55;

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

    for (const position of wheelPositions) {
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

    // ============================================================
    // ADD TO PHYSICS
    // ============================================================

    vehicle.addToWorld(
      physics.world
    );

    // ============================================================
    // STATE
    // ============================================================

    this.vehicle =
      vehicle;

    this.chassisBody =
      chassisBody;

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

    this.maxForce =
      2600;

    this.maxBrake =
      100;

    this.maxSteer =
      0.5;

    this._steerValue =
      0;

    this._engineForce =
      0;

    this._brakeForce =
      6;

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

    /*
     * Physics activation state.
     *
     * VehicleManager controls this.
     */

    this._physicsActive = true;

    this._lastSafePosition =
      new CANNON.Vec3(
        x,
        chassisY,
        z
      );

    this._hasGroundContact =
      false;

    this.update(0);
  }

  // ============================================================
  // INPUT
  // ============================================================

  setInput(
    keys,
    currentSpeed = 0
  ) {
    if (!this.isDriving)
      return;

    const forward =
      !!(
        keys.w ||
        keys.arrowup
      );

    const backward =
      !!(
        keys.s ||
        keys.arrowdown
      );

    const left =
      !!(
        keys.a ||
        keys.arrowleft
      );

    const right =
      !!(
        keys.d ||
        keys.arrowright
      );

    const handbrake =
      !!keys[' '];

    const speed =
      Math.abs(
        currentSpeed
      );

    let gearIndex = 0;

    for (
      let i = 0;
      i < this.gears.length;
      i++
    ) {
      if (
        speed <
        this.gears[i]
          .maxSpeed
      ) {
        gearIndex = i;
        break;
      }

      gearIndex = i;
    }

    const gear =
      this.gears[
        gearIndex
      ];

    if (forward) {
      this._engineForce =
        -this.maxForce *
        gear.force;

      this._brakeForce =
        0;
    } else if (backward) {
      this._engineForce =
        this.maxForce *
        0.4;

      this._brakeForce =
        0;
    } else {
      this._engineForce =
        0;

      this._brakeForce =
        handbrake
          ? this.maxBrake
          : 6;
    }

    const targetSteer =
      left
        ? this.maxSteer
        : right
          ? -this.maxSteer
          : 0;

    /*
     * Smooth steering.
     */

    const steerT =
      1 -
      Math.exp(
        -10 / 1000
      );

    this._steerValue +=
      (
        targetSteer -
        this._steerValue
      ) *
      Math.max(
        steerT,
        0.08
      );

    this.vehicle
      .setSteeringValue(
        this._steerValue,
        0
      );

    this.vehicle
      .setSteeringValue(
        this._steerValue,
        1
      );

    /*
     * All-wheel drive.
     */

    const perWheel =
      this._engineForce /
      4;

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      this.vehicle
        .applyEngineForce(
          perWheel,
          i
        );

      this.vehicle
        .setBrake(
          this._brakeForce,
          i
        );
    }
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt) {
    /*
     * IMPORTANT:
     *
     * Do NOT constantly teleport cars back
     * to the ground.
     *
     * Only recover a genuinely lost vehicle.
     */

    if (
      this.chassisBody.position.y <
      -20
    ) {
      console.warn(
        `[Vehicle:${this.name}] fell out of world`
      );

      this.chassisBody.position.copy(
        this._lastSafePosition
      );

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

      this.chassisBody.quaternion.setFromEuler(
        0,
        this.chassisBody.quaternion.toEuler
          ? this.chassisBody.quaternion.toEuler().y
          : 0,
        0
      );
    }

    /*
     * Save safe position whenever the vehicle
     * is actually above the world.
     */

    if (
      this.chassisBody.position.y >
      -1
    ) {
      this._lastSafePosition.copy(
        this.chassisBody.position
      );
    }

    // ============================================================
    // VISUAL
    // ============================================================

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

    // ============================================================
    // WHEEL VISUALS
    // ============================================================

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

    for (
      const wheel
      of this._wheelPivots
    ) {
      this._qSpin.setFromAxisAngle(
        this._axisX,
        wheel.spinSign *
          this._wheelSpin
      );

      const steering =
        wheel.isFront
          ? this._steerValue
          : 0;

      this._qSteer.setFromAxisAngle(
        this._axisY,
        steering
      );

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

  // ============================================================
  // POSITION
  // ============================================================

  getPosition() {
    const p =
      this.chassisBody.position;

    return new THREE.Vector3(
      p.x,
      p.y,
      p.z
    );
  }

  getSpeed() {
    const v =
      this.chassisBody.velocity;

    return Math.hypot(
      v.x,
      v.z
    );
  }

  getForwardSpeed() {
    const v =
      this.chassisBody.velocity;

    const fwd =
      this.getForwardVector();

    return (
      v.x * fwd.x +
      v.z * fwd.z
    );
  }

  getForwardVector() {
    const q =
      this.chassisBody.quaternion;

    const fwd =
      new THREE.Vector3(
        0,
        0,
        1
      );

    fwd.applyQuaternion(
      new THREE.Quaternion(
        q.x,
        q.y,
        q.z,
        q.w
      )
    );

    return fwd;
  }

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
        this.gears[i]
          .maxSpeed
      ) {
        return i + 1;
      }
    }

    return this.gears.length;
  }

  // ============================================================
  // ENTER / EXIT
  // ============================================================

  enter() {
    this.isDriving = true;

    this._brakeForce =
      4;

    this._engineForce =
      0;

    this._steerValue =
      0;

    /*
     * Make sure the vehicle is awake.
     */

    this.chassisBody.wakeUp();
  }

  exit() {
    this.isDriving =
      false;

    this._engineForce =
      0;

    this._brakeForce =
      30;

    this._steerValue =
      0;

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      this.vehicle
        .setBrake(
          this._brakeForce,
          i
        );

      this.vehicle
        .applyEngineForce(
          0,
          i
        );

      this.vehicle
        .setSteeringValue(
          0,
          i
        );
    }
  }

  // ============================================================
  // DESTROY
  // ============================================================

  destroy() {
    if (
      this.vehicle.world
    ) {
      this.vehicle
        .removeFromWorld(
          this.physics.world
        );
    }

    this.group.removeFromParent();
  }
}