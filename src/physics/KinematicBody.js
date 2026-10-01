import * as CANNON from 'cannon-es';

export class KinematicBody {
  constructor(body, options = {}) {
    this.body = body;

    // =========================
    // Movement
    // =========================

    this.maxSpeed = options.maxSpeed ?? 7;

    // مدت تقریبی رسیدن از 0 به ~90% سرعت
    this.accelTime = options.accelTime ?? 0.4;

    // مدت تقریبی توقف از سرعت فعلی تا ~10%
    this.decelTime = options.decelTime ?? 0.3;

    // وقتی جهت عوض می‌شود، سرعت در جهت جدید
    // به صورت نرم اصلاح می‌شود.
    this.turnSpeed = options.turnSpeed ?? 14;

    // =========================
    // State
    // =========================

    this.desiredDirection = new CANNON.Vec3(0, 0, 0);
    this.wantsToMove = false;
  }

  setDirection(dx, dz, wantsToMove = true) {
    if (!wantsToMove) {
      this.wantsToMove = false;
      return;
    }

    const length = Math.hypot(dx, dz);

    if (length < 0.0001) {
      this.wantsToMove = false;
      return;
    }

    this.desiredDirection.set(
      dx / length,
      0,
      dz / length
    );

    this.wantsToMove = true;
  }

  update(dt) {
    const vel = this.body.velocity;

    // جلوگیری از مشکلات در صورت lag / tab switch
    dt = Math.min(dt, 0.05);

    if (this.wantsToMove) {
      const targetSpeed = this.maxSpeed;

      const targetX =
        this.desiredDirection.x * targetSpeed;

      const targetZ =
        this.desiredDirection.z * targetSpeed;

      /*
       * شتاب:
       *
       * اگر accelTime = 0.4 باشد،
       * بعد از حدود 0.4 ثانیه به ~90% سرعت می‌رسیم.
       */
      const accelRate =
        -Math.log(0.1) / Math.max(this.accelTime, 0.001);

      const accelT =
        1 - Math.exp(-accelRate * dt);

      /*
       * اگر در حال تغییر جهت باشیم،
       * turnSpeed باعث می‌شود تغییر جهت سریع ولی نرم باشد.
       */
      const turnT =
        1 - Math.exp(-this.turnSpeed * dt);

      vel.x += (targetX - vel.x) * accelT;
      vel.z += (targetZ - vel.z) * turnT;
    } else {
      /*
       * ترمز مستقل از FPS
       */
      const decelRate =
        -Math.log(0.1) / Math.max(this.decelTime, 0.001);

      const decelT =
        1 - Math.exp(-decelRate * dt);

      vel.x += (0 - vel.x) * decelT;
      vel.z += (0 - vel.z) * decelT;

      // جلوگیری از velocity های خیلی کوچک
      if (Math.abs(vel.x) < 0.01) {
        vel.x = 0;
      }

      if (Math.abs(vel.z) < 0.01) {
        vel.z = 0;
      }
    }
  }

  getHorizontalSpeed() {
    return Math.hypot(
      this.body.velocity.x,
      this.body.velocity.z
    );
  }
}