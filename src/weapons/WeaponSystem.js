import * as THREE from 'three';

export class WeaponSystem {
  constructor(scene, player, camera) {
    this.scene = scene;
    this.player = player;
    this.camera = camera;

    this.currentWeapon = null;
    this.ammo = {
      pistol: 12,
      rifle: 30,
    };
    this.lastShotTime = 0;

    this.bullets = [];
    this.raycaster = new THREE.Raycaster();
  }

  setWeapon(weapon) {
    this.currentWeapon = weapon;
    console.log('Weapon selected:', weapon.name);
  }

  tryFire(now) {
    if (!this.currentWeapon) return;
    const w = this.currentWeapon;
    const elapsed = (now - this.lastShotTime) / 1000;

    if (elapsed < w.fireRate) return;
    this.lastShotTime = now;

    if (w.isMelee) {
      this._meleeAttack();
    } else {
      this._shootBullet(w);
    }
  }

  _meleeAttack() {
    // یه raycast کوچیک جلوی شخصیت
    const origin = this.player.getPosition();
    const dir = new THREE.Vector3(-Math.sin(this.player.facing), 0, -Math.cos(this.player.facing));

    this.raycaster.set(
      new THREE.Vector3(origin.x, origin.y + 1, origin.z),
      dir
    );
    this.raycaster.far = 2.5;

    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits.length > 0) {
      console.log('Melee hit:', hits[0].object.name || hits[0].object.type);
    }
  }

  _shootBullet(weapon) {
    // از دوربین به سمت جلو
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const origin = this.camera.position.clone().add(dir.clone().multiplyScalar(1));

    // raycast برای برخورد
    this.raycaster.set(origin, dir);
    this.raycaster.far = weapon.range;

    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let endPoint;
    if (hits.length > 0) {
      endPoint = hits[0].point.clone();
      console.log('Bullet hit:', hits[0].object.name || hits[0].object.type);
    } else {
      endPoint = origin.clone().add(dir.clone().multiplyScalar(weapon.range));
    }

    // === خط گلوله (Tracer) ===
    const points = [origin, endPoint];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    // حذف بعد از ۵۰ میلی‌ثانیه
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 50);
  }

  update(dt) {
    // فعلاً چیزی لازم نیست
  }
}