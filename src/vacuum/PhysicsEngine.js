import * as THREE from 'three';
import { G, SOFTENING } from './config.js';
import { SpacetimeVolumeSystem } from './SpacetimeVolumeSystem.js';

export class PhysicsEngine {
  constructor(state) {
    this.state = state;
    this.tmp = new THREE.Vector3();
    this.delta = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.relative = new THREE.Vector3();
    this.spacetime = new SpacetimeVolumeSystem(state);
  }

  step(dt) {
    const baseSubsteps = Math.max(1, Math.min(8, Math.round(this.state.substeps ?? 2)));
    const adaptiveSubsteps = Math.max(1, Math.min(6, Math.ceil(dt / 0.018)));
    const substeps = Math.min(8, Math.max(baseSubsteps, adaptiveSubsteps));
    const stepDt = dt / substeps;
    for (let i = 0; i < substeps; i++) this.singleStep(stepDt);
  }

  singleStep(dt) {
    const bodies = this.state.bodies;
    for (const body of bodies) {
      body.acceleration.set(0, 0, 0);
      body.fieldStress = 0;
      body.tidalStress = 0;
      body.reactionCooldown = Math.max(0, (body.reactionCooldown ?? 0) - dt);
      body.attachCooldown = Math.max(0, (body.attachCooldown ?? 0) - dt);
      body.abductCooldown = Math.max(0, (body.abductCooldown ?? 0) - dt);
      body.spacetimeCooldown = Math.max(0, (body.spacetimeCooldown ?? 0) - dt);
      body.materialCooldown = Math.max(0, (body.materialCooldown ?? 0) - dt);
      body.tidalCooldown = Math.max(0, (body.tidalCooldown ?? 0) - dt);
      body.resonanceCooldown = Math.max(0, (body.resonanceCooldown ?? 0) - dt);
      body.captureCooldown = Math.max(0, (body.captureCooldown ?? 0) - dt);
    }

    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (this.shouldSkipPair(a, b)) continue;
        if (a.attachedTo || b.attachedTo) continue;
        this.applyPair(a, b);
      }
    }

    this.applyPortals();
    this.spacetime.apply(dt);

    for (const body of bodies) {
      if (this.updateAttachment(body)) continue;
      if (body.frozen) continue;
      const visualDt = dt * Math.max(0.45, body.timeDilation ?? 1);
      body.velocity.addScaledVector(body.acceleration, dt);
      this.clampVector(body.velocity, this.state.maxVelocity ?? 520);
      const damping = this.state.damping ?? 0.996;
      if (damping < 1) body.velocity.multiplyScalar(Math.pow(Math.max(0, damping), dt * 60));
      body.position.addScaledVector(body.velocity, dt);
      const angularDamping = this.state.angularDamping ?? damping;
      if (angularDamping < 1) body.angularVelocity *= Math.pow(Math.max(0, angularDamping), dt * 60);
      body.rotation += body.angularVelocity * visualDt;
      this.applyBounds(body);
      body.group.position.copy(body.position);
      body.group.rotation.z = body.rotation;
    }

    this.collisions();
  }

  applyBounds(body) {
    const half = (this.state.boundsSize ?? 820) * 0.5;
    if (!Number.isFinite(half) || half <= 0) return;
    const bounce = this.state.boundaryRestitution ?? 0.78;
    if (body.position.x > half) {
      body.position.x = half;
      body.velocity.x = -Math.abs(body.velocity.x) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
    if (body.position.x < -half) {
      body.position.x = -half;
      body.velocity.x = Math.abs(body.velocity.x) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
    if (body.position.y > half) {
      body.position.y = half;
      body.velocity.y = -Math.abs(body.velocity.y) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
    if (body.position.y < -half) {
      body.position.y = -half;
      body.velocity.y = Math.abs(body.velocity.y) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
    if (body.position.z > half) {
      body.position.z = half;
      body.velocity.z = -Math.abs(body.velocity.z) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
    if (body.position.z < -half) {
      body.position.z = -half;
      body.velocity.z = Math.abs(body.velocity.z) * bounce;
      body.shockwave = Math.max(body.shockwave ?? 0, 0.3);
    }
  }

  applyPair(a, b) {
    this.tmp.subVectors(b.position, a.position);
    const distSq = this.tmp.lengthSq() + (this.state.softeningScale ?? SOFTENING);
    const dist = Math.sqrt(distSq);
    const dir = this.tmp.multiplyScalar(1 / dist);
    if (a.mass > 0 && b.mass > 0) {
      const f = (this.state.gravityScale ?? G) / distSq;
      if (!a.frozen) a.acceleration.addScaledVector(dir, f * b.mass);
      if (!b.frozen) b.acceleration.addScaledVector(dir, -f * a.mass);
      const stress = Math.min(1, (a.mass + b.mass) / distSq * 16);
      a.fieldStress = Math.max(a.fieldStress, stress);
      b.fieldStress = Math.max(b.fieldStress, stress);
    }

    if (a.charge || b.charge) {
      const mag = ((a.charge ?? 0) * (b.charge ?? 0) || (a.charge ?? 0) + (b.charge ?? 0)) * 70 / distSq;
      if (!a.frozen) a.acceleration.addScaledVector(dir, mag / Math.max(0.4, a.mass));
      if (!b.frozen) b.acceleration.addScaledVector(dir, -mag / Math.max(0.4, b.mass));
    }

    this.applySpecialFields(a, b, dir, dist, distSq);
    this.applyFluidFields(a, b, dir, dist);
    this.applyCaptureAssist(a, b, dir, dist);
    this.applyOrbitalResonance(a, b, dir, dist);
    this.clampVector(a.acceleration, this.state.maxAcceleration ?? 850);
    this.clampVector(b.acceleration, this.state.maxAcceleration ?? 850);
  }

  applyCaptureAssist(a, b, dir, dist) {
    if ((a.captureCooldown ?? 0) > 0 || (b.captureCooldown ?? 0) > 0) return;
    const pair = this.capturePair(a, b);
    if (!pair) return;
    const { host, guest } = pair;
    const reach = host.radius * (host.type === 'jupiter' ? 11 : 8.5);
    if (dist < host.radius * 2.4 || dist > reach) return;
    const outward = guest.position.clone().sub(host.position);
    if (outward.lengthSq() < 0.001) return;
    outward.normalize();
    const rel = this.relative.subVectors(guest.velocity, host.velocity);
    const radialSpeed = rel.dot(outward);
    const tangentSpeed = rel.clone().addScaledVector(outward, -radialSpeed).length();
    if (Math.abs(radialSpeed) > Math.max(28, tangentSpeed * 0.82)) return;
    const ideal = Math.sqrt(Math.max(0.01, (this.state.gravityScale ?? G) * host.mass / Math.max(1, dist))) * 8.5;
    if (tangentSpeed < ideal * 0.35 || tangentSpeed > ideal * 2.1) return;
    const tangent = new THREE.Vector3(-outward.y, outward.x, outward.z * 0.18).normalize();
    const direction = rel.dot(tangent) < 0 ? -1 : 1;
    if (!guest.frozen) {
      guest.velocity.copy(host.velocity).addScaledVector(tangent, ideal * direction);
      guest.velocity.addScaledVector(outward, -Math.max(-8, Math.min(8, radialSpeed)) * 0.18);
    }
    guest.captureCooldown = 3.5;
    host.captureCooldown = 1.4;
    guest.fieldStress = Math.max(guest.fieldStress ?? 0, 0.85);
    host.fieldStress = Math.max(host.fieldStress ?? 0, 0.36);
    this.state.events?.push({
      type: 'capture-lock',
      position: host.position.clone().lerp(guest.position, 0.55),
      hostId: host.id,
      guestId: guest.id,
      hostType: host.type,
      guestType: guest.type,
      radius: dist
    });
  }

  capturePair(a, b) {
    const hostTypes = new Set(['planet', 'mars', 'jupiter']);
    const guestTypes = new Set(['moon', 'asteroid', 'comet', 'debris', 'dust', 'astronaut']);
    if (hostTypes.has(a.type) && guestTypes.has(b.type)) return { host: a, guest: b };
    if (hostTypes.has(b.type) && guestTypes.has(a.type)) return { host: b, guest: a };
    return null;
  }

  applyFluidFields(a, b, dir, dist) {
    const fluidA = this.fluidStrength(a);
    const fluidB = this.fluidStrength(b);
    if (!fluidA && !fluidB) return;
    const reach = Math.max(a.radius, b.radius) * (fluidA && fluidB ? 3.8 : 2.8);
    if (dist > reach || dist <= 0) return;
    const falloff = 1 - dist / reach;
    const swirl = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.35).normalize();
    const heatDelta = ((a.heat ?? 0) - (b.heat ?? 0)) * falloff * 0.012;
    if (fluidA && !a.frozen) {
      const pressure = fluidA * falloff * (fluidB ? 18 : 8) / Math.max(0.35, a.mass);
      a.acceleration.addScaledVector(dir, -pressure);
      a.acceleration.addScaledVector(swirl, pressure * 0.55);
      a.velocity.multiplyScalar(1 - falloff * 0.0025 * fluidA);
      a.heat = Math.max(0, Math.min(1, (a.heat ?? 0) - heatDelta));
    }
    if (fluidB && !b.frozen) {
      const pressure = fluidB * falloff * (fluidA ? 18 : 8) / Math.max(0.35, b.mass);
      b.acceleration.addScaledVector(dir, pressure);
      b.acceleration.addScaledVector(swirl, -pressure * 0.55);
      b.velocity.multiplyScalar(1 - falloff * 0.0025 * fluidB);
      b.heat = Math.max(0, Math.min(1, (b.heat ?? 0) + heatDelta));
    }
    if (fluidA || fluidB) {
      a.fieldStress = Math.max(a.fieldStress ?? 0, falloff * 0.35 * fluidA);
      b.fieldStress = Math.max(b.fieldStress ?? 0, falloff * 0.35 * fluidB);
    }
  }

  fluidStrength(body) {
    if (body.category === 'gas') return 1.1;
    if (body.category === 'dust' || body.isDust) return 0.45;
    if ((body.heat ?? 0) > 0.55 && body.mass < 4) return 0.35;
    return 0;
  }

  applySpecialFields(a, b, dir, dist, distSq) {
    const blackhole = a.type === 'blackhole' ? a : b.type === 'blackhole' ? b : null;
    if (blackhole) {
      const other = blackhole === a ? b : a;
      const towardHole = blackhole === a ? dir.clone().multiplyScalar(-1) : dir.clone();
      const feeding = ['gas', 'dust', 'debris', 'small-body', 'crew'].includes(other.category) || other.type === 'comet';
      const reach = blackhole.radius * (feeding ? 16 : 10);
      if (dist < reach) {
        const falloff = 1 - dist / reach;
        const pole = Math.abs(towardHole.z) < 0.82 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        const tangent = new THREE.Vector3().crossVectors(towardHole, pole).normalize();
        const binormal = new THREE.Vector3().crossVectors(towardHole, tangent).normalize();
        const phase = ((blackhole.id ?? 1) * 0.73 + (other.id ?? 1) * 0.37);
        const frameDrag = tangent.multiplyScalar(Math.cos(phase)).addScaledVector(binormal, Math.sin(phase)).normalize();
        if (!other.frozen) {
          other.acceleration.addScaledVector(towardHole, falloff * blackhole.mass * (feeding ? 0.026 : 0.018));
          other.acceleration.addScaledVector(frameDrag, falloff * 46 / Math.max(0.5, other.mass));
          const damping = 1 - falloff * 0.024 * (this.state.captureScale ?? 1);
          if (feeding) other.velocity.multiplyScalar(Math.max(0.88, damping));
        }
        blackhole.accretion = Math.min(3, (blackhole.accretion ?? 0) + falloff * (feeding ? 0.035 : 0.006));
        other.heat = Math.min(1, (other.heat ?? 0) + falloff * 0.04);
        other.tidalStress = Math.max(other.tidalStress ?? 0, falloff * (blackhole.type === 'blackhole' ? 1 : 0.35));
        if (falloff > 0.48 && (other.tidalCooldown ?? 0) <= 0 && other.category !== 'singularity') {
          other.tidalCooldown = feeding ? 0.45 : 0.85;
          blackhole.tidalCooldown = 0.25;
          this.state.events?.push({
            type: 'tidal-shear',
            position: other.position.clone().lerp(blackhole.position, 0.35),
            bodyId: other.id,
            sourceType: other.type,
            sourceCategory: other.category,
            materialProfile: other.materialProfile,
            severity: falloff
          });
        }
      }
    }

    const portalBlackhole = this.blackholePortalPair(a, b);
    if (portalBlackhole) {
      const { blackhole: hole, portal } = portalBlackhole;
      const towardPortal = portal.position.clone().sub(hole.position);
      const reach = hole.radius * 9;
      const distance = Math.max(1, towardPortal.length());
      if (distance < reach) {
        const falloff = 1 - distance / reach;
        towardPortal.normalize();
        const tangent = new THREE.Vector3(-towardPortal.y, towardPortal.x, towardPortal.z * 0.2).normalize();
        if (!portal.frozen) {
          portal.acceleration.addScaledVector(towardPortal, falloff * 42 / Math.max(0.5, portal.mass + 1));
          portal.acceleration.addScaledVector(tangent, falloff * 34 / Math.max(0.5, portal.mass + 1));
        }
        portal.fieldStress = Math.max(portal.fieldStress ?? 0, falloff * 1.2);
        portal.heat = Math.min(1, (portal.heat ?? 0) + falloff * 0.025);
        hole.accretion = Math.min(4, (hole.accretion ?? 0) + falloff * 0.018);
        if (falloff > 0.5 && (portal.reactionCooldown ?? 0) <= 0) {
          portal.reactionCooldown = 0.72;
          hole.reactionCooldown = Math.max(hole.reactionCooldown ?? 0, 0.28);
          this.state.events?.push({
            type: 'whitehole-jet',
            position: portal.position.clone(),
            sourceId: portal.id,
            blackholeId: hole.id,
            direction: towardPortal.clone(),
            severity: falloff
          });
        }
      }
    }

    const ufo = a.type === 'ufo' ? a : b.type === 'ufo' ? b : null;
    if (ufo) {
      const other = ufo === a ? b : a;
      const towardCraft = ufo === a ? dir.clone().multiplyScalar(-1) : dir.clone();
      const canAbduct = ['crew', 'dust', 'debris', 'small-body'].includes(other.category) || other.mass < 3;
      const reach = ufo.radius * 7;
      if (canAbduct && dist < reach) {
        const falloff = 1 - dist / reach;
        const spiral = new THREE.Vector3(-towardCraft.y, towardCraft.x, 0.28).normalize();
        if (!other.frozen) {
          other.acceleration.addScaledVector(towardCraft, falloff * 9 * (Math.abs(ufo.charge ?? 0) + 0.35) / Math.max(0.4, other.mass));
          other.acceleration.addScaledVector(spiral, falloff * 16 / Math.max(0.4, other.mass));
          other.velocity.multiplyScalar(1 - falloff * 0.01);
        }
        ufo.fieldStress = Math.max(ufo.fieldStress ?? 0, falloff * 0.7);
        ufo.tractorActive = Math.max(ufo.tractorActive ?? 0, 0.18);
        other.fieldStress = Math.max(other.fieldStress ?? 0, falloff * 0.45);
        if (dist < ufo.radius * 1.75 && (ufo.abductCooldown ?? 0) <= 0 && (other.abductCooldown ?? 0) <= 0) {
          const lift = towardCraft.clone().multiplyScalar(36 + falloff * 44).add(new THREE.Vector3(0, 0, 42));
          if (!other.frozen) other.velocity.lerp(ufo.velocity.clone().add(lift), 0.45);
          other.heat = Math.max(other.heat ?? 0, 0.18);
          other.shockwave = Math.max(other.shockwave ?? 0, 0.38);
          ufo.shockwave = Math.max(ufo.shockwave ?? 0, 0.55);
          ufo.abductCooldown = 0.9;
          other.abductCooldown = 1.1;
          this.state.events?.push({
            type: 'abduct',
            position: other.position.clone(),
            ufoId: ufo.id,
            targetId: other.id,
            targetType: other.type,
            targetCategory: other.category,
            targetLabel: other.label
          });
        }
      }
    }

    const star = a.type === 'star' ? a : b.type === 'star' ? b : null;
    if (star) {
      const other = star === a ? b : a;
      const reach = star.radius * 12;
      if (dist < reach) {
        const heat = (1 - dist / reach) * (other.type === 'gas' ? 0.08 : 0.025);
        other.heat = Math.min(1, (other.heat ?? 0) + heat);
        if (other.type === 'gas') {
          star.shockwave = Math.max(star.shockwave ?? 0, heat * 3);
          other.fieldStress = Math.max(other.fieldStress ?? 0, other.heat * 0.75);
          if (other.heat > 0.82 && !other.ignitionLatch) {
            other.ignitionLatch = true;
            this.state.events?.push({
              type: 'ignite',
              position: other.position.clone(),
              bodyId: other.id
            });
          }
        }
        if (other.materialProfile === 'rock' && (other.materialCooldown ?? 0) <= 0 && dist < reach * 0.48) {
          other.heat = Math.min(1, (other.heat ?? 0) + 0.18);
          other.fieldStress = Math.max(other.fieldStress ?? 0, 0.7);
          this.cooldown(star, other, 1.15);
          this.state.events?.push({
            type: 'radiant-scorch',
            position: other.position.clone().lerp(star.position, 0.42),
            bodyId: other.id,
            sourceType: other.type,
            severity: 1 - dist / (reach * 0.48)
          });
        }
        if (other.type === 'comet') {
          const falloff = 1 - dist / reach;
          other.heat = Math.min(1, (other.heat ?? 0) + falloff * 0.08);
          other.fieldStress = Math.max(other.fieldStress ?? 0, falloff * 0.75);
          other.velocity.addScaledVector(dir, (star === a ? 1 : -1) * falloff * 0.9);
          if ((other.reactionCooldown ?? 0) <= 0) {
            other.reactionCooldown = 0.55;
            this.state.events?.push({
              type: 'comet-flare',
              position: other.position.clone()
            });
          }
        }
      }
    }

    const magnet = a.type === 'magnet' ? a : b.type === 'magnet' ? b : null;
    if (magnet) {
      const other = magnet === a ? b : a;
      if (['dust', 'debris', 'small-body', 'energy'].includes(other.category) && dist < magnet.radius * 9) {
        const falloff = 1 - dist / (magnet.radius * 9);
        const towardMagnet = magnet === a ? dir.clone().multiplyScalar(-1) : dir.clone();
        const swirl = new THREE.Vector3(-towardMagnet.y, towardMagnet.x, 0.42).normalize();
        if (!other.frozen) {
          other.acceleration.addScaledVector(swirl, falloff * 58 / Math.max(0.3, other.mass));
          other.acceleration.addScaledVector(towardMagnet, falloff * 10 / Math.max(0.3, other.mass));
        }
        other.charge = Math.max(Math.abs(other.charge ?? 0), 0.35);
        other.fieldStress = Math.max(other.fieldStress ?? 0, falloff * 0.8);
        magnet.fieldStress = Math.max(magnet.fieldStress ?? 0, falloff);
        if ((magnet.reactionCooldown ?? 0) <= 0 && falloff > 0.35) {
          magnet.reactionCooldown = 0.5;
          this.state.events?.push({
            type: 'magnetic-aurora',
            position: other.position.clone()
          });
        }
      }
    }
  }

  applyOrbitalResonance(a, b, dir, dist) {
    if ((a.resonanceCooldown ?? 0) > 0 || (b.resonanceCooldown ?? 0) > 0) return;
    if (a.mass <= 0 || b.mass <= 0 || a.attachedTo || b.attachedTo) return;
    if (a.category === 'dust' || b.category === 'dust') return;
    const heavy = a.mass >= b.mass ? a : b;
    const light = heavy === a ? b : a;
    if (heavy.mass < light.mass * 1.65 || heavy.mass < 8) return;
    const min = this.effectiveRadius(a) + this.effectiveRadius(b);
    if (dist < min * 2.2 || dist > Math.max(heavy.radius * 12, min * 8)) return;
    const rel = this.relative.subVectors(light.velocity, heavy.velocity);
    const speed = rel.length();
    if (speed < 7) return;
    const radial = Math.abs(rel.dot(light === b ? dir : dir.clone().multiplyScalar(-1)));
    const tangentRatio = 1 - radial / Math.max(0.001, speed);
    if (tangentRatio < 0.62) return;
    const score = Math.min(1, tangentRatio * Math.min(1, speed / 70));
    heavy.fieldStress = Math.max(heavy.fieldStress ?? 0, score * 0.55);
    light.fieldStress = Math.max(light.fieldStress ?? 0, score * 0.85);
    a.resonanceCooldown = 1.2;
    b.resonanceCooldown = 1.2;
    this.state.events?.push({
      type: 'orbital-resonance',
      position: heavy.position.clone().lerp(light.position, 0.5),
      heavyId: heavy.id,
      lightId: light.id,
      heavyType: heavy.type,
      lightType: light.type,
      severity: score
    });
  }

  collisions() {
    const bodies = this.state.bodies;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (this.shouldSkipCollision(a, b)) continue;
        const min = this.effectiveRadius(a) + this.effectiveRadius(b);
        const delta = this.tmp.subVectors(b.position, a.position);
        const dist = delta.length() || 1;
        if (dist > min) continue;
        const normal = this.normal.copy(delta).multiplyScalar(1 / dist);
        if (this.applyPortalLaserReaction(a, b, normal)) continue;
        if (this.applyWormholeStarReaction(a, b, normal)) continue;
        if (this.applyMaterialReaction(a, b, normal)) continue;
        if (this.applyBlackHoleMerge(a, b, normal)) continue;
        if (a.type === 'blackhole' || b.type === 'blackhole') {
          const eater = a.type === 'blackhole' ? a : b;
          const food = eater === a ? b : a;
          const exit = this.delta.copy(food.position).sub(eater.position).normalize();
          if (food.type === 'laser' || food.type === 'mystery') {
            food.position.copy(eater.position).addScaledVector(exit, eater.radius * 5.2);
            food.velocity.copy(exit.multiplyScalar(food.type === 'laser' ? 260 : 150));
            food.trail.length = 0;
            food.heat = 1;
            food.shockwave = 1;
          } else {
            food.toRemove = food.type !== 'star';
            this.state.events?.push({
              type: 'absorb',
              foodType: food.type,
              foodCategory: food.category,
              foodLabel: food.label,
              foodMass: food.mass,
              foodRadius: food.radius,
              position: food.position.clone(),
              velocity: food.velocity.clone(),
              exit: exit.clone(),
              eaterId: eater.id
            });
          }
          eater.mass += food.mass * 0.08;
          eater.accretion = Math.min(4, (eater.accretion ?? 0) + food.mass * 0.08);
          eater.shockwave = 1;
          continue;
        }
        if (this.applyStarCollision(a, b, normal)) continue;
        const landed = this.applySurfaceContact(a, b, normal, min);
        if (landed) continue;
        if (this.applyStickyCollision(a, b, normal, min)) continue;
        const overlap = min - dist;
        if (!a.frozen) a.position.addScaledVector(normal, -overlap * 0.5);
        if (!b.frozen) b.position.addScaledVector(normal, overlap * 0.5);
        const rel = this.relative.subVectors(b.velocity, a.velocity);
        const impulse = rel.dot(normal);
        if (impulse < 0) {
          const bounce = this.state.restitution ?? 0.72;
          const total = a.mass + b.mass;
          if (!a.frozen) a.velocity.addScaledVector(normal, impulse * bounce * b.mass / total);
          if (!b.frozen) b.velocity.addScaledVector(normal, -impulse * bounce * a.mass / total);
          a.shockwave = 1;
          b.shockwave = 1;
          this.emitImpact(a, b, normal, Math.abs(impulse));
          this.applyFragmentation(a, b, normal, Math.abs(impulse));
        }
      }
    }
  }

  applyPortalLaserReaction(a, b, normal) {
    const portal = a.type === 'portal' ? a : b.type === 'portal' ? b : null;
    const laser = a.type === 'laser' ? a : b.type === 'laser' ? b : null;
    if (!portal || !laser) return false;
    if ((portal.reactionCooldown ?? 0) > 0 || (laser.reactionCooldown ?? 0) > 0) return false;
    const outward = laser.position.clone().sub(portal.position);
    if (outward.lengthSq() < 0.001) outward.copy(normal);
    outward.normalize();
    laser.velocity.copy(outward.multiplyScalar(180)).add(new THREE.Vector3(-outward.y, outward.x, outward.z * 0.4).multiplyScalar(95));
    laser.position.copy(portal.position).addScaledVector(outward, portal.radius * 2.2);
    laser.heat = 1;
    laser.shockwave = 1;
    portal.heat = Math.max(portal.heat ?? 0, 0.65);
    portal.shockwave = 1;
    portal.reactionCooldown = 0.9;
    laser.reactionCooldown = 0.9;
    this.state.events?.push({
      type: 'portal-laser',
      position: portal.position.clone()
    });
    return true;
  }

  blackholePortalPair(a, b) {
    const blackhole = a.type === 'blackhole' ? a : b.type === 'blackhole' ? b : null;
    const portal = a.type === 'portal' ? a : b.type === 'portal' ? b : null;
    return blackhole && portal ? { blackhole, portal } : null;
  }

  applyMaterialReaction(a, b, normal) {
    const profiles = [a.materialProfile, b.materialProfile];
    const hasMetal = profiles.some((profile) => ['metal', 'field-metal'].includes(profile));
    const hasField = profiles.some((profile) => ['field', 'field-metal'].includes(profile));
    const star = a.type === 'star' ? a : b.type === 'star' ? b : null;
    const comet = a.type === 'comet' ? a : b.type === 'comet' ? b : null;
    const gas = a.type === 'gas' ? a : b.type === 'gas' ? b : null;
    const rockyPlanet = ['planet', 'mars'].includes(a.type) ? a : ['planet', 'mars'].includes(b.type) ? b : null;
    const planet = ['planet', 'mars', 'moon', 'jupiter'].includes(a.type) ? a : ['planet', 'mars', 'moon', 'jupiter'].includes(b.type) ? b : null;
    const impactor = planet === a ? b : planet === b ? a : null;
    if (gas && rockyPlanet && this.readyForReaction(gas, rockyPlanet)) {
      const outward = gas.position.clone().sub(rockyPlanet.position);
      if (outward.lengthSq() < 0.001) outward.copy(normal);
      outward.normalize();
      gas.mass *= 0.55;
      gas.radius *= 0.82;
      gas.heat = Math.max(gas.heat ?? 0, 0.3);
      gas.fieldStress = 1;
      rockyPlanet.heat = Math.min(1, (rockyPlanet.heat ?? 0) + 0.18);
      rockyPlanet.fieldStress = Math.max(rockyPlanet.fieldStress ?? 0, 0.75);
      rockyPlanet.mass += gas.mass * 0.22;
      if (!gas.frozen) gas.velocity.addScaledVector(outward, 28 / Math.max(0.6, gas.mass));
      this.cooldown(gas, rockyPlanet, 1.8);
      this.state.events?.push({
        type: 'atmosphere-accretion',
        position: gas.position.clone().lerp(rockyPlanet.position, 0.55),
        planetId: rockyPlanet.id,
        gasId: gas.id,
        planetType: rockyPlanet.type
      });
      return false;
    }
    if (planet && impactor && this.readyForReaction(planet, impactor)) {
      if (impactor.type === 'comet') {
        const impactDir = impactor.position.clone().sub(planet.position);
        if (impactDir.lengthSq() < 0.001) impactDir.copy(normal);
        impactDir.normalize();
        planet.water = Math.min(1, (planet.water ?? 0) + (planet.type === 'jupiter' ? 0.04 : 0.18));
        planet.atmosphere = Math.min(1, (planet.atmosphere ?? 0) + 0.08);
        planet.fieldStress = Math.max(planet.fieldStress ?? 0, 0.55);
        planet.heat = Math.min(1, (planet.heat ?? 0) + 0.12);
        impactor.toRemove = impactor.mass < 5;
        if (!impactor.toRemove) impactor.velocity.addScaledVector(impactDir, 42 / Math.max(0.5, impactor.mass));
        this.cooldown(planet, impactor, 1.4);
        this.state.events?.push({
          type: 'water-delivery',
          position: impactor.position.clone().lerp(planet.position, 0.35),
          planetId: planet.id,
          impactorId: impactor.id,
          planetType: planet.type,
          severity: Math.min(1, impactor.velocity.length() / 120 + 0.35)
        });
        return true;
      }
      if (['asteroid', 'debris'].includes(impactor.type) && planet.type !== 'jupiter') {
        const speed = impactor.velocity.clone().sub(planet.velocity).length();
        const severity = Math.min(1, 0.25 + speed / 140 + impactor.mass / Math.max(12, planet.mass));
        planet.craters = (planet.craters ?? 0) + 1;
        planet.heat = Math.min(1, (planet.heat ?? 0) + severity * 0.25);
        planet.fieldStress = Math.max(planet.fieldStress ?? 0, severity * 0.75);
        impactor.toRemove = impactor.mass < 3 || speed > 58;
        if (!impactor.toRemove) impactor.velocity.reflect(normal).multiplyScalar(0.45);
        this.cooldown(planet, impactor, 1.0);
        this.state.events?.push({
          type: 'crater-impact',
          position: impactor.position.clone().lerp(planet.position, 0.42),
          planetId: planet.id,
          impactorId: impactor.id,
          planetType: planet.type,
          sourceType: impactor.type,
          severity
        });
        return true;
      }
    }
    if (star && comet && this.readyForReaction(star, comet)) {
      const outward = comet.position.clone().sub(star.position);
      if (outward.lengthSq() < 0.001) outward.copy(normal);
      outward.normalize();
      comet.heat = 1;
      comet.fieldStress = 1;
      comet.velocity.addScaledVector(outward, 38);
      star.shockwave = Math.max(star.shockwave ?? 0, 0.65);
      this.cooldown(star, comet, 0.7);
      this.state.events?.push({
        type: 'vaporize-ice',
        position: comet.position.clone().lerp(star.position, 0.35),
        bodyId: comet.id
      });
      return false;
    }

    if (star && (profiles.includes('rock') || profiles.includes('gas-giant')) && this.readyForReaction(a, b)) {
      const other = star === a ? b : a;
      other.heat = 1;
      other.shockwave = 1;
      other.fieldStress = Math.max(other.fieldStress ?? 0, 0.85);
      star.shockwave = Math.max(star.shockwave ?? 0, 0.8);
      this.cooldown(star, other, 1.2);
      this.state.events?.push({
        type: other.materialProfile === 'gas-giant' ? 'gas-giant-shear' : 'magma-splash',
        position: other.position.clone().lerp(star.position, 0.5),
        bodyId: other.id,
        sourceType: other.type
      });
      return false;
    }

    if (hasMetal && hasField && this.readyForReaction(a, b)) {
      const metal = ['metal', 'field-metal'].includes(a.materialProfile) ? a : b;
      const field = metal === a ? b : a;
      metal.charge = Math.max(Math.abs(metal.charge ?? 0), 0.8);
      metal.fieldStress = Math.max(metal.fieldStress ?? 0, 1);
      field.fieldStress = Math.max(field.fieldStress ?? 0, 1);
      metal.velocity.addScaledVector(normal.clone().multiplyScalar(metal === b ? 1 : -1), 32 / Math.max(0.5, metal.mass));
      this.cooldown(metal, field, 0.9);
      this.state.events?.push({
        type: 'charged-metal',
        position: metal.position.clone().lerp(field.position, 0.5),
        bodyId: metal.id
      });
      return false;
    }

    if (profiles.includes('organic') && profiles.includes('plasma') && this.readyForReaction(a, b)) {
      const body = a.materialProfile === 'organic' ? a : b;
      body.heat = 1;
      body.shockwave = 1;
      body.toRemove = true;
      this.cooldown(a, b, 1.2);
      this.state.events?.push({
        type: 'bio-plasma',
        position: body.position.clone(),
        velocity: body.velocity.clone(),
        sourceType: body.type,
        sourceLabel: body.label,
        severity: 1
      });
      return true;
    }

    if (profiles.includes('energy') && profiles.some((profile) => ['metal', 'rock', 'ice'].includes(profile)) && this.readyForReaction(a, b)) {
      const energy = a.materialProfile === 'energy' ? a : b;
      const target = energy === a ? b : a;
      target.heat = Math.min(1, (target.heat ?? 0) + 0.55);
      target.shockwave = Math.max(target.shockwave ?? 0, 0.6);
      energy.velocity.reflect(normal).multiplyScalar(0.72);
      this.cooldown(energy, target, 0.45);
      this.state.events?.push({
        type: 'beam-scar',
        position: energy.position.clone().lerp(target.position, 0.5),
        targetId: target.id,
        targetType: target.type
      });
      return false;
    }

    return false;
  }

  readyForReaction(a, b) {
    return (a.materialCooldown ?? 0) <= 0 && (b.materialCooldown ?? 0) <= 0;
  }

  cooldown(a, b, time) {
    a.materialCooldown = time;
    b.materialCooldown = time;
  }

  applyBlackHoleMerge(a, b, normal) {
    if (a.type !== 'blackhole' || b.type !== 'blackhole') return false;
    const primary = a.mass >= b.mass ? a : b;
    const secondary = primary === a ? b : a;
    const outward = secondary.position.clone().sub(primary.position);
    if (outward.lengthSq() < 0.001) outward.copy(normal.lengthSq() > 0 ? normal : new THREE.Vector3(1, 0, 0));
    outward.normalize();
    primary.mass += secondary.mass * 0.62;
    primary.radius = Math.min(42, primary.radius + secondary.radius * 0.18);
    primary.baseRadius ??= primary.radius;
    primary.visualScale = primary.radius / primary.baseRadius;
    primary.velocity.lerp(secondary.velocity, 0.22);
    primary.angularVelocity += Math.sign(primary.angularVelocity || 1) * 0.45 + secondary.angularVelocity * 0.18;
    primary.accretion = Math.min(6, (primary.accretion ?? 0) + 2.2);
    primary.shockwave = 1.4;
    primary.heat = 1;
    secondary.toRemove = true;
    this.state.events?.push({
      type: 'blackhole-merge',
      position: primary.position.clone().lerp(secondary.position, 0.5),
      velocity: outward.multiplyScalar(120).add(primary.velocity),
      eaterId: primary.id,
      foodMass: secondary.mass,
      foodRadius: secondary.radius
    });
    return true;
  }

  updateAttachment(body) {
    if (!body.attachedTo) return false;
    const parent = this.state.bodies.find((candidate) => candidate.id === body.attachedTo);
    if (!parent || parent.toRemove) {
      body.attachedTo = null;
      return false;
    }
    body.position.copy(parent.position).add(body.attachOffset);
    body.velocity.copy(parent.velocity);
    body.angularVelocity *= 0.94;
    body.group.position.copy(body.position);
    body.group.rotation.z = body.rotation;
    return true;
  }

  shouldSkipPair(a, b) {
    return (a.category === 'dust' && b.category === 'dust') || (a.category === 'dust' && b.category === 'debris') || (a.category === 'debris' && b.category === 'dust');
  }

  shouldSkipCollision(a, b) {
    if (a.category === 'dust' || b.category === 'dust') return true;
    if (a.category === 'debris' && b.category === 'debris') return true;
    if (a.attachedTo === b.id || b.attachedTo === a.id) return true;
    return false;
  }

  effectiveRadius(body) {
    return body.radius * (body.collisionScale ?? 1);
  }

  clampVector(vector, maxLength) {
    if (!Number.isFinite(maxLength) || maxLength <= 0) return;
    const lengthSq = vector.lengthSq();
    if (lengthSq > maxLength * maxLength) vector.multiplyScalar(maxLength / Math.sqrt(lengthSq));
  }

  applyWormholeStarReaction(a, b, normal) {
    const portal = a.type === 'portal' ? a : b.type === 'portal' ? b : null;
    const star = a.type === 'star' ? a : b.type === 'star' ? b : null;
    if (!portal || !star) return false;
    if ((portal.reactionCooldown ?? 0) > 0 || (star.reactionCooldown ?? 0) > 0) return false;
    const outward = portal === b ? normal : normal.clone().multiplyScalar(-1);
    portal.position.copy(star.position).addScaledVector(outward, this.effectiveRadius(star) + this.effectiveRadius(portal) + 4);
    portal.velocity.addScaledVector(outward, 95);
    portal.heat = 1;
    portal.shockwave = 1;
    portal.mass = Math.max(portal.mass, 8);
    star.shockwave = 1;
    star.heat = 1;
    star.angularVelocity += 0.18;
    portal.reactionCooldown = 1.4;
    star.reactionCooldown = 1.4;
    this.state.events?.push({
      type: 'wormhole-star',
      position: portal.position.clone(),
      portalId: portal.id,
      starId: star.id
    });
    return true;
  }

  applySurfaceContact(a, b, normal, min) {
    const crew = a.category === 'crew' ? a : b.category === 'crew' ? b : null;
    const surface = crew === a ? b : a;
    if (!crew || !['planetary', 'stellar'].includes(surface.category)) return false;
    const outward = crew === b ? normal : normal.clone().multiplyScalar(-1);
    crew.position.copy(surface.position).addScaledVector(outward, min + 0.5);
    const surfaceVelocity = surface.frozen ? new THREE.Vector3() : surface.velocity;
    const tangent = new THREE.Vector3(-outward.y, outward.x, 0);
    crew.velocity.lerp(surfaceVelocity, 0.78);
    crew.velocity.addScaledVector(tangent, crew.angularVelocity * 0.18);
    crew.angularVelocity *= 0.94;
    crew.shockwave = Math.max(crew.shockwave ?? 0, 0.45);
    surface.shockwave = Math.max(surface.shockwave ?? 0, 0.12);
    return true;
  }

  applyStickyCollision(a, b, normal, min) {
    const pair = this.stickyPair(a, b);
    if (!pair) return false;
    const { small, large, outward } = pair;
    if ((small.attachCooldown ?? 0) > 0) return false;
    const relativeSpeed = small.velocity.clone().sub(large.velocity).length();
    const massRatio = large.mass / Math.max(0.2, small.mass);
    const shouldStick = relativeSpeed < 42 && massRatio > 2.2 && ['crew', 'spacecraft', 'small-body', 'debris'].includes(small.category);
    if (!shouldStick) return false;
    small.attachedTo = large.id;
    small.attachOffset = outward.clone().multiplyScalar(min + 1.2);
    small.position.copy(large.position).add(small.attachOffset);
    small.velocity.copy(large.velocity);
    small.shockwave = Math.max(small.shockwave ?? 0, 0.35);
    large.shockwave = Math.max(large.shockwave ?? 0, 0.12);
    this.state.events?.push({
      type: 'stick',
      position: small.position.clone(),
      smallId: small.id,
      largeId: large.id,
      smallLabel: small.label,
      largeLabel: large.label
    });
    return true;
  }

  stickyPair(a, b) {
    if (a.mass === b.mass) return null;
    const small = a.mass < b.mass ? a : b;
    const large = small === a ? b : a;
    if (!['planetary', 'stellar', 'singularity'].includes(large.category) && large.mass < 18) return null;
    const outward = small === b ? this.normal.clone() : this.normal.clone().multiplyScalar(-1);
    return { small, large, outward };
  }

  applyStarCollision(a, b, normal) {
    const star = a.type === 'star' ? a : b.type === 'star' ? b : null;
    if (!star) return false;
    const other = star === a ? b : a;
    if (other.type === 'blackhole') return false;
    const exit = other.position.clone().sub(star.position).normalize();
    other.heat = 1;
    other.shockwave = 1;
    star.shockwave = 1;
    if (['dust', 'debris', 'small-body', 'energy'].includes(other.category) || other.mass < 3) {
      other.toRemove = true;
      this.state.events?.push({
        type: 'burn',
        position: other.position.clone(),
        foodType: other.type,
        severity: 1
      });
      return true;
    }
    other.velocity.addScaledVector(exit.lengthSq() > 0 ? exit : normal, 55 / Math.max(0.8, other.mass));
    this.state.events?.push({
      type: 'scorch',
      position: other.position.clone(),
      bodyId: other.id,
      bodyType: other.type
    });
    return false;
  }

  emitImpact(a, b, normal, speed) {
    if (speed < 8) return;
    this.state.events?.push({
      type: 'impact',
      position: a.position.clone().lerp(b.position, 0.5),
      normal: normal.clone(),
      speed,
      aType: a.type,
      bType: b.type,
      aCategory: a.category,
      bCategory: b.category
    });
    if (speed > 26 && (a.category === 'crew' || b.category === 'crew')) {
      const crew = a.category === 'crew' ? a : b;
      this.state.events?.push({
        type: 'bio-plasma',
        position: crew.position.clone(),
        velocity: crew.velocity.clone(),
        sourceType: crew.type,
        sourceLabel: crew.label,
        severity: Math.min(1, speed / 92)
      });
    }
  }

  applyFragmentation(a, b, normal, speed) {
    if (speed < 46) return;
    for (const body of [a, b]) {
      if (body.toRemove || body.mass > 70 || body.category === 'stellar' || body.category === 'singularity' || body.category === 'field') continue;
      const fragile = ['small-body', 'debris', 'spacecraft', 'energy', 'crew'].includes(body.category);
      if (!fragile) continue;
      const severity = Math.min(1, speed / 130);
      body.heat = Math.max(body.heat ?? 0, severity);
      body.shockwave = 1;
      if (severity > 0.72 || body.category === 'energy') {
        body.toRemove = (body.category !== 'spacecraft' && body.category !== 'crew') || speed > 112;
      }
      this.state.events?.push({
        type: 'fragment',
        position: body.position.clone(),
        velocity: body.velocity.clone(),
        sourceType: body.type,
        sourceCategory: body.category,
        severity
      });
    }
  }

  applyPortals() {
    const portals = this.state.bodies.filter((body) => body.type === 'portal');
    if (portals.length < 2) return;
    for (const body of this.state.bodies) {
      if (body.type === 'portal') continue;
      for (let i = 0; i < portals.length; i++) {
        const portal = portals[i];
        if (body.position.distanceTo(portal.position) > portal.radius * 1.2) continue;
        const other = portals[(i + 1) % portals.length];
        body.position.copy(other.position).add(new THREE.Vector3(portal.radius * 1.4, 0, 0));
        body.trail.length = 0;
        body.shockwave = 1;
      }
    }
  }
}
