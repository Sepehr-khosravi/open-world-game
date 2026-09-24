import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(canvas, target) {
    this.canvas = canvas;
    this.target = target; // Player

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      4000
    );

    // پارامترهای چرخش
    this.yaw = 0;
    this.pitch = 0.35; // کمی از بالا نگاه کنه
    this.distance = 8;

    // محدودیت pitch
    this.minPitch = -0.2;
    this.maxPitch = 1.2;

    // ماوس
    this.mouseDown = false;
    this._bindEvents();

    // موقعیت اولیه
    this.camera.position.set(0, 8, 10);
  }

  _bindEvents() {
    // حرکت ماوس هنگام نگه داشتن کلیک
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    });

    // زوم
    this.canvas.addEventListener('wheel', (e) => {
      this.distance += e.deltaY * 0.01;
      this.distance = Math.max(4, Math.min(20, this.distance));
    }, { passive: true });

    // ریسایز
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  update(dt) {
    const pos = this.target.getPosition();

    // هدف دوربین: کمی بالاتر از مرکز شخصیت
    const targetPos = new THREE.Vector3(pos.x, pos.y + 1.6, pos.z);

    // موقعیت دوربین بر اساس yaw/pitch/distance
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).multiplyScalar(this.distance);

    const desired = targetPos.clone().add(offset);

    // نرم کردن حرکت
    this.camera.position.lerp(desired, Math.min(1, dt * 10));
    this.camera.lookAt(targetPos);
  }
}