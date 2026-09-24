/**
 * Loader: لودر مرکزی برای assetها.
 * فعلاً فقط یه پلیس‌هولدر ساده‌ست تا بعداً GLTF/Texture بهش اضافه بشه.
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

export class Loader {
  constructor() {
    this.gltf = new GLTFLoader();
    this.texture = new TextureLoader();
    this.cache = new Map();
  }

  loadTexture(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = this.texture.loadAsync(url);
    this.cache.set(url, p);
    return p;
  }

  loadGLTF(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = this.gltf.loadAsync(url);
    this.cache.set(url, p);
    return p;
  }
}