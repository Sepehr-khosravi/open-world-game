import * as THREE from 'three';

export class Building {
  constructor({ width = 10, depth = 10, height = 20, x = 0, z = 0 } = {}) {
    this.mesh = new THREE.Group();
    this.mesh.name = 'Building';
    this.mesh.position.set(x, 0, z);

    this.width = width;
    this.depth = depth;
    this.height = height;

    this._createBody();
    this._createWindows();
    this._createDoor();
    this._createRoof();
    this._createAC(); // کولر/جعبه روی پشت‌بام
  }

  // ---------- بدنه‌ی ساختمون ----------
  _createBody() {
    const geo = new THREE.BoxGeometry(this.width, this.height, this.depth);

    // رنگ بدنه شبه‌تصادفی بین چند تن خاکستری/کرم
    const palette = [0x8b8f96, 0x9a9ea5, 0x7d8188, 0xa8a29a, 0x8f8b85, 0xb0b4bb];
    const idx = Math.abs(Math.floor(this.width * 31 + this.depth * 17 + this.height * 7)) % palette.length;
    const color = palette[idx];

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.15,
    });

    const body = new THREE.Mesh(geo, mat);
    body.position.y = this.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);
  }

  // ---------- پنجره‌ها ----------
  _createWindows() {
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x9fd7ff,
      emissive: 0x3a6a8a,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.6,
    });

    const litMat = new THREE.MeshStandardMaterial({
      color: 0xffd98a,
      emissive: 0xffb347,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });

    // ابعاد و فاصله‌ی پنجره‌ها
    const winW = 1.1;
    const winH = 1.4;
    const gapX = 2.2;
    const gapY = 2.6;

    // تعداد پنجره‌های افقی روی هر وجه
    const colsX = Math.max(1, Math.floor(this.width / gapX));
    const colsZ = Math.max(1, Math.floor(this.depth / gapX));
    const rows = Math.max(1, Math.floor((this.height - 4) / gapY));

    const stepX = this.width / (colsX + 1);
    const stepZ = this.depth / (colsZ + 1);
    const stepY = (this.height - 5) / (rows + 1);

    const halfW = this.width / 2;
    const halfD = this.depth / 2;

    // پنجره روی وجه +Z و -Z (رو به جلو و عقب)
    for (let r = 0; r < rows; r++) {
      const y = 3 + stepY * (r + 1);
      for (let c = 0; c < colsX; c++) {
        const xOff = -this.width / 2 + stepX * (c + 1);
        const lit = ((r * 7 + c * 13) % 5) === 0;

        // +Z
        const w1 = new THREE.Mesh(
          new THREE.BoxGeometry(winW, winH, 0.1),
          lit ? litMat : windowMat
        );
        w1.position.set(xOff, y, halfD + 0.06);
        this.mesh.add(w1);

        // -Z
        const w2 = new THREE.Mesh(
          new THREE.BoxGeometry(winW, winH, 0.1),
          lit ? litMat : windowMat
        );
        w2.position.set(xOff, y, -halfD - 0.06);
        this.mesh.add(w2);
      }

      // پنجره روی وجه +X و -X
      for (let c = 0; c < colsZ; c++) {
        const zOff = -this.depth / 2 + stepZ * (c + 1);
        const lit = ((r * 11 + c * 5) % 6) === 0;

        const w3 = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, winH, winW),
          lit ? litMat : windowMat
        );
        w3.position.set(halfW + 0.06, y, zOff);
        this.mesh.add(w3);

        const w4 = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, winH, winW),
          lit ? litMat : windowMat
        );
        w4.position.set(-halfW - 0.06, y, zOff);
        this.mesh.add(w4);
      }
    }
  }

  // ---------- در ----------
  _createDoor() {
    const doorW = Math.min(2.2, this.width * 0.35);
    const doorH = 3;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.7,
      metalness: 0.2,
    });

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, doorH, 0.15),
      mat
    );
    door.position.set(0, doorH / 2, this.depth / 2 + 0.08);
    door.castShadow = true;
    this.mesh.add(door);

    // سایه‌بان کوچیک بالای در
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.6, 0.15, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    awning.position.set(0, doorH + 0.3, this.depth / 2 + 0.4);
    awning.castShadow = true;
    this.mesh.add(awning);
  }

  // ---------- پشت‌بام ----------
  _createRoof() {
    // یه لبه‌ی کوچیک دور پشت‌بام
    const lipH = 0.6;
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0x4a4e55,
      roughness: 0.9,
      metalness: 0.1,
    });

    const lipGeo = new THREE.BoxGeometry(this.width + 0.4, lipH, this.depth + 0.4);
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.position.y = this.height + lipH / 2 - 0.3;
    lip.castShadow = true;
    lip.receiveShadow = true;
    this.mesh.add(lip);
  }

  // ---------- جعبه‌ی روی پشت‌بام ----------
  _createAC() {
    // بعضی ساختمون‌ها کولر/جعبه ندارن
    const seed = Math.floor(this.width * 5 + this.depth * 3);
    if (seed % 3 === 0) return;

    const w = 1.5;
    const h = 1.2;
    const d = 1.5;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x555a60,
      roughness: 0.8,
      metalness: 0.4,
    });

    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const offsetX = (this.width * 0.25) * (seed % 2 === 0 ? 1 : -1);
    const offsetZ = (this.depth * 0.2) * (seed % 3 === 0 ? 1 : -1);
    box.position.set(offsetX, this.height + h / 2, offsetZ);
    box.castShadow = true;
    box.receiveShadow = true;
    this.mesh.add(box);

    // آنتن کوچیک
    if (seed % 2 === 1) {
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.4 })
      );
      antenna.position.set(-offsetX, this.height + 1, -offsetZ);
      antenna.castShadow = true;
      this.mesh.add(antenna);
    }
  }
}