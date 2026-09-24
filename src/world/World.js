import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Lighting } from './Lighting.js';
import { Water } from './Water.js';
import { City } from './City.js';

export class World {
  constructor(physics) {
    this.group = new THREE.Group();

    this.group.add(new Lighting().group);
    this.group.add(new Water().mesh);
    this.group.add(new City(physics).group);
  }

  update(dt) {}
}