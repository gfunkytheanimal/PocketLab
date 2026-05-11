export class CaptureSystem {
  constructor(canvas, params) {
    this.canvas = canvas;
    this.params = params;
    this.recorder = null;
    this.chunks = [];
    this.recording = false;
  }

  toggleRecording() {
    if (this.recording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording() {
    if (!this.canvas.captureStream || typeof MediaRecorder === 'undefined') {
      console.warn('Canvas recording is not supported in this browser.');
      return;
    }
    const fps = this.params.recordFps;
    const stream = this.canvas.captureStream(fps);
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder.mimeType });
      downloadBlob(blob, `recursive-universe-${Date.now()}.webm`);
    };
    this.recorder.start();
    this.recording = true;
    this.params.recordingMode = true;
    document.body.classList.add('recording');
  }

  stopRecording() {
    if (!this.recorder) return;
    this.recorder.stop();
    this.recording = false;
    this.params.recordingMode = false;
    document.body.classList.remove('recording');
  }

  screenshot() {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `recursive-universe-${Date.now()}.png`);
    }, 'image/png');
  }
}

function pickMimeType() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
