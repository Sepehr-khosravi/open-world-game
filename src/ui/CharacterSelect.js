import * as THREE from 'three';

export class CharacterSelect {
  constructor(assetLoader, onStart) {
    this.loader = assetLoader;
    this.onStart = onStart;

    this.letters = 'abcdefghijklmnopqr'.split('');
    this.index = 0;
    this.models = new Map(); // cache: letter → { model, animations }

    // DOM
    this.root = document.getElementById('character-select');
    this.canvas = document.getElementById('preview-canvas');
    this.nameEl = document.getElementById('char-name');
    this.prevBtn = document.getElementById('prev-char');
    this.nextBtn = document.getElementById('next-char');
    this.startBtn = document.getElementById('start-btn');

    this._setupRenderer();
    this._setupScene();
    this._bind();
    this._loadCurrent();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }

  _setupScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      35,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.4, 4);
    this.camera.lookAt(0, 0.9, 0);

    // نور
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2, 4, 3);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x88bbff, 1.2);
    rim.position.set(-2, 2, -3);
    this.scene.add(rim);

    // سکوی گرد زیر شخصیت
    const discGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.15, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1a2638,
      roughness: 0.6,
      metalness: 0.3,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.075;
    this.scene.add(disc);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
  }

  _bind() {
    this.prevBtn.addEventListener('click', () => this._navigate(-1));
    this.nextBtn.addEventListener('click', () => this._navigate(1));

    // کیبورد
    window.addEventListener('keydown', (e) => {
      if (this.root.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') this._navigate(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') this._navigate(1);
      if (e.key === 'Enter') this._start();
    });

    this.startBtn.addEventListener('click', () => this._start());

    // ریسایز
    window.addEventListener('resize', () => {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
  }

  async _navigate(dir) {
    this.index = (this.index + dir + this.letters.length) % this.letters.length;
    await this._loadCurrent();
  }

  async _loadCurrent() {
    const letter = this.letters[this.index];
    this.nameEl.textContent = `Character ${letter.toUpperCase()}`;

    // اگه قبلاً لود شده، فقط نشونش بده
    if (this.models.has(letter)) {
      this._showModel(this.models.get(letter));
      return;
    }

    try {
      // فقط یه پارامتر: آدرس GLB
      const { model, animations } = await this.loader.loadCharacter(
        `/models/characters/character-${letter}.glb`
      );

      this._normalize(model);

      // ذخیره model + animations
      this.models.set(letter, { model, animations });

      this._showModel({ model, animations });
    } catch (err) {
      console.error('خطا در لود مدل:', letter, err);
    }
  }

  _normalize(model) {
    // مقیاس به قد ~۱.۸
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scale = 1.8 / size.y;
    model.scale.setScalar(scale);

    // بعد از scale، مرکز رو روی ۰ بذار
    const box2 = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
  }

  _showModel(entry) {
    // entry یا { model, animations } هست یا model مستقیم
    const model = entry.model || entry;

    while (this.modelGroup.children.length > 0) {
      this.modelGroup.remove(this.modelGroup.children[0]);
    }

    // اطمینان از اینکه rotation و position پاک شده
    model.rotation.set(0, 0, 0);

    this.modelGroup.add(model);
  }

  _start() {
    const letter = this.letters[this.index];
    this.root.classList.add('hidden');
    this.onStart(letter);
  }

  update(dt) {
    if (this.root.classList.contains('hidden')) return;

    // چرخش نرم مدل
    this.modelGroup.rotation.y += dt * 0.6;

    this.renderer.render(this.scene, this.camera);
  }

  get isHidden() {
    return this.root.classList.contains('hidden');
  }
}