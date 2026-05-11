export class IntroOverlay {
  constructor(params, onPreset, onAudio, onStart, onTest) {
    this.params = params;
    this.element = document.getElementById('intro');
    this.controls = document.getElementById('controls-help');
    this.onPreset = onPreset;
    this.onAudio = onAudio;
    this.onStart = onStart;
    this.onTest = onTest;
    this.build();
  }

  build() {
    this.element.innerHTML = `
      <div class="intro-copy">
        <p class="eyebrow">Universal musical physics</p>
        <h1>Playable Universe</h1>
        <p class="subtitle">Play piano strings of a cosmological particle instrument.</p>
      </div>
      <div class="intro-actions">
        <button id="intro-piano">Jam Session</button>
        <button id="intro-mic">Microphone Listening</button>
        <button id="intro-demo">Demo Upload</button>
      </div>
      <p class="hint">Press Backquote for controls</p>
    `;
    this.element.querySelector('#intro-piano').addEventListener('click', () => {
      this.params.primaryMode = 'piano';
      this.params.pianoPhysicsMode = true;
      this.hide();
    });
    this.element.querySelector('#intro-mic').addEventListener('click', () => {
      this.params.primaryMode = 'microphone';
      this.params.pianoPhysicsMode = true;
      this.onAudio();
      this.hide();
    });
    this.element.querySelector('#intro-demo').addEventListener('click', () => {
      this.params.primaryMode = 'demo';
      this.params.pianoPhysicsMode = true;
      this.onTest?.('demo-upload');
      this.hide();
    });
    setTimeout(() => this.element.classList.add('soft-hide'), 4200);
  }

  hide() {
    this.element.classList.add('hidden');
    window.setTimeout(() => {
      if (this.element.classList.contains('hidden')) this.element.style.display = 'none';
    }, 650);
    this.onStart?.();
  }

  toggleControls() {
    this.controls.classList.toggle('visible');
  }
}
