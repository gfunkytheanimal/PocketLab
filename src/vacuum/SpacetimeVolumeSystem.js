import * as THREE from 'three';

const UP = new THREE.Vector3(0, 0, 1);
const SIDE = new THREE.Vector3(0, 1, 0);

export class SpacetimeVolumeSystem {
  constructor(state) {
    this.state = state;
    this.delta = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.binormal = new THREE.Vector3();
  }

  apply(dt) {
    const scale = this.state.spacetimeScale ?? 1;
    if (scale <= 0) return;
    const bodies = this.state.bodies;
    const sources = bodies.filter((body) => this.isSource(body));

    for (const body of bodies) {
      body.w ??= 0;
      body.wVelocity ??= 0;
      body.spacetimeCurvature = 0;
      body.timeDilation = 1;
      body.topologyPressure = 0;
      body.spacetimeRadius = 0;
      body.spacetimeStrength = 0;
      body.phaseShift = Math.abs(body.w) / 60;
      body.wVelocity *= Math.pow(0.86, dt);
    }

    for (const source of sources) {
      const reach = this.reachFor(source);
      source.spacetimeRadius = reach;
      source.spacetimeStrength = Math.max(source.spacetimeStrength ?? 0, this.strengthFor(source));

      for (const body of bodies) {
        if (body === source || body.frozen || body.attachedTo) continue;
        this.delta.subVectors(source.position, body.position);
        const dist = Math.max(1, this.delta.length());
        if (dist > reach) continue;
        const dir = this.delta.multiplyScalar(1 / dist);
        const falloff = smoothFalloff(dist / reach) * scale;
        if (falloff <= 0) continue;

        if (source.type === 'blackhole') this.applyBlackHoleVolume(source, body, dir, dist, reach, falloff, dt);
        else if (source.type === 'portal') this.applyWormholeVolume(source, body, dir, dist, reach, falloff, dt);
        else if (source.type === 'star') this.applyStellarVolume(source, body, dir, dist, reach, falloff, dt);
        else if (source.type === 'magnet' || source.type === 'ufo') this.applyFieldVolume(source, body, dir, dist, reach, falloff, dt);
      }
    }

    for (const body of bodies) {
      body.w += body.wVelocity * dt;
      body.w = THREE.MathUtils.clamp(body.w, -90, 90);
      body.phaseShift = Math.min(1, Math.abs(body.w) / 70);
      if (body.phaseShift > 0.35) {
        body.fieldStress = Math.max(body.fieldStress ?? 0, body.phaseShift * 0.8);
      }
    }
  }

  isSource(body) {
    return body.type === 'blackhole' || body.type === 'portal' || body.type === 'star' || body.type === 'magnet' || body.type === 'ufo';
  }

  reachFor(body) {
    if (body.type === 'blackhole') return body.radius * 30;
    if (body.type === 'portal') return body.radius * 10;
    if (body.type === 'star') return body.radius * 9;
    if (body.type === 'ufo') return body.radius * 6;
    return body.radius * 8;
  }

  strengthFor(body) {
    if (body.type === 'blackhole') return 1.6 + (body.accretion ?? 0) * 0.25;
    if (body.type === 'portal') return 1.15 + Math.abs(body.charge ?? 0) * 0.12;
    if (body.type === 'star') return 0.72 + (body.heat ?? 0) * 0.2;
    if (body.type === 'ufo') return 0.64 + (body.tractorActive ?? 0) * 0.5;
    return 0.82 + Math.abs(body.charge ?? 0) * 0.18;
  }

  applyBlackHoleVolume(source, body, dir, dist, reach, falloff, dt) {
    const curvature = falloff * (1.4 + source.mass / 180);
    const timeDilation = 1 / (1 + curvature * 2.5);
    body.spacetimeCurvature = Math.max(body.spacetimeCurvature ?? 0, curvature);
    body.timeDilation = Math.min(body.timeDilation ?? 1, timeDilation);
    body.topologyPressure = Math.max(body.topologyPressure ?? 0, falloff);
    source.spacetimeStrength = Math.max(source.spacetimeStrength ?? 0, curvature);

    const pole = Math.abs(dir.dot(UP)) < 0.84 ? UP : SIDE;
    this.tangent.crossVectors(dir, pole).normalize();
    this.binormal.crossVectors(dir, this.tangent).normalize();
    const twist = this.tangent.multiplyScalar(Math.cos(body.w * 0.06)).addScaledVector(this.binormal, Math.sin(body.w * 0.06)).normalize();

    const longRangePull = Math.max(0.04, falloff) * source.mass * 0.034;
    body.acceleration.addScaledVector(dir, longRangePull);
    body.acceleration.addScaledVector(twist, falloff * 24 / Math.max(0.45, body.mass));
    if (falloff > 0.42) {
      body.velocity.multiplyScalar(Math.max(0.91, 1 - falloff * 0.012 * (this.state.captureScale ?? 1)));
    }
    body.wVelocity += (-body.w * falloff * 0.08) * dt;
    body.heat = Math.min(1, (body.heat ?? 0) + falloff * 0.012);
  }

  applyWormholeVolume(source, body, dir, dist, reach, falloff, dt) {
    body.spacetimeCurvature = Math.max(body.spacetimeCurvature ?? 0, falloff * 0.9);
    body.topologyPressure = Math.max(body.topologyPressure ?? 0, falloff * 0.85);
    const sign = source.id % 2 ? 1 : -1;
    body.wVelocity += (sign * falloff * 28 - body.w * falloff * 0.14) * dt;
    const swirl = this.tangent.set(-dir.y, dir.x, dir.z * 0.35).normalize();
    body.acceleration.addScaledVector(swirl, falloff * 18 / Math.max(0.5, body.mass));

    if (dist < source.radius * 1.35 && (body.spacetimeCooldown ?? 0) <= 0) {
      body.w *= -0.65;
      body.wVelocity *= -0.55;
      body.velocity.addScaledVector(dir.multiplyScalar(-1), 42 + Math.abs(body.wVelocity) * 0.4);
      body.trail.length = 0;
      body.spacetimeCooldown = 1.4;
      source.shockwave = Math.max(source.shockwave ?? 0, 0.8);
      this.state.events?.push({
        type: 'phase-pop',
        position: body.position.clone(),
        bodyId: body.id,
        bodyLabel: body.label
      });
    }
  }

  applyStellarVolume(source, body, dir, dist, reach, falloff, dt) {
    body.timeDilation = Math.min(body.timeDilation ?? 1, 1 / (1 + falloff * 0.32));
    body.topologyPressure = Math.max(body.topologyPressure ?? 0, falloff * 0.42);
    body.wVelocity += (-body.w * 0.32 + Math.sin(source.rotation + body.id) * 4.5 * falloff) * dt;
    if (body.type === 'gas' || body.type === 'comet' || body.category === 'dust') {
      body.heat = Math.min(1, (body.heat ?? 0) + falloff * 0.035);
    }
  }

  applyFieldVolume(source, body, dir, dist, reach, falloff, dt) {
    const charge = body.charge ?? 0;
    body.topologyPressure = Math.max(body.topologyPressure ?? 0, falloff * 0.55);
    body.wVelocity += (charge * (source.charge ?? 1) * falloff * 16 - body.w * 0.08 * falloff) * dt;
    if (source.type === 'ufo' && ['crew', 'dust', 'small-body'].includes(body.category)) {
      body.wVelocity += falloff * 8 * dt;
    }
  }
}

function smoothFalloff(t) {
  const x = THREE.MathUtils.clamp(1 - t, 0, 1);
  return x * x * (3 - 2 * x);
}
