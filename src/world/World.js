import * as THREE from 'three';
import { Lighting } from './Lighting.js';
import { City } from './City.js';

export class World {
  constructor(physics, assets) {
    this.physics = physics;
    this.assets = assets;

    this.group = new THREE.Group();
    this.group.name = 'World';

    this.lighting = new Lighting();
    this.group.add(this.lighting.group);

    this.city = new City(physics, assets);
    this.group.add(this.city.group);
  }

  async load() {
    try {
      await this.city.load();
    } catch (error) {
      console.error('[World] City loading failed:', error);
      throw error;
    }
  }

  update(dt) {
    if (this.lighting && this.lighting.update) this.lighting.update(dt);
  }
}
