import * as THREE from 'three';

/*
 * تست تشخیصی: هر قطعه جاده رو با rotation = 0 نشون می‌ده
 * تا ببینیم ذاتاً به کدوم سمت کشیده شده.
 */

export class Road {
  constructor(assets) {
    this.assets = assets;
    this.group = new THREE.Group();
    this.group.name = 'RoadTest';
  }

  async load() {
    const base = '/models/city/roads/GLB%20format';

    const pieces = [
      'road-straight',
      'road-crossroad-line',
      'road-crossing',
      'road-side',
      'road-bend',
      'road-split',
      'road-intersection-line',
    ];

    const gridSpacing = 6;
    const startX = -18;

    for (let i = 0; i < pieces.length; i++) {
      const name = pieces[i];

      try {
        const { model } = await this.assets.load(`${base}/${name}.glb`);

        const clone = model.clone(true);
        clone.scale.setScalar(2);

        /* یه رنگ متفاوت به هر کدوم می‌دیم تا واضح بشه */
        clone.traverse(n => {
          if (n.isMesh) {
            n.material = n.material.clone();
            n.material.color = new THREE.Color().setHSL(
              i / pieces.length, 0.7, 0.6
            );
          }
        });

        clone.position.set(
          startX + i * gridSpacing,
          0.1,
          0
        );

        /*
         * یه فلش قرمز به سمت +Z اضافه می‌کنیم
         * تا ببینیم جهت +Z کجاست.
         */
        const arrowGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.set(0, 0.5, 0.8);
        arrow.rotation.x = Math.PI / 2;
        clone.add(arrow);

        /*
         * یه فلش آبی به سمت +X
         */
        const arrowX = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x0000ff }));
        arrowX.position.set(0.8, 0.5, 0);
        arrowX.rotation.z = -Math.PI / 2;
        clone.add(arrowX);

        this.group.add(clone);

        console.log(`[RoadTest] Placed ${name}`);
      } catch (e) {
        console.error(`[RoadTest] ${name} failed:`, e);
      }
    }

    /*
     * یه خط کمکی روی زمین به سمت +Z
     */
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 30),
    ]);
    this.group.add(new THREE.Line(lineGeo, lineMat));

    /*
     * یه خط آبی به سمت +X
     */
    const lineMatX = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const lineGeoX = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(30, 0, 0),
    ]);
    this.group.add(new THREE.Line(lineGeoX, lineMatX));
  }
}
