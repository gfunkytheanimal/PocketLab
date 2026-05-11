const KEYS = [
  { note: 'C', key: 'KeyA', label: 'A' },
  { note: 'C#', key: 'KeyW', label: 'W', sharp: true },
  { note: 'D', key: 'KeyS', label: 'S' },
  { note: 'D#', key: 'KeyE', label: 'E', sharp: true },
  { note: 'E', key: 'KeyD', label: 'D' },
  { note: 'F', key: 'KeyF', label: 'F' },
  { note: 'F#', key: 'KeyT', label: 'T', sharp: true },
  { note: 'G', key: 'KeyG', label: 'G' },
  { note: 'G#', key: 'KeyY', label: 'Y', sharp: true },
  { note: 'A', key: 'KeyH', label: 'H' },
  { note: 'A#', key: 'KeyU', label: 'U', sharp: true },
  { note: 'B', key: 'KeyJ', label: 'J' }
];

export class VirtualPiano {
  constructor(audioSystem) {
    this.audio = audioSystem;
    this.params = audioSystem.params ?? {};
    this.octave = 4;
    this.context = null;
    this.master = null;
    this.active = new Map();
    this.element = document.createElement('div');
    this.element.id = 'virtual-piano';
    document.body.appendChild(this.element);
    this.build();
    window.addEventListener('keydown', (event) => this.handleKey(event, true));
    window.addEventListener('keyup', (event) => this.handleKey(event, false));
  }

  build() {
    this.element.innerHTML = `
      <div class="piano-title">Jam Session</div>
      <div class="piano-keys">
        ${KEYS.map((key) => `<button class="${key.sharp ? 'sharp' : 'natural'}" data-note="${key.note}"><span>${key.note}</span><small>${key.label}</small></button>`).join('')}
      </div>
    `;
    for (const button of this.element.querySelectorAll('button')) {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.noteOn(button.dataset.note, 1);
      });
      button.addEventListener('pointerup', () => this.noteOff(button.dataset.note));
      button.addEventListener('pointerleave', () => this.noteOff(button.dataset.note));
    }
  }

  handleKey(event, down) {
    const key = KEYS.find((item) => item.key === event.code);
    if (!key) return;
    if (event.repeat && down) return;
    event.preventDefault();
    if (down) this.noteOn(key.note, 0.95);
    else this.noteOff(key.note);
  }

  noteOn(note, strength) {
    this.element.querySelector(`[data-note="${CSS.escape(note)}"]`)?.classList.add('active');
    if (this.audio.noteOn) this.audio.noteOn(note, this.octave, strength);
    else this.audio.triggerNote(note, this.octave, strength);
    this.playSynth(note, strength);
  }

  noteOff(note) {
    this.element.querySelector(`[data-note="${CSS.escape(note)}"]`)?.classList.remove('active');
    this.audio.noteOff?.(note);
    const osc = this.active.get(note);
    if (osc) {
      const release = osc.release ?? 0.16;
      osc.gain.gain.setTargetAtTime(0.0001, this.context.currentTime, release * 0.45);
      setTimeout(() => {
        osc.osc.stop();
        osc.osc2?.stop();
      }, Math.max(80, release * 1000));
      this.active.delete(note);
    }
  }

  playSynth(note, strength) {
    if (this.active.has(note)) return;
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    this.master.gain.setTargetAtTime(this.params.masterVolume ?? 0.8, this.context.currentTime, 0.02);
    const profile = instrumentProfile(this.params.noteInstrument ?? 'piano');
    const osc = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequency = noteFrequency(note, this.octave);
    osc.type = profile.wave;
    osc2.type = profile.overtoneWave;
    osc.frequency.value = frequency;
    osc2.frequency.value = frequency * profile.overtone;
    const now = this.context.currentTime;
    const volume = (this.params.synthVolume ?? 0.42) * profile.gain * strength;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0005, volume), now + profile.attack);
    gain.gain.setTargetAtTime(volume * profile.sustain, now + profile.attack, profile.decay);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    this.active.set(note, { osc, osc2, gain, release: profile.release });
  }
}

function noteFrequency(note, octave) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = (octave + 1) * 12 + names.indexOf(note);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function instrumentProfile(name) {
  return {
    piano: { wave: 'triangle', overtoneWave: 'sine', overtone: 2, gain: 0.22, attack: 0.006, decay: 0.18, sustain: 0.34, release: 0.16 },
    harp: { wave: 'sine', overtoneWave: 'triangle', overtone: 2.01, gain: 0.2, attack: 0.004, decay: 0.42, sustain: 0.2, release: 0.28 },
    drum: { wave: 'triangle', overtoneWave: 'square', overtone: 0.5, gain: 0.24, attack: 0.002, decay: 0.08, sustain: 0.08, release: 0.08 },
    strings: { wave: 'sawtooth', overtoneWave: 'triangle', overtone: 1.5, gain: 0.14, attack: 0.12, decay: 0.45, sustain: 0.72, release: 0.38 },
    'synth-pad': { wave: 'sine', overtoneWave: 'sawtooth', overtone: 2, gain: 0.16, attack: 0.22, decay: 0.6, sustain: 0.85, release: 0.55 },
    'electric-guitar': { wave: 'sawtooth', overtoneWave: 'square', overtone: 2.02, gain: 0.16, attack: 0.01, decay: 0.22, sustain: 0.48, release: 0.22 },
    choir: { wave: 'sine', overtoneWave: 'triangle', overtone: 1.99, gain: 0.13, attack: 0.18, decay: 0.5, sustain: 0.78, release: 0.5 }
  }[name] ?? instrumentProfile('piano');
}
