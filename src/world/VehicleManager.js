import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { Vehicle } from '../entities/Vehicle.js';

export class VehicleManager {
  constructor(
    scene,
    physics,
    assets
  ) {
    this.scene = scene;
    this.physics = physics;
    this.assets = assets;

    this.vehicles = [];
    this.activeVehicle = null;

    this.carBodies = [];
    this._loaded = false;

    this.chunkVehicles =
      new Map();

    this.carsPerChunk = 3;

    this.spawnTypes = [
      'sedan',
      'suv',
      'taxi',
      'police',
      'van',
      'hatchback-sports',
      'box',
    ];

    this.ACTIVE_RADIUS = 60;
    this.KEEP_RADIUS = 100;
  }

  // ============================================================
  // LOAD
  // ============================================================

  async load() {
    const cBase =
      '/models/car/Models/GLB%20format';

    const carFiles = [
      'sedan',
      'sedan-sports',
      'suv',
      'suv-luxury',
      'hatchback-sports',
      'taxi',
      'police',
      'ambulance',
      'delivery',
      'box',
      'truck',
      'van',
    ];

    for (
      const name
      of carFiles
    ) {
      try {
        const {
          model,
        } =
          await this.assets.load(
            `${cBase}/${name}.glb`
          );

        this.carBodies.push({
          name,
          model,
        });
      } catch (e) {
        console.error(
          `[VehicleManager] car ${name} failed:`,
          e
        );
      }
    }

    this._loaded = true;
  }

  // ============================================================
  // CHUNKS
  // ============================================================

  updateChunks(
    playerX,
    playerZ,
    chunkSize,
    renderDistance
  ) {
    if (!this._loaded) return;

    const cx =
      Math.floor(
        playerX /
        chunkSize
      );

    const cz =
      Math.floor(
        playerZ /
        chunkSize
      );

    const required =
      new Set();

    for (
      let x = cx - renderDistance;
      x <= cx + renderDistance;
      x++
    ) {
      for (
        let z = cz - renderDistance;
        z <= cz + renderDistance;
        z++
      ) {
        const key =
          `${x}:${z}`;

        required.add(key);

        if (
          !this.chunkVehicles.has(
            key
          )
        ) {
          this._spawnChunk(
            x,
            z,
            chunkSize
          );
        }
      }
    }

    for (
      const [
        key,
        cars,
      ]
      of this.chunkVehicles
    ) {
      if (
        required.has(key)
      ) {
        continue;
      }

      /*
       * NEVER despawn the chunk containing
       * the active vehicle.
       */
      if (
        cars.includes(
          this.activeVehicle
        )
      ) {
        continue;
      }

      this._despawnChunk(
        key
      );
    }
  }

  // ============================================================
  // SPAWN
  // ============================================================

  _spawnChunk(
    cx,
    cz,
    chunkSize
  ) {
    if (!this._loaded) {
      return;
    }

    const key =
      `${cx}:${cz}`;

    if (
      this.chunkVehicles.has(key)
    ) {
      return;
    }

    const cars = [];

    const baseX =
      cx * chunkSize;

    const baseZ =
      cz * chunkSize;

    let s =
      Math.abs(
        (cx * 73856093) ^
        (cz * 19349663)
      ) || 1;

    const rng = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;

      return (
        (s >>> 0) /
        4294967296
      );
    };

    for (
      let i = 0;
      i < this.carsPerChunk;
      i++
    ) {
      let lx;
      let lz;

      let tries = 0;

      do {
        lx =
          (rng() - 0.5) *
          chunkSize *
          0.7;

        lz =
          (rng() - 0.5) *
          chunkSize *
          0.7;

        tries++;
      } while (
        tries < 20 &&
        (
          Math.abs(lx) < 10 ||
          Math.abs(lz) < 10
        )
      );

      const worldX =
        baseX + lx;

      const worldZ =
        baseZ + lz;

      const rotationY =
        rng() *
        Math.PI *
        2;

      const typeName =
        this.spawnTypes[
          Math.floor(
            rng() *
            this.spawnTypes.length
          )
        ];

      const body =
        this.carBodies.find(
          (c) =>
            c.name === typeName
        );

      if (!body) {
        continue;
      }

      const vehicle =
        new Vehicle({
          bodyModel: body.model,
          physics: this.physics,
          x: worldX,
          z: worldZ,
          rotationY,
          name: typeName,
        });

      this.scene.add(
        vehicle.group
      );

      this.vehicles.push(
        vehicle
      );

      cars.push(
        vehicle
      );
    }

    this.chunkVehicles.set(
      key,
      cars
    );
  }

  // ============================================================
  // PHYSICS ACTIVE
  // ============================================================

  _activateVehiclePhysics(
    vehicle
  ) {
    if (
      vehicle._physicsActive
    ) {
      return;
    }

    vehicle._physicsActive =
      true;

    vehicle.chassisBody.collisionResponse =
      false;

    vehicle.chassisBody.wakeUp();

    if (
      !vehicle.vehicle.world
    ) {
      vehicle.vehicle.addToWorld(
        this.physics.world
      );
    }
  }

  _deactivateVehiclePhysics(
    vehicle
  ) {
    /*
     * Active vehicle is NEVER deactivated.
     */
    if (
      this.activeVehicle ===
      vehicle
    ) {
      return;
    }

    if (
      !vehicle._physicsActive
    ) {
      return;
    }

    vehicle._physicsActive =
      false;

    if (
      vehicle.chassisBody.position.y >
      -1
    ) {
      vehicle._lastSafePosition.copy(
        vehicle.chassisBody.position
      );

      vehicle._lastSafeQuaternion.copy(
        vehicle.chassisBody.quaternion
      );
    }

    if (
      vehicle.vehicle.world
    ) {
      vehicle.vehicle.removeFromWorld(
        this.physics.world
      );
    }
  }

  // ============================================================
  // DESPAWN
  // ============================================================

  _despawnChunk(key) {
    const cars =
      this.chunkVehicles.get(
        key
      );

    if (!cars) return;

    for (
      const vehicle
      of cars
    ) {
      /*
       * Safety:
       * active vehicle must never be destroyed.
       */
      if (
        this.activeVehicle ===
        vehicle
      ) {
        continue;
      }

      vehicle.destroy();

      const idx =
        this.vehicles.indexOf(
          vehicle
        );

      if (idx >= 0) {
        this.vehicles.splice(
          idx,
          1
        );
      }
    }

    /*
     * If somehow an active vehicle existed
     * in this chunk, keep the chunk.
     */
    if (
      cars.includes(
        this.activeVehicle
      )
    ) {
      return;
    }

    this.chunkVehicles.delete(
      key
    );
  }

  // ============================================================
  // ACTIVE VEHICLES
  // ============================================================

  updateActive(
    playerPos
  ) {
    const px =
      playerPos.x;

    const pz =
      playerPos.z;

    const r2 =
      this.ACTIVE_RADIUS *
      this.ACTIVE_RADIUS;

    for (
      const vehicle
      of this.vehicles
    ) {
      /*
       * Active vehicle is always active.
       */
      if (
        this.activeVehicle ===
        vehicle
      ) {
        if (
          !vehicle._physicsActive
        ) {
          this._activateVehiclePhysics(
            vehicle
          );
        }

        continue;
      }

      const vp =
        vehicle.getPosition();

      const dx =
        vp.x - px;

      const dz =
        vp.z - pz;

      const d2 =
        dx * dx +
        dz * dz;

      const shouldBeActive =
        d2 <
        r2;

      if (
        shouldBeActive &&
        !vehicle._physicsActive
      ) {
        this._activateVehiclePhysics(
          vehicle
        );
      }

      if (
        !shouldBeActive &&
        vehicle._physicsActive
      ) {
        this._deactivateVehiclePhysics(
          vehicle
        );
      }
    }
  }

  // ============================================================
  // FIND
  // ============================================================

  findNearestVehicle(
    playerPos,
    maxDist = 4
  ) {
    let best = null;
    let bestDist = maxDist;

    for (
      const vehicle
      of this.vehicles
    ) {
      const d =
        vehicle
          .getPosition()
          .distanceTo(
            playerPos
          );

      if (
        d < bestDist
      ) {
        bestDist = d;
        best = vehicle;
      }
    }

    return best;
  }

  // ============================================================
  // ENTER
  // ============================================================

  enterVehicle(
    vehicle
  ) {
    if (
      this.activeVehicle
    ) {
      return false;
    }

    this._activateVehiclePhysics(
      vehicle
    );

    this.activeVehicle =
      vehicle;

    vehicle.enter();

    return true;
  }

  // ============================================================
  // EXIT
  // ============================================================

  exitVehicle() {
    if (
      !this.activeVehicle
    ) {
      return;
    }

    this.activeVehicle.exit();

    this.activeVehicle =
      null;
  }

  // ============================================================
  // STATE
  // ============================================================

  isDriving() {
    return (
      this.activeVehicle !== null
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt) {
    for (
      const vehicle
      of this.vehicles
    ) {
      vehicle.update(dt);
    }
  }

  // ============================================================
  // DESTROY
  // ============================================================

  destroy() {
    for (
      const vehicle
      of this.vehicles
    ) {
      if (
        vehicle._physicsActive
      ) {
        this._deactivateVehiclePhysics(
          vehicle
        );
      }

      vehicle.destroy();
    }

    this.vehicles.length = 0;

    this.chunkVehicles.clear();

    this.activeVehicle = null;
  }
}