/**
 * CameraRig: دوربین + کنترل‌های چرخش.
 * فعلاً فقط چرخش دستی ساده داره تا بعداً OrbitControls جایگزین بشه.
 */
import * as THREE from 'three';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // موقعیت اولیه: بالای شهر، کمی زاویه‌دار
    this.camera.position.set(80, 90, 140);
    this.camera.lookAt(0, 0, 0);

    // پارامترهای چرخش مداری (برای بعداً)
    this.target = new THREE.Vector3(0, 0, 0);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(_dt) {
    // اینجا بعداً OrbitControls یا حرکت دوربین اضافه می‌شه
  }
}