import * as CANNON from 'cannon-es';

export class Physics {
  constructor() {
    // ============================================================
    // WORLD
    // ============================================================

    this.world = new CANNON.World({
      /*
       * Slower gravity gives the jump more hang time.
       */
      gravity: new CANNON.Vec3(
        0,
        -20,
        0
      ),
    });

    // ============================================================
    // BROADPHASE
    // ============================================================

    this.world.broadphase =
      new CANNON.SAPBroadphase(
        this.world
      );

    this.world.allowSleep = false;

    // ============================================================
    // DEFAULT MATERIAL
    // ============================================================

    this.world.defaultContactMaterial.friction = 0;

    this.world.defaultContactMaterial.restitution = 0;

    // ============================================================
    // SOLVER
    // ============================================================

    this.world.solver.iterations = 15;

    this.world.solver.tolerance = 0.001;

    // ============================================================
    // MATERIALS
    // ============================================================

    this.groundMaterial =
      new CANNON.Material(
        'ground'
      );

    this.playerMaterial =
      new CANNON.Material(
        'player'
      );

    // ============================================================
    // PLAYER / GROUND
    // ============================================================

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(
        this.groundMaterial,
        this.playerMaterial,
        {
          friction: 0,
          restitution: 0,
        }
      )
    );

    // ============================================================
    // PLAYER / PLAYER
    // ============================================================

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(
        this.playerMaterial,
        this.playerMaterial,
        {
          friction: 0,
          restitution: 0,
        }
      )
    );

    // ============================================================
    // MAIN GROUND
    // ============================================================

    /*
     * IMPORTANT:
     *
     * This is the ONE global ground plane.
     *
     * City.js must NOT create another identical
     * physics ground at Y = 0.
     */

    const groundBody =
      new CANNON.Body({
        mass: 0,

        shape:
          new CANNON.Plane(),

        material:
          this.groundMaterial,
      });

    groundBody.quaternion.setFromEuler(
      -Math.PI / 2,
      0,
      0
    );

    groundBody.position.set(
      0,
      0,
      0
    );

    this.world.addBody(
      groundBody
    );

    this.groundBody =
      groundBody;
  }

  // ============================================================
  // STEP
  // ============================================================

  step(dt) {
    /*
     * Fixed timestep keeps Cannon stable.
     *
     * maxSubSteps = 5 prevents huge physics jumps
     * when the browser stalls for a moment.
     */
    this.world.step(
      1 / 60,
      Math.min(dt, 0.05),
      5
    );
  }
}