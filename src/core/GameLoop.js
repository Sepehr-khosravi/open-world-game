/**
 * GameLoop: حلقه‌ی requestAnimationFrame با محاسبه‌ی deltaTime.
 */
export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this._boundTick = this._tick.bind(this);

    // شمارش FPS
    this._fpsEl = document.getElementById('fps');
    this._frames = 0;
    this._fpsTimer = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._boundTick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this._updateFps(dt);

    requestAnimationFrame(this._boundTick);
  }

  _updateFps(dt) {
    this._frames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      const fps = Math.round(this._frames / this._fpsTimer);
      if (this._fpsEl) this._fpsEl.textContent = fps;
      this._frames = 0;
      this._fpsTimer = 0;
    }
  }
}