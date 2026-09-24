<div align="center">

# 🎮 Simple Game

**یه بازی سه‌بعدی تحت وب با Three.js و Cannon-ES**

[![Three.js](https://img.shields.io/badge/Three.js-0.160-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Cannon-ES](https://img.shields.io/badge/Cannon--ES-0.20-4B5563?style=for-the-badge)](https://github.com/pmndrs/cannon-es)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](./LICENSE)

</div>

---

## 📖 درباره‌ی پروژه

**Game** یه بازی سه‌بعدی تحت وب هست که با هدف ساخت یه محیط **مقیاس‌پذیر و ماژولار** طراحی شده. تو این بازی می‌تونی:

- 🏙️ تو یه شهر خالی با خیابون‌ها و ساختمون‌ها راه بری
- 🌊 دور تا دور شهر رو آب گرفته با ساحل شنی
- 🎭 یکی از ۱۸ شخصیت ماینکرفتی رو انتخاب کنی
- 🏃 بدوی، بپری، مشت بزنی و لگد بزنی
- 🔫 اسلحه انتخاب کنی (چاقو، کلت، تفنگ) و شلیک کنی
- 🎥 دوربین داینامیک سوم شخص که با حرکتت نرم عقب می‌ره

---

## ✨ ویژگی‌ها

### 🎨 گرافیک
- رندر سه‌بعدی با **Three.js**
- سایه‌های داینامیک با **PCF Shadow Map**
- سیستم **Tone Mapping** فیلمی (ACES)
- آب انیمیشن‌دار با موج
- Fog برای عمق بیشتر

### 🎮 گیم‌پلی
- **فیزیک واقعی** با Cannon-ES
- حرکت با شتاب نمایی (ramp-up) — دقیقاً مثل بازی‌های AAA
- پرش با تشخیص خودکار زمین
- ۲۷ انیمیشن از مدل‌های Kenney
- سیستم **Weapon Wheel** شبیه GTA V

### 🏗️ معماری
- **ماژولار و مقیاس‌پذیر** — هر بخش مستقل
- جداسازی منطق بازی از فیزیک
- سیستم `KinematicBody` قابل استفاده برای شخصیت، ماشین، NPC
- Cache هوشمند برای مدل‌ها و تکسچرها

---

## 🚀 شروع سریع

### پیش‌نیازها

- [Node.js](https://nodejs.org/) نسخه‌ی ۱۸ یا بالاتر
- یه مرورگر مدرن (Chrome, Firefox, Edge)

### نصب

```bash
git clone <repository-url>
cd <directory-name>(repository name)
npm install
npm run dev
```

بعد تو مرورگر برو به `http://localhost:5173`

### ساخت نسخه‌ی نهایی

```bash
npm run build
npm run preview
```

---

## 🎯 کنترل‌ها

| کلید | کار |
|:---:|:---|
| `W` `A` `S` `D` | حرکت (جلو، چپ، عقب، راست) |
| `Shift` + حرکت | دویدن (sprint) |
| `Space` | پرش |
| `کلیک چپ` | قفل موس / شلیک |
| `کلیک راست` | شلیک |
| `Esc` | منو تنظیمات |
| `Tab` (نگه دار) | Weapon Wheel |

### انیمیشن‌ها

| کلید | انیمیشن |
|:---:|:---|
| `J` | مشت راست |
| `L` | مشت چپ |
| `K` | لگد راست |
| `H` | لگد چپ |
| `E` / `Q` | تعامل راست / چپ |
| `F` | برداشتن |
| `1` / `2` | بله / نه |
| `3` | مرگ |
| `4` | نشستن |
| `5` | رانندگی |
| `Z` / `X` / `C` | نگه‌داشتن (راست/چپ/هر دو) |

---

## 📁 ساختار پروژه

```
game/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── favicon.svg
│   └── models/
│       └── characters/
│           ├── character-a.glb
│           └── Textures/
│               └── texture-a.png
└── src/
    ├── main.js
    ├── style.css
    ├── core/
    ├── world/
    │   ├── World.js
    │   ├── Physics.js
    │   ├── Lighting.js
    │   ├── Water.js
    │   ├── City.js
    │   ├── Building.js
    │   └── AssetLoader.js
    ├── entities/
    │   └── Player.js
    ├── physics/
    │   └── KinematicBody.js
    ├── ui/
    │   └── CharacterSelect.js
    └── weapons/
        ├── WeaponData.js
        ├── WeaponWheel.js
        └── WeaponSystem.js
```

---

## 🧠 معماری

### جداسازی لایه‌ها

```
main.js (نقطه‌ی ورود)
    ↓
World (Lighting + Water + City)
    ↓
Player (Model + Physics + Animations)
    ↓
Physics (Cannon-ES World)
```

### چرا این معماری؟

- **هر فایل یه مسئولیت داره** → تغییر یه بخش، بقیه رو خراب نمی‌کنه
- **`KinematicBody` قابل استفاده‌ی مجدد** → فردا برای ماشین هم استفاده می‌شه
- **`AssetLoader` با cache** → یه مدل رو دوبار لود نمی‌کنه

---

## 🎬 سیستم‌های کلیدی

### KinematicBody — حرکت نرم

```javascript
this.controller = new KinematicBody(this.body, {
  maxSpeed: 7,
  x: 0.4,
  y: 0.06,
  yMin: 0.02,
  rampDuration: 0.6,
  decelTime: 0.15,
});
```

**مزایا:**
- ✅ مستقل از FPS
- ✅ نرم و طبیعی
- ✅ قابل استفاده برای شخصیت، ماشین، NPC

### دوربین داینامیک

```
ایستاده       →  فاصله ۶
راه می‌ره     →  فاصله ۸
دویدن         →  فاصله ۹.۵ + ارتفاع ۰.۶
```

### Weapon Wheel (GTA V-style)

با نگه داشتن `Tab`، چرخ اسلحه باز می‌شه.

---

## 🛠️ تکنولوژی‌ها

| تکنولوژی | کاربرد |
|---|---|
| **Three.js** | رندر سه‌بعدی |
| **Cannon-ES** | فیزیک |
| **Vite** | Build tool و Dev server |
| **GLTFLoader** | لود مدل‌های GLB |
| **SkeletonUtils** | کلون مدل‌های اسکلتی |
| **AnimationMixer** | پخش انیمیشن‌ها |

---

## 📊 عملکرد

اگه بازی کند شد:

### ۱. `pixelRatio` رو کم کن

```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
```

### ۲. سایه‌ها رو سبک‌تر کن

```javascript
sun.shadow.mapSize.set(1024, 1024);
```

### ۳. ساختمون‌ها سایه نندازن

```javascript
this.mesh.castShadow = false;
```

### ۴. تعداد بلوک‌های شهر رو کم کن

```javascript
this.blocks = 4;
```

---

## 🗺️ راهنمای توسعه

### اضافه کردن یه ساختمون جدید

```javascript
import { Building } from './Building.js';

const b = new Building({
  width: 12,
  depth: 12,
  height: 30,
  x: 0,
  z: 0,
});
this.group.add(b.mesh);
```

### اضافه کردن یه اسلحه جدید

```javascript
{
  id: 'shotgun',
  name: 'شاتگان',
  icon: '💥',
  holdAnim: 'holding-both',
  fireAnim: 'holding-both-shoot',
  isMelee: false,
  damage: 80,
  fireRate: 0.8,
  bulletSpeed: 60,
  range: 30,
}
```

### اضافه کردن یه انیمیشن جدید

```javascript
'r': { name: 'emote-yes', duration: 0.67 },
```

---

## 🎨 منابع و اعتبارها

- **مدل‌های شخصیت:** [Kenney Mini Characters](https://kenney.nl/assets/mini-characters-1) (CC0)
- **موتور سه‌بعدی:** [Three.js](https://threejs.org/)
- **فیزیک:** [Cannon-ES](https://github.com/pmndrs/cannon-es)

---

## 📜 لایسنس

این پروژه تحت لایسنس **MIT** منتشر شده. برای اطلاعات بیشتر فایل [LICENSE](./LICENSE) رو ببین.

---

## 🤝 مشارکت

1. یه Fork بگیر
2. یه branch جدید بساز (`git checkout -b feature/AmazingFeature`)
3. تغییراتت رو commit کن (`git commit -m 'Add some AmazingFeature'`)
4. push کن (`git push origin feature/AmazingFeature`)
5. یه Pull Request بزن

---



