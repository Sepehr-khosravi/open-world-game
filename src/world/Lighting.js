import * as THREE from 'three';

export class Lighting {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Lighting';

    // Ambient — soft base
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.group.add(ambient);

    // Hemisphere — sky vs ground
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a3f35, 0.85);
    this.group.add(hemi);

    // Sun
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.6);
    sun.position.set(80, 140, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);

    const d = 80;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;

    this.sun = sun;
    this.group.add(sun);

    // Keep sun following a target for tight shadows
    this.sunTarget = new THREE.Object3D();
    this.group.add(this.sunTarget);
    sun.target = this.sunTarget;
  }

  update(dt) {}

  /*
   * Called by main loop when we want the sun to follow
   * the player (keeps shadows sharp near the camera).
   */
  followTarget(x, z) {
    this.sun.position.set(x + 80, 140, z + 60);
    this.sunTarget.position.set(x, 0, z);
    this.sunTarget.updateMatrixWorld();
  }
}
