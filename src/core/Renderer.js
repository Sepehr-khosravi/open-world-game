/**
 * Renderer: پوششی نازک روی THREE.WebGLRenderer.
 */
import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.0;
  }

  setSize(width, height) {
    this.instance.setSize(width, height, false);
  }

  render(scene, camera) {
    this.instance.render(scene, camera);
  }
}