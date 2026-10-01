export class MobileControls {
  constructor({
    onEnterExit,
    onCamera,
    onFullscreen,
    onJump,
    onSprintChange,
    onLook,
  }) {
    this.onEnterExit = onEnterExit;
    this.onCamera = onCamera;
    this.onFullscreen = onFullscreen;
    this.onJump = onJump;
    this.onSprintChange = onSprintChange;
    this.onLook = onLook;

    this.enabled =
      window.matchMedia('(max-width: 900px)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    this.keys = {};

    this.driving = false;
    this.interactable = false;

    this.steering = 0;

    this.joystick = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
    };

    this.look = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    };

    this.create();
    this.bindResize();
    this.updateOrientation();
  }

  /* ======================================================
   * CREATE
   * ====================================================== */

  create() {
    if (!this.enabled) return;

    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';

    this.root.innerHTML = `
      <div class="mobile-orientation">
        <div class="mobile-orientation-icon">↻</div>

        <div class="mobile-orientation-title">
          گوشی را افقی کنید
        </div>

        <div class="mobile-orientation-text">
          برای اجرای بازی، دستگاه باید در حالت افقی باشد.
        </div>
      </div>

      <div class="mobile-ui">

        <!-- TOP LEFT -->
        <div class="mobile-top-left">
          <div class="mobile-game-label">
            CITY
          </div>
        </div>

        <!-- TOP RIGHT -->
        <div class="mobile-top-right">

          <button
            class="mobile-small-button mobile-interact-button hidden"
            data-action="enter"
            aria-label="تعامل با ماشین"
          >
            <span class="mobile-interact-icon">🚗</span>
            <span class="mobile-interact-text">
              سوار شدن
            </span>
          </button>

          <button
            class="mobile-small-button"
            data-action="camera"
            aria-label="تغییر دوربین"
          >
            C
          </button>

          <button
            class="mobile-small-button"
            data-action="fullscreen"
            aria-label="تمام صفحه"
          >
            ⛶
          </button>

        </div>

        <!-- LEFT -->
        <div class="mobile-left">

          <div class="mobile-joystick">

            <div class="mobile-joystick-ring"></div>

            <div class="mobile-steering-spoke spoke-a"></div>
            <div class="mobile-steering-spoke spoke-b"></div>
            <div class="mobile-steering-spoke spoke-c"></div>

            <div class="mobile-joystick-stick">

              <div class="mobile-steering-center">
                <div class="mobile-steering-logo">
                  S
                </div>
              </div>

            </div>

          </div>

          <button
            class="mobile-action-button mobile-sprint"
            data-action="sprint"
          >
            <span class="mobile-button-icon">
              🏃
            </span>

            <span>
              دویدن
            </span>
          </button>

        </div>

        <!-- CAMERA LOOK -->
        <div
          class="mobile-look-area"
          aria-hidden="true"
        ></div>

        <!-- RIGHT -->
        <div class="mobile-right">

          <!-- PLAYER -->
          <div class="mobile-player-actions">

            <button
              class="mobile-action-button mobile-jump"
              data-action="jump"
            >
              <span class="mobile-button-icon">
                ↑
              </span>

              <span>
                پرش
              </span>
            </button>

          </div>

          <!-- VEHICLE -->
          <div class="mobile-vehicle-actions">

            <button
              class="mobile-button mobile-gas"
              data-action="gas"
            >
              <span class="vehicle-button-icon">
                ▲
              </span>

              <span>
                GAS
              </span>
            </button>

            <button
              class="mobile-button mobile-brake"
              data-action="brake"
            >
              <span class="vehicle-button-icon">
                ▼
              </span>

              <span>
                BRAKE
              </span>
            </button>

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(this.root);

    this.setupJoystick();
    this.setupLookArea();
    this.setupButtons();

    this.setDriving(false);
    this.setInteractable(false);
  }

  /* ======================================================
   * JOYSTICK / STEERING
   * ====================================================== */

  setupJoystick() {
    const base =
      this.root.querySelector(
        '.mobile-joystick'
      );

    const stick =
      this.root.querySelector(
        '.mobile-joystick-stick'
      );

    if (!base || !stick) return;

    const start = (e) => {
      e.preventDefault();

      const touch =
        e.changedTouches
          ? e.changedTouches[0]
          : e;

      this.joystick.active = true;

      this.joystick.pointerId =
        touch.identifier ??
        touch.pointerId ??
        0;

      const rect =
        base.getBoundingClientRect();

      this.joystick.startX =
        rect.left +
        rect.width / 2;

      this.joystick.startY =
        rect.top +
        rect.height / 2;

      this.updateJoystick(
        touch.clientX,
        touch.clientY,
        stick
      );
    };

    const move = (e) => {
      if (!this.joystick.active) return;

      e.preventDefault();

      const touch =
        e.changedTouches
          ? [...e.changedTouches].find(
              (t) =>
                t.identifier ===
                this.joystick.pointerId
            )
          : e;

      if (!touch) return;

      this.updateJoystick(
        touch.clientX,
        touch.clientY,
        stick
      );
    };

    const end = (e) => {
      if (!this.joystick.active) return;

      const touch =
        e.changedTouches
          ? [...e.changedTouches].find(
              (t) =>
                t.identifier ===
                this.joystick.pointerId
            )
          : e;

      if (
        e.changedTouches &&
        !touch
      ) {
        return;
      }

      e.preventDefault();

      this.joystick.active = false;
      this.joystick.pointerId = null;

      this.joystick.x = 0;
      this.joystick.y = 0;

      this.steering = 0;

      stick.style.transform =
        'translate(-50%, -50%)';

      base.style.setProperty(
        '--steer-rotation',
        '0deg'
      );

      this.keys.w = false;
      this.keys.a = false;
      this.keys.s = false;
      this.keys.d = false;
    };

    base.addEventListener(
      'touchstart',
      start,
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      move,
      { passive: false }
    );

    window.addEventListener(
      'touchend',
      end,
      { passive: false }
    );

    window.addEventListener(
      'touchcancel',
      end,
      { passive: false }
    );
  }

  updateJoystick(x, y, stick) {
    const dx =
      x -
      this.joystick.startX;

    const dy =
      y -
      this.joystick.startY;

    const max =
      this.driving
        ? 62
        : 42;

    const distance =
      Math.hypot(dx, dy);

    const scale =
      distance > max
        ? max / distance
        : 1;

    const px =
      dx * scale;

    const py =
      dy * scale;

    this.joystick.x =
      px / max;

    this.joystick.y =
      py / max;

    /*
     * وقتی داخل ماشین هستیم:
     * X فرمان است.
     */
    if (this.driving) {
      this.steering =
        Math.max(
          -1,
          Math.min(
            1,
            this.joystick.x
          )
        );

      /*
       * فرمان کمی به سمت چرخش
       * راننده می‌چرخد.
       */
      const rotation =
        this.steering * 135;

      const base =
        this.root.querySelector(
          '.mobile-joystick'
        );

      if (base) {
        base.style.setProperty(
          '--steer-rotation',
          `${rotation}deg`
        );
      }

      /*
       * در ماشین Y فقط گاز/دنده عقب.
       */
      const deadzone = 0.18;

      this.keys.w =
        this.joystick.y <
        -deadzone;

      this.keys.s =
        this.joystick.y >
        deadzone;

      /*
       * A/D را هم نگه می‌داریم
       * تا Vehicle فعلی روی دسکتاپ/نسخه قدیمی
       * همچنان کار کند.
       */
      this.keys.a =
        this.steering <
        -deadzone;

      this.keys.d =
        this.steering >
        deadzone;

      return;
    }

    /*
     * حالت پیاده
     */
    stick.style.transform =
      `translate(
        calc(-50% + ${px}px),
        calc(-50% + ${py}px)
      )`;

    const deadzone = 0.18;

    this.keys.w =
      this.joystick.y <
      -deadzone;

    this.keys.s =
      this.joystick.y >
      deadzone;

    this.keys.a =
      this.joystick.x <
      -deadzone;

    this.keys.d =
      this.joystick.x >
      deadzone;
  }

  /* ======================================================
   * CAMERA
   * ====================================================== */

  setupLookArea() {
    const area =
      this.root.querySelector(
        '.mobile-look-area'
      );

    if (!area) return;

    const start = (e) => {
      const touch =
        e.changedTouches
          ? e.changedTouches[0]
          : e;

      this.look.active = true;

      this.look.pointerId =
        touch.identifier ??
        touch.pointerId ??
        0;

      this.look.lastX =
        touch.clientX;

      this.look.lastY =
        touch.clientY;
    };

    const move = (e) => {
      if (!this.look.active) return;

      const touch =
        e.changedTouches
          ? [...e.changedTouches].find(
              (t) =>
                t.identifier ===
                this.look.pointerId
            )
          : e;

      if (!touch) return;

      e.preventDefault();

      const dx =
        touch.clientX -
        this.look.lastX;

      const dy =
        touch.clientY -
        this.look.lastY;

      this.look.lastX =
        touch.clientX;

      this.look.lastY =
        touch.clientY;

      this.onLook?.(
        dx,
        dy
      );
    };

    const end = (e) => {
      const touch =
        e.changedTouches
          ? [...e.changedTouches].find(
              (t) =>
                t.identifier ===
                this.look.pointerId
            )
          : e;

      if (
        e.changedTouches &&
        !touch
      ) {
        return;
      }

      this.look.active = false;
      this.look.pointerId = null;
    };

    area.addEventListener(
      'touchstart',
      start,
      { passive: true }
    );

    area.addEventListener(
      'touchmove',
      move,
      { passive: false }
    );

    area.addEventListener(
      'touchend',
      end,
      { passive: true }
    );

    area.addEventListener(
      'touchcancel',
      end,
      { passive: true }
    );
  }

  /* ======================================================
   * BUTTONS
   * ====================================================== */

  setupButtons() {
    const buttons =
      this.root.querySelectorAll(
        '[data-action]'
      );

    for (const button of buttons) {
      const action =
        button.dataset.action;

      if (
        action === 'gas' ||
        action === 'brake'
      ) {
        const key =
          action === 'gas'
            ? 'w'
            : 's';

        this.bindHoldButton(
          button,
          () => {
            this.keys[key] = true;
          },
          () => {
            this.keys[key] = false;
          }
        );

        continue;
      }

      if (action === 'sprint') {
        this.bindHoldButton(
          button,
          () => {
            this.keys.shift = true;
            this.onSprintChange?.(
              true
            );
          },
          () => {
            this.keys.shift = false;
            this.onSprintChange?.(
              false
            );
          }
        );

        continue;
      }

      if (action === 'jump') {
        this.bindTapButton(
          button,
          () => {
            this.keys.space = true;

            this.onJump?.();

            setTimeout(() => {
              this.keys.space = false;
            }, 100);
          }
        );

        continue;
      }

      if (action === 'enter') {
        button.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            this.onEnterExit?.();
          }
        );

        button.addEventListener(
          'touchend',
          (e) => {
            e.preventDefault();
            this.onEnterExit?.();
          },
          { passive: false }
        );

        continue;
      }

      button.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();

          if (action === 'camera') {
            this.onCamera?.();
          }

          if (action === 'fullscreen') {
            await this.onFullscreen?.();
          }
        }
      );
    }
  }

  bindHoldButton(
    button,
    onDown,
    onUp
  ) {
    let active = false;

    const down = (e) => {
      e.preventDefault();

      if (active) return;

      active = true;

      button.classList.add(
        'pressed'
      );

      onDown();
    };

    const up = (e) => {
      e.preventDefault();

      if (!active) return;

      active = false;

      button.classList.remove(
        'pressed'
      );

      onUp();
    };

    button.addEventListener(
      'touchstart',
      down,
      { passive: false }
    );

    button.addEventListener(
      'touchend',
      up,
      { passive: false }
    );

    button.addEventListener(
      'touchcancel',
      up,
      { passive: false }
    );

    button.addEventListener(
      'mousedown',
      down
    );

    button.addEventListener(
      'mouseup',
      up
    );

    button.addEventListener(
      'mouseleave',
      up
    );
  }

  bindTapButton(
    button,
    callback
  ) {
    button.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();

        button.classList.add(
          'pressed'
        );

        callback();

        setTimeout(() => {
          button.classList.remove(
            'pressed'
          );
        }, 120);
      },
      { passive: false }
    );
  }

  /* ======================================================
   * DRIVING
   * ====================================================== */

  setDriving(driving) {
    this.driving =
      !!driving;

    if (!this.root) return;

    this.root.classList.toggle(
      'driving',
      this.driving
    );

    this.steering = 0;

    this.joystick.x = 0;
    this.joystick.y = 0;

    this.keys.w = false;
    this.keys.a = false;
    this.keys.s = false;
    this.keys.d = false;

    const base =
      this.root.querySelector(
        '.mobile-joystick'
      );

    if (base) {
      base.style.setProperty(
        '--steer-rotation',
        '0deg'
      );
    }

    /*
     * متن دکمه تعامل
     */
    const button =
      this.root.querySelector(
        '.mobile-interact-button'
      );

    if (button) {
      const text =
        button.querySelector(
          '.mobile-interact-text'
        );

      const icon =
        button.querySelector(
          '.mobile-interact-icon'
        );

      if (this.driving) {
        if (text) {
          text.textContent =
            'پیاده شدن';
        }

        if (icon) {
          icon.textContent =
            '🚶';
        }
      } else {
        if (text) {
          text.textContent =
            'سوار شدن';
        }

        if (icon) {
          icon.textContent =
            '🚗';
        }
      }
    }
  }

  setInteractable(value) {
    this.interactable =
      !!value;

    if (!this.root) return;

    const button =
      this.root.querySelector(
        '.mobile-interact-button'
      );

    if (!button) return;

    if (
      this.driving ||
      this.interactable
    ) {
      button.classList.remove(
        'hidden'
      );
    } else {
      button.classList.add(
        'hidden'
      );
    }
  }

  getSteering() {
    return this.driving
      ? this.steering
      : 0;
  }

  getKeys() {
    return this.keys;
  }

  isPortrait() {
    return (
      window.innerHeight >
      window.innerWidth
    );
  }

  /* ======================================================
   * RESIZE
   * ====================================================== */

  bindResize() {
    window.addEventListener(
      'resize',
      () => {
        this.updateOrientation();
      }
    );

    window.addEventListener(
      'orientationchange',
      () => {
        setTimeout(
          () =>
            this.updateOrientation(),
          100
        );
      }
    );
  }

  updateOrientation() {
    if (!this.root) return;

    const portrait =
      window.innerHeight >
      window.innerWidth;

    this.root.classList.toggle(
      'portrait',
      portrait
    );
  }
}