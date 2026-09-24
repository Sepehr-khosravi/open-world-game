import * as CANNON from 'cannon-es';

export class KinematicBody {
  constructor(body, options = {}) {
    this.body = body;

    this.maxSpeed = options.maxSpeed ?? 7;

    // === پارامترهای ramp-up ===
    // x: مقدار افزایش سرعت (گام اولیه)
    // y: فاصله‌ی زمانی بین گام‌ها (ثانیه)
    // yMin: حداقل y (وقتی به این رسید، دیگه کمتر نمی‌شه)
    // rampDuration: چند ثانیه طول بکشه تا y به yMin برسه
    this.x = options.x ?? 0.5;              // گام اولیه‌ی سرعت (m/s)
    this.y = options.y ?? 0.25;             // فاصله‌ی اولیه (ثانیه)
    this.yMin = options.yMin ?? 0.05;       // حداقل فاصله (خیلی سریع)
    this.rampDuration = options.rampDuration ?? 2.0; // ثانیه تا y به yMin برسه

    // === پارامترهای کاهش (توقف) ===
    this.decelTime = options.decelTime ?? 0.3;

    // === وضعیت داخلی ===
    this.desiredDirection = new CANNON.Vec3(0, 0, 0);
    this.wantsToMove = false;

    // تایمر ramp
    this.rampTimer = 0;       // چقدر از زمان ramp گذشته
    this.stepTimer = 0;       // تایمر بین گام‌ها
    this.currentStep = 0;     // گام فعلی (x چند بار اضافه شده)
  }

  setDirection(dx, dz, wantsToMove = true) {
    if (!wantsToMove) {
      this.wantsToMove = false;
      return;
    }
    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      this.wantsToMove = false;
      return;
    }
    // جهت نرمالایز شده
    this.desiredDirection.set(dx / len, 0, dz / len);
    this.wantsToMove = true;
  }

  update(dt) {
    const vel = this.body.velocity;

    if (this.wantsToMove) {
      // === ramp-up ===
      // y فعلی رو از روی زمان حساب کن
      const progress = Math.min(1, this.rampTimer / this.rampDuration);
      // y از y شروع می‌شه و خطی به yMin می‌رسه
      const currentY = this.y + (this.yMin - this.y) * progress;

      // تایمر گام
      this.stepTimer += dt;

      // اگه وقت گام جدید رسیده، سرعت هدف رو زیاد کن
      if (this.stepTimer >= currentY) {
        this.stepTimer = 0;
        this.currentStep++;
      }

      // زمان ramp
      this.rampTimer += dt;

      // سرعت هدف بر اساس گام فعلی
      const targetSpeed = Math.min(this.maxSpeed, this.currentStep * this.x);

      // سرعت هدف در جهت مورد نظر
      const targetVx = this.desiredDirection.x * targetSpeed;
      const targetVz = this.desiredDirection.z * targetSpeed;

      // ⚠️ نزدیک شدن نرم به هدف (lerp) تا پرش نداشته باشیم
      // از lerp برای هر فریم استفاده می‌کنیم که نرم باشه
      const t = 1 - Math.exp(-8 * dt);
      vel.x += (targetVx - vel.x) * t;
      vel.z += (targetVz - vel.z) * t;
    } else {
      // === توقف نرم ===
      // ریست ramp
      this.rampTimer = 0;
      this.stepTimer = 0;
      this.currentStep = 0;

      // کاهش نمایی
      const k = -Math.log(0.1) / this.decelTime;
      const t = 1 - Math.exp(-k * dt);

      vel.x += (0 - vel.x) * t;
      vel.z += (0 - vel.z) * t;

      // dead zone
      if (Math.abs(vel.x) < 0.02) vel.x = 0;
      if (Math.abs(vel.z) < 0.02) vel.z = 0;
    }
  }
}