import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();
    this.gltfCache = new Map();
  }

  async loadCharacter(modelUrl) {
    // === مدل ===
    if (!this.gltfCache.has(modelUrl)) {
      this.gltfCache.set(modelUrl, this.gltf.loadAsync(modelUrl));
    }
    const gltf = await this.gltfCache.get(modelUrl);

    console.log('=== GLB loaded:', modelUrl);
    console.log(
      'Animations:',
      gltf.animations.map((a) => a.name)
    );

    // === کلون درست ===
    const model = skeletonClone(gltf.scene);

    // فقط shadow و frustumCulled رو تنظیم کن، به material دست نزن
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });

    const animations = gltf.animations.map((clip) => clip.clone());

    return { model, animations };
  }
}