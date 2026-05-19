import * as THREE from 'three';

export class Interaction {
  constructor(renderer, camera, state, callbacks, controls = null) {
    this.renderer = renderer;
    this.camera = camera;
    this.state = state;
    this.callbacks = callbacks;
    this.controls = controls;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragged = null;
    this.painting = false;
    this.lastPaintAt = 0;
    this.lastWorld = new THREE.Vector3();
    this.lastTime = performance.now();
    this.bind();
  }

  bind() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('dragover', (event) => event.preventDefault());
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('text/plain');
      if (type) this.callbacks.spawn(type, this.screenToWorld(event.clientX, event.clientY));
    });
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (this.state.toolMode === 'paint') {
        if (this.controls) this.controls.enabled = false;
        const world = this.screenToPaintWorld(event.clientX, event.clientY);
        this.callbacks.applyToolAt(world, 'paint');
        this.painting = true;
        this.dragged = null;
        this.lastPaintAt = performance.now();
        this.callbacks.selectionChanged();
        return;
      }
      const hit = this.pick(event.clientX, event.clientY);
      if (hit) {
        if (this.controls) this.controls.enabled = false;
        this.state.selected = hit;
        this.dragged = hit;
        this.lastWorld.copy(hit.position);
        this.lastTime = performance.now();
      } else {
        const world = this.state.toolMode === 'paint'
          ? this.screenToPaintWorld(event.clientX, event.clientY)
          : this.screenToWorld(event.clientX, event.clientY, this.state.selected?.position.z ?? 0);
        if (this.state.toolMode && this.state.toolMode !== 'select') {
          if (this.controls) this.controls.enabled = false;
          this.callbacks.applyToolAt(world, this.state.toolMode);
          if (this.state.toolMode === 'paint') {
            this.painting = true;
            this.lastPaintAt = performance.now();
          }
        } else {
          this.state.selected = null;
        }
      }
      this.callbacks.selectionChanged();
    });
    window.addEventListener('pointermove', (event) => {
      const coordinateWorld = this.state.toolMode === 'paint'
        ? this.screenToPaintWorld(event.clientX, event.clientY)
        : this.screenToWorld(event.clientX, event.clientY, this.state.selected?.position.z ?? 0);
      this.callbacks.pointerMoved?.(coordinateWorld, this.state.toolMode === 'paint' ? 'Paint plane' : 'World');
      if (this.painting && !this.dragged) {
        const now = performance.now();
        if (now - this.lastPaintAt > 90) {
          const world = this.screenToPaintWorld(event.clientX, event.clientY);
          this.callbacks.applyToolAt(world, 'paint');
          this.lastPaintAt = now;
        }
        return;
      }
      if (!this.dragged) return;
      const world = this.screenToWorld(event.clientX, event.clientY, this.dragged.position.z);
      const now = performance.now();
      const dt = Math.max(0.016, (now - this.lastTime) / 1000);
      this.dragged.position.copy(world);
      this.dragged.velocity.copy(world.clone().sub(this.lastWorld).multiplyScalar(1 / dt));
      this.dragged.group.position.copy(world);
      this.lastWorld.copy(world);
      this.lastTime = now;
    });
    window.addEventListener('pointerup', () => {
      this.dragged = null;
      this.painting = false;
      if (this.controls) this.controls.enabled = true;
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        this.callbacks.togglePause();
      }
      if (event.code === 'KeyR') this.callbacks.reset();
      if (event.code === 'KeyG') this.callbacks.toggleFields();
      if (event.code === 'KeyT') this.callbacks.toggleTrails();
      if (event.code === 'KeyA') this.callbacks.toggleScanner?.();
    });
  }

  pick(x, y) {
    this.setPointer(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const groups = this.state.bodies.map((body) => body.group);
    const hit = this.raycaster.intersectObjects(groups, true)[0];
    if (!hit) return null;
    return this.state.bodies.find((body) => {
      let node = hit.object;
      while (node) {
        if (node === body.group) return true;
        node = node.parent;
      }
      return false;
    }) ?? null;
  }

  screenToWorld(x, y, z = 0) {
    this.setPointer(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
    const world = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, world);
    return world;
  }

  screenToPaintWorld(x, y) {
    this.setPointer(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const planeZ = this.state.paintPlaneZ ?? this.state.selected?.position.z ?? 0;
    const anchor = new THREE.Vector3(0, 0, planeZ);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const world = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, world)) {
      return anchor.clone();
    }
    return world;
  }

  setPointer(x, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
  }
}
