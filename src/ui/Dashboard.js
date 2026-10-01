export class Dashboard {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'vehicle-dashboard';
    this.el.style.cssText = `
      position: fixed;
      right: 30px;
      top: 50%;
      transform: translateY(-50%);
      width: 140px;
      padding: 20px 16px;
      background: rgba(0, 0, 0, 0.75);
      border: 2px solid rgba(120, 200, 255, 0.4);
      border-radius: 14px;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      text-align: center;
      z-index: 40;
      user-select: none;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
      display: none;
    `;

    this.el.innerHTML = `
      <div style="font-size:11px;color:#7aa9d9;letter-spacing:2px;margin-bottom:4px;">GEAR</div>
      <div id="dash-gear" style="font-size:48px;font-weight:bold;color:#7dff7d;line-height:1;margin-bottom:18px;text-shadow:0 0 14px rgba(125,255,125,0.6);">N</div>
      <div style="font-size:11px;color:#7aa9d9;letter-spacing:2px;margin-bottom:4px;">SPEED</div>
      <div style="font-size:30px;font-weight:bold;color:#fff;line-height:1;">
        <span id="dash-speed">0</span>
        <span style="font-size:12px;color:#999;margin-left:2px;">km/h</span>
      </div>
    `;

    document.body.appendChild(this.el);

    this.gearEl = this.el.querySelector('#dash-gear');
    this.speedEl = this.el.querySelector('#dash-speed');

    this._lastGear = null;
    this._lastSpeed = null;
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }

  update(speedMs, forwardSpeed, gearNumber, gears) {
    const kmh = Math.round(Math.abs(speedMs) * 3.6);

    let gearLabel;
    if (forwardSpeed < -0.5) gearLabel = 'R';
    else if (Math.abs(forwardSpeed) < 0.5) gearLabel = 'N';
    else if (gearNumber) gearLabel = String(gearNumber);
    else gearLabel = '1';

    if (gearLabel !== this._lastGear) {
      this.gearEl.textContent = gearLabel;

      if (gearLabel === 'R') this.gearEl.style.color = '#ff7d7d';
      else if (gearLabel === 'N') this.gearEl.style.color = '#aaa';
      else this.gearEl.style.color = '#7dff7d';

      this._lastGear = gearLabel;
    }

    if (kmh !== this._lastSpeed) {
      this.speedEl.textContent = kmh;
      this._lastSpeed = kmh;
    }
  }

  dispose() {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
