import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Building } from './Building.js';

const CITY_SCALE = 8;

export class City {
  constructor(physics, assets) {
    this.physics = physics;
    this.assets = assets;

    this.group = new THREE.Group();
    this.group.name = 'City';

    this.cityScale = CITY_SCALE;

    this.chunkTiles = 9;
    this.chunkSize =
      this.chunkTiles * CITY_SCALE;

    this.renderDistance = 2;

    this.loadedChunks = new Map();

    this.assets_building = [];
    this.assets_road = {};
    this.assets_prop = {};
    this.assets_veg = [];

    /*
     * Road collision settings.
     *
     * We intentionally use simple boxes instead of
     * triangle-mesh physics. This is much more stable
     * with Cannon-es RaycastVehicle.
     */
    this.roadColliderThickness = 0.10;

    /*
     * Maximum amount of vertical geometry that can be
     * treated as the road surface.
     *
     * This prevents things such as decorative curbs,
     * markings or small details from making the whole
     * road collider unnecessarily high.
     */
    this.roadMaxSurfaceHeight = 0.30;
  }

  async load() {
    await this._loadAllAssets();

    await this.updatePlayerPosition(
      new THREE.Vector3(0, 0, 0)
    );
  }

  setPlayerChunk() {}

  // ============================================================
  // ASSETS
  // ============================================================

  async _loadAllAssets() {
    const roadFiles = {
      straight: 'road-straight.glb',
      crossroad: 'road-crossroad.glb',
      crossroadLine: 'road-crossroad-line.glb',
      bend: 'road-bend.glb',
      curve: 'road-curve.glb',
      side: 'road-side.glb',
      crossing: 'road-crossing.glb',
      intersection: 'road-intersection.glb',
      square: 'road-square.glb',
      end: 'road-end.glb',
      trafficLight: 'traffic-light.glb',
      lightSquare: 'light-square.glb',
    };

    const propFiles = {
      planter: 'planter.glb',
      pathLong: 'path-long.glb',
      pathShort: 'path-short.glb',
    };

    const vegFiles = {
      treeLarge: 'tree-large.glb',
      treeSmall: 'tree-small.glb',
    };

    const bPromises = [];

    for (let i = 0; i < 21; i++) {
      const letter =
        String.fromCharCode(97 + i);

      bPromises.push(
        this.assets
          .load(
            `/models/city/buildings/building-type-${letter}.glb`
          )
          .then(({ model }) => {
            model.updateMatrixWorld(true);

            const box =
              new THREE.Box3()
                .setFromObject(model);

            const size =
              new THREE.Vector3();

            box.getSize(size);

            this.assets_building.push({
              model,
              rawSize: size.clone(),
            });
          })
          .catch((e) =>
            console.error(
              `[City] building ${letter}:`,
              e
            )
          )
      );
    }

    const rBase =
      '/models/city/roads/GLB%20format';

    const rPromises =
      Object.entries(roadFiles).map(
        ([key, file]) =>
          this.assets
            .load(`${rBase}/${file}`)
            .then(({ model }) => {
              this._prep(model);
              this.assets_road[key] = model;
            })
            .catch((e) =>
              console.error(
                `[City] road ${file}:`,
                e
              )
            )
      );

    const pBase =
      '/models/city/props';

    const pPromises =
      Object.entries(propFiles).map(
        ([key, file]) =>
          this.assets
            .load(`${pBase}/${file}`)
            .then(({ model }) => {
              this._prep(model);
              this.assets_prop[key] = model;
            })
            .catch((e) =>
              console.error(
                `[City] prop ${file}:`,
                e
              )
            )
      );

    const vBase =
      '/models/city/vegetation';

    const vPromises =
      Object.entries(vegFiles).map(
        ([key, file]) =>
          this.assets
            .load(`${vBase}/${file}`)
            .then(({ model }) => {
              this._prep(model);
              this.assets_veg[key] = model;
            })
            .catch((e) =>
              console.error(
                `[City] veg ${file}:`,
                e
              )
            )
      );

    await Promise.all([
      ...bPromises,
      ...rPromises,
      ...pPromises,
      ...vPromises,
    ]);
  }

  _prep(model) {
    model.traverse((n) => {
      if (!n.isMesh) return;

      n.castShadow = false;
      n.receiveShadow = true;
      n.frustumCulled = true;
    });
  }

  // ============================================================
  // PLACE
  // ============================================================

  _place(
    parent,
    model,
    tileX,
    tileZ,
    rotationTurns = 0,
    pivotOffsetLocalZ = 0,
    yOffset = 0,
    yScale = 1
  ) {
    if (!model) return null;

    const clone =
      model.clone(true);

    clone.scale.set(
      this.cityScale,
      this.cityScale * yScale,
      this.cityScale
    );

    const angle =
      rotationTurns *
      Math.PI /
      2;

    clone.rotation.y = angle;

    const offX =
      Math.sin(angle) *
      pivotOffsetLocalZ;

    const offZ =
      Math.cos(angle) *
      pivotOffsetLocalZ;

    clone.position.set(
      (tileX + offX) *
        this.cityScale,

      yOffset *
        this.cityScale,

      (tileZ + offZ) *
        this.cityScale
    );

    parent.add(clone);

    return clone;
  }

  // ============================================================
  // ROAD COLLIDER
  // ============================================================

  _addRoadCollider(
    chunk,
    mesh,
    {
      surfaceOffset = 0,
      maxHeight = this.roadMaxSurfaceHeight,
    } = {}
  ) {
    if (!mesh) return;

    /*
     * Make sure all transforms are up to date before
     * calculating the world-space bounding box.
     */
    mesh.updateMatrixWorld(true);

    const box =
      new THREE.Box3()
        .setFromObject(mesh);

    if (box.isEmpty()) {
      return;
    }

    const size =
      new THREE.Vector3();

    box.getSize(size);

    /*
     * Ignore tiny/invalid geometry.
     */
    if (
      size.x < 0.1 ||
      size.z < 0.1
    ) {
      return;
    }

    /*
     * The road GLB can contain decorative geometry
     * slightly above the actual driving surface.
     *
     * We use the bottom of the visual model plus a
     * controlled height for the physical road.
     */
    const minY = box.min.y;

    let colliderHeight =
      Math.min(
        Math.max(
          size.y,
          this.roadColliderThickness
        ),
        maxHeight
      );

    /*
     * Never create a huge vertical collider.
     */
    colliderHeight =
      Math.max(
        colliderHeight,
        this.roadColliderThickness
      );

    const topY =
      minY +
      colliderHeight +
      surfaceOffset;

    const shape =
      new CANNON.Box(
        new CANNON.Vec3(
          size.x / 2,
          colliderHeight / 2,
          size.z / 2
        )
      );

    const body =
      new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material:
          this.physics.groundMaterial,
      });

    body.position.set(
      (box.min.x + box.max.x) / 2,
      topY - colliderHeight / 2,
      (box.min.z + box.max.z) / 2
    );

    /*
     * Match the visual mesh's rotation indirectly
     * through its world-space bounding box.
     *
     * The collider itself stays axis aligned, which is
     * exactly what we want for the straight road pieces.
     */
    body.quaternion.set(0, 0, 0, 1);

    body.addShape(shape);

    body.collisionResponse = true;

    this.physics.world.addBody(body);

    chunk.staticBodies.push(body);

    return body;
  }

  _placeRoad(
    chunk,
    model,
    tileX,
    tileZ,
    rotationTurns = 0,
    pivotOffsetLocalZ = 0,
    yOffset = 0,
    yScale = 1
  ) {
    if (!model) return null;

    const mesh =
      this._place(
        chunk.group,
        model,
        tileX,
        tileZ,
        rotationTurns,
        pivotOffsetLocalZ,
        yOffset,
        yScale
      );

    if (!mesh) return null;

    /*
     * Road gets real Cannon collision.
     */
    this._addRoadCollider(
      chunk,
      mesh,
      {
        surfaceOffset: 0,
      }
    );

    return mesh;
  }

  // ============================================================
  // CHUNKS
  // ============================================================

  async updatePlayerPosition(position) {
    if (
      this.assets_building.length === 0
    ) {
      return;
    }

    const cx =
      Math.floor(
        position.x /
        this.chunkSize
      );

    const cz =
      Math.floor(
        position.z /
        this.chunkSize
      );

    const required =
      new Set();

    for (
      let x = cx - this.renderDistance;
      x <= cx + this.renderDistance;
      x++
    ) {
      for (
        let z = cz - this.renderDistance;
        z <= cz + this.renderDistance;
        z++
      ) {
        const key = `${x}:${z}`;

        required.add(key);

        if (
          !this.loadedChunks.has(key)
        ) {
          await this._loadChunk(
            x,
            z
          );
        }
      }
    }

    for (
      const [key, chunk]
      of this.loadedChunks
    ) {
      if (!required.has(key)) {
        this._unloadChunk(
          key,
          chunk
        );
      }
    }
  }

  async _loadChunk(cx, cz) {
    const key = `${cx}:${cz}`;

    if (
      this.loadedChunks.has(key)
    ) {
      return;
    }

    const chunk = {
      group: new THREE.Group(),
      buildings: [],
      staticBodies: [],
    };

    chunk.group.name =
      `CityChunk_${cx}_${cz}`;

    chunk.group.position.set(
      cx * this.chunkSize,
      0,
      cz * this.chunkSize
    );

    this.group.add(
      chunk.group
    );

    this._buildGround(
      chunk
    );

    this._buildRoadNetwork(
      chunk
    );

    this._buildSidewalks(
      chunk
    );

    this._buildCrossings(
      chunk
    );

    this._buildTrafficLights(
      chunk
    );

    this._buildStreetLights(
      chunk
    );

    this._buildBuildings(
      chunk,
      cx,
      cz
    );

    this._buildVegetation(
      chunk,
      cx,
      cz
    );

    this.loadedChunks.set(
      key,
      chunk
    );
  }

  // ============================================================
  // GROUND
  // ============================================================

  _buildGround(chunk) {
    const geo =
      new THREE.PlaneGeometry(
        this.chunkSize,
        this.chunkSize
      );

    const mat =
      new THREE.MeshStandardMaterial({
        color: 0x5a7a48,
        roughness: 1,
      });

    const ground =
      new THREE.Mesh(
        geo,
        mat
      );

    ground.rotation.x =
      -Math.PI / 2;

    ground.position.y =
      -0.05;

    ground.receiveShadow = true;

    chunk.group.add(
      ground
    );

    // ==========================================================
    // PHYSICS GROUND
    // ==========================================================

    const thickness = 0.10;

    const shape =
      new CANNON.Box(
        new CANNON.Vec3(
          this.chunkSize / 2,
          thickness / 2,
          this.chunkSize / 2
        )
      );

    const body =
      new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material:
          this.physics.groundMaterial,
      });

    body.position.set(
      chunk.group.position.x,
      -thickness / 2,
      chunk.group.position.z
    );

    body.addShape(shape);

    body.collisionResponse = true;

    this.physics.world.addBody(
      body
    );

    chunk.staticBodies.push(
      body
    );
  }

  // ============================================================
  // ROADS
  // ============================================================

  _buildRoadNetwork(chunk) {
    const straight =
      this.assets_road.straight;

    const crossroad =
      this.assets_road.crossroadLine ||
      this.assets_road.crossroad;

    if (
      !straight ||
      !crossroad
    ) {
      return;
    }

    // Vertical roads
    for (
      let tz = -4;
      tz <= 4;
      tz++
    ) {
      if (tz === 0) continue;

      this._placeRoad(
        chunk,
        straight,
        0,
        tz,
        1
      );
    }

    // Horizontal roads
    for (
      let tx = -4;
      tx <= 4;
      tx++
    ) {
      if (tx === 0) continue;

      this._placeRoad(
        chunk,
        straight,
        tx,
        0,
        0
      );
    }

    // Center intersection
    this._placeRoad(
      chunk,
      crossroad,
      0,
      0,
      0
    );
  }

  // ============================================================
  // SIDEWALKS
  // ============================================================

  _buildSidewalks(chunk) {
    const swHeight = 0.12;
    const swWidth = 2.0;

    const mat =
      new THREE.MeshStandardMaterial({
        color: 0xc8c8c0,
        roughness: 0.95,
        metalness: 0,
      });

    const half =
      this.chunkSize / 2;

    const roadHalf =
      this.cityScale / 2;

    const swCenter =
      roadHalf +
      swWidth / 2;

    const segLen =
      half -
      roadHalf;

    const segMid1 =
      -(roadHalf +
        segLen / 2);

    const segMid2 =
      +(roadHalf +
        segLen / 2);

    const baseX =
      chunk.group.position.x;

    const baseZ =
      chunk.group.position.z;

    const addStaticBox =
      (
        cx,
        cz,
        w,
        h,
        d
      ) => {
        const shape =
          new CANNON.Box(
            new CANNON.Vec3(
              w / 2,
              h / 2,
              d / 2
            )
          );

        const body =
          new CANNON.Body({
            mass: 0,
            type:
              CANNON.Body.STATIC,
            material:
              this.physics.groundMaterial,
          });

        body.position.set(
          cx,
          h / 2,
          cz
        );

        body.addShape(
          shape
        );

        this.physics.world.addBody(
          body
        );

        chunk.staticBodies.push(
          body
        );
      };

    // Vertical road

    for (
      const x
      of [-swCenter, swCenter]
    ) {
      for (
        const z
        of [segMid1, segMid2]
      ) {
        const geo =
          new THREE.BoxGeometry(
            swWidth,
            swHeight,
            segLen
          );

        const mesh =
          new THREE.Mesh(
            geo,
            mat
          );

        mesh.position.set(
          x,
          swHeight / 2,
          z
        );

        mesh.receiveShadow = true;

        chunk.group.add(
          mesh
        );

        addStaticBox(
          baseX + x,
          baseZ + z,
          swWidth,
          swHeight,
          segLen
        );
      }
    }

    // Horizontal road

    for (
      const z
      of [-swCenter, swCenter]
    ) {
      for (
        const x
        of [segMid1, segMid2]
      ) {
        const geo =
          new THREE.BoxGeometry(
            segLen,
            swHeight,
            swWidth
          );

        const mesh =
          new THREE.Mesh(
            geo,
            mat
          );

        mesh.position.set(
          x,
          swHeight / 2,
          z
        );

        mesh.receiveShadow = true;

        chunk.group.add(
          mesh
        );

        addStaticBox(
          baseX + x,
          baseZ + z,
          segLen,
          swHeight,
          swWidth
        );
      }
    }
  }

  // ============================================================
  // CROSSINGS
  // ============================================================

  _buildCrossings(chunk) {
    const crossing =
      this.assets_road.crossing;

    if (!crossing) return;

    const yScale = 0.1;
    const yOff = 0.005;

    this._placeRoad(
      chunk,
      crossing,
      0,
      -1,
      0,
      0,
      yOff,
      yScale
    );

    this._placeRoad(
      chunk,
      crossing,
      0,
      1,
      0,
      0,
      yOff,
      yScale
    );

    this._placeRoad(
      chunk,
      crossing,
      -1,
      0,
      1,
      0,
      yOff,
      yScale
    );

    this._placeRoad(
      chunk,
      crossing,
      1,
      0,
      1,
      0,
      yOff,
      yScale
    );
  }

  // ============================================================
  // TRAFFIC LIGHTS
  // ============================================================

  _buildTrafficLights(chunk) {
    const tLight =
      this.assets_road.trafficLight;

    if (!tLight) return;

    const t = 0.5625;

    const corners = [
      {
        tx: -t,
        tz: -t,
        rot: 0,
      },
      {
        tx: t,
        tz: -t,
        rot: 1,
      },
      {
        tx: -t,
        tz: t,
        rot: 3,
      },
      {
        tx: t,
        tz: t,
        rot: 2,
      },
    ];

    for (
      const c of corners
    ) {
      this._place(
        chunk.group,
        tLight,
        c.tx,
        c.tz,
        c.rot
      );
    }
  }

  // ============================================================
  // STREET LIGHTS
  // ============================================================

  _buildStreetLights(chunk) {
    const light =
      this.assets_road.lightSquare;

    if (!light) return;

    const positions = [
      {
        tx: -1.5,
        tz: -3,
        rot: 1,
      },
      {
        tx: 1.5,
        tz: -3,
        rot: 3,
      },
      {
        tx: -1.5,
        tz: 3,
        rot: 1,
      },
      {
        tx: 1.5,
        tz: 3,
        rot: 3,
      },
      {
        tx: -3,
        tz: -1.5,
        rot: 0,
      },
      {
        tx: 3,
        tz: -1.5,
        rot: 0,
      },
      {
        tx: -3,
        tz: 1.5,
        rot: 2,
      },
      {
        tx: 3,
        tz: 1.5,
        rot: 2,
      },
    ];

    for (
      const p of positions
    ) {
      this._place(
        chunk.group,
        light,
        p.tx,
        p.tz,
        p.rot
      );
    }
  }

  // ============================================================
  // BUILDINGS
  // ============================================================

  _buildBuildings(
    chunk,
    cx,
    cz
  ) {
    if (
      this.assets_building.length === 0
    ) {
      return;
    }

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

    const corners = [
      {
        tx: -3.2,
        tz: -3.2,
      },
      {
        tx: 3.2,
        tz: -3.2,
      },
      {
        tx: -3.2,
        tz: 3.2,
      },
      {
        tx: 3.2,
        tz: 3.2,
      },
    ];

    const gridOffsets = [
      {
        dx: -1.0,
        dz: -1.0,
      },
      {
        dx: 1.0,
        dz: -1.0,
      },
      {
        dx: -1.0,
        dz: 1.0,
      },
      {
        dx: 1.0,
        dz: 1.0,
      },
    ];

    for (
      const corner
      of corners
    ) {
      for (
        const off
        of gridOffsets
      ) {
        if (
          rng() < 0.10
        ) {
          continue;
        }

        const tx =
          corner.tx +
          off.dx;

        const tz =
          corner.tz +
          off.dz;

        const asset =
          this.assets_building[
            Math.floor(
              rng() *
              this.assets_building.length
            )
          ];

        const rotY =
          rng() < 0.5
            ? 0
            : Math.PI / 2;

        const worldX =
          chunk.group.position.x +
          tx * this.cityScale;

        const worldZ =
          chunk.group.position.z +
          tz * this.cityScale;

        const building =
          new Building({
            model: asset.model,
            physics: this.physics,
            x: worldX,
            z: worldZ,
            scale: this.cityScale,
            rotationY: rotY,
          });

        building.mesh.position.set(
          tx * this.cityScale,
          0,
          tz * this.cityScale
        );

        chunk.group.add(
          building.mesh
        );

        chunk.buildings.push(
          building
        );
      }
    }
  }

  // ============================================================
  // VEGETATION
  // ============================================================

  _buildVegetation(
    chunk,
    cx,
    cz
  ) {
    let s =
      Math.abs(
        (cx * 31415926) ^
        (cz * 27182818)
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

    const trees = [
      this.assets_veg.treeLarge,
      this.assets_veg.treeSmall,
    ].filter(Boolean);

    if (
      trees.length === 0
    ) {
      return;
    }

    const spots = [
      {
        tx: -4.5,
        tz: -4.5,
      },
      {
        tx: 4.5,
        tz: -4.5,
      },
      {
        tx: -4.5,
        tz: 4.5,
      },
      {
        tx: 4.5,
        tz: 4.5,
      },
    ];

    for (
      const spot of spots
    ) {
      if (
        rng() < 0.30
      ) {
        continue;
      }

      const model =
        trees[
          Math.floor(
            rng() *
            trees.length
          )
        ];

      this._place(
        chunk.group,
        model,
        spot.tx,
        spot.tz,
        Math.floor(
          rng() * 4
        ),
        0,
        0
      );
    }
  }

  // ============================================================
  // UNLOAD
  // ============================================================

  _unloadChunk(
    key,
    chunk
  ) {
    for (
      const building
      of chunk.buildings
    ) {
      building.destroy();
    }

    chunk.buildings.length = 0;

    if (
      chunk.staticBodies
    ) {
      for (
        const body
        of chunk.staticBodies
      ) {
        this.physics.world.removeBody(
          body
        );
      }

      chunk.staticBodies.length = 0;
    }

    chunk.group.removeFromParent();

    this.loadedChunks.delete(
      key
    );
  }

  update() {}
}