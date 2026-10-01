import * as CANNON from 'cannon-es';

export class KinematicBody {
  constructor(body, options = {}) {
    this.body = body;

    this.maxSpeed =
      options.maxSpeed ?? 7;

    this.accelTime =
      options.accelTime ?? 0.2;

    this.decelTime =
      options.decelTime ?? 0.12;

    this.desiredDirection =
      new CANNON.Vec3(
        0,
        0,
        0
      );

    this.wantsToMove = false;
  }

  // ============================================================
  // DIRECTION
  // ============================================================

  setDirection(
    dx,
    dz,
    wantsToMove = true
  ) {
    if (!wantsToMove) {
      this.wantsToMove = false;
      return;
    }

    const len =
      Math.hypot(dx, dz);

    if (len < 0.0001) {
      this.wantsToMove = false;
      return;
    }

    this.desiredDirection.set(
      dx / len,
      0,
      dz / len
    );

    this.wantsToMove = true;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt) {
    dt =
      Math.min(
        dt,
        0.05
      );

    const vel =
      this.body.velocity;

    // ==========================================================
    // MOVING
    // ==========================================================

    if (this.wantsToMove) {
      const targetX =
        this.desiredDirection.x *
        this.maxSpeed;

      const targetZ =
        this.desiredDirection.z *
        this.maxSpeed;

      const rate =
        -Math.log(0.1) /
        Math.max(
          this.accelTime,
          0.001
        );

      const t =
        1 -
        Math.exp(
          -rate * dt
        );

      vel.x +=
        (
          targetX -
          vel.x
        ) * t;

      vel.z +=
        (
          targetZ -
          vel.z
        ) * t;
    }

    // ==========================================================
    // STOPPING
    // ==========================================================

    else {
      const rate =
        -Math.log(0.1) /
        Math.max(
          this.decelTime,
          0.001
        );

      const t =
        1 -
        Math.exp(
          -rate * dt
        );

      vel.x +=
        (
          0 -
          vel.x
        ) * t;

      vel.z +=
        (
          0 -
          vel.z
        ) * t;

      if (
        Math.abs(vel.x) <
        0.01
      ) {
        vel.x = 0;
      }

      if (
        Math.abs(vel.z) <
        0.01
      ) {
        vel.z = 0;
      }
    }

    /*
     * DO NOT TOUCH vel.y HERE.
     *
     * Y is exclusively controlled by Cannon gravity,
     * jumping and collision resolution.
     */
  }

  // ============================================================
  // HORIZONTAL SPEED
  // ============================================================

  getHorizontalSpeed() {
    return Math.hypot(
      this.body.velocity.x,
      this.body.velocity.z
    );
  }
}