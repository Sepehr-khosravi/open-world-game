import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Building {
  constructor({
    model,
    physics,
    x = 0,
    z = 0,
    scale = 8,
    rotationY = 0,
  }) {
    this.physics = physics;

    this.group = new THREE.Group();
    this.group.name = 'Building';

    this.mesh = this.group;
    this.collider = null;

    const visual = model.clone(true);

    visual.name = 'BuildingModel';

    visual.scale.setScalar(scale);

    visual.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    /*
     * First calculate the scaled bounding box.
     */
    visual.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(visual);

    /*
     * Put the model's center on the local origin.
     */
    const center = box.getCenter(new THREE.Vector3());

    visual.position.x -= center.x;
    visual.position.z -= center.z;

    /*
     * Put the bottom of the building on Y = 0.
     */
    visual.position.y -= box.min.y;

    visual.updateMatrixWorld(true);

    this.group.add(visual);

    /*
     * Rotation belongs to the complete building.
     */
    this.group.rotation.y = rotationY;

    this.group.position.set(x, 0, z);

    /*
     * Recalculate after normalization.
     */
    visual.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(visual);
    const size = finalBox.getSize(new THREE.Vector3());

    this._createCollider(
      size.x,
      size.y,
      size.z,
      rotationY,
    );
  }

  _createCollider(width, height, depth, rotationY) {
    /*
     * Keep a small margin so the player doesn't
     * get stuck on the exact visual edge.
     */
    const padding = 0.15;

    let w = Math.max(0.5, width - padding);
    let d = Math.max(0.5, depth - padding);

    /*
     * The collider is an axis-aligned box.
     * Swap X/Z for 90° rotations.
     */
    const quarterTurn =
      Math.abs(
        Math.abs(rotationY) % Math.PI - Math.PI / 2
      ) < 0.01;

    if (quarterTurn) {
      [w, d] = [d, w];
    }

    const h = Math.max(1, height);

    const shape = new CANNON.Box(
      new CANNON.Vec3(
        w / 2,
        h / 2,
        d / 2,
      )
    );

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physics.groundMaterial,
    });

    body.position.set(
      this.group.position.x,
      h / 2,
      this.group.position.z,
    );

    body.addShape(shape);

    this.physics.world.addBody(body);

    this.collider = body;
  }

  destroy() {
    if (this.collider) {
      this.physics.world.removeBody(this.collider);
      this.collider = null;
    }

    this.group.removeFromParent();
  }
}