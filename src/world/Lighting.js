import * as THREE from 'three';

export class Lighting {
  constructor() {
    this.group = new THREE.Group();

    // نور محیطی قوی‌تر تا همه‌چیز دیده بشه
    this.group.add(new THREE.AmbientLight(0xffffff, 0.8));
    this.group.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a3f35, 0.9));

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.6);
    sun.position.set(150, 250, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);

    const d = 400;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1000;

    this.group.add(sun);
  }
}