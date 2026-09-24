import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Building } from './Building.js';

export class City {
  constructor(physics) {
    this.physics = physics;
    this.group = new THREE.Group();
    this.group.name = 'City';

    this.size = 260;
    this.roadWidth = 6;
    this.blocks = 5;

    this._createGround();
    this._createBeach();
    this._createRoads();
    this._createBuildings();
    this._createPhysicsGround();
  }

  // ---------- زمین شهر ----------
  _createGround() {
    const geo = new THREE.PlaneGeometry(this.size, this.size);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.95,
      metalness: 0.05,
    });

    const ground = new THREE.Mesh(geo, mat);
    ground.name = 'CityGround';
    ground.receiveShadow = true;
    ground.position.y = 0;

    this.group.add(ground);
  }

  // ---------- ساحل ----------
  _createBeach() {
    const beachWidth = 18;
    const outer = this.size + beachWidth * 2;

    const geo = new THREE.PlaneGeometry(outer, outer);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xd9c79a,
      roughness: 1,
      metalness: 0,
    });

    const beach = new THREE.Mesh(geo, mat);
    beach.name = 'Beach';
    beach.position.y = -0.15;
    beach.receiveShadow = true;

    this.group.add(beach);
  }

  // ---------- خیابون‌ها ----------
  _createRoads() {
    const n = this.blocks;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x8a8f96,
      roughness: 0.9,
      metalness: 0.05,
    });

    const blockSize = (this.size - this.roadWidth * (n + 1)) / n;
    const step = blockSize + this.roadWidth;
    const total = n * blockSize + (n + 1) * this.roadWidth;
    const start = -total / 2;

    for (let i = 0; i <= n; i++) {
      const z = start + this.roadWidth / 2 + i * step;
      const geo = new THREE.PlaneGeometry(this.size, this.roadWidth);
      geo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(geo, roadMat);
      road.position.set(0, 0.02, z);
      road.receiveShadow = true;
      this.group.add(road);
    }

    for (let j = 0; j <= n; j++) {
      const x = start + this.roadWidth / 2 + j * step;
      const geo = new THREE.PlaneGeometry(this.roadWidth, this.size);
      geo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(geo, roadMat);
      road.position.set(x, 0.02, 0);
      road.receiveShadow = true;
      this.group.add(road);
    }

    this._blockSize = blockSize;
    this._step = step;
    this._start = start;
  }

  // ---------- ساختمان‌ها ----------
  _createBuildings() {
    const n = this.blocks;
    const blockSize = this._blockSize;
    const step = this._step;
    const start = this._start;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = start + this.roadWidth + blockSize / 2 + i * step;
        const cz = start + this.roadWidth + blockSize / 2 + j * step;

        const mid = Math.floor(n / 2);
        if (i === mid && j === mid) continue;

        const perSide = 2;
        const cell = blockSize / perSide;

        for (let a = 0; a < perSide; a++) {
          for (let b = 0; b < perSide; b++) {
            const seed = (i * 73 + j * 41 + a * 13 + b * 7) % 100;
            if (seed % 5 === 0) continue;

            const w = cell * (0.5 + (seed % 3) * 0.08);
            const d = cell * (0.5 + ((seed * 2) % 3) * 0.08);
            const h = 10 + (seed % 9) * 3.5;

            const x = cx - blockSize / 2 + cell / 2 + a * cell;
            const z = cz - blockSize / 2 + cell / 2 + b * cell;

            const bld = new Building({ width: w, depth: d, height: h, x, z });
            this.group.add(bld.mesh);
          }
        }
      }
    }
  }

  // ---------- زمین فیزیکی ----------
  _createPhysicsGround() {
    // یه بدنه‌ی استاتیک بزرگ به عنوان زمین
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.physics.groundMaterial,
    });
    // Plane در cannon-es به صورت پیش‌فرض رو به +Z هست، باید بچرخونیمش
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, 0, 0);
    this.physics.world.addBody(groundBody);

    this.groundBody = groundBody;
  }

  update(dt) {}
}