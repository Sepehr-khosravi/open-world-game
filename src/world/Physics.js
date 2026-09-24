import * as CANNON from 'cannon-es';

export class Physics {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;

    const groundMat = new CANNON.Material('ground');
    const playerMat = new CANNON.Material('player');

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(groundMat, playerMat, {
        friction: 0.0,
        restitution: 0,
      })
    );

    this.groundMaterial = groundMat;
    this.playerMaterial = playerMat;
  }

  step(dt) {
    const fixedTimeStep = 1 / 60;
    this.world.step(fixedTimeStep, dt, 5);
  }
}