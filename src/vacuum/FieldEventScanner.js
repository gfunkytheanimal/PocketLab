import * as THREE from 'three';

const GRID_W = 48;
const GRID_H = 32;
const CELL_COUNT = GRID_W * GRID_H;

const EVENT_LABELS = {
  stagnation: 'STAGNATION ZONE',
  barrier: 'THERMAL BARRIER',
  'shock-front': 'COMPRESSION FRONT',
  'stress-knot': 'STRESS KNOT',
  'vortex-lock': 'VORTEX LOCK',
  unknown: 'ANOMALY'
};

// Toy-universe scanner: this finds visually interesting high-gradient,
// low-transport regions. It is not a validated scientific diagnostic.
export class FieldEventScanner {
  constructor(state) {
    this.state = state;
    this.frame = 0;
    this.nextId = 1;
    this.gridW = GRID_W;
    this.gridH = GRID_H;
    this.field = new Float32Array(CELL_COUNT);
    this.prevField = new Float32Array(CELL_COUNT);
    this.gradient = new Float32Array(CELL_COUNT);
    this.flux = new Float32Array(CELL_COUNT);
    this.activity = new Float32Array(CELL_COUNT);
    this.heat = new Float32Array(CELL_COUNT);
    this.gravity = new Float32Array(CELL_COUNT);
    this.mass = new Float32Array(CELL_COUNT);
    this.vx = new Float32Array(CELL_COUNT);
    this.vy = new Float32Array(CELL_COUNT);
    this.vz = new Float32Array(CELL_COUNT);
    this.persistence = new Float32Array(CELL_COUNT);
    this.condition = new Uint8Array(CELL_COUNT);
    this.visited = new Uint8Array(CELL_COUNT);
    this.events = [];
    this.lastEvents = [];
    this.queue = new Int32Array(CELL_COUNT);
  }

  update(dt) {
    this.frame++;
    this.ageEvents(dt);
    if (!this.state.showScanner && this.events.length === 0) return this.events;
    if (this.frame % 3 !== 0) return this.events;
    this.sample();
    this.score();
    this.extractEvents();
    this.state.scannerCount = this.events.length;
    return this.events;
  }

  sample() {
    this.prevField.set(this.field);
    this.field.fill(0);
    this.gradient.fill(0);
    this.flux.fill(0);
    this.activity.fill(0);
    this.heat.fill(0);
    this.gravity.fill(0);
    this.mass.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.vz.fill(0);

    const bodies = this.state.bodies ?? [];
    const size = Math.max(240, this.state.boundsSize ?? 820);
    const half = size * 0.5;
    const cellW = size / GRID_W;
    const cellH = size / GRID_H;

    for (const body of bodies) {
      if (body.toRemove) continue;
      const x = clamp(Math.floor(((body.position.x + half) / size) * GRID_W), 0, GRID_W - 1);
      const y = clamp(Math.floor(((body.position.y + half) / size) * GRID_H), 0, GRID_H - 1);
      const idx = y * GRID_W + x;
      const categoryWeight = body.category === 'dust' ? 0.18 : body.category === 'gas' ? 0.45 : body.category === 'stellar' ? 2.2 : body.category === 'singularity' ? 3.4 : 1;
      const localMass = Math.sqrt(Math.max(0.01, Math.abs(body.mass))) * categoryWeight;
      const speed = body.velocity?.length?.() ?? 0;
      const heat = body.heat ?? 0;
      const stress = body.fieldStress ?? 0;
      this.mass[idx] += localMass;
      this.heat[idx] += heat * (0.35 + categoryWeight);
      this.field[idx] += localMass + heat * 2.4 + stress * 2.1;
      this.flux[idx] += speed * (0.08 + localMass * 0.08);
      this.vx[idx] += body.velocity?.x ?? 0;
      this.vy[idx] += body.velocity?.y ?? 0;
      this.vz[idx] += body.velocity?.z ?? 0;

      const radiusCells = body.category === 'singularity' ? 5 : body.category === 'stellar' ? 4 : body.category === 'planetary' ? 3 : 2;
      for (let oy = -radiusCells; oy <= radiusCells; oy++) {
        const gy = y + oy;
        if (gy < 0 || gy >= GRID_H) continue;
        for (let ox = -radiusCells; ox <= radiusCells; ox++) {
          const gx = x + ox;
          if (gx < 0 || gx >= GRID_W) continue;
          const dist2 = ox * ox + oy * oy + 1;
          const falloff = 1 / dist2;
          const j = gy * GRID_W + gx;
          this.gravity[j] += Math.abs(body.mass) * falloff * 0.018;
          this.field[j] += localMass * falloff * 0.35;
          this.heat[j] += heat * falloff * 0.55;
        }
      }
    }

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const idx = y * GRID_W + x;
        this.field[idx] += this.gravity[idx] * 0.8 + this.heat[idx] * 1.2;
        const worldX = -half + (x + 0.5) * cellW;
        const worldY = -half + (y + 0.5) * cellH;
        this.activity[idx] = Math.abs(this.field[idx] - this.prevField[idx]) * 0.65
          + Math.hypot(this.vx[idx], this.vy[idx], this.vz[idx]) * 0.012
          + this.heat[idx] * 0.055
          + this.gravity[idx] * 0.028
          + this.mass[idx] * 0.01;
        this.vx[idx] *= 0.16;
        this.vy[idx] *= 0.16;
        this.vz[idx] *= 0.16;
        this._worldX = worldX;
        this._worldY = worldY;
      }
    }
  }

  score() {
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        const idx = y * GRID_W + x;
        const gx = this.field[idx + 1] - this.field[idx - 1];
        const gy = this.field[idx + GRID_W] - this.field[idx - GRID_W];
        const hx = this.heat[idx + 1] - this.heat[idx - 1];
        const hy = this.heat[idx + GRID_W] - this.heat[idx - GRID_W];
        this.gradient[idx] = Math.hypot(gx, gy) + Math.hypot(hx, hy) * 0.65;
      }
    }

    const gHigh = percentile(this.gradient, 0.86);
    const fLow = percentile(this.flux, 0.34);
    const aAlive = Math.max(percentile(this.activity, 0.28), 0.006);
    const gFloor = Math.max(gHigh, 0.08);
    this.condition.fill(0);
    for (let i = 0; i < CELL_COUNT; i++) {
      const active = this.gradient[i] >= gFloor && this.flux[i] <= fLow && this.activity[i] >= aAlive;
      if (active) {
        this.persistence[i] = Math.min(30, this.persistence[i] + 1);
        if (this.persistence[i] >= 3) this.condition[i] = 1;
      } else {
        this.persistence[i] = Math.max(0, this.persistence[i] - 0.7);
      }
    }
  }

  extractEvents() {
    this.visited.fill(0);
    const raw = [];
    const size = Math.max(240, this.state.boundsSize ?? 820);
    const half = size * 0.5;
    const cellW = size / GRID_W;
    const cellH = size / GRID_H;

    for (let i = 0; i < CELL_COUNT; i++) {
      if (!this.condition[i] || this.visited[i]) continue;
      let head = 0;
      let tail = 0;
      this.queue[tail++] = i;
      this.visited[i] = 1;
      let weight = 0;
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let sumGradient = 0;
      let sumFlux = 0;
      let sumActivity = 0;
      let sumHeat = 0;
      let sumGravity = 0;
      let sumCurl = 0;
      let maxPersistence = 0;

      while (head < tail) {
        const idx = this.queue[head++];
        const x = idx % GRID_W;
        const y = Math.floor(idx / GRID_W);
        const w = Math.max(0.1, this.gradient[idx]) * (1 + this.persistence[idx] * 0.12);
        weight += w;
        sumX += (-half + (x + 0.5) * cellW) * w;
        sumY += (-half + (y + 0.5) * cellH) * w;
        sumZ += this.vz[idx] * w * 0.3;
        sumGradient += this.gradient[idx];
        sumFlux += this.flux[idx];
        sumActivity += this.activity[idx];
        sumHeat += this.heat[idx];
        sumGravity += this.gravity[idx];
        sumCurl += localCurl(this.vx, this.vy, x, y);
        maxPersistence = Math.max(maxPersistence, this.persistence[idx]);
        for (const n of neighbors(idx, x, y)) {
          if (!this.condition[n] || this.visited[n]) continue;
          this.visited[n] = 1;
          this.queue[tail++] = n;
        }
      }

      if (tail < 2 || weight <= 0) continue;
      const cells = tail;
      const event = {
        id: '',
        type: classify(sumGradient / cells, sumFlux / cells, sumActivity / cells, sumHeat / cells, sumGravity / cells, sumCurl / cells),
        x: sumX / weight,
        y: sumY / weight,
        z: clamp(sumZ / weight, -90, 90),
        radius: clamp(Math.sqrt(cells) * Math.max(cellW, cellH) * 0.72, 16, 82),
        strength: clamp((sumGradient / cells) * 0.3 + (sumActivity / cells) * 0.8 + maxPersistence * 0.07, 0.25, 2.8),
        gradientScore: sumGradient / cells,
        fluxScore: sumFlux / cells,
        activityScore: sumActivity / cells,
        persistenceFrames: Math.round(maxPersistence),
        age: 0,
        lifetime: 2.4,
        driftX: 0,
        driftY: 0,
        label: ''
      };
      event.label = EVENT_LABELS[event.type] ?? EVENT_LABELS.unknown;
      raw.push(event);
    }

    raw.sort((a, b) => b.strength - a.strength);
    this.matchEvents(raw.slice(0, 8));
  }

  matchEvents(raw) {
    const previous = this.lastEvents;
    const next = [];
    for (const event of raw) {
      let best = null;
      let bestDist = Infinity;
      for (const old of previous) {
        const dist = Math.hypot(event.x - old.x, event.y - old.y);
        if (dist < bestDist && dist < Math.max(80, event.radius + old.radius)) {
          best = old;
          bestDist = dist;
        }
      }
      if (best) {
        event.id = best.id;
        event.age = Math.min(best.age + 1, 999);
        event.lifetime = Math.max(best.lifetime, 2.2);
        event.driftX = event.x - best.x;
        event.driftY = event.y - best.y;
      } else {
        event.id = `scan-${this.nextId++}`;
      }
      next.push(event);
    }
    for (const old of previous) {
      if (next.some((event) => event.id === old.id)) continue;
      old.lifetime -= 0.35;
      old.strength *= 0.88;
      if (old.lifetime > 0) next.push(old);
    }
    this.events = next.slice(0, 8);
    this.lastEvents = this.events.map((event) => ({ ...event }));
  }

  ageEvents(dt) {
    for (const event of this.events) {
      event.lifetime -= dt * 0.45;
      event.age += dt;
    }
    this.events = this.events.filter((event) => event.lifetime > 0);
  }

  clear() {
    this.persistence.fill(0);
    this.events = [];
    this.lastEvents = [];
    this.state.scannerCount = 0;
  }
}

function classify(gradient, flux, activity, heat, gravity, curl) {
  if (Math.abs(curl) > gradient * 0.16 && activity > 0.08) return 'vortex-lock';
  if (heat > 0.35 && flux < gradient * 0.45) return 'barrier';
  if (gravity > heat * 1.6 && gradient > 0.18) return 'stress-knot';
  if (gradient > 0.4 && activity > 0.08) return 'shock-front';
  if (flux < gradient * 0.35 && activity > 0.04) return 'stagnation';
  return 'unknown';
}

function localCurl(vx, vy, x, y) {
  if (x <= 0 || x >= GRID_W - 1 || y <= 0 || y >= GRID_H - 1) return 0;
  const idx = y * GRID_W + x;
  return (vy[idx + 1] - vy[idx - 1]) - (vx[idx + GRID_W] - vx[idx - GRID_W]);
}

function* neighbors(idx, x, y) {
  if (x > 0) yield idx - 1;
  if (x < GRID_W - 1) yield idx + 1;
  if (y > 0) yield idx - GRID_W;
  if (y < GRID_H - 1) yield idx + GRID_W;
}

function percentile(values, q) {
  const scratch = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) scratch.push(values[i]);
  if (!scratch.length) return 0;
  scratch.sort((a, b) => a - b);
  return scratch[Math.min(scratch.length - 1, Math.max(0, Math.floor(scratch.length * q)))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
