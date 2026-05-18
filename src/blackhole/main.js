import './styles.css';

const canvas = document.getElementById('blackhole-canvas');
const particleCanvas = document.getElementById('particle-canvas');
const pctx = particleCanvas.getContext('2d', { alpha: true });
const statusEl = document.getElementById('status');
const uploadButton = document.getElementById('upload-button');
const micButton = document.getElementById('mic-button');
const modeButton = document.getElementById('mode-button');
const audioFile = document.getElementById('audio-file');
const keysEl = document.getElementById('keys');

const NOTES = [
  ['C', 'A'], ['C#', 'W'], ['D', 'S'], ['D#', 'E'], ['E', 'D'], ['F', 'F'],
  ['F#', 'T'], ['G', 'G'], ['G#', 'Y'], ['A', 'H'], ['A#', 'U'], ['B', 'J']
];
const KEY_TO_NOTE = new Map(NOTES.map(([note, key], index) => [`Key${key}`, { note, index }]));
const MODES = ['duality', 'blackhole', 'whitehole'];

const state = {
  mode: 'duality',
  time: 0,
  last: performance.now(),
  dragging: false,
  lastPointer: [0, 0],
  impulse: [0, 0, 0],
  tilt: 0,
  rotate: 0,
  charge: 0,
  pulse: 0,
  disk: 1,
  rotationSpeed: 0.32,
  chromatic: 0.06,
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  noteEnergy: Array(12).fill(0),
  held: Array(12).fill(0),
  particles: createParticles(860),
  shader: null,
  audio: null
};

keysEl.innerHTML = NOTES.map(([note, key]) => (
  `<button class="key" type="button" data-note="${note}"><span>${note}</span><small>${key}</small></button>`
)).join('');

for (const button of keysEl.querySelectorAll('.key')) {
  button.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    await state.audio.ensureSynth();
    noteOn(NOTES.findIndex(([note]) => note === button.dataset.note), 1);
  });
  button.addEventListener('pointerup', () => noteOff(NOTES.findIndex(([note]) => note === button.dataset.note)));
  button.addEventListener('pointerleave', () => noteOff(NOTES.findIndex(([note]) => note === button.dataset.note)));
}

uploadButton.addEventListener('click', () => audioFile.click());
audioFile.addEventListener('change', async () => {
  const file = audioFile.files?.[0];
  if (!file) return;
  await state.audio.loadFile(file);
  statusEl.textContent = `playing ${file.name}`;
});

micButton.addEventListener('click', async () => {
  await state.audio.enableMic();
  micButton.classList.add('active');
  statusEl.textContent = 'microphone driving geodesics';
});

modeButton.addEventListener('click', () => {
  const next = (MODES.indexOf(state.mode) + 1) % MODES.length;
  state.mode = MODES[next];
  modeButton.textContent = state.mode === 'duality' ? 'Duality' : state.mode === 'blackhole' ? 'Blackhole' : 'Whitehole';
  statusEl.textContent = `${modeButton.textContent} mode`;
});

canvas.addEventListener('pointerdown', async (event) => {
  await state.audio.ensureSynth();
  state.dragging = true;
  state.lastPointer = [event.clientX, event.clientY];
  const p = pointerFromEvent(event);
  state.impulse = [p[0], p[1], 1];
  state.pulse = Math.max(state.pulse, 1);
  state.charge = Math.max(-1, state.charge - 0.38);
  statusEl.textContent = 'click lens impulse';
});

window.addEventListener('pointermove', (event) => {
  if (!state.dragging) return;
  const dx = event.clientX - state.lastPointer[0];
  const dy = event.clientY - state.lastPointer[1];
  state.rotate += dx * 0.003;
  state.tilt = clamp(state.tilt + dy * 0.003, -0.8, 0.8);
  state.lastPointer = [event.clientX, event.clientY];
});
window.addEventListener('pointerup', () => { state.dragging = false; });

window.addEventListener('keydown', async (event) => {
  const hit = KEY_TO_NOTE.get(event.code);
  if (!hit || event.repeat) return;
  event.preventDefault();
  await state.audio.ensureSynth();
  noteOn(hit.index, 0.95);
});
window.addEventListener('keyup', (event) => {
  const hit = KEY_TO_NOTE.get(event.code);
  if (!hit) return;
  event.preventDefault();
  noteOff(hit.index);
});

window.addEventListener('resize', resize);

function frame(now) {
  const dt = Math.min(0.033, (now - state.last) / 1000 || 0.016);
  state.last = now;
  state.time += dt;
  state.audio.update();
  updateState(dt);
  renderShader();
  updateParticles(dt);
  renderParticles();
  requestAnimationFrame(frame);
}

function updateState(dt) {
  const audio = state.audio;
  state.bass += (audio.bass - state.bass) * 0.24;
  state.mid += (audio.mid - state.mid) * 0.22;
  state.high += (audio.high - state.high) * 0.28;
  state.rms += (audio.rms - state.rms) * 0.3;
  const held = Math.max(...state.held);
  const modeCharge = state.mode === 'blackhole' ? -1 : state.mode === 'whitehole' ? 1 : state.high - state.bass;
  state.charge += (clamp(modeCharge + held * 0.3 - state.bass * 0.28, -1, 1) - state.charge) * (1 - Math.pow(0.004, dt));
  state.pulse = Math.max(state.pulse * Math.pow(0.82, dt * 60), audio.onset, held * 0.8);
  state.rotationSpeed = 0.25 + state.mid * 2.4 + state.bass * 1.2 + state.pulse * 0.45;
  state.disk = 0.95 + state.rms * 4.2 + state.bass * 2.2 + state.pulse * 0.75;
  state.chromatic = clamp(0.04 + state.high * 1.25 + Math.max(0, state.charge) * 0.6, 0, 1);
  state.impulse[2] *= Math.pow(0.86, dt * 60);
  state.rotate += dt * (0.04 + state.mid * 0.32 + Math.abs(state.charge) * 0.12);
  state.tilt += Math.sin(state.time * 0.7) * state.rms * 0.002;
  for (let i = 0; i < 12; i++) {
    state.noteEnergy[i] = Math.max(state.held[i], state.noteEnergy[i] * Math.pow(0.9, dt * 60));
  }
}

function renderShader() {
  const shader = state.shader;
  const gl = shader.gl;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(shader.program);
  gl.uniform1f(shader.uniforms.time, state.time);
  gl.uniform2f(shader.uniforms.res, canvas.width, canvas.height);
  gl.uniform1f(shader.uniforms.rotationSpeed, state.rotationSpeed);
  gl.uniform1f(shader.uniforms.diskIntensity, state.disk);
  gl.uniform1f(shader.uniforms.starsOnly, 0);
  gl.uniform1f(shader.uniforms.tilt, state.tilt + state.charge * 0.08);
  gl.uniform1f(shader.uniforms.rotate, state.rotate);
  gl.uniform2f(shader.uniforms.center, 0.5 + state.impulse[0] * state.impulse[2] * 0.06, 0.5 + state.impulse[1] * state.impulse[2] * 0.04);
  gl.uniform1f(shader.uniforms.scale, 1 / (1 + state.pulse * 0.035));
  gl.uniform1f(shader.uniforms.chromatic, state.chromatic);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function updateParticles(dt) {
  const inhale = Math.max(0, -state.charge);
  const exhale = Math.max(0, state.charge);
  const cx = particleCanvas.width * (0.5 + state.impulse[0] * state.impulse[2] * 0.06);
  const cy = particleCanvas.height * (0.5 - state.impulse[1] * state.impulse[2] * 0.04);
  const scale = Math.min(particleCanvas.width, particleCanvas.height) * 0.28;
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const note = state.noteEnergy[p.note] ?? 0;
    const x = p.x * scale + cx;
    const y = p.y * scale + cy;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const field = smoothstep(scale * 1.35, scale * 0.08, d);
    const gravity = (0.08 + inhale * 0.5 - exhale * 0.18) * field * (1 + state.bass * 2 + state.pulse);
    const jet = exhale * field * (0.18 + state.pulse * 0.2);
    const orbit = (0.11 + state.mid * 0.45 + note * 0.45) * field;
    p.vx += (-nx * gravity + nx * jet - ny * orbit) * dt * 9;
    p.vy += (-ny * gravity + ny * jet + nx * orbit) * dt * 9;
    p.vx *= 0.992;
    p.vy *= 0.992;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.hypot(p.x, p.y) > 1.8 || Math.hypot(p.x, p.y) < 0.025) resetParticle(p, i, exhale > inhale);
  }
}

function renderParticles() {
  const w = particleCanvas.width;
  const h = particleCanvas.height;
  const cx = w * (0.5 + state.impulse[0] * state.impulse[2] * 0.06);
  const cy = h * (0.5 - state.impulse[1] * state.impulse[2] * 0.04);
  const scale = Math.min(w, h) * 0.28;
  pctx.clearRect(0, 0, w, h);
  pctx.globalCompositeOperation = 'lighter';
  for (const p of state.particles) {
    const energy = Math.max(state.noteEnergy[p.note] ?? 0, state.rms * 0.5, state.pulse * 0.18);
    if (energy < 0.025 && p.spark < 0.52) continue;
    const x = cx + p.x * scale;
    const y = cy + p.y * scale;
    const hue = 28 + p.note * 23 + state.charge * 80;
    pctx.fillStyle = `hsla(${hue}, 95%, ${58 + energy * 24}%, ${0.12 + energy * 0.38})`;
    pctx.beginPath();
    pctx.arc(x, y, 0.8 + energy * 2.8 + p.spark * 0.7, 0, Math.PI * 2);
    pctx.fill();
  }
  pctx.globalCompositeOperation = 'source-over';
}

function noteOn(index, strength) {
  state.held[index] = strength;
  state.noteEnergy[index] = Math.max(state.noteEnergy[index], strength);
  state.pulse = Math.max(state.pulse, strength);
  state.charge = clamp(state.charge + (index >= 8 ? 0.22 : index <= 2 ? -0.25 : 0.06), -1, 1);
  keysEl.querySelectorAll('.key')[index]?.classList.add('active');
  state.audio.playNote(index, strength);
  statusEl.textContent = `${NOTES[index][0]} ${state.charge < 0 ? 'pulls inward' : 'throws outward'}`;
}

function noteOff(index) {
  if (index < 0) return;
  state.held[index] = 0;
  keysEl.querySelectorAll('.key')[index]?.classList.remove('active');
  state.audio.stopNote(index);
}

function createParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const p = {};
    resetParticle(p, i, false);
    return p;
  });
}

function resetParticle(p, i, ejected) {
  const a = i * 2.399963 + Math.random() * 0.25;
  const r = ejected ? 0.08 + Math.random() * 0.1 : 0.32 + Math.random() * 1.05;
  p.x = Math.cos(a) * r;
  p.y = Math.sin(a) * r * (0.44 + Math.random() * 0.28);
  p.vx = -Math.sin(a) * (0.08 + Math.random() * 0.05);
  p.vy = Math.cos(a) * (0.08 + Math.random() * 0.05);
  p.note = i % 12;
  p.spark = Math.random();
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.data = null;
    this.timeData = null;
    this.audio = null;
    this.source = null;
    this.master = null;
    this.voices = new Map();
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
    this.rms = 0;
    this.fast = 0;
    this.slow = 0;
    this.onset = 0;
  }

  async ensure() {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.analyser ??= this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    this.data ??= new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData ??= new Uint8Array(this.analyser.fftSize);
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }
  }

  async ensureSynth() {
    await this.ensure();
  }

  async loadFile(file) {
    await this.ensure();
    if (this.audio) this.audio.pause();
    this.audio = new Audio(URL.createObjectURL(file));
    this.audio.preload = 'auto';
    this.source?.disconnect?.();
    this.source = this.context.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    await this.audio.play();
  }

  async enableMic() {
    await this.ensure();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    this.source?.disconnect?.();
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  playNote(index, strength) {
    if (!this.context || this.voices.has(index)) return;
    const now = this.context.currentTime;
    const gain = this.context.createGain();
    const osc = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const freq = 261.63 * Math.pow(2, index / 12);
    osc.type = 'triangle';
    overtone.type = index >= 8 ? 'sawtooth' : 'sine';
    osc.frequency.value = freq;
    overtone.frequency.value = freq * 2.01;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * strength, now + 0.012);
    gain.gain.setTargetAtTime(0.042 * strength, now + 0.05, 0.16);
    osc.connect(gain);
    overtone.connect(gain);
    gain.connect(this.master);
    osc.start();
    overtone.start();
    this.voices.set(index, { osc, overtone, gain });
  }

  stopNote(index) {
    const voice = this.voices.get(index);
    if (!voice || !this.context) return;
    voice.gain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.075);
    setTimeout(() => {
      voice.osc.stop();
      voice.overtone.stop();
    }, 220);
    this.voices.delete(index);
  }

  update() {
    if (!this.analyser || !this.data || !this.timeData || !this.context) {
      this.bass *= 0.94;
      this.mid *= 0.94;
      this.high *= 0.94;
      this.rms *= 0.94;
      this.onset *= 0.82;
      return;
    }
    this.analyser.getByteFrequencyData(this.data);
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    const nyquist = this.context.sampleRate * 0.5;
    const band = (a, b) => {
      const start = Math.max(1, Math.floor(a / nyquist * this.data.length));
      const end = Math.max(start + 1, Math.floor(b / nyquist * this.data.length));
      let total = 0;
      for (let i = start; i < end; i++) total += this.data[i];
      return total / (end - start) / 255;
    };
    const bass = Math.max(band(25, 160), rms * 0.72);
    const mid = Math.max(band(180, 2200), rms * 0.35);
    const high = band(2400, 12000);
    this.bass += (bass - this.bass) * 0.34;
    this.mid += (mid - this.mid) * 0.3;
    this.high += (high - this.high) * 0.34;
    this.rms += (rms - this.rms) * 0.36;
    this.fast = this.fast * 0.5 + this.rms * 0.5;
    this.slow = this.slow * 0.965 + this.rms * 0.035;
    this.onset = Math.max(this.onset * 0.76, Math.max(0, this.fast - this.slow * 1.18) * 6);
  }
}

state.audio = new AudioEngine();
await boot();
resize();
requestAnimationFrame(frame);

async function boot() {
  const source = await fetch('/event-horizon-source.html').then((response) => response.text());
  const frag = source.match(/var fragSrc = `([\s\S]*?)`;/)?.[1];
  if (!frag) throw new Error('Could not extract event horizon shader source.');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL unavailable.');
  const vert = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';
  const program = createProgram(gl, vert, frag);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  state.shader = {
    gl,
    program,
    uniforms: {
      time: gl.getUniformLocation(program, 'u_time'),
      res: gl.getUniformLocation(program, 'u_res'),
      rotationSpeed: gl.getUniformLocation(program, 'u_rotationSpeed'),
      diskIntensity: gl.getUniformLocation(program, 'u_diskIntensity'),
      starsOnly: gl.getUniformLocation(program, 'u_starsOnly'),
      tilt: gl.getUniformLocation(program, 'u_tilt'),
      rotate: gl.getUniformLocation(program, 'u_rotate'),
      center: gl.getUniformLocation(program, 'u_bhCenter'),
      scale: gl.getUniformLocation(program, 'u_bhScale'),
      chromatic: gl.getUniformLocation(program, 'u_chromatic')
    }
  };
  statusEl.textContent = 'keyboard, clicks, and audio bend the shader';
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  particleCanvas.width = canvas.width;
  particleCanvas.height = canvas.height;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((event.clientX - rect.left) / rect.width - 0.5) * 2,
    (0.5 - (event.clientY - rect.top) / rect.height) * 2
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
