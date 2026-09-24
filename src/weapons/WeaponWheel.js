export class WeaponWheel {
  constructor(weapons, onSelect) {
    this.weapons = weapons;
    this.onSelect = onSelect;
    this.isOpen = false;
    this.selectedIndex = 0;

    this.root = document.createElement('div');
    this.root.id = 'weapon-wheel';
    this.root.style.display = 'none';
    document.body.appendChild(this.root);

    this._render();
    this._bind();
  }

  _render() {
    const n = this.weapons.length;
    const radius = 180;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    this.root.innerHTML = `
      <div class="wheel-overlay"></div>
      <div class="wheel-ring"></div>
      <div class="wheel-items"></div>
      <div class="wheel-info">
        <div class="wheel-name"></div>
        <div class="wheel-hint">برای انتخاب، کلید را رها کن</div>
      </div>
    `;

    const itemsEl = this.root.querySelector('.wheel-items');

    this.weapons.forEach((w, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const el = document.createElement('div');
      el.className = 'wheel-item';
      el.dataset.index = i;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.innerHTML = `<div class="wheel-icon">${w.icon}</div>`;
      itemsEl.appendChild(el);
    });
  }

  _bind() {
    // حرکت ماوس برای انتخاب
    document.addEventListener('mousemove', (e) => {
      if (!this.isOpen) return;
      this._updateSelection(e.clientX, e.clientY);
    });
  }

  open() {
    this.isOpen = true;
    this.root.style.display = 'block';
    this._updateVisual();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.onSelect(this.selectedIndex, this.weapons[this.selectedIndex]);
  }

  _updateSelection(mouseX, mouseY) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < 40) return; // وسط، انتخاب نکن

    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    let idx = Math.round((angle / (Math.PI * 2)) * this.weapons.length);
    idx = ((idx % this.weapons.length) + this.weapons.length) % this.weapons.length;

    if (idx !== this.selectedIndex) {
      this.selectedIndex = idx;
      this._updateVisual();
    }
  }

  _updateVisual() {
    const items = this.root.querySelectorAll('.wheel-item');
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
    this.root.querySelector('.wheel-name').textContent =
      this.weapons[this.selectedIndex].name;
  }
}