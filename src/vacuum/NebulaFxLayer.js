import * as THREE from 'three';
import System, {
  Alpha,
  Color,
  Emitter,
  Life,
  Mass,
  PointZone,
  Position,
  RadialVelocity,
  RandomDrift,
  Radius,
  Rate,
  Scale,
  Span,
  SpriteRenderer,
  Vector3D
} from 'three-nebula';
import { createSoftParticleTexture } from './SoftParticleTexture.js';

export class NebulaFxLayer {
  constructor(scene, state) {
    this.state = state;
    this.group = new THREE.Group();
    this.group.name = 'nebula-fx-layer';
    scene.add(this.group);
    this.system = new System(800);
    this.renderer = new SpriteRenderer(this.group, THREE);
    const mistTexture = createSoftParticleTexture('nebula-fx-mist', {
      size: 192,
      core: 'rgba(255,255,255,0.88)',
      mid: 'rgba(170,240,255,0.28)',
      falloff: 0.78
    });
    this.renderer._body.material.map = mistTexture;
    this.renderer._body.material.alphaMap = mistTexture;
    this.renderer._body.material.transparent = true;
    this.renderer._body.material.depthWrite = false;
    this.renderer._body.material.blending = THREE.AdditiveBlending;
    this.system.addRenderer(this.renderer);
    this.emitters = [];
  }

  burst(position, options = {}) {
    if (!this.state.showParticles) return;
    const {
      count = 42,
      colorA = '#7df7ff',
      colorB = '#ffffff',
      life = 1.1,
      radius = [3, 9],
      speed = 80,
      drift = 22,
      direction = new THREE.Vector3(0, 1, 0),
      spread = 180
    } = options;
    const emitter = new Emitter()
      .setRate(new Rate(new Span(count, count), new Span(0.001, 0.002)))
      .setInitializers([
        new Position(new PointZone(position.x, position.y, position.z)),
        new Mass(1),
        new Radius(new Span(radius[0], radius[1])),
        new Life(new Span(life * 0.72, life * 1.25)),
        new RadialVelocity(new Span(speed * 0.55, speed * 1.2), toVector3D(direction), spread)
      ])
      .setBehaviours([
        new Alpha(0.95, 0),
        new Scale(0.2, 1.6),
        new Color(colorA, colorB),
        new RandomDrift(drift, drift, drift * 0.75, 0.035)
      ]);
    emitter.emit(1, life);
    this.system.addEmitter(emitter);
    this.emitters.push({ emitter, age: 0, life: life + 1.2 });
  }

  stream(position, direction, options = {}) {
    this.burst(position, {
      count: options.count ?? 12,
      colorA: options.colorA ?? '#74ffe8',
      colorB: options.colorB ?? '#ffffff',
      life: options.life ?? 0.7,
      radius: options.radius ?? [2, 5],
      speed: options.speed ?? 48,
      drift: options.drift ?? 8,
      direction,
      spread: options.spread ?? 38
    });
  }

  update(dt) {
    this.system.update(dt);
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const entry = this.emitters[i];
      entry.age += dt;
      if (entry.age < entry.life) continue;
      entry.emitter.stopEmit();
      entry.emitter.removeAllParticles();
      this.system.removeEmitter(entry.emitter);
      this.emitters.splice(i, 1);
    }
  }

  clear() {
    for (const entry of this.emitters) {
      entry.emitter.stopEmit();
      entry.emitter.removeAllParticles();
    }
    this.system.update(0.1);
    for (const entry of this.emitters) this.system.removeEmitter(entry.emitter);
    this.emitters = [];
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.material?.dispose?.();
      child.geometry?.dispose?.();
    }
  }
}

function toVector3D(vector) {
  const safe = vector.lengthSq() > 0 ? vector.clone().normalize() : new THREE.Vector3(0, 1, 0);
  return new Vector3D(safe.x, safe.y, safe.z);
}
