import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();
    this.gltfCache = new Map();
  }

  async load(modelUrl, { skinned = false } = {}) {
    if (!this.gltfCache.has(modelUrl)) {
      const promise = this.gltf.loadAsync(modelUrl).catch((error) => {
        console.error(`[AssetLoader] Failed to load: ${modelUrl}`, error);
        this.gltfCache.delete(modelUrl);
        throw error;
      });

      this.gltfCache.set(modelUrl, promise);
    }

    const gltf = await this.gltfCache.get(modelUrl);

    const model = skinned
      ? skeletonClone(gltf.scene)
      : gltf.scene.clone(true);

    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    return {
      model,
      animations: gltf.animations.map((clip) => clip.clone()),
    };
  }

  async loadCharacter(modelUrl) {
    return this.load(modelUrl, { skinned: true });
  }
}
