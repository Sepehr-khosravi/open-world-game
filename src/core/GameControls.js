import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class GameControls {
  constructor(camera, player, domElement) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;

    this.controls = new PointerLockControls(camera, domElement);
    this.sensitivity = 0.002;
    this.isLocked = false;
    this.menuOpen = false;

    this._bind();
  }

  _bind() {
    // کلیک برای قفل کردن موس
    this.domElement.addEventListener('click', () => {
      if (!this.menuOpen) this.controls.lock();
    });

    this.controls.addEventListener('lock', () => {
      this.isLocked = true;
    });

    this.controls.addEventListener('unlock', () => {
      this.isLocked = false;
    });

    // Esc برای منو (PointerLockControls خودش با Esc آنلاک می‌کنه، پس ما منو رو باز می‌کنیم)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.menuOpen) {
        this.openMenu();
      }
    });

    // حرکت ماوس فقط وقتی قفله
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      // PointerLockControls خودش هندل می‌کنه، ولی sensitivity رو می‌تونیم تغییر بدیم
    });
  }

  setSensitivity(value) {
    this.sensitivity = value;
    // PointerLockControls داخلی pointerSpeed داره
    if (this.controls.pointerSpeed !== undefined) {
      this.controls.pointerSpeed = value / 0.002;
    }
  }

  openMenu() {
    this.menuOpen = true;
    document.getElementById('settings-menu')?.classList.add('open');
  }

  closeMenu() {
    this.menuOpen = false;
    document.getElementById('settings-menu')?.classList.remove('open');
  }

  update(dt) {
    // دوربین سوم شخص: موقعیت رو از فیزیک بگیر و کمی عقب‌تر بذار
    if (!this.player) return;

    const pos = this.player.getPosition();
    const camPos = this.camera.position;

    // فاصله پشت سر
    const dist = 6;
    const height = 3;

    // جهت دوربین از کنترلر
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // موقعیت هدف: کمی جلوتر از شخصیت
    const target = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);

    // دوربین رو عقب‌تر ببر
    const desired = target.clone().add(
      dir.clone().multiplyScalar(-dist)
    );
    desired.y = pos.y + height;

    camPos.lerp(desired, Math.min(1, dt * 8));
    this.camera.lookAt(target);
  }
}