/**
 * Game: هسته‌ی اصلی بازی.
 * مسئول: ساخت Scene، دوربین، رندرر، حلقه‌ی بازی، و مدیریت سیستم‌ها.
 * این کلاس نباید مستقیماً چیز خاصی از شهر بدونه.
 */
import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { CameraRig } from './CameraRig.js';
import { GameLoop } from './GameLoop.js';
import { World } from '../world/World.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    // صحنه
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

    // دوربین
    this.cameraRig = new CameraRig();

    // رندرر
    this.renderer = new Renderer(canvas);

    // دنیا (شهر + آب)
    this.world = new World();
    this.scene.add(this.world.group);

    // حلقه‌ی بازی
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });

    // هندل ریسایز
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }

  update(dt) {
    this.world.update(dt);
    this.cameraRig.update(dt);
  }

  render() {
    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.cameraRig.setAspect(w / h);
    this.renderer.setSize(w, h);
  }
}