import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ASSETS, MATERIAL_PROFILES, MAX_TRAIL_POINTS, PRESETS } from './config.js';
import { createBlackHoleMaterial } from './BlackHoleMaterial.js';
import {
  createGasCloudMaterial,
  createHologramMaterial,
  createLightShaftMaterial,
  createProceduralPlanetMaterial,
  createStarSurfaceMaterial,
  createVolumetricShellMaterial
} from './ProceduralMaterials.js';
import { createSoftParticleTexture } from './SoftParticleTexture.js';

let nextId = 1;
const MODEL_PATHS = {
  astronaut: '/assets/models/nasa-astronaut.glb',
  station: '/assets/models/nasa-iss.glb',
  mir: '/assets/models/nasa-mir.glb',
  hubble: '/assets/models/nasa-hubble.glb',
  jwst: '/assets/models/nasa-jwst.glb',
  mro: '/assets/models/nasa-mro.glb',
  voyager: '/assets/models/nasa-voyager.glb',
  rover: '/assets/models/nasa-perseverance.glb',
  dish: '/assets/models/nasa-70m-dish.glb',
  probe: '/assets/models/nasa-cassini.glb',
  mystery: '/assets/models/nasa-apollo-lunar-module.glb',
  asteroid: '/assets/models/nasa-asteroid-rq36.glb',
  alien: '/assets/models/kenney-alien.glb',
  ufo: '/assets/models/kenney-craft-racer.glb'
};

const MODEL_TUNING = {
  astronaut: { scale: 3.3, rotation: [Math.PI / 2, 0, 0] },
  station: { scale: 4.6, rotation: [Math.PI / 2, 0, 0] },
  mir: { scale: 4.2, rotation: [Math.PI / 2, 0, 0] },
  hubble: { scale: 4.3, rotation: [Math.PI / 2, 0, 0] },
  jwst: { scale: 4.4, rotation: [Math.PI / 2, 0, 0] },
  mro: { scale: 4.1, rotation: [Math.PI / 2, 0, 0] },
  voyager: { scale: 4.7, rotation: [Math.PI / 2, 0, 0] },
  rover: { scale: 3.6, rotation: [Math.PI / 2, 0, 0] },
  dish: { scale: 4.4, rotation: [Math.PI / 2, 0, 0] },
  probe: { scale: 4.4, rotation: [Math.PI / 2, 0, 0] },
  mystery: { scale: 4.2, rotation: [Math.PI / 2, 0, 0] },
  asteroid: { scale: 2.3, rotation: [0, 0, 0] },
  alien: { scale: 4.2, rotation: [Math.PI / 2, 0, 0] },
  ufo: { scale: 4.8, rotation: [Math.PI / 2, 0, 0] }
};

const TEXTURE_PATHS = {
  planet: '/assets/models/nasa-earth-day.jpg',
  moon: '/assets/models/nasa-moon-color.jpg'
};

export class ObjectFactory {
  constructor(scene, state = null) {
    this.scene = scene;
    this.state = state;
    const draco = new DRACOLoader();
    draco.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);
    this.textureLoader = new THREE.TextureLoader();
    this.modelCache = new Map();
    this.textureCache = new Map();
  }

  create(type, position) {
    const asset = ASSETS.find((item) => item.type === type) ?? ASSETS[0];
    const preset = PRESETS[type] ?? PRESETS.astronaut;
    const group = new THREE.Group();
    const mesh = this.meshFor(asset);
    mesh.userData.placeholder = Boolean(MODEL_PATHS[asset.type]);
    group.add(mesh);
    this.addDecorations(group, asset);
    this.attachModel(group, asset);
    group.position.copy(position);
    this.scene.add(group);
    const body = {
      id: nextId++,
      type,
      category: asset.category,
      label: asset.label,
      materialProfile: MATERIAL_PROFILES[type] ?? asset.category,
      mass: asset.mass,
      radius: asset.radius,
      charge: asset.charge ?? (type === 'debris' ? 0.25 : 0),
      baseRadius: asset.radius,
      position: position.clone(),
      velocity: new THREE.Vector3(...preset.velocity),
      acceleration: new THREE.Vector3(),
      rotation: 0,
      angularVelocity: preset.angular,
      frozen: false,
      showTrail: !['dust', 'debris'].includes(asset.category),
      mesh,
      group,
      trail: [],
      fieldStress: 0,
      shockwave: 0,
      heat: 0,
      glow: 1,
      w: 0,
      wVelocity: 0,
      timeDilation: 1,
      spacetimeCurvature: 0,
      topologyPressure: 0,
      phaseShift: 0,
      tailLength: type === 'comet' ? 1 : undefined,
      tailWidth: type === 'comet' ? 1 : undefined,
      tailOpacity: type === 'comet' ? 1 : undefined,
      accretion: type === 'blackhole' ? 0.45 : 0
    };
    this.addSelectionShell(body);
    this.addSelectionLabel(body);
    if (type === 'dust') {
      body.isDust = true;
      body.collisionScale = 0.35;
    }
    if (['station', 'mir', 'hubble', 'probe', 'mystery', 'jwst', 'mro', 'voyager', 'rover', 'dish', 'ufo'].includes(type)) {
      body.collisionScale = 2.35;
    }
    return body;
  }

  addSelectionShell(body) {
    if (body.type === 'blackhole') return;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius * 1.35, 32, 16),
      createHologramMaterial()
    );
    shell.name = 'selection-hologram';
    shell.visible = false;
    body.group.add(shell);
    body.selectionShell = shell;
  }

  addSelectionLabel(body) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(3, 10, 18, 0.72)';
    roundRect(context, 8, 22, 496, 82, 18);
    context.fill();
    context.strokeStyle = 'rgba(126, 248, 239, 0.8)';
    context.lineWidth = 3;
    roundRect(context, 8, 22, 496, 82, 18);
    context.stroke();
    context.fillStyle = '#e9fbff';
    context.font = '700 34px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(body.label, 256, 63, 452);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    }));
    sprite.name = 'selection-label';
    sprite.visible = false;
    sprite.position.set(0, body.radius * 2.2, 0);
    sprite.scale.set(body.radius * 4.5, body.radius * 1.1, 1);
    sprite.renderOrder = 9;
    body.group.add(sprite);
    body.selectionLabel = sprite;
  }

  attachModel(group, asset) {
    const path = MODEL_PATHS[asset.type];
    if (!path) return;
    const useModel = (source) => {
      const model = source.clone(true);
      model.name = `${asset.type}-model`;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const tuning = MODEL_TUNING[asset.type] ?? { scale: 3 };
      model.scale.setScalar((asset.radius * tuning.scale) / maxAxis);
      model.userData.baseScale = model.scale.clone();
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(model.scale.x));
      model.rotation.set(...(tuning.rotation ?? [0, 0, 0]));
      model.traverse((child) => {
        if (child.isLine || child.isLineSegments || child.type === 'Line' || child.type === 'LineSegments') {
          child.visible = false;
          return;
        }
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      for (const child of group.children) {
        if (child.userData.placeholder || child.userData.rigVisual || child.userData.placeholderDecoration) child.visible = false;
      }
      group.add(model);
    };
    if (this.modelCache.has(path)) {
      useModel(this.modelCache.get(path));
      return;
    }
    this.loader.load(path, (gltf) => {
      this.modelCache.set(path, gltf.scene);
      useModel(gltf.scene);
    });
  }

  meshFor(asset) {
    const texture = this.textureFor(asset.type);
    const material = this.materialForAsset(asset, texture);
    if (asset.type === 'star') {
      return new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 72, 36), createStarSurfaceMaterial());
    }
    if (asset.type === 'mars') {
      return new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 72, 36), createProceduralPlanetMaterial('mars'));
    }
    if (asset.type === 'jupiter') {
      return new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 96, 48), createProceduralPlanetMaterial('jupiter'));
    }
    if (asset.type === 'blackhole') {
      return new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 0.9, 64, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
    }
    if (asset.type === 'astronaut') {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(asset.radius * 0.46, asset.radius * 1.12, 8, 18), material);
      torso.name = 'astro-torso';
      return torso;
    }
    if (asset.type === 'alien') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(asset.radius * 0.38, asset.radius * 0.95, 8, 18), material);
      body.name = 'alien-body';
      body.visible = false;
      return body;
    }
    if (asset.type === 'ufo') {
      const saucer = new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 48, 16), material);
      saucer.name = 'ufo-hull';
      saucer.scale.set(1.45, 0.22, 1.45);
      saucer.visible = false;
      return saucer;
    }
    if (asset.type === 'station' || asset.type === 'mir' || asset.type === 'hubble' || asset.type === 'probe' || asset.type === 'jwst' || asset.type === 'mro' || asset.type === 'voyager' || asset.type === 'rover' || asset.type === 'dish') {
      return new THREE.Mesh(new THREE.BoxGeometry(asset.radius * 1.7, asset.radius * 0.8, 5), material);
    }
    if (asset.type === 'laser') {
      const emitter = new THREE.Mesh(
        new THREE.CylinderGeometry(asset.radius * 0.36, asset.radius * 0.48, asset.radius * 2.1, 18),
        new THREE.MeshStandardMaterial({
          color: 0x39485f,
          emissive: 0xff335c,
          emissiveIntensity: 0.55,
          metalness: 0.35,
          roughness: 0.34
        })
      );
      emitter.name = 'laser-emitter';
      emitter.rotation.z = Math.PI / 2;
      emitter.scale.set(1.25, 1.25, 1.25);
      return emitter;
    }
    if (asset.type === 'dust') {
      const positions = [];
      const colors = [];
      const color = new THREE.Color(asset.color);
      for (let i = 0; i < 28; i++) {
        const dir = randomDirection().multiplyScalar(asset.radius * (0.35 + Math.random() * 1.6));
        positions.push(dir.x, dir.y, dir.z);
        colors.push(color.r, color.g, color.b);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const texture = createSoftParticleTexture('dust-mote', {
        core: 'rgba(255,255,255,0.9)',
        mid: 'rgba(150,245,255,0.32)',
        falloff: 0.74
      });
      return new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 5.2,
          map: texture,
          alphaMap: texture,
          alphaTest: 0.015,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
    }
    if (asset.type === 'debris' || asset.type === 'asteroid') return new THREE.Mesh(new THREE.DodecahedronGeometry(asset.radius, 0), material);
    if (asset.type === 'gas') {
      return new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 48, 24), createGasCloudMaterial());
    }
    return new THREE.Mesh(new THREE.SphereGeometry(asset.radius, 48, 24), material);
  }

  materialForAsset(asset, texture) {
    return new THREE.MeshStandardMaterial({
      color: asset.color,
      map: texture,
      emissive: asset.emissive,
      emissiveIntensity: asset.type === 'star' ? 2.4 : asset.type === 'blackhole' ? 0 : 0.55,
      roughness: 0.55,
      metalness: asset.type === 'station' ? 0.5 : 0.05
    });
  }

  textureFor(type) {
    const path = TEXTURE_PATHS[type];
    if (!path) return null;
    if (!this.textureCache.has(path)) {
      const texture = this.textureLoader.load(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 6;
      this.textureCache.set(path, texture);
    }
    return this.textureCache.get(path);
  }

  addDecorations(group, asset) {
    if (asset.type === 'astronaut') {
      group.name = 'astronaut-ragdoll';
      const suit = new THREE.MeshStandardMaterial({ color: 0xeef7ff, emissive: 0x1b3854, emissiveIntensity: 0.45, roughness: 0.5 });
      const limbMat = new THREE.MeshStandardMaterial({ color: 0xb9d7e8, emissive: 0x12354a, emissiveIntensity: 0.42, roughness: 0.45 });
      const visor = new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x60eaff, emissiveIntensity: 0.5, roughness: 0.2 });
      const joint = new THREE.MeshBasicMaterial({ color: 0x70fff0 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(asset.radius * 0.48, 24, 12), suit);
      head.name = 'astro-head';
      head.position.y = asset.radius * 1.05;
      head.userData.anchor = { x: 0, y: 1.05, z: 0 };
      head.userData.rigVisual = true;
      const face = new THREE.Mesh(new THREE.CircleGeometry(asset.radius * 0.27, 24), visor);
      face.name = 'astro-visor';
      face.position.set(0, asset.radius * 1.08, asset.radius * 0.42);
      face.userData.anchor = { x: 0, y: 1.08, z: 0.42 };
      face.userData.rigVisual = true;
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(asset.radius * 0.72, asset.radius * 0.9, asset.radius * 0.28), suit);
      backpack.name = 'astro-backpack';
      backpack.position.z = -asset.radius * 0.48;
      backpack.userData.anchor = { x: 0, y: 0, z: -0.48 };
      backpack.userData.rigVisual = true;
      group.add(head, face, backpack);
      const limbs = [
        ['arm-left', -0.82, 0.35, -0.8],
        ['arm-right', 0.82, 0.35, 0.8],
        ['leg-left', -0.34, -0.98, -0.32],
        ['leg-right', 0.34, -0.98, 0.32]
      ];
      for (const [name, x, y, bend] of limbs) {
        const limb = new THREE.Mesh(new THREE.CapsuleGeometry(asset.radius * 0.18, asset.radius * 1.05, 8, 12), limbMat);
        limb.name = name;
        limb.userData.base = { x, y, bend, phase: Math.random() * Math.PI * 2 };
        limb.userData.rigVisual = true;
        limb.position.set(asset.radius * x, asset.radius * y, 0);
        limb.rotation.z = bend;
        group.add(limb);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(asset.radius * 0.1, 10, 6), joint);
        dot.name = `${name}-joint`;
        dot.position.set(asset.radius * x * 0.82, asset.radius * (y + 0.28), asset.radius * 0.18);
        dot.userData.anchor = { x: x * 0.82, y: y + 0.28, z: 0.18 };
        dot.userData.rigVisual = true;
        group.add(dot);
      }
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 0.18, 16, 8),
        new THREE.MeshBasicMaterial({ color: 0x72fff1 })
      );
      light.position.set(asset.radius * 0.65, asset.radius * 0.25, 2);
      light.userData.anchor = { x: 0.65, y: 0.25, z: 2 / asset.radius };
      light.userData.rigVisual = true;
      group.add(light);
    }
    if (asset.type === 'alien') {
      group.name = 'alien-authored';
      const aura = new THREE.PointLight(0x7dffb3, 0.8, asset.radius * 8);
      aura.name = 'alien-aura-light';
      group.add(aura);
    }
    if (asset.type === 'ufo') {
      group.name = 'ufo-craft';
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(asset.radius * 0.16, asset.radius * 0.62, asset.radius * 2.4, 32, 1, true),
        createLightShaftMaterial(0x74ffe8)
      );
      beam.name = 'tractor-beam';
      beam.position.y = -asset.radius * 1.35;
      beam.visible = false;
      group.add(beam);
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI * 2;
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(asset.radius * 0.07, 10, 6),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff74ef : 0x72fff0, transparent: true, opacity: 0.65 })
        );
        light.name = 'ufo-light';
        light.position.set(Math.cos(angle) * asset.radius * 0.74, Math.sin(angle) * asset.radius * 0.12, Math.sin(angle) * asset.radius * 0.74);
        group.add(light);
      }
    }
    if (asset.type === 'planet' || asset.type === 'mars' || asset.type === 'jupiter') {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 1.12, 48, 24),
        new THREE.MeshBasicMaterial({ color: asset.type === 'mars' ? 0xff8c5e : asset.type === 'jupiter' ? 0xffd6a5 : 0x63d9ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })
      );
      atmosphere.name = 'planet-atmosphere';
      group.add(atmosphere);
    }
    if (asset.type === 'planet') {
      const continent = new THREE.Mesh(
        new THREE.TorusGeometry(asset.radius * 0.42, asset.radius * 0.06, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x4dff9b, transparent: true, opacity: 0.62 })
      );
      continent.scale.y = 0.38;
      continent.rotation.z = 0.45;
      group.add(continent);
    }
    if (asset.type === 'jupiter') {
      const storm = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 0.18, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xffc08a, transparent: true, opacity: 0.72 })
      );
      storm.name = 'jupiter-storm';
      storm.position.set(asset.radius * 0.48, -asset.radius * 0.08, asset.radius * 0.86);
      group.add(storm);
    }
    if (asset.type === 'moon') {
      const terminator = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 1.01, 36, 18),
        new THREE.MeshBasicMaterial({ color: 0x0a0d13, transparent: true, opacity: 0.26, blending: THREE.NormalBlending })
      );
      terminator.name = 'moon-terminator';
      terminator.position.x = -asset.radius * 0.16;
      group.add(terminator);
      for (let i = 0; i < 5; i++) {
        const crater = new THREE.Mesh(
          new THREE.RingGeometry(asset.radius * (0.08 + Math.random() * 0.08), asset.radius * (0.1 + Math.random() * 0.1), 18),
          new THREE.MeshBasicMaterial({ color: 0x7b828c, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
        );
        crater.position.set((Math.random() - 0.5) * asset.radius, (Math.random() - 0.5) * asset.radius, asset.radius * 0.92);
        group.add(crater);
      }
    }
    if (asset.type === 'blackhole') {
      const horizon = new THREE.Mesh(
        new THREE.PlaneGeometry(asset.radius * 10.8, asset.radius * 10.8),
        createBlackHoleMaterial()
      );
      horizon.name = 'event-horizon-shader';
      horizon.renderOrder = 3;
      group.add(horizon);
    }
    if (asset.type === 'gas') {
      const volume = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 1.16, 64, 32),
        createVolumetricShellMaterial(0x9a72ff, 0xffb35d)
      );
      volume.name = 'gas-volume-shell';
      group.add(volume);
      const particleMaterial = new THREE.PointsMaterial({
        color: asset.color,
        size: 5.8,
        map: createSoftParticleTexture('gas-mote', {
          core: 'rgba(255,255,255,0.72)',
          mid: 'rgba(180,128,255,0.24)',
          falloff: 0.84
        }),
        alphaTest: 0.01,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const positions = [];
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * asset.radius;
        positions.push(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * asset.radius * 0.25);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const particles = new THREE.Points(geometry, particleMaterial);
      particles.name = 'gas-particles';
      group.add(particles);
    }
    if (asset.type === 'magnet') {
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(asset.radius * 0.66, 1),
        new THREE.MeshStandardMaterial({ color: 0xff5fe0, emissive: 0x9c1fff, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.25 })
      );
      core.name = 'magnet-core';
      group.add(core);
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(asset.radius * (1.04 + i * 0.18), 0.8, 10, 96),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4ed6 : 0x72fff0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending })
        );
        ring.name = 'magnetic-field-ring';
        ring.rotation.x = Math.PI * 0.5 + i * 0.18;
        ring.rotation.y = i * 0.62;
        group.add(ring);
      }
    }
    if (asset.type === 'laser') {
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(asset.radius * 6.4, asset.radius * 0.2, asset.radius * 0.2),
        createLightShaftMaterial(0xff3c72)
      );
      glow.name = 'laser-glow';
      glow.position.x = asset.radius * 2.9;
      group.add(glow);
      const muzzle = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 0.34, 18, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd5df, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })
      );
      muzzle.name = 'laser-muzzle';
      muzzle.position.x = asset.radius * 0.82;
      group.add(muzzle);
    }
    if (asset.type === 'star') {
      const glow = new THREE.PointLight(asset.color, 2.4, 420);
      group.add(glow);
      for (let i = 0; i < 5; i++) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(asset.radius * (1.08 + i * 0.13), 48, 24),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xfff1a4 : 0xff7a22,
            transparent: true,
            opacity: 0.12 - i * 0.012,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
          })
        );
        shell.name = 'star-flare';
        shell.scale.set(1 + Math.random() * 0.06, 1 + Math.random() * 0.06, 1 + Math.random() * 0.06);
        group.add(shell);
      }
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 1.7, 64, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
      );
      corona.name = 'star-corona';
      group.add(corona);
      for (let i = 0; i < 4; i++) {
        const ray = new THREE.Mesh(
          new THREE.ConeGeometry(asset.radius * (0.12 + i * 0.025), asset.radius * 3.8, 24, 1, true),
          createLightShaftMaterial(i % 2 ? 0xffd36b : 0xff7442)
        );
        ray.name = 'star-godray';
        ray.visible = false;
        ray.position.z = asset.radius * 0.4;
        ray.rotation.set(Math.PI * 0.5, i * Math.PI * 0.5, i * 0.9);
        group.add(ray);
      }
    }
    if (asset.type === 'comet') {
      const coma = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 1.35, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xcffcff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      coma.name = 'comet-coma';
      group.add(coma);
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCometTailTexture(),
        color: 0xbffaff,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      tail.name = 'comet-tail-sprite';
      tail.center.set(1, 0.5);
      tail.position.x = -asset.radius * 1.1;
      tail.scale.set(asset.radius * 12, asset.radius * 4.2, 1);
      group.add(tail);
      const nucleus = new THREE.Mesh(
        new THREE.DodecahedronGeometry(asset.radius * 0.62, 0),
        new THREE.MeshStandardMaterial({ color: 0xdafaff, emissive: 0x53dfff, emissiveIntensity: 0.9, roughness: 0.65 })
      );
      nucleus.name = 'comet-nucleus';
      nucleus.scale.set(1.12, 0.82, 0.92);
      group.add(nucleus);
      for (let i = 0; i < 3; i++) {
        const chip = new THREE.Mesh(
          new THREE.IcosahedronGeometry(asset.radius * (0.16 + i * 0.05), 0),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0x9defff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
        );
        chip.name = 'comet-ice-chip';
        chip.position.set((Math.random() - 0.5) * asset.radius * 1.8, (Math.random() - 0.5) * asset.radius * 1.4, (Math.random() - 0.5) * asset.radius);
        group.add(chip);
      }
    }
    if (asset.type === 'station' || asset.type === 'mir' || asset.type === 'hubble' || asset.type === 'probe' || asset.type === 'jwst' || asset.type === 'mro' || asset.type === 'voyager') {
      const panelMat = new THREE.MeshBasicMaterial({ color: 0x3c8dff, transparent: true, opacity: 0.78 });
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(asset.radius * 1.8, asset.radius * 0.12, 1), panelMat);
        panel.name = 'solar-panel';
        panel.userData.placeholderDecoration = true;
        panel.position.x = side * asset.radius * 1.9;
        group.add(panel);
      }
    }
    if (asset.type === 'portal') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(asset.radius, 2.4, 12, 80),
        new THREE.MeshBasicMaterial({ color: asset.color })
      );
      ring.name = 'wormhole-main-ring';
      group.add(ring);
      const throat = new THREE.Mesh(
        new THREE.SphereGeometry(asset.radius * 0.72, 48, 18),
        createVolumetricShellMaterial(0x2bffe2, 0xc35cff)
      );
      throat.name = 'wormhole-throat';
      throat.scale.z = 0.35;
      group.add(throat);
      for (let i = 0; i < 4; i++) {
        const spiral = new THREE.Mesh(
          new THREE.TorusGeometry(asset.radius * (0.45 + i * 0.17), 0.7, 8, 80),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xc35cff : 0x72fff0, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending })
        );
        spiral.name = 'wormhole-spiral';
        spiral.rotation.x = Math.PI / 2 + i * 0.28;
        spiral.rotation.y = i * 0.42;
        group.add(spiral);
      }
    }
    if (asset.type === 'debris') {
      const shardMat = new THREE.MeshStandardMaterial({ color: 0xb0947f, emissive: 0x28160d, emissiveIntensity: 0.35, roughness: 0.8 });
      for (let i = 0; i < 5; i++) {
        const chip = new THREE.Mesh(new THREE.TetrahedronGeometry(asset.radius * (0.18 + Math.random() * 0.2), 0), shardMat);
        chip.name = 'debris-chip';
        chip.position.set((Math.random() - 0.5) * asset.radius * 1.4, (Math.random() - 0.5) * asset.radius * 1.4, (Math.random() - 0.5) * asset.radius * 1.2);
        chip.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(chip);
      }
    }
  }

  updateTrail(body) {
    if (!body.showTrail) return;
    body.trail.push(body.position.clone());
    const max = Math.floor(this.state?.trailLength ?? MAX_TRAIL_POINTS);
    while (body.trail.length > max) body.trail.shift();
  }
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function createCometTailTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 80, 512, 80);
  gradient.addColorStop(0, 'rgba(210, 255, 255, 0)');
  gradient.addColorStop(0.38, 'rgba(120, 225, 255, 0.18)');
  gradient.addColorStop(0.72, 'rgba(190, 255, 255, 0.55)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.92)');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, 8);
  context.quadraticCurveTo(260, 40, 512, 74);
  context.quadraticCurveTo(260, 122, 0, 152);
  context.closePath();
  context.fill();
  const core = context.createLinearGradient(0, 80, 512, 80);
  core.addColorStop(0, 'rgba(90, 190, 255, 0)');
  core.addColorStop(0.7, 'rgba(160, 245, 255, 0.35)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0.86)');
  context.strokeStyle = core;
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(18, 82);
  context.quadraticCurveTo(260, 86, 512, 80);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}
