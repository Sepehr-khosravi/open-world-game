// src/ui/MobileControls.js

export class MobileControls {
  constructor({
    onEnterExit = null,
    onCamera = null,
    onFullscreen = null,
    onJump = null,
    onSprintChange = null,
    onLook = null,
    onVehicleGas = null,
    onVehicleBrake = null,
    onVehicleReverse = null,
    onVehicleSteer = null,
  } = {}) {
    this.onEnterExit = onEnterExit;
    this.onCamera = onCamera;
    this.onFullscreen = onFullscreen;
    this.onJump = onJump;
    this.onSprintChange = onSprintChange;
    this.onLook = onLook;

    this.onVehicleGas = onVehicleGas;
    this.onVehicleBrake = onVehicleBrake;
    this.onVehicleReverse = onVehicleReverse;
    this.onVehicleSteer = onVehicleSteer;

    this.enabled = true;
    this.isDriving = false;
    this.isInteractable = false;

    // PLAYER INPUT
    this.keys = { w: false, a: false, s: false, d: false, shift: false, ' ': false };
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };

    // VEHICLE INPUT
    this.vehicle = {
      gas: false,
      brake: false,
      reverse: false,
      steering: 0,
    };

    // JOYSTICK
    this.joystick = {
      active: false,
      pointerId: null,
      centerX: 0,
      centerY: 0,
      radius: 55,
      maxDistance: 55,
    };

    // STEERING WHEEL
    this.steeringWheel = {
      active: false,
      pointerId: null,
      centerX: 0,
      centerY: 0,
      startX: 0,
      value: 0,
      maxAngle: 135,
      sensitivity: 1.15,
    };

    // CAMERA
    this.lookTouch = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    };

    this._style();
    this._build();
    this._bindGlobalEvents();
  }

  // ============================================================
  // STYLE
  // ============================================================

  _style() {
    if (document.getElementById('mobile-controls-style')) return;

    const style = document.createElement('style');
    style.id = 'mobile-controls-style';

    style.textContent = `
      #mobile-controls {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      #mobile-controls * {
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }

      .mc-hidden { display: none !important; }

      /* ======================================================
       * TOP LEFT
       * ==================================================== */

      .mc-top-left {
        position: absolute;
        top: 16px;
        left: 16px;
        display: flex;
        align-items: center;
        gap: 9px;
        z-index: 20;
        pointer-events: none;
      }

      .mc-brand {
        min-width: 70px;
        height: 34px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 11px;
        background: linear-gradient(180deg, rgba(25,25,30,.78), rgba(8,8,12,.76));
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: rgba(255,255,255,.92);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 2px;
        box-shadow: 0 8px 28px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.08);
      }

      .mc-status {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #65e39a;
        box-shadow: 0 0 12px rgba(101,227,154,.7);
      }

      /* ======================================================
       * TOP RIGHT
       * ==================================================== */

      .mc-top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        display: flex;
        gap: 8px;
        pointer-events: auto;
        z-index: 30;
      }

      .mc-icon-button {
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 13px;
        background: linear-gradient(180deg, rgba(30,30,36,.82), rgba(8,8,12,.78));
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 8px 28px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
        pointer-events: auto;
        cursor: pointer;
        transition: transform .1s ease, background .1s ease;
      }

      .mc-icon-button:active {
        transform: scale(.9);
        background: rgba(255,255,255,.18);
      }

      /* ======================================================
       * PLAYER JOYSTICK
       * ==================================================== */

      .mc-movement {
        position: absolute;
        left: 26px;
        bottom: 26px;
        width: 148px;
        height: 148px;
        pointer-events: auto;
        z-index: 10;
      }

      .mc-joystick {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 43%,
          rgba(255,255,255,.12),
          rgba(255,255,255,.035) 55%,
          rgba(0,0,0,.2));
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: 0 15px 45px rgba(0,0,0,.25),
                    inset 0 1px 0 rgba(255,255,255,.08);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        touch-action: none;
      }

      .mc-joystick-ring {
        position: absolute;
        inset: 15px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,.07);
      }

      .mc-joystick-direction {
        position: absolute;
        color: rgba(255,255,255,.24);
        font-size: 9px;
        font-weight: 800;
      }

      .mc-joystick-direction.up {
        top: 9px;
        left: 50%;
        transform: translateX(-50%);
      }

      .mc-joystick-direction.down {
        bottom: 9px;
        left: 50%;
        transform: translateX(-50%);
      }

      .mc-joystick-direction.left {
        left: 9px;
        top: 50%;
        transform: translateY(-50%);
      }

      .mc-joystick-direction.right {
        right: 9px;
        top: 50%;
        transform: translateY(-50%);
      }

      .mc-stick {
        position: absolute;
        width: 66px;
        height: 66px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) translate3d(0,0,0);
        border-radius: 50%;
        background: radial-gradient(circle at 35% 28%,
          rgba(255,255,255,.28),
          rgba(255,255,255,.1) 48%,
          rgba(0,0,0,.25));
        border: 1px solid rgba(255,255,255,.22);
        box-shadow: 0 9px 24px rgba(0,0,0,.3),
                    inset 0 1px 0 rgba(255,255,255,.14);
        transition: transform .08s ease-out;
        pointer-events: none;
      }

      .mc-stick.active { transition: none; }

      /* ======================================================
       * PLAYER ACTIONS
       * ==================================================== */

      .mc-actions {
        position: absolute;
        right: 27px;
        bottom: 26px;
        width: 180px;
        height: 180px;
        pointer-events: none;
        z-index: 20;
      }

      .mc-action {
        position: absolute;
        border: 1px solid rgba(255,255,255,.14);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: 800;
        backdrop-filter: blur(13px);
        -webkit-backdrop-filter: blur(13px);
        box-shadow: 0 12px 35px rgba(0,0,0,.27),
                    inset 0 1px 0 rgba(255,255,255,.08);
        pointer-events: auto;
        cursor: pointer;
        touch-action: none;
        transition: transform .1s ease, background .1s ease;
      }

      .mc-action:active,
      .mc-action.active {
        transform: scale(.9);
        background: rgba(255,255,255,.2);
      }

      .mc-jump {
        right: 0;
        bottom: 20px;
        width: 82px;
        height: 82px;
        background: linear-gradient(145deg, rgba(70,130,255,.55), rgba(25,60,140,.62));
        font-size: 27px;
      }

      .mc-jump-label {
        position: absolute;
        bottom: 12px;
        font-size: 8px;
        letter-spacing: 1px;
        opacity: .7;
        pointer-events: none;
      }

      .mc-sprint {
        left: 6px;
        bottom: 2px;
        width: 60px;
        height: 60px;
        background: rgba(255,255,255,.075);
        font-size: 19px;
      }

      .mc-sprint-label {
        position: absolute;
        bottom: -17px;
        font-size: 8px;
        letter-spacing: 1px;
        opacity: .5;
        white-space: nowrap;
        pointer-events: none;
      }

      .mc-interact {
        right: 83px;
        top: 8px;
        width: 53px;
        height: 53px;
        background: rgba(255,255,255,.09);
        font-size: 20px;
      }

      /* ======================================================
       * LOOK AREA (زیر همه دکمه‌ها)
       * ==================================================== */

      .mc-look-area {
        position: absolute;
        top: 70px;
        right: 0;
        bottom: 0;
        width: 48%;
        pointer-events: auto;
        touch-action: none;
        z-index: 1;
      }

      .mc-look-hint {
        position: absolute;
        right: 28px;
        top: 20px;
        padding: 7px 11px;
        border-radius: 10px;
        color: rgba(255,255,255,.28);
        font-size: 8px;
        letter-spacing: 1px;
        background: rgba(0,0,0,.12);
        opacity: 0;
        transition: opacity .3s ease;
        pointer-events: none;
      }

      .mc-look-area.show-hint .mc-look-hint {
        opacity: 1;
      }

      /* ======================================================
       * VEHICLE MODE
       * ==================================================== */

      .mc-vehicle-ui {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 15;
      }

      /* STEERING WHEEL */
      .mc-steering-container {
        position: absolute;
        left: 28px;
        bottom: 25px;
        width: 178px;
        height: 178px;
        pointer-events: auto;
        touch-action: none;
        z-index: 20;
      }

      .mc-steering-wheel {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle,
          rgba(30,30,35,.96) 0 34%,
          rgba(255,255,255,.09) 35% 39%,
          rgba(18,18,22,.98) 40% 66%,
          rgba(255,255,255,.11) 67% 69%,
          rgba(0,0,0,.3) 70%);
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: 0 18px 45px rgba(0,0,0,.35),
                    inset 0 1px 0 rgba(255,255,255,.09);
        touch-action: none;
        transition: transform .14s cubic-bezier(.2,.8,.2,1);
        pointer-events: none;
      }

      .mc-steering-wheel.active { transition: none; }

      .mc-steering-inner {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 55px;
        height: 55px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%,
          rgba(255,255,255,.14),
          rgba(255,255,255,.04));
        border: 1px solid rgba(255,255,255,.08);
      }

      .mc-steering-spoke {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 9px;
        height: 62px;
        transform-origin: center bottom;
        background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05));
        border-radius: 8px;
      }

      .mc-steering-spoke.one {
        transform: translate(-50%, -100%) rotate(0deg);
      }

      .mc-steering-spoke.two {
        transform: translate(-50%, -100%) rotate(120deg);
      }

      .mc-steering-spoke.three {
        transform: translate(-50%, -100%) rotate(240deg);
      }

      .mc-steering-label {
        position: absolute;
        left: 50%;
        bottom: -21px;
        transform: translateX(-50%);
        color: rgba(255,255,255,.4);
        font-size: 8px;
        letter-spacing: 2px;
        white-space: nowrap;
        pointer-events: none;
      }

      /* ======================================================
       * GAS / BRAKE / REVERSE
       * ==================================================== */

      .mc-driving-actions {
        position: absolute;
        right: 27px;
        bottom: 27px;
        display: flex;
        align-items: flex-end;
        gap: 10px;
        pointer-events: none;
        z-index: 20;
      }

      .mc-drive-button {
        width: 72px;
        height: 72px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.13);
        background: linear-gradient(145deg, rgba(255,255,255,.12), rgba(0,0,0,.28));
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: 900;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 12px 35px rgba(0,0,0,.3),
                    inset 0 1px 0 rgba(255,255,255,.08);
        pointer-events: auto;
        cursor: pointer;
        touch-action: none;
        transition: transform .1s ease, background .1s ease;
      }

      .mc-drive-button span {
        margin-top: 3px;
        font-size: 7px;
        letter-spacing: 1px;
        opacity: .6;
        pointer-events: none;
      }

      .mc-drive-button:active,
      .mc-drive-button.active {
        transform: scale(.91);
        background: rgba(255,255,255,.2);
      }

      /* Reverse (زرد نارنجی) */
      .mc-reverse {
        height: 66px;
        background: linear-gradient(145deg, rgba(230,180,60,.24), rgba(90,60,15,.4));
        border-color: rgba(255,210,110,.28);
      }

      /* Brake (قرمز) */
      .mc-brake {
        height: 72px;
        background: linear-gradient(145deg, rgba(220,70,70,.20), rgba(80,20,20,.36));
        border-color: rgba(240,100,100,.22);
      }

      /* Gas (سبز) */
      .mc-gas {
        height: 88px;
        background: linear-gradient(145deg, rgba(65,190,120,.26), rgba(20,70,45,.42));
        border-color: rgba(95,220,130,.28);
      }

      /* Pressed colors */
      .mc-gas.active,
      .mc-gas:active {
        background: linear-gradient(145deg, rgba(65,210,120,.55), rgba(30,110,65,.6));
      }

      .mc-brake.active,
      .mc-brake:active {
        background: linear-gradient(145deg, rgba(240,80,80,.55), rgba(120,25,25,.6));
      }

      .mc-reverse.active,
      .mc-reverse:active {
        background: linear-gradient(145deg, rgba(240,190,70,.55), rgba(130,85,15,.6));
      }

      /* MODES */
      #mobile-controls.driving .mc-movement,
      #mobile-controls.driving .mc-actions {
        display: none;
      }

      #mobile-controls:not(.driving) .mc-vehicle-ui {
        display: none;
      }

      #mobile-controls.driving .mc-look-area {
        width: 100%;
        z-index: 1;
      }

      /* ======================================================
       * ORIENTATION
       * ==================================================== */

      .mc-orientation {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: none;
        align-items: center;
        justify-content: center;
        background: #08080b;
        color: white;
        text-align: center;
      }

      .mc-orientation-inner {
        width: min(320px, 85vw);
      }

      .mc-orientation-icon {
        font-size: 48px;
        margin-bottom: 18px;
      }

      .mc-orientation-title {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .mc-orientation-text {
        color: rgba(255,255,255,.5);
        font-size: 12px;
        line-height: 1.7;
      }

      @media (orientation: portrait) {
        .mc-orientation { display: flex; }
        #mobile-controls { display: none; }
      }

      @media (max-width: 700px) {
        .mc-movement {
          left: 16px;
          bottom: 16px;
          transform: scale(.9);
          transform-origin: bottom left;
        }

        .mc-actions {
          right: 16px;
          bottom: 16px;
          transform: scale(.9);
          transform-origin: bottom right;
        }

        .mc-steering-container {
          left: 17px;
          bottom: 16px;
          transform: scale(.9);
          transform-origin: bottom left;
        }

        .mc-driving-actions {
          right: 16px;
          bottom: 16px;
          transform: scale(.85);
          transform-origin: bottom right;
          gap: 8px;
        }

        .mc-drive-button {
          width: 64px;
          height: 64px;
          font-size: 20px;
        }

        .mc-gas {
          height: 78px;
        }

        .mc-brake {
          height: 64px;
        }

        .mc-reverse {
          height: 58px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // BUILD
  // ============================================================

  _build() {
    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';

    this.root.innerHTML = `
      <div class="mc-top-left">
        <div class="mc-brand">CITY</div>
        <div class="mc-status"></div>
      </div>

      <div class="mc-top-right">
        <button class="mc-icon-button mc-interact-top" type="button">↗</button>
        <button class="mc-icon-button mc-camera" type="button">◉</button>
        <button class="mc-icon-button mc-fullscreen" type="button">⛶</button>
      </div>

      <div class="mc-movement">
        <div class="mc-joystick">
          <div class="mc-joystick-ring"></div>
          <div class="mc-joystick-direction up">W</div>
          <div class="mc-joystick-direction down">S</div>
          <div class="mc-joystick-direction left">A</div>
          <div class="mc-joystick-direction right">D</div>
          <div class="mc-stick"></div>
        </div>
      </div>

      <div class="mc-actions">
        <button class="mc-action mc-interact" type="button">↗</button>

        <button class="mc-action mc-sprint" type="button">
          ⚡
          <span class="mc-sprint-label">SPRINT</span>
        </button>

        <button class="mc-action mc-jump" type="button">
          ↑
          <span class="mc-jump-label">JUMP</span>
        </button>
      </div>

      <div class="mc-look-area">
        <div class="mc-look-hint">DRAG TO LOOK</div>
      </div>

      <div class="mc-vehicle-ui">
        <div class="mc-steering-container">
          <div class="mc-steering-wheel">
            <div class="mc-steering-spoke one"></div>
            <div class="mc-steering-spoke two"></div>
            <div class="mc-steering-spoke three"></div>
            <div class="mc-steering-inner"></div>
          </div>
          <div class="mc-steering-label">STEER</div>
        </div>

        <div class="mc-driving-actions">
          <button class="mc-drive-button mc-reverse" type="button">
            ▼
            <span>REV</span>
          </button>

          <button class="mc-drive-button mc-brake" type="button">
            ◀
            <span>BRAKE</span>
          </button>

          <button class="mc-drive-button mc-gas" type="button">
            ▲
            <span>GAS</span>
          </button>
        </div>
      </div>

      <div class="mc-orientation">
        <div class="mc-orientation-inner">
          <div class="mc-orientation-icon">↻</div>
          <div class="mc-orientation-title">Rotate your device</div>
          <div class="mc-orientation-text">
            This game is optimized for landscape mode.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.root);

    this._cacheElements();
    this._setupJoystick();
    this._setupActions();
    this._setupLook();
    this._setupSteering();
    this._setupVehicleButtons();
    this._setupTopButtons();
  }

  // ============================================================
  // CACHE
  // ============================================================

  _cacheElements() {
    this.joystickElement = this.root.querySelector('.mc-joystick');
    this.stickElement = this.root.querySelector('.mc-stick');
    this.lookArea = this.root.querySelector('.mc-look-area');
    this.jumpButton = this.root.querySelector('.mc-jump');
    this.sprintButton = this.root.querySelector('.mc-sprint');
    this.interactButton = this.root.querySelector('.mc-interact');
    this.interactTopButton = this.root.querySelector('.mc-interact-top');
    this.cameraButton = this.root.querySelector('.mc-camera');
    this.fullscreenButton = this.root.querySelector('.mc-fullscreen');
    this.steeringContainer = this.root.querySelector('.mc-steering-container');
    this.steeringWheel = this.root.querySelector('.mc-steering-wheel');
    this.gasButton = this.root.querySelector('.mc-gas');
    this.brakeButton = this.root.querySelector('.mc-brake');
    this.reverseButton = this.root.querySelector('.mc-reverse');
  }

  // ============================================================
  // PLAYER JOYSTICK
  // ============================================================

  _setupJoystick() {
    this.joystickElement.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      event.stopPropagation();

      try { this.joystickElement.setPointerCapture(event.pointerId); } catch {}

      this.joystick.active = true;
      this.joystick.pointerId = event.pointerId;

      const rect = this.joystickElement.getBoundingClientRect();
      this.joystick.centerX = rect.left + rect.width / 2;
      this.joystick.centerY = rect.top + rect.height / 2;
      this.joystick.radius = Math.min(rect.width, rect.height) / 2;
      this.joystick.maxDistance = this.joystick.radius - 34;

      this.stickElement.classList.add('active');
      this._updateJoystick(event);
    }, { passive: false });

    this.joystickElement.addEventListener('pointermove', (event) => {
      if (!this.joystick.active) return;
      if (event.pointerId !== this.joystick.pointerId) return;
      event.preventDefault();
      this._updateJoystick(event);
    }, { passive: false });

    const release = (event) => {
      if (!this.joystick.active) return;
      if (event.pointerId !== this.joystick.pointerId) return;
      this._resetJoystick();
    };

    this.joystickElement.addEventListener('pointerup', release);
    this.joystickElement.addEventListener('pointercancel', release);
    this.joystickElement.addEventListener('lostpointercapture', () => {
      if (this.joystick.active) this._resetJoystick();
    });
  }

  _updateJoystick(event) {
    const dx = event.clientX - this.joystick.centerX;
    const dy = event.clientY - this.joystick.centerY;
    const distance = Math.hypot(dx, dy);
    const max = this.joystick.maxDistance;
    const scale = distance > max ? max / distance : 1;

    const x = dx * scale;
    const y = dy * scale;

    this.move.x = THREEClamp(x / max, -1, 1);
    this.move.y = THREEClamp(y / max, -1, 1);

    this.stickElement.style.transform =
      `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;

    this._updateMovementKeys();
  }

  _updateMovementKeys() {
    const DEAD_ZONE = 0.12;
    const x = Math.abs(this.move.x) < DEAD_ZONE ? 0 : this.move.x;
    const y = Math.abs(this.move.y) < DEAD_ZONE ? 0 : this.move.y;

    this.keys.a = x < 0;
    this.keys.d = x > 0;
    this.keys.w = y < 0;
    this.keys.s = y > 0;
  }

  _resetJoystick() {
    this.joystick.active = false;
    this.joystick.pointerId = null;
    this.move.x = 0;
    this.move.y = 0;
    this.keys.w = false;
    this.keys.a = false;
    this.keys.s = false;
    this.keys.d = false;

    this.stickElement.classList.remove('active');
    this.stickElement.style.transform =
      `translate(-50%, -50%) translate3d(0,0,0)`;
  }

  // ============================================================
  // PLAYER ACTIONS
  // ============================================================

  _setupActions() {
    this._bindHold(
      this.sprintButton,
      () => {
        this.keys.shift = true;
        this.sprintButton.classList.add('active');
        this.onSprintChange?.(true);
      },
      () => {
        this.keys.shift = false;
        this.sprintButton.classList.remove('active');
        this.onSprintChange?.(false);
      }
    );

    this._bindTap(this.jumpButton, () => {
      this.keys[' '] = true;
      this.jumpButton.classList.add('active');
      this.onJump?.();

      window.setTimeout(() => {
        this.keys[' '] = false;
        this.jumpButton.classList.remove('active');
      }, 90);
    });

    const interact = () => {
      if (!this.isInteractable && !this.isDriving) return;
      this.onEnterExit?.();
    };

    this._bindTap(this.interactButton, interact);
    this._bindTap(this.interactTopButton, interact);
  }

  // ============================================================
  // CAMERA
  // ============================================================

  _setupLook() {
    this.lookArea.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      if (event.pointerType === 'mouse') return;

      event.preventDefault();
      try { this.lookArea.setPointerCapture(event.pointerId); } catch {}

      this.lookTouch.active = true;
      this.lookTouch.pointerId = event.pointerId;
      this.lookTouch.lastX = event.clientX;
      this.lookTouch.lastY = event.clientY;
    }, { passive: false });

    this.lookArea.addEventListener('pointermove', (event) => {
      if (!this.lookTouch.active) return;
      if (event.pointerId !== this.lookTouch.pointerId) return;

      event.preventDefault();

      const dx = event.clientX - this.lookTouch.lastX;
      const dy = event.clientY - this.lookTouch.lastY;

      this.lookTouch.lastX = event.clientX;
      this.lookTouch.lastY = event.clientY;

      this.look.x = dx;
      this.look.y = dy;

      this.onLook?.(dx, dy);
    }, { passive: false });

    const release = (event) => {
      if (event.pointerId !== this.lookTouch.pointerId) return;
      this.lookTouch.active = false;
      this.lookTouch.pointerId = null;
      this.look.x = 0;
      this.look.y = 0;
    };

    this.lookArea.addEventListener('pointerup', release);
    this.lookArea.addEventListener('pointercancel', release);
  }

  // ============================================================
  // STEERING WHEEL
  // ============================================================

  _setupSteering() {
    this.steeringContainer.addEventListener('pointerdown', (event) => {
      if (!this.enabled) return;
      if (!this.isDriving) return;

      event.preventDefault();
      event.stopPropagation();

      try { this.steeringContainer.setPointerCapture(event.pointerId); } catch {}

      const rect = this.steeringContainer.getBoundingClientRect();

      this.steeringWheel.active = true;
      this.steeringWheel.pointerId = event.pointerId;
      this.steeringWheel.centerX = rect.left + rect.width / 2;
      this.steeringWheel.centerY = rect.top + rect.height / 2;
      this.steeringWheel.startX = event.clientX;
      this.steeringWheel.value = 0;

      this.steeringWheel.classList.add('active');
      this._updateSteering(event);
    }, { passive: false });

    this.steeringContainer.addEventListener('pointermove', (event) => {
      if (!this.steeringWheel.active) return;
      if (event.pointerId !== this.steeringWheel.pointerId) return;
      event.preventDefault();
      this._updateSteering(event);
    }, { passive: false });

    const release = (event) => {
      if (event.pointerId !== this.steeringWheel.pointerId) return;
      this._releaseSteering();
    };

    this.steeringContainer.addEventListener('pointerup', release);
    this.steeringContainer.addEventListener('pointercancel', release);
    this.steeringContainer.addEventListener('lostpointercapture', () => {
      if (this.steeringWheel.active) this._releaseSteering();
    });
  }

  _updateSteering(event) {
    const rect = this.steeringContainer.getBoundingClientRect();
    const halfWidth = rect.width / 2;
    const delta = event.clientX - this.steeringWheel.centerX;
    const normalized = delta / halfWidth;

    const value = THREEClamp(
      normalized * this.steeringWheel.sensitivity,
      -1,
      1
    );

    this.steeringWheel.value = value;

    const angle = value * this.steeringWheel.maxAngle;
    this.steeringWheel.style.transform = `rotate(${angle}deg)`;

    this.vehicle.steering = value;
    this.onVehicleSteer?.(value);
  }

  _releaseSteering() {
    this.steeringWheel.active = false;
    this.steeringWheel.pointerId = null;
    this.steeringWheel.classList.remove('active');
    this._centerSteering();
  }

  _centerSteering() {
    const start = this.vehicle.steering;
    const duration = 140;
    const startTime = performance.now();

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t * t * (3 - 2 * t);
      const value = start * (1 - eased);

      this.vehicle.steering = value;
      this.steeringWheel.value = value;

      const angle = value * this.steeringWheel.maxAngle;
      this.steeringWheel.style.transform = `rotate(${angle}deg)`;

      this.onVehicleSteer?.(value);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.vehicle.steering = 0;
        this.steeringWheel.value = 0;
        this.steeringWheel.style.transform = 'rotate(0deg)';
        this.onVehicleSteer?.(0);
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================
  // VEHICLE BUTTONS
  // ============================================================

  _setupVehicleButtons() {
    /* GAS */
    this._bindHold(
      this.gasButton,
      () => {
        this.vehicle.gas = true;
        this.gasButton.classList.add('active');
        this.onVehicleGas?.(true);
      },
      () => {
        this.vehicle.gas = false;
        this.gasButton.classList.remove('active');
        this.onVehicleGas?.(false);
      }
    );

    /* BRAKE */
    this._bindHold(
      this.brakeButton,
      () => {
        this.vehicle.brake = true;
        this.brakeButton.classList.add('active');
        this.onVehicleBrake?.(true);
      },
      () => {
        this.vehicle.brake = false;
        this.brakeButton.classList.remove('active');
        this.onVehicleBrake?.(false);
      }
    );

    /* REVERSE */
    this._bindHold(
      this.reverseButton,
      () => {
        this.vehicle.reverse = true;
        this.reverseButton.classList.add('active');
        this.onVehicleReverse?.(true);
      },
      () => {
        this.vehicle.reverse = false;
        this.reverseButton.classList.remove('active');
        this.onVehicleReverse?.(false);
      }
    );
  }

  // ============================================================
  // TOP BUTTONS
  // ============================================================

  _setupTopButtons() {
    this._bindTap(this.cameraButton, () => this.onCamera?.());

    this._bindTap(this.fullscreenButton, async () => {
      this.onFullscreen?.();

      if (!document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen?.(); } catch {}
      } else {
        try { await document.exitFullscreen?.(); } catch {}
      }
    });
  }

  // ============================================================
  // POINTER HELPERS
  // ============================================================

  _bindTap(element, callback) {
    if (!element) return;

    let consumed = false;

    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.pointerType === 'mouse' && event.button !== 0) return;

      consumed = true;
      callback();

      try { element.setPointerCapture(event.pointerId); } catch {}
    }, { passive: false });

    const release = (event) => {
      if (!consumed) return;
      consumed = false;
      try { element.releasePointerCapture(event.pointerId); } catch {}
    };

    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', () => {
      consumed = false;
    });
  }

  _bindHold(element, onStart, onEnd) {
    if (!element) return;

    let activePointer = null;

    const start = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (activePointer !== null) return;
      activePointer = event.pointerId;

      try { element.setPointerCapture(event.pointerId); } catch {}
      onStart();
    };

    const end = (event) => {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      onEnd();
    };

    element.addEventListener('pointerdown', start, { passive: false });
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', () => {
      if (activePointer !== null) {
        activePointer = null;
        onEnd();
      }
    });
  }

  // ============================================================
  // GLOBAL
  // ============================================================

  _bindGlobalEvents() {
    window.addEventListener('blur', () => this.reset());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  getKeys() {
    return {
      w: this.keys.w,
      a: this.keys.a,
      s: this.keys.s,
      d: this.keys.d,
      shift: this.keys.shift,
      ' ': this.keys[' '],
    };
  }

  getMove() {
    return { x: this.move.x, y: this.move.y };
  }

  getLook() {
    return { x: this.look.x, y: this.look.y };
  }

  getVehicleInput() {
    return {
      gas: this.vehicle.gas,
      brake: this.vehicle.brake,
      reverse: this.vehicle.reverse,
      steering: this.vehicle.steering,
    };
  }

  getSteering() {
    return this.vehicle.steering;
  }

  setDriving(driving) {
    this.isDriving = !!driving;
    this.root.classList.toggle('driving', this.isDriving);

    if (this.isDriving) {
      this.resetPlayerControls();
      this.vehicle.steering = 0;
      if (this.steeringWheel) {
        this.steeringWheel.style.transform = 'rotate(0deg)';
      }
    } else {
      this.resetVehicleControls();
    }

    this._refreshInteractVisibility();
  }

  setInteractable(value) {
    this.isInteractable = !!value;
    this._refreshInteractVisibility();
  }

  _refreshInteractVisibility() {
    const visible = this.isInteractable || this.isDriving;

    this.interactButton?.classList.toggle('mc-hidden', !visible);
    this.interactTopButton?.classList.toggle('mc-hidden', !visible);
  }

  resetPlayerControls() {
    this.keys.w = false;
    this.keys.a = false;
    this.keys.s = false;
    this.keys.d = false;
    this.keys.shift = false;
    this.keys[' '] = false;

    this.move.x = 0;
    this.move.y = 0;
    this._resetJoystick();
  }

  resetVehicleControls() {
    this.vehicle.gas = false;
    this.vehicle.brake = false;
    this.vehicle.reverse = false;
    this.vehicle.steering = 0;

    this.onVehicleGas?.(false);
    this.onVehicleBrake?.(false);
    this.onVehicleReverse?.(false);
    this.onVehicleSteer?.(0);

    if (this.steeringWheel) {
      this.steeringWheel.style.transform = 'rotate(0deg)';
    }
  }

  reset() {
    this.resetPlayerControls();
    this.resetVehicleControls();

    this.lookTouch.active = false;
    this.lookTouch.pointerId = null;
    this.look.x = 0;
    this.look.y = 0;

    this.sprintButton?.classList.remove('active');
    this.jumpButton?.classList.remove('active');
    this.gasButton?.classList.remove('active');
    this.brakeButton?.classList.remove('active');
    this.reverseButton?.classList.remove('active');
  }

  destroy() {
    this.reset();
    this.root?.remove();
    document.getElementById('mobile-controls-style')?.remove();
  }
}

function THREEClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}