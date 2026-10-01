import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Vehicle } from '../entities/Vehicle.js';

export class VehicleManager {
  constructor(scene, physics, assets) {
    this.scene = scene;
    this.physics = physics;
    this.assets = assets;

    this.vehicles = [];
    this.activeVehicle = null;

    this.carBodies = [];
    this._loaded = false;

    this.chunkVehicles = new Map();
    this.carsPerChunk = 2;

    this.spawnTypes = [
      'sedan', 'suv', 'taxi', 'police', 'van', 'hatchback-sports', 'box',
    ];

    this.ACTIVE_RADIUS = 60;
    this.KEEP_RADIUS = 120;
  }

  async load() {
    const cBase = '/models/car/Models/GLB%20format';

    const carFiles = [
      'sedan', 'sedan-sports', 'suv', 'suv-luxury',
      'hatchback-sports', 'taxi', 'police', 'ambulance',
      'delivery', 'box', 'truck', 'van',
    ];

    for (const name of carFiles) {
      try {
        const { model } = await this.assets.load(`${cBase}/${name}.glb`);
        this.carBodies.push({ name, model });
      } catch (e) {
        console.error(`[VehicleManager] car ${name} failed:`, e);
      }
    }
    this._loaded = true;
  }

  updateChunks(playerX, playerZ, chunkSize, renderDistance) {
    const cx = Math.floor(playerX / chunkSize);
    const cz = Math.floor(playerZ / chunkSize);

    const required = new Set();

    for (let x = cx - renderDistance; x <= cx + renderDistance; x++) {
      for (let z = cz - renderDistance; z <= cz + renderDistance; z++) {
        const key = `${x}:${z}`;
        required.add(key);
        if (!this.chunkVehicles.has(key)) {
          this._spawnChunk(x, z, chunkSize);
        }
      }
    }

    for (const [key] of this.chunkVehicles) {
      if (!required.has(key)) {
        this._despawnChunk(key);
      }
    }
  }

  _spawnChunk(cx, cz, chunkSize) {
    if (!this._loaded) return;

    const key = `${cx}:${cz}`;
    const cars = [];

    const baseX = cx * chunkSize;
    const baseZ = cz * chunkSize;

    let s = Math.abs((cx * 73856093) ^ (cz * 19349663)) || 1;
    const rng = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };

    for (let i = 0; i < this.carsPerChunk; i++) {
      let lx, lz;
      let tries = 0;
      do {
        lx = (rng() - 0.5) * chunkSize * 0.7;
        lz = (rng() - 0.5) * chunkSize * 0.7;
        tries++;
      } while (
        tries < 20 &&
        (Math.abs(lx) < 10 || Math.abs(lz) < 10)
      );

      const worldX = baseX + lx;
      const worldZ = baseZ + lz;
      const rotationY = rng() * Math.PI * 2;

      const typeName = this.spawnTypes[Math.floor(rng() * this.spawnTypes.length)];
      const body = this.carBodies.find(c => c.name === typeName);
      if (!body) continue;

      const v = new Vehicle({
        bodyModel: body.model,
        physics: this.physics,
        x: worldX,
        z: worldZ,
        rotationY,
        name: typeName,
      });

      // Tracking fields
      v._physicsActive = false;
      v._lastSafePosition = new CANNON.Vec3(worldX, v.chassisY, worldZ);

      this.scene.add(v.group);
      this.vehicles.push(v);
      cars.push(v);
    }

    this.chunkVehicles.set(key, cars);
  }

  _activateVehiclePhysics(v) {
    if (v._physicsActive) return;

    v._physicsActive = true;

    v.chassisBody.collisionResponse = false;

    /*
     * Wake the chassis before putting it back
     * into active simulation.
     */
    if (typeof v.chassisBody.wakeUp === 'function') {
      v.chassisBody.wakeUp();
    }

    if (!v.vehicle.world) {
      v.vehicle.addToWorld(this.physics.world);
    }
  }

  _deactivateVehiclePhysics(v) {
    /*
     * NEVER deactivate the vehicle being driven.
     */
    if (this.activeVehicle === v) {
      return;
    }

    if (!v._physicsActive) {
      return;
    }

    v._physicsActive = false;

    /*
     * Save its current position before removing
     * it from simulation.
     */
    if (v.chassisBody.position.y > -1) {
      v._lastSafePosition.copy(v.chassisBody.position);
    }

    if (v.vehicle.world) {
      v.vehicle.removeFromWorld(this.physics.world);
    }
  }

  _despawnChunk(key) {
    const cars = this.chunkVehicles.get(key);
    if (!cars) return;

    for (const v of cars) {
      if (this.activeVehicle === v) {
        this.activeVehicle = null;
      }
      v.destroy();
      const idx = this.vehicles.indexOf(v);
      if (idx >= 0) this.vehicles.splice(idx, 1);
    }

    this.chunkVehicles.delete(key);
  }

  /*
   * Called every frame from main loop.
   * Activates physics only for vehicles near the player.
   */
  updateActive(playerPos) {
    const px = playerPos.x;
    const pz = playerPos.z;
    const r2 = this.ACTIVE_RADIUS * this.ACTIVE_RADIUS;

    for (const v of this.vehicles) {
      const vp = v.getPosition();
      const dx = vp.x - px;
      const dz = vp.z - pz;
      const d2 = dx * dx + dz * dz;

      const shouldBeActive = d2 < r2;

      if (shouldBeActive && !v._physicsActive) {
        this._activateVehiclePhysics(v);
      }

      if (
        !shouldBeActive &&
        v._physicsActive &&
        this.activeVehicle !== v
      ) {
        this._deactivateVehiclePhysics(v);
      }
    }
  }

  findNearestVehicle(playerPos, maxDist = 4) {
    let best = null;
    let bestDist = maxDist;

    for (const v of this.vehicles) {
      const d = v.getPosition().distanceTo(playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }

    return best;
  }

  enterVehicle(vehicle) {
    if (this.activeVehicle) return false;

    this._activateVehiclePhysics(vehicle);

    this.activeVehicle = vehicle;
    vehicle.enter();
    return true;
  }

  exitVehicle() {
    if (!this.activeVehicle) return;
    this.activeVehicle.exit();
    this.activeVehicle = null;
  }

  isDriving() {
    return this.activeVehicle !== null;
  }

  update(dt) {
    for (const v of this.vehicles) v.update(dt);
  }

  destroy() {
    for (const v of this.vehicles) {
      if (v._physicsActive) this._deactivateVehiclePhysics(v);
      v.destroy();
    }
    this.vehicles.length = 0;
    this.chunkVehicles.clear();
    this.activeVehicle = null;
  }
}
