import * as THREE from 'three';

export class Water {
  constructor() {
    const size = 4000;

    const geometry = new THREE.PlaneGeometry(size, size, 64, 64);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x1a6b9c,
      transparent: true,
      opacity: 0.9,
      roughness: 0.3,
      metalness: 0.2,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Water';
    this.mesh.position.y = -2.5; // پایین‌تر از سطح شهر و ساحل
  }

  update(dt) {}
}