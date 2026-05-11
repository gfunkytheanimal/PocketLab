export class AudioReactiveSystem {
  constructor(params) {
    this.params = params;
    this.enabled = false;
    this.permission = 'idle';
    this.sub = 0;
    this.bass = 0;
    this.lowMid = 0;
    this.mid = 0;
    this.highMid = 0;
    this.treble = 0;
    this.level = 0;
    this.context = null;
    this.analyser = null;
    this.demoAudio = null;
    this.demoSource = null;
    this.data = null;
    this.timeData = null;
    this.fastLevel = 0;
    this.slowLevel = 0;
    this.energy = 0;
    this.noiseFloor = 0.015;
    this.quietFrames = 0;
    this.onsetCount = 0;
    this.hitType = 'none';
    this.onset = 0;
    this.centroid = 0;
    this.events = [];
    this.eventLevels = { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, broadband: 0 };
    this.eventHistory = [];
    this.noteEvents = [];
    this.noteLevels = Array(12).fill(0);
    this.noteHeld = Array(12).fill(0);
    this.detectedNote = 'none';
    this.detectedNoteConfidence = 0;
    this.noteGestureFrames = 0;
    this.pitchCooldown = 0;
    this.broadbandCooldown = 0;
    this.originEstablished = false;
    this.originFamily = -1;
    this.originNote = 'none';
    this.originPhase = 0;
    this.songMemory = { bass: 0, melody: 0, sparkle: 0, repetition: 0, sections: 0, lastDominant: 'none', shape: 'waveform' };
    this.bandState = {
      sub: createBandState(),
      bass: createBandState(),
      lowMid: createBandState(),
      mid: createBandState(),
      highMid: createBandState(),
      high: createBandState()
    };
    this.synthetic = { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, impulse: 0, tone: 0, sweep: 0, phase: 0 };
  }

  async enableMicrophone() {
    this.permission = 'requesting';
    if (this.params) this.params.audioPermission = this.permission;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.permission = 'unavailable';
      if (this.params) this.params.audioPermission = this.permission;
      throw new Error('Microphone input is not available in this browser context.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    this.context = new AudioContext();
    await this.context.resume();
    const source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.68;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.enabled = true;
    this.permission = 'granted';
    if (this.params) this.params.audioPermission = this.permission;
  }

  async loadAudioFile(file) {
    if (!file) return;
    this.permission = 'file';
    if (this.params) {
      this.params.primaryMode = 'demo';
      this.params.audioPermission = 'file';
      this.params.demoFileName = file.name;
      this.params.demoPlaying = false;
      this.params.pianoPhysicsMode = true;
    }
    this.resetCosmogenesis();
    this.context ??= new AudioContext();
    await this.context.resume();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    if (this.demoAudio) {
      this.demoAudio.pause();
      URL.revokeObjectURL(this.demoAudio.src);
    }
    this.demoAudio = new Audio(URL.createObjectURL(file));
    this.demoAudio.crossOrigin = 'anonymous';
    this.demoAudio.preload = 'auto';
    this.demoSource?.disconnect?.();
    this.demoSource = this.context.createMediaElementSource(this.demoAudio);
    this.demoSource.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.enabled = true;
    this.demoAudio.addEventListener('loadedmetadata', () => {
      if (this.params) this.params.demoDuration = this.demoAudio.duration || 0;
    }, { once: true });
    this.demoAudio.addEventListener('play', () => {
      if (this.params) this.params.demoPlaying = true;
    });
    this.demoAudio.addEventListener('pause', () => {
      if (this.params) this.params.demoPlaying = false;
    });
    await this.demoAudio.play();
  }

  async loadAudioUrl(url, name = 'demo audio') {
    this.permission = 'file';
    if (this.params) {
      this.params.primaryMode = 'demo';
      this.params.audioPermission = 'file';
      this.params.demoFileName = name;
      this.params.demoPlaying = false;
      this.params.pianoPhysicsMode = true;
    }
    this.resetCosmogenesis();
    this.context ??= new AudioContext();
    await this.context.resume();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    if (this.demoAudio) this.demoAudio.pause();
    this.demoAudio = new Audio(url);
    this.demoAudio.preload = 'auto';
    this.demoSource?.disconnect?.();
    this.demoSource = this.context.createMediaElementSource(this.demoAudio);
    this.demoSource.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.enabled = true;
    this.demoAudio.addEventListener('loadedmetadata', () => {
      if (this.params) this.params.demoDuration = this.demoAudio.duration || 0;
    }, { once: true });
    this.demoAudio.addEventListener('play', () => {
      if (this.params) this.params.demoPlaying = true;
    });
    this.demoAudio.addEventListener('pause', () => {
      if (this.params) this.params.demoPlaying = false;
    });
    await this.demoAudio.play();
  }

  async toggleDemoPlayback() {
    if (!this.demoAudio) return;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (this.demoAudio.paused) await this.demoAudio.play();
    else this.demoAudio.pause();
  }

  seekDemo(fraction) {
    if (!this.demoAudio || !Number.isFinite(this.demoAudio.duration)) return;
    this.demoAudio.currentTime = Math.max(0, Math.min(this.demoAudio.duration, this.demoAudio.duration * fraction));
  }

  seekDemoTime(seconds) {
    if (!this.demoAudio) return;
    const applySeek = () => {
      const duration = Number.isFinite(this.demoAudio.duration) && this.demoAudio.duration > 0 ? this.demoAudio.duration : Math.max(seconds, 0);
      this.demoAudio.currentTime = Math.max(0, Math.min(duration, seconds));
      if (this.params) this.params.demoBuildProgress = smoothstep(0.015, 0.72, duration > 0 ? this.demoAudio.currentTime / duration : 0);
    };
    if (Number.isFinite(this.demoAudio.duration) && this.demoAudio.duration > 0) applySeek();
    else this.demoAudio.addEventListener('loadedmetadata', applySeek, { once: true });
  }

  update() {
    this.synthetic.phase += 1 / 60;
    this.decaySynthetic();
    if (!this.enabled || !this.analyser) {
      this.applyAnalysis(emptyBands(), 0, 0);
      this.writeParams(0);
      return;
    }

    this.analyser.getByteFrequencyData(this.data);
    this.analyser.getByteTimeDomainData(this.timeData);
    let rmsSum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const centered = (this.timeData[i] - 128) / 128;
      rmsSum += centered * centered;
    }
    const rms = Math.sqrt(rmsSum / this.timeData.length);
    const nyquist = this.context.sampleRate * 0.5;
    const hzToBin = (hz) => Math.max(1, Math.min(this.data.length - 1, Math.floor(hz / nyquist * this.data.length)));
    const band = (fromHz, toHz) => {
      const from = hzToBin(fromHz);
      const to = Math.max(from + 1, hzToBin(toHz));
      let sum = 0;
      for (let i = from; i < to; i++) sum += this.data[i];
      return sum / Math.max(1, to - from) / 255;
    };

    let weighted = 0;
    let total = 0;
    for (let i = 1; i < this.data.length; i++) {
      const value = this.data[i] / 255;
      const frequency = i / this.data.length * nyquist;
      weighted += frequency * value;
      total += value;
    }
    const centroid = total > 0.001 ? weighted / total : 0;
    this.applyAnalysis({
      sub: band(20, 65),
      bass: Math.max(band(65, 150), rms * 0.9),
      lowMid: band(150, 420),
      mid: Math.max(band(420, 1800), rms * 0.38),
      highMid: band(1800, 4200),
      high: band(4200, 12000)
    }, rms, centroid);
    this.writeParams(rms);
  }

  triggerTest(type) {
    this.params.audioSynthetic = true;
    if (type === 'sub') this.triggerSubBoom(1);
    if (type === 'bass') this.triggerBassPulse(1);
    if (type === 'clap') this.triggerFullMusicBurst(1);
    if (type === 'hihat') this.triggerHiHatSparks(0.9);
    if (type === 'lead') this.triggerLeadArc(0.9);
    if (type === 'vocal') this.triggerVocalRibbon(0.9);
    if (type === 'music') this.triggerFullMusicBurst(1);
    if (type === 'tone') {
      this.synthetic.tone = 1;
      this.addEvent('tone', 0.65);
    }
  }

  triggerSubBoom(strength = 1) {
    this.synthetic.sub = Math.max(this.synthetic.sub, strength);
    this.addEvent('sub', strength);
  }

  triggerBassPulse(strength = 1) {
    this.synthetic.bass = Math.max(this.synthetic.bass, strength);
    this.addEvent('bass', strength);
  }

  triggerVocalRibbon(strength = 1) {
    this.synthetic.mid = Math.max(this.synthetic.mid, strength);
    this.synthetic.sweep = Math.max(this.synthetic.sweep, strength * 0.7);
    this.addEvent('mid', strength);
  }

  triggerLeadArc(strength = 1) {
    this.synthetic.highMid = Math.max(this.synthetic.highMid, strength);
    this.addEvent('highMid', strength);
  }

  triggerHiHatSparks(strength = 1) {
    this.synthetic.treble = Math.max(this.synthetic.treble, strength);
    this.addEvent('high', strength);
  }

  triggerFullMusicBurst(strength = 1) {
    this.synthetic.sub = Math.max(this.synthetic.sub, strength * 0.75);
    this.synthetic.bass = Math.max(this.synthetic.bass, strength * 0.9);
    this.synthetic.mid = Math.max(this.synthetic.mid, strength * 0.8);
    this.synthetic.highMid = Math.max(this.synthetic.highMid, strength * 0.75);
    this.synthetic.treble = Math.max(this.synthetic.treble, strength * 0.7);
    this.synthetic.impulse = Math.max(this.synthetic.impulse, strength * 0.55);
    this.addEvent('broadband', strength);
  }

  triggerBandEvent(band, strength = 1) {
    this.dispatchBandEvent(band, strength);
  }

  triggerChord(notes, strength = 1) {
    for (const note of notes) this.triggerNote(note.note ?? note, note.octave ?? 4, strength);
    if (notes.length >= 3) this.addEvent('broadband', Math.min(1, strength * 0.85));
  }

  noteOn(note, octave = 4, strength = 1) {
    const name = normalizeNote(note);
    const index = NOTE_INDEX[name] ?? 0;
    this.noteHeld[index] = Math.max(this.noteHeld[index], strength);
    this.triggerNote(name, octave, strength, this.params.noteInstrument ?? 'piano');
  }

  noteOff(note) {
    const name = normalizeNote(note);
    this.noteHeld[NOTE_INDEX[name] ?? 0] = 0;
  }

  triggerBassGravity(strength = 1) {
    this.triggerSubBoom(strength * 0.8);
    this.triggerBassPulse(strength);
  }

  triggerGoldenEscape(strength = 1) {
    this.addEvent('golden', strength);
    if (this.params) this.params.goldenEscape = Math.max(this.params.goldenEscape ?? 0, strength);
  }

  triggerNote(note, octave = 4, strength = 1, instrument = this.params.noteInstrument ?? 'piano') {
    const name = normalizeNote(note);
    const index = NOTE_INDEX[name] ?? 0;
    const band = noteBand(name, octave);
    this.establishOrigin(name, strength);
    this.noteGestureFrames = 10;
    this.noteLevels[index] = Math.max(this.noteLevels[index], Math.max(0.12, Math.min(1, strength)));
    if (!this.params.pianoPhysicsMode) {
      this.params.audioSynthetic = true;
      if (band === 'sub') this.synthetic.sub = Math.max(this.synthetic.sub, strength);
      if (band === 'bass') this.synthetic.bass = Math.max(this.synthetic.bass, strength);
      if (band === 'lowMid') this.synthetic.lowMid = Math.max(this.synthetic.lowMid, strength);
      if (band === 'mid') this.synthetic.mid = Math.max(this.synthetic.mid, strength);
      if (band === 'highMid') this.synthetic.highMid = Math.max(this.synthetic.highMid, strength);
      if (band === 'high') this.synthetic.treble = Math.max(this.synthetic.treble, strength);
      this.addEvent(band, strength);
    }
    this.noteEvents.push({
      note: name,
      octave,
      strength: Math.max(0.1, Math.min(1, strength)),
      age: 0,
      frequency: noteFrequency(name, octave),
      structure: noteStructure(name),
      instrument,
      phase: this.synthetic.phase * 6.283 + this.onsetCount * 0.618
    });
    if (name === 'B' && !this.params.pianoPhysicsMode) this.triggerGoldenEscape(strength * 0.75);
    if (this.noteEvents.length > 24) this.noteEvents.shift();
  }

  exciteFamily(index, strength = 1) {
    const family = ((Math.round(index) % 12) + 12) % 12;
    this.establishOrigin(NOTE_NAMES[family], strength * 0.72);
    this.noteLevels[family] = Math.max(this.noteLevels[family], Math.max(0.08, Math.min(1, strength)));
  }

  resetCosmogenesis() {
    this.originEstablished = false;
    this.originFamily = -1;
    this.originNote = 'none';
    this.originPhase = 0;
    this.songMemory = { bass: 0, melody: 0, sparkle: 0, repetition: 0, sections: 0, lastDominant: 'none', shape: 'waveform' };
    if (this.params) {
      this.params.originEstablished = false;
      this.params.originNote = 'none';
      this.params.originFamily = -1;
      this.params.originStrength = 0;
      this.params.originPhase = 0;
      this.params.songMemory = { ...this.songMemory };
      this.params.demoBuildProgress = 0;
    }
  }

  establishOrigin(note, strength = 1) {
    if (this.originEstablished || !this.params?.almightyWaveformMode) return;
    const name = normalizeNote(note);
    this.originEstablished = true;
    this.originFamily = NOTE_INDEX[name] ?? 0;
    this.originNote = name;
    this.originPhase = this.synthetic.phase * Math.PI * 2 + this.originFamily * 0.37;
    this.params.originEstablished = true;
    this.params.originNote = name;
    this.params.originFamily = this.originFamily;
    this.params.originStrength = Math.max(0.12, Math.min(1, strength));
    this.params.originPhase = this.originPhase;
  }

  applyAnalysis(rawBands, rmsIn, centroidIn) {
    const sweepTone = this.synthetic.sweep * (0.5 + 0.5 * Math.sin(this.synthetic.phase * 4));
    const synthetic = {
      sub: this.synthetic.sub,
      bass: this.synthetic.bass + this.synthetic.impulse * 0.28,
      lowMid: this.synthetic.lowMid + this.synthetic.mid * 0.28 + sweepTone * 0.2,
      mid: this.synthetic.mid + this.synthetic.tone * 0.62 + sweepTone * 0.55,
      highMid: this.synthetic.highMid + sweepTone * 0.5,
      high: this.synthetic.treble + this.synthetic.impulse * 0.85 + sweepTone * 0.45
    };
    const syntheticTotal = Object.values(this.synthetic).reduce((sum, value) => typeof value === 'number' ? sum + value : sum, 0) - this.synthetic.phase;
    const micMode = this.params.primaryMode === 'microphone';
    const demoMode = this.params.primaryMode === 'demo';
    const sensitivity = (this.params.audioSensitivity ?? 2.8) * (micMode ? 1.65 : demoMode ? 0.62 : 1);
    const onsetSensitivity = (this.params.onsetSensitivity ?? 1.65) * (micMode ? 1.25 : 1);
    const gain = 1 + sensitivity * (micMode ? 1.25 : 0.85);
    const rawRms = Math.min(1, Math.max(rmsIn * gain, this.synthetic.impulse * 0.9, this.synthetic.sub * 0.45, this.synthetic.bass * 0.5, this.synthetic.tone * 0.24, this.synthetic.sweep * 0.25));
    const isSynthetic = syntheticTotal > 0.01;
    if (!isSynthetic && rawRms < this.noiseFloor * 1.8) {
      this.quietFrames++;
      if (this.quietFrames > 45) this.noiseFloor = this.noiseFloor * 0.995 + rawRms * 0.005;
    } else {
      this.quietFrames = 0;
    }
    const gated = Math.max(0, (rawRms - this.noiseFloor * (micMode ? 0.92 : 1.35)) / Math.max(micMode ? 0.025 : 0.04, 1 - this.noiseFloor));
    this.energy += (gated - this.energy) * (gated > this.energy ? 0.42 : 0.055);
    if (isSynthetic) this.energy = Math.max(this.energy, rawRms);

    const scale = 0.08 + this.energy * 0.92;
    const levels = {};
    const onsets = {};
    const rawGated = {};
    for (const key of Object.keys(this.bandState)) {
      const state = this.bandState[key];
      const rawLinear = Math.max(rawBands[key] ?? 0, synthetic[key] ?? 0);
      const raw = Math.min(1, Math.log1p(rawLinear * gain * 5.5) / Math.log1p(gain * 5.5));
      if (!isSynthetic && raw < state.floor * 1.8) state.floor = state.floor * 0.996 + raw * 0.004;
      const bandGated = Math.max(0, (raw - state.floor * (micMode ? 0.88 : 1.22)) / Math.max(micMode ? 0.025 : 0.04, 1 - state.floor));
      rawGated[key] = bandGated;
      state.cooldown = Math.max(0, state.cooldown - 1);
      state.average = state.average * 0.985 + bandGated * 0.015;
      state.flux = Math.max(0, bandGated - state.previous);
      state.previous = bandGated;
      state.level += (bandGated - state.level) * (bandGated > state.level ? 0.36 : 0.075);
      state.fast = state.fast * 0.42 + state.level * 0.58;
      state.slow = state.slow * 0.96 + state.level * 0.04;
      state.onset = Math.max(
        state.onset * 0.76,
        Math.max(0, state.fast - state.slow * 1.16) * 3.2 * onsetSensitivity,
        Math.max(0, bandGated - state.average * 1.28) * 3.1 * onsetSensitivity,
        state.flux * 3.4 * onsetSensitivity,
        Math.abs(bandGated - state.slow) * 0.65 * onsetSensitivity,
        synthetic[key] > 0.78 ? synthetic[key] : 0
      );
      const threshold = ({ sub: 0.15, bass: 0.16, lowMid: 0.18, mid: 0.17, highMid: 0.14, high: 0.12 }[key] ?? 0.16) / Math.sqrt(Math.max(0.5, onsetSensitivity));
      if (state.onset > threshold && state.cooldown <= 0) {
        this.dispatchBandEvent(key, Math.min(1, state.onset));
        state.cooldown = key === 'high' ? 8 : key === 'highMid' ? 10 : 14;
      }
      state.lastOnset = state.onset;
      const usefulFloor = bandGated > 0.018 ? Math.min(0.12, 0.028 + bandGated * 0.18) : 0;
      levels[key] = Math.min(1, Math.max(demoMode ? usefulFloor * 0.25 : usefulFloor, state.level * scale + (synthetic[key] ?? 0)));
      onsets[key] = state.onset;
    }
    if (demoMode && !isSynthetic) {
      const rawTotal = Object.keys(this.bandState).reduce((sum, key) => sum + Math.max(0, rawBands[key] ?? 0), 0) + 0.0001;
      for (const key of Object.keys(this.bandState)) {
        const share = Math.max(0, rawBands[key] ?? 0) / rawTotal;
        const prominence = Math.min(1.35, share * 6);
        const contrast = 0.18 + Math.pow(prominence, 1.25) * 0.62;
        levels[key] = Math.min(0.92, Math.pow(levels[key], 1.22) * contrast);
      }
    }

    this.sub = this.sub * 0.72 + levels.sub * 0.28;
    this.bass = this.bass * 0.72 + levels.bass * 0.28;
    this.lowMid = this.lowMid * 0.72 + levels.lowMid * 0.28;
    this.mid = this.mid * 0.72 + levels.mid * 0.28;
    this.highMid = this.highMid * 0.72 + levels.highMid * 0.28;
    this.treble = this.treble * 0.72 + levels.high * 0.28;
    this.level = this.level * 0.62 + Math.min(1, rawRms * 3.2 + this.sub * 0.18 + this.bass * 0.25 + this.lowMid * 0.14 + this.mid * 0.16 + this.highMid * 0.12 + this.treble * 0.1) * 0.38;
    this.fastLevel = this.fastLevel * 0.45 + this.level * 0.55;
    this.slowLevel = this.slowLevel * 0.96 + this.level * 0.04;
    const onsetCandidate = Math.max(0, this.fastLevel - this.slowLevel * 1.28) * 3.5;
    const dominant = dominantType({ sub: this.sub, bass: this.bass, lowMid: this.lowMid, mid: this.mid, highMid: this.highMid, high: this.treble }, this.centroid, this.synthetic.impulse);
    const activeSpikes = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high'].filter((key) => (this.bandState[key]?.onset ?? 0) > 0.2).length;
    const broadbandStrength = Math.min(1, onsetCandidate + activeSpikes * 0.12);
    if (activeSpikes >= 3 && broadbandStrength > 0.45 && this.broadbandCooldown <= 0) {
      this.addEvent('broadband', broadbandStrength);
      this.broadbandCooldown = 24;
    }
    this.broadbandCooldown = Math.max(0, this.broadbandCooldown - 1);
    if (onsetCandidate > 0.2 && this.onset < 0.12 && activeSpikes < 3) this.dispatchBandEvent(dominant, Math.min(1, onsetCandidate));
    this.onset = Math.max(this.onset * 0.78, onsetCandidate, this.synthetic.impulse);
    this.centroid = centroidIn || (this.synthetic.tone ? 420 : this.synthetic.sweep ? 260 + sweepTone * 2600 : this.synthetic.impulse ? 5000 : 0);
    this.pitchCooldown = Math.max(0, this.pitchCooldown - 1);
    if (this.centroid > 55 && this.centroid < 2200 && this.energy > 0.08 && this.pitchCooldown <= 0) {
      const pitch = frequencyToNote(this.centroid);
      const confidence = Math.min(0.82, Math.max(0.08, this.energy * 0.85 + (this.bandVariance ?? 0) * 1.8));
      const instrument = estimateInstrument(this.bandState, this.centroid, this.energy, activeSpikes);
      this.params.liveInstrumentEstimate = instrument;
      this.detectedNote = `${pitch.note}${pitch.octave}`;
      this.detectedNoteConfidence = confidence;
      this.triggerNote(pitch.note, pitch.octave, confidence * 0.72, instrument);
      this.pitchCooldown = 18;
    }
    this.bandOnsets = onsets;
    const values = Object.values(levels);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    this.bandVariance = values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / Math.max(1, values.length);
    this.dominantBand = dominantType(levels, this.centroid, this.synthetic.impulse);
    if (!this.originEstablished && this.energy > 0.025) this.establishOrigin(dominantNoteFromBands(levels), Math.max(this.energy, this.onset));
    this.updateSongMemory(levels, this.dominantBand);
    this.updateEvents();
  }

  updateSongMemory(levels, dominant) {
    const memory = this.songMemory;
    memory.bass = Math.min(1, memory.bass * 0.998 + Math.max(levels.sub ?? 0, levels.bass ?? 0) * 0.0028);
    memory.melody = Math.min(1, memory.melody * 0.998 + Math.max(levels.lowMid ?? 0, levels.mid ?? 0) * 0.0028);
    memory.sparkle = Math.min(1, memory.sparkle * 0.998 + Math.max(levels.highMid ?? 0, levels.high ?? 0) * 0.0028);
    if (dominant && dominant === memory.lastDominant && this.energy > 0.08) memory.repetition = Math.min(1, memory.repetition + 0.0035);
    if (dominant && dominant !== memory.lastDominant && this.energy > 0.12) memory.sections = Math.min(24, memory.sections + 0.05);
    memory.lastDominant = dominant;
    memory.shape = memory.bass > memory.melody * 1.18 && memory.bass > memory.sparkle ? 'gravity wells'
      : memory.sparkle > memory.melody * 1.12 && memory.sparkle > memory.bass ? 'crystalline comet field'
        : memory.melody > memory.bass * 1.05 ? 'branching ribbon galaxy'
          : memory.repetition > 0.35 ? 'repeating harmonic arms'
            : 'waveform star nursery';
    if (this.params) this.params.songMemory = { ...memory };
  }

  dispatchBandEvent(type, strength) {
    if (this.params?.pianoPhysicsMode && this.noteGestureFrames <= 0) {
      const families = {
        sub: [0, 7],
        bass: [0, 4],
        lowMid: [2, 7],
        mid: [5, 9],
        highMid: [3, 6, 10],
        high: [9, 10, 11],
        broadband: [0, 2, 4, 7, 9, 11]
      }[type] ?? [0, 7];
      const falloff = type === 'broadband' ? 0.62 : 0.72;
      families.forEach((family, order) => this.exciteFamily(family, strength * Math.pow(falloff, order)));
    }
    if (type === 'sub') this.addEvent('sub', strength);
    else if (type === 'bass') this.addEvent('bass', strength);
    else if (type === 'lowMid') this.addEvent('lowMid', strength);
    else if (type === 'mid') this.addEvent('mid', strength);
    else if (type === 'highMid') this.addEvent('highMid', strength);
    else if (type === 'high') this.addEvent('high', strength);
    else this.addEvent('broadband', strength);
  }

  writeParams(rms) {
    this.params.audioPermission = this.permission;
    this.params.audioRms = Math.max(rms, this.synthetic.impulse * 0.9, this.synthetic.sub * 0.42, this.synthetic.bass * 0.45, this.synthetic.tone * 0.22, this.synthetic.sweep * 0.25);
    this.params.audioPulse = Math.max(this.params.audioPulse * 0.86, Math.min(1, this.params.audioRms * 4.5), this.onset);
    this.params.audioSub = this.sub;
    this.params.audioBass = this.bass;
    this.params.audioLowMid = this.lowMid;
    this.params.audioMid = this.mid;
    this.params.audioHighMid = this.highMid;
    this.params.audioTreble = this.treble;
    this.params.audioBands = { sub: this.sub, bass: this.bass, lowMid: this.lowMid, mid: this.mid, highMid: this.highMid, high: this.treble };
    this.params.audioBandOnsets = this.bandOnsets ?? emptyBands();
    this.params.audioOnset = this.onset;
    this.params.audioCentroid = this.centroid;
    this.params.audioImpulse = Math.max(this.params.audioImpulse * 0.86, this.onset);
    this.params.audioSynthetic = Object.entries(this.synthetic).some(([key, value]) => key !== 'phase' && value > 0.01);
    this.params.audioEnergy = this.energy;
    this.params.audioNoiseFloor = this.noiseFloor;
    this.params.audioOnsetCount = this.onsetCount;
    this.params.audioHitType = this.hitType;
    this.params.audioEvents = this.events.map((event) => ({ ...event }));
    this.params.noteEvents = this.noteEvents.map((event) => ({ ...event }));
    this.params.noteFamilyActivation = this.noteLevels.slice();
    this.params.noteFamilyHeld = this.noteHeld.slice();
    const chord = detectChord(this.noteLevels, this.noteHeld);
    this.params.chordType = chord.type;
    this.params.chordNotes = chord.notes;
    this.params.activeNotes = NOTE_NAMES
      .map((note, index) => ({ note, value: Math.max(this.noteLevels[index], this.noteHeld[index]) }))
      .filter((item) => item.value > 0.06)
      .map((item) => item.note);
    this.params.detectedNote = this.detectedNote;
    this.params.detectedNoteConfidence = this.detectedNoteConfidence;
    this.params.audioBandEvents = { ...this.eventLevels };
    this.params.audioBandVariance = this.bandVariance ?? 0;
    this.params.audioDominantBand = this.dominantBand ?? 'none';
    this.params.liveInstrumentEstimate ??= 'none';
    this.params.audioEventHistory = this.eventHistory.slice(-8).join(' ');
    if (this.demoAudio) {
      this.params.demoTime = this.demoAudio.currentTime || 0;
      this.params.demoDuration = this.demoAudio.duration || 0;
      this.params.demoPlaying = !this.demoAudio.paused;
      const songProgress = this.params.demoDuration > 0 ? this.params.demoTime / this.params.demoDuration : 0;
      const accretion = smoothstep(0.004, 0.46, songProgress);
      const eventLift = Math.min(0.16, this.energy * 0.05 + this.onset * 0.055 + (this.eventLevels.broadband ?? 0) * 0.06);
      this.params.demoBuildProgress = Math.max(this.params.demoBuildProgress ?? 0, Math.min(1, accretion + eventLift));
    }
  }

  addEvent(type, strength) {
    this.onsetCount++;
    this.hitType = type;
    this.events.push({
      type,
      strength: Math.max(0.1, Math.min(1, strength)),
      age: 0,
      radius: 0,
      phase: this.synthetic.phase * 6.283 + this.onsetCount * 1.618
    });
    if (this.params) {
      if (type === 'broadband') this.params.cosmicFlower = Math.max(this.params.cosmicFlower ?? 0, strength);
      if (type === 'high' || type === 'highMid') this.params.soundRift = Math.max(this.params.soundRift ?? 0, strength);
      if (type === 'golden') this.params.goldenEscape = Math.max(this.params.goldenEscape ?? 0, strength);
    }
    if (type in this.eventLevels) this.eventLevels[type] = Math.max(this.eventLevels[type], strength);
    this.eventHistory.push(type);
    if (this.eventHistory.length > 12) this.eventHistory.shift();
    if (this.events.length > 16) this.events.shift();
  }

  updateEvents() {
    const dt = 1 / 60;
    for (const event of this.events) {
      event.age += dt;
      const speed = event.type === 'sub' ? 20 : event.type === 'bass' ? 28 : event.type === 'high' ? 52 : event.type === 'highMid' ? 44 : event.type === 'golden' ? 62 : 36;
      event.radius = event.age * speed;
      event.strength *= event.type === 'tone' ? 0.992 : event.type === 'golden' ? 0.982 : 0.965;
    }
    for (const event of this.noteEvents) {
      event.age += dt;
      event.strength *= 0.988;
    }
    for (let i = 0; i < this.noteLevels.length; i++) {
      const held = this.noteHeld[i] ?? 0;
      this.noteLevels[i] = Math.max(held, this.noteLevels[i] * (held > 0 ? 0.992 : 0.94));
    }
    this.detectedNoteConfidence *= 0.96;
    this.noteGestureFrames = Math.max(0, this.noteGestureFrames - 1);
    if (this.detectedNoteConfidence < 0.05) this.detectedNote = 'none';
    this.noteEvents = this.noteEvents.filter((event) => event.age < 7 && event.strength > 0.025);
    this.events = this.events.filter((event) => event.age < 2.6 && event.strength > 0.025);
    for (const key of Object.keys(this.eventLevels)) this.eventLevels[key] *= key === 'broadband' ? 0.88 : 0.82;
    if (!this.events.length && this.onset < 0.04) this.hitType = 'none';
  }

  decaySynthetic() {
    this.synthetic.sub *= 0.9;
    this.synthetic.bass *= 0.9;
    this.synthetic.lowMid *= 0.91;
    this.synthetic.mid *= 0.92;
    this.synthetic.highMid *= 0.88;
    this.synthetic.treble *= 0.86;
    this.synthetic.impulse *= 0.76;
    this.synthetic.tone *= 0.994;
    this.synthetic.sweep *= 0.988;
  }
}

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function normalizeNote(note) {
  const n = String(note).toUpperCase().replace('♯', '#');
  return NOTE_INDEX[n] !== undefined ? n : 'C';
}

function noteFrequency(note, octave) {
  const midi = (octave + 1) * 12 + NOTE_INDEX[normalizeNote(note)];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToNote(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  return { note, octave: Math.floor(midi / 12) - 1 };
}

function noteBand(note, octave) {
  if (octave <= 2 || note === 'C') return 'bass';
  if (note === 'D' || note === 'G') return 'lowMid';
  if (note === 'F' || note === 'E') return 'mid';
  if (note === 'A' || note === 'B') return octave >= 5 ? 'high' : 'highMid';
  return octave >= 5 ? 'high' : 'mid';
}

function noteStructure(note) {
  return {
    C: 'central-gravity',
    'C#': 'crystal-shard',
    D: 'ribbon-orbit',
    'D#': 'spark-belt',
    E: 'crystal-shard',
    F: 'nebula-bloom',
    'F#': 'crystal-shard',
    G: 'spiral-arm',
    'G#': 'nebula-bloom',
    A: 'spark-belt',
    'A#': 'ribbon-orbit',
    B: 'golden-escape'
  }[normalizeNote(note)] ?? 'central-gravity';
}

function createBandState() {
  return { floor: 0.012, level: 0, fast: 0, slow: 0, onset: 0, lastOnset: 0, previous: 0, average: 0, flux: 0, cooldown: 0 };
}

function emptyBands() {
  return { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 };
}

function dominantType(bands, centroid, impulse) {
  if (impulse > 0.2) return 'broadband';
  let best = 'mid';
  let bestValue = 0;
  for (const [key, value] of Object.entries(bands)) {
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  if (centroid > 4800 && bands.high > 0.05) return 'high';
  return bestValue > 0.04 ? best : 'broadband';
}

function dominantNoteFromBands(levels) {
  const band = dominantType(levels, 0, 0);
  const map = {
    sub: 'C',
    bass: 'C',
    lowMid: 'D',
    mid: 'F',
    highMid: 'F#',
    high: 'A',
    broadband: 'G'
  };
  return map[band] ?? 'C';
}

function detectChord(levels, held) {
  const active = NOTE_NAMES
    .map((note, index) => ({ note, index, value: Math.max(levels[index] ?? 0, held[index] ?? 0) }))
    .filter((item) => item.value > 0.12)
    .sort((a, b) => b.value - a.value);
  const notes = active.map((item) => item.note);
  if (!active.length) return { type: 'none', notes: [] };
  const set = new Set(active.map((item) => item.index));
  for (const root of active) {
    if (set.has((root.index + 4) % 12) && set.has((root.index + 7) % 12)) return { type: 'major', notes };
    if (set.has((root.index + 3) % 12) && set.has((root.index + 7) % 12)) return { type: 'minor', notes };
    if (set.has((root.index + 7) % 12)) return { type: 'fifth', notes };
    if (set.has((root.index + 1) % 12) || set.has((root.index + 11) % 12)) return { type: 'dissonant', notes };
  }
  return active.length >= 4 ? { type: 'cluster', notes } : { type: active.length === 1 ? 'single' : 'interval', notes };
}

function estimateInstrument(bandState, centroid, energy, activeSpikes) {
  const high = bandState.high?.level ?? 0;
  const highMid = bandState.highMid?.level ?? 0;
  const mid = bandState.mid?.level ?? 0;
  const bass = Math.max(bandState.sub?.level ?? 0, bandState.bass?.level ?? 0);
  const percussive = Object.values(bandState).reduce((max, state) => Math.max(max, state.onset ?? 0), 0);
  if (percussive > 0.55 && bass > 0.1) return 'drum';
  if (percussive > 0.4) return 'piano';
  if ((high + highMid) > 0.34 && centroid > 2200) return 'electric-guitar';
  if (mid > 0.18 && energy > 0.18 && activeSpikes <= 2) return centroid < 900 ? 'choir' : 'strings';
  if (energy > 0.18) return 'synth-pad';
  return 'none';
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
