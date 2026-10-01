import * as THREE from 'three';

export class CharacterSelect {
  constructor(assetLoader, onStart) {
    this.loader = assetLoader;
    this.onStart = onStart;

    this.letters =
      'abcdefghijklmnopqr'.split('');

    this.index = 0;

    this.models =
      new Map();

    this.loading =
      false;

    this.root =
      document.getElementById(
        'character-select'
      );

    if (!this.root) {
      throw new Error(
        '#character-select پیدا نشد.'
      );
    }

    this.buildUI();

    this.canvas =
      document.getElementById(
        'preview-canvas'
      );

    this.nameEl =
      document.getElementById(
        'char-name'
      );

    this.prevBtn =
      document.getElementById(
        'prev-char'
      );

    this.nextBtn =
      document.getElementById(
        'next-char'
      );

    this.startBtn =
      document.getElementById(
        'start-btn'
      );

    this._setupRenderer();
    this._setupScene();
    this._bind();

    this._loadCurrent();
  }

  /* ======================================================
   * UI
   * ====================================================== */

  buildUI() {
    this.root.innerHTML = `
      <div class="character-select-backdrop"></div>

      <div class="character-select-panel">

        <div class="character-select-header">

          <div>
            <div class="character-select-kicker">
              CITY
            </div>

            <h1>
              انتخاب کاراکتر
            </h1>

            <p>
              کاراکتر خودت را انتخاب کن و وارد شهر شو.
            </p>
          </div>

          <div class="character-select-counter">
            <span id="character-current">
              01
            </span>

            <span class="character-counter-line">
              /
            </span>

            <span>
              ${String(this.letters.length).padStart(2, '0')}
            </span>
          </div>

        </div>

        <div class="character-select-content">

          <div class="character-preview-card">

            <div class="character-preview-glow"></div>

            <canvas
              id="preview-canvas"
            ></canvas>

            <div class="character-loading">
              <span></span>
              <span></span>
              <span></span>
            </div>

          </div>

          <div class="character-info">

            <div class="character-info-label">
              CHARACTER
            </div>

            <div
              id="char-name"
              class="character-name"
            >
              Character A
            </div>

            <div class="character-info-line"></div>

            <p class="character-description">
              این کاراکتر را انتخاب کن تا بازی
              با همین شخصیت شروع شود.
            </p>

            <div class="character-navigation">

              <button
                id="prev-char"
                class="character-nav-button"
                type="button"
              >
                <span>‹</span>
                قبلی
              </button>

              <button
                id="next-char"
                class="character-nav-button"
                type="button"
              >
                بعدی
                <span>›</span>
              </button>

            </div>

            <button
              id="start-btn"
              class="character-start-button"
              type="button"
            >
              <span>
                شروع بازی
              </span>

              <strong>
                →
              </strong>
            </button>

            <div class="character-hint">
              <span>←</span>
              <span>→</span>
              برای تغییر کاراکتر
            </div>

          </div>

        </div>

      </div>
    `;
  }

  /* ======================================================
   * RENDERER
   * ====================================================== */

  _setupRenderer() {
    this.renderer =
      new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference:
          'high-performance',
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2
      )
    );

    this.renderer.setSize(
      this.canvas.clientWidth ||
        500,
      this.canvas.clientHeight ||
        500,
      false
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    this.renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    this.renderer.toneMappingExposure =
      1.1;
  }

  /* ======================================================
   * SCENE
   * ====================================================== */

  _setupScene() {
    this.scene =
      new THREE.Scene();

    this.camera =
      new THREE.PerspectiveCamera(
        35,
        1,
        0.1,
        100
      );

    this.camera.position.set(
      0,
      1.4,
      4
    );

    this.camera.lookAt(
      0,
      0.9,
      0
    );

    this.scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x182233,
        2.0
      )
    );

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2.5
      );

    key.position.set(
      3,
      5,
      4
    );

    this.scene.add(key);

    const rim =
      new THREE.DirectionalLight(
        0x88bbff,
        1.5
      );

    rim.position.set(
      -3,
      3,
      -4
    );

    this.scene.add(rim);

    const floorGeo =
      new THREE.CylinderGeometry(
        1.35,
        1.35,
        0.12,
        64
      );

    const floorMat =
      new THREE.MeshStandardMaterial({
        color: 0x152033,
        roughness: 0.55,
        metalness: 0.4,
      });

    const floor =
      new THREE.Mesh(
        floorGeo,
        floorMat
      );

    floor.position.y =
      -0.06;

    this.scene.add(floor);

    this.modelGroup =
      new THREE.Group();

    this.scene.add(
      this.modelGroup
    );
  }

  /* ======================================================
   * EVENTS
   * ====================================================== */

  _bind() {
    this.prevBtn.addEventListener(
      'click',
      () => this._navigate(-1)
    );

    this.nextBtn.addEventListener(
      'click',
      () => this._navigate(1)
    );

    this.startBtn.addEventListener(
      'click',
      () => this._start()
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (
          this.root.classList.contains(
            'hidden'
          )
        ) {
          return;
        }

        if (
          e.key === 'ArrowLeft' ||
          e.key.toLowerCase() === 'a'
        ) {
          this._navigate(-1);
        }

        if (
          e.key === 'ArrowRight' ||
          e.key.toLowerCase() === 'd'
        ) {
          this._navigate(1);
        }

        if (e.key === 'Enter') {
          this._start();
        }
      }
    );

    window.addEventListener(
      'resize',
      () => {
        const w =
          this.canvas.clientWidth ||
          500;

        const h =
          this.canvas.clientHeight ||
          500;

        this.renderer.setSize(
          w,
          h,
          false
        );

        this.camera.aspect =
          w / h;

        this.camera.updateProjectionMatrix();
      }
    );
  }

  /* ======================================================
   * NAVIGATION
   * ====================================================== */

  async _navigate(dir) {
    if (this.loading) return;

    this.index =
      (
        this.index +
        dir +
        this.letters.length
      ) %
      this.letters.length;

    await this._loadCurrent();
  }

  /* ======================================================
   * LOAD
   * ====================================================== */

  async _loadCurrent() {
    const letter =
      this.letters[this.index];

    const number =
      String(
        this.index + 1
      ).padStart(2, '0');

    const counter =
      document.getElementById(
        'character-current'
      );

    if (counter) {
      counter.textContent =
        number;
    }

    this.nameEl.textContent =
      `Character ${letter.toUpperCase()}`;

    this.loading = true;

    this.root.classList.add(
      'character-loading-active'
    );

    try {
      if (
        this.models.has(letter)
      ) {
        this._showModel(
          this.models.get(letter)
        );

        return;
      }

      const {
        model,
        animations,
      } =
        await this.loader.loadCharacter(
          `/models/characters/character-${letter}.glb`
        );

      this._normalize(model);

      this.models.set(
        letter,
        {
          model,
          animations,
        }
      );

      this._showModel({
        model,
        animations,
      });
    } catch (err) {
      console.error(
        'خطا در لود مدل:',
        letter,
        err
      );
    } finally {
      this.loading = false;

      this.root.classList.remove(
        'character-loading-active'
      );
    }
  }

  /* ======================================================
   * NORMALIZE
   * ====================================================== */

  _normalize(model) {
    const box =
      new THREE.Box3()
        .setFromObject(model);

    const size =
      new THREE.Vector3();

    box.getSize(size);

    if (
      !size.y ||
      size.y <= 0
    ) {
      return;
    }

    const scale =
      1.8 / size.y;

    model.scale.setScalar(
      scale
    );

    const box2 =
      new THREE.Box3()
        .setFromObject(model);

    const center =
      new THREE.Vector3();

    box2.getCenter(center);

    model.position.x -=
      center.x;

    model.position.z -=
      center.z;

    model.position.y -=
      box2.min.y;
  }

  /* ======================================================
   * SHOW MODEL
   * ====================================================== */

  _showModel(entry) {
    const model =
      entry.model || entry;

    while (
      this.modelGroup.children
        .length > 0
    ) {
      this.modelGroup.remove(
        this.modelGroup.children[0]
      );
    }

    model.rotation.set(
      0,
      0,
      0
    );

    this.modelGroup.add(
      model
    );
  }

  /* ======================================================
   * START
   * ====================================================== */

  _start() {
    if (this.loading) return;

    const letter =
      this.letters[this.index];

    this.root.classList.add(
      'hidden'
    );

    this.onStart(letter);
  }

  /* ======================================================
   * UPDATE
   * ====================================================== */

  update(dt) {
    if (
      this.root.classList.contains(
        'hidden'
      )
    ) {
      return;
    }

    this.modelGroup.rotation.y +=
      dt * 0.45;

    this.renderer.render(
      this.scene,
      this.camera
    );
  }

  get isHidden() {
    return this.root.classList.contains(
      'hidden'
    );
  }
}