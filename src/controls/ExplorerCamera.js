import * as pc from 'playcanvas/build/playcanvas.mjs';

export class ExplorerCamera {
  constructor(app, params) {
    this.app = app;
    this.params = params;
    this.yaw = 0.45;
    this.pitch = 0.38;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.distance = 18;
    this.boardDistance = params.targetCameraDistance ?? 58;
    this.pan = new pc.Vec3();
    this.targetPan = new pc.Vec3();
    this.freePos = new pc.Vec3(0, 0, 0);
    this.freeVel = new pc.Vec3();
    this.forwardTravel = 0;
    this.speedMultiplier = 1;
    this.velocity = new pc.Vec3();
    this.bank = 0;
    this.dragging = false;
    this.button = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.downX = 0;
    this.downY = 0;
    this.pointerMoved = 0;

    this.entity = new pc.Entity('explorer-camera');
    this.entity.addComponent('camera', {
      clearColor: new pc.Color(0, 0, 0),
      fov: 74,
      nearClip: 0.04,
      farClip: 1000,
      frustumCulling: false
    });
    this.app.root.addChild(this.entity);

    const canvas = app.graphicsDevice.canvas;
    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (event) => {
      canvas.focus();
      this.dragging = true;
      this.button = event.button;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.downX = event.clientX;
      this.downY = event.clientY;
      this.pointerMoved = 0;
      this.params.dragging = true;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      const moved = Math.hypot(event.clientX - this.downX, event.clientY - this.downY) + this.pointerMoved;
      this.dragging = false;
      this.params.dragging = false;
      canvas.releasePointerCapture(event.pointerId);
      if (this.params.pianoPhysicsMode && this.params.cameraState !== 'outside' && this.button === 0 && moved < 10) {
        this.selectRingAt(event.clientX, event.clientY, false);
      }
    });
    canvas.addEventListener('pointercancel', () => {
      this.dragging = false;
      this.params.dragging = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      this.params.mouseX = event.clientX;
      this.params.mouseY = event.clientY;
      this.params.pointerMoves += 1;
      if (!this.dragging) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.pointerMoved += Math.abs(dx) + Math.abs(dy);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      if (this.params.appMode === 'sound-board' && this.button === 2) {
        const panScale = this.boardDistance * 0.0012;
        this.targetPan.x -= dx * panScale;
        this.targetPan.y += dy * panScale;
        this.params.cameraPanX = this.targetPan.x;
        this.params.cameraPanY = this.targetPan.y;
        return;
      }
      const gain = this.params.appMode === 'sound-board' ? 0.0065 : (this.params.controlTestMode ? 0.012 : 0.007);
      if (this.params.appMode === 'sound-board') {
        this.yawVelocity += dx * gain;
        this.pitchVelocity += -dy * gain * 0.72;
      } else {
        this.yawVelocity += -dx * gain;
        this.pitchVelocity += -dy * gain * 0.78;
      }
    }, { passive: true });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('dblclick', () => {
      if (this.params.appMode !== 'sound-board') return;
      if (this.params.pianoPhysicsMode && this.params.cameraState !== 'outside') {
        this.jumpToSelectedRing();
        return;
      }
      this.targetPan.set(0, 0, 0);
      this.pitch = 0.62;
      this.yaw = 0.45;
      this.params.targetZoomDepth = 0;
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (this.params.appMode === 'sound-board') {
        if (event.shiftKey) {
          this.params.targetSimSpeed = Math.max(0.15, Math.min(4, (this.params.targetSimSpeed ?? 1) * Math.exp(direction * 0.18)));
        } else {
          this.params.targetZoomDepth = Math.max(0, Math.min(1, (this.params.targetZoomDepth ?? this.params.zoomDepth ?? 0.52) + direction * 0.024));
        }
        this.params.wheelDelta = event.deltaY;
        return;
      }
      const zoomStep = this.params.controlTestMode ? 0.9 : 0.42;
      this.params.targetSpeedMultiplier = Math.max(0.35, Math.min(20, (this.params.targetSpeedMultiplier ?? 1) * Math.exp(direction * zoomStep)));
      this.params.wheelDelta = event.deltaY;
      this.distance = Math.max(5, Math.min(54, this.distance + direction * 1.2));
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyV' && this.params.pianoPhysicsMode) {
        const states = ['outside', 'free', 'first'];
        const current = states.indexOf(this.params.cameraState ?? 'outside');
        const next = states[(current + 1) % states.length];
        this.params.cameraState = next;
        this.params.targetZoomDepth = next === 'outside' ? 0 : next === 'free' ? 0.52 : 1;
      }
      if (event.code === 'Tab' && this.params.pianoPhysicsMode) {
        event.preventDefault();
        const rings = this.params.ringInstances ?? [];
        this.params.focusRingIndex = ((this.params.focusRingIndex ?? 0) + 1) % Math.max(1, rings.length);
        this.params.focusNoteFamily = rings[this.params.focusRingIndex]?.family ?? ((this.params.focusNoteFamily ?? 0) + 1) % 12;
      }
      if (event.code === 'Escape' && this.params.pianoPhysicsMode) {
        this.params.selectedRingIndex = -1;
        this.params.selectedTarget = null;
        this.params.jumpActive = false;
        this.params.jumpTarget = null;
      }
    });
  }

  update(dt) {
    this.integrateRotation(dt);
    if (this.params.appMode === 'sound-board') {
      this.updateBoardCamera(dt);
      return;
    }
    const audioPulse = this.params.audioLevel ?? 0;
    const cinematic = this.params.cinematicMode ? 1 : 0;
    const clean = this.params.cleanFlow ? 1 : 0;
    const noiseAmount = clean ? 0.22 : 1;
    const recordPath = this.params.recordingMode ? 1 : 0;
    const discoveryPull = (this.params.discoveryIntent === 'scale vista' ? 0.02 : this.params.discoveryIntent === 'entity encounter' ? -0.012 : 0) * noiseAmount;
    const horizonTension = (this.params.eventHorizon ?? 0) * 0.045 * noiseAmount;
    const targetSpeed = Math.max(0.35, Math.min(20, this.params.targetSpeedMultiplier ?? 1));
    this.speedMultiplier += (targetSpeed - this.speedMultiplier) * (1 - Math.pow(0.002, Math.max(0.001, dt)));
    this.params.speedMultiplier = this.speedMultiplier;
    this.params.tunnelTightness = 1 + Math.log2(Math.max(1, this.speedMultiplier)) * 0.22;
    this.params.cameraYaw = this.yaw;
    this.params.cameraPitch = this.pitch;
    this.params.dragging = this.dragging;

    this.yaw += dt * (0.018 + cinematic * 0.018 * Math.sin(this.forwardTravel * 0.07) + discoveryPull + horizonTension + recordPath * 0.012) * (this.dragging ? 0 : 1);
    this.bank = this.bank * 0.96 + Math.sin(this.forwardTravel * 0.1) * 0.04 * cinematic * noiseAmount;
    const encounterInfluence = this.params.encounterInfluence ?? 0;
    const encounterSlowdown = 1 - Math.min(0.42, encounterInfluence * 0.32);
    this.forwardTravel += dt * this.params.travelSpeed * this.speedMultiplier * encounterSlowdown * (1 + audioPulse * (this.params.controlTestMode ? 1.4 : 0.45) * noiseAmount + (this.params.harmonicConvergence ?? 0) * 0.08 * noiseAmount - (this.params.eventHorizon ?? 0) * 0.12 * noiseAmount);
    const cp = Math.cos(this.pitch);
    const orbitRadius = this.params.controlTestMode ? 8.5 : 5.2;
    const yawOffset = Math.sin(this.yaw) * cp * orbitRadius;
    const pitchOffset = Math.sin(this.pitch) * orbitRadius;
    const desiredEye = clean
      ? new pc.Vec3(
        Math.sin(this.forwardTravel * 0.031) * 0.85 + yawOffset,
        Math.sin(this.forwardTravel * 0.047) * 0.48 + pitchOffset,
        -this.forwardTravel + 7.5
      )
      : new pc.Vec3(
        Math.sin(this.yaw) * cp * this.distance,
        Math.sin(this.pitch) * this.distance + Math.sin(this.forwardTravel * 0.15) * 2.5,
        Math.cos(this.yaw) * cp * this.distance - this.forwardTravel
      );
    desiredEye.x += cinematic * Math.sin(this.forwardTravel * 0.043) * (2.2 + (this.params.eventHorizon ?? 0) * 5) * noiseAmount;
    desiredEye.y += cinematic * Math.sin(this.forwardTravel * 0.071) * (1.4 + (this.params.harmonicConvergence ?? 0) * 2) * noiseAmount;
    const target = clean
      ? new pc.Vec3(
        Math.sin(this.forwardTravel * 0.025) * 0.65 - yawOffset * 0.34,
        Math.cos(this.forwardTravel * 0.029) * 0.4 - pitchOffset * 0.34,
        -this.forwardTravel - (46 + Math.log2(Math.max(1, this.speedMultiplier)) * 18)
      )
      : new pc.Vec3(
        Math.sin(this.forwardTravel * 0.11) * 2.5 * noiseAmount,
        Math.cos(this.forwardTravel * 0.13) * 1.4 * noiseAmount,
        -this.forwardTravel - 13
      );
    if (encounterInfluence > 0.02 && this.params.encounterAim) {
      const aim = this.params.encounterAim;
      const aimBlend = Math.min(0.58, encounterInfluence * 0.42);
      target.x = target.x * (1 - aimBlend) + aim[0] * aimBlend;
      target.y = target.y * (1 - aimBlend) + aim[1] * aimBlend;
      target.z = target.z * (1 - aimBlend) + aim[2] * aimBlend;
    }
    const current = this.entity.getPosition();
    const inertia = 1 - Math.pow(0.0008, Math.max(0.001, dt));
    current.lerp(current, desiredEye, inertia);
    this.entity.setPosition(current);
    this.entity.lookAt(target);
    this.entity.rotateLocal(0, 0, this.bank);
    const speedFov = Math.min(16, Math.log2(Math.max(1, this.speedMultiplier)) * 4.5);
    this.entity.camera.fov = 74 - speedFov - encounterInfluence * 4 + cinematic * Math.sin(this.forwardTravel * 0.09) * 3.2 * this.params.fovBreathing * noiseAmount + audioPulse * 4 * noiseAmount + (this.params.eventHorizon ?? 0) * 9 * noiseAmount;
  }

  get position() {
    return this.entity.getPosition();
  }

  integrateRotation(dt) {
    const step = Math.min(0.05, Math.max(0.001, dt));
    const drag = this.params.appMode === 'sound-board' ? 0.045 : 0.08;
    this.yaw += this.yawVelocity * step * 60;
    this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch + this.pitchVelocity * step * 60));
    const damping = Math.pow(drag, step * 60);
    this.yawVelocity *= damping;
    this.pitchVelocity *= damping;
  }

  updateBoardCamera(dt) {
    const audioPulse = this.params.audioLevel ?? 0;
    this.params.zoomDepth += ((this.params.targetZoomDepth ?? 0) - (this.params.zoomDepth ?? 0)) * (1 - Math.pow(0.003, Math.max(0.001, dt)));
    const depth = this.params.zoomDepth;
    const rings = this.params.ringInstances ?? [];
    const focusRing = rings[this.params.focusRingIndex ?? 0] ?? rings.find((ring) => (ring.activity ?? 0) > 0.05) ?? { center: [0, 0, 0], family: 0 };
    const songFocus = this.songObjectFocus();
    const focusCenter = songFocus?.center ?? new pc.Vec3(focusRing.center?.[0] ?? 0, focusRing.center?.[1] ?? 0, focusRing.center?.[2] ?? 0);
    const state = depth < 0.2 ? 'outside' : depth < 0.88 ? 'free' : 'first';
    this.params.cameraState = state;
    this.params.viewDepth = depth;
    if (this.params.jumpActive && this.params.jumpTarget) {
      this.params.jumpProgress = Math.min(1, (this.params.jumpProgress ?? 0) + dt * 0.55);
      if (this.params.jumpProgress >= 1) this.params.jumpActive = false;
    } else {
      this.params.jumpProgress = Math.max(0, (this.params.jumpProgress ?? 0) - dt * 0.8);
    }
    const jumpBlend = this.params.jumpActive ? Math.sin((this.params.jumpProgress ?? 0) * Math.PI) : 0;
    const outsideTravel = smoothstep(0.14, 0.24, depth) * (1 - smoothstep(0.3, 0.42, depth));
    const insideTravel = smoothstep(0.74, 0.86, depth) * (1 - smoothstep(0.92, 1, depth));
    this.params.travelBlend = Math.max(jumpBlend, outsideTravel, insideTravel);
    this.params.insideBlend = smoothstep(0.84, 1, depth);
    this.params.travelProgress = smoothstep(0.2, 0.88, depth);
    this.params.viewLabel = state === 'outside' ? 'OUTSIDE OBSERVER' : state === 'free' ? 'FREE EXPLORATION' : 'FIRST PERSON';
    const jumpTarget = this.params.jumpTarget ? new pc.Vec3(this.params.jumpTarget[0], this.params.jumpTarget[1], this.params.jumpTarget[2]) : null;
    this.params.transitionAnchor = jumpTarget ? [jumpTarget.x, jumpTarget.y, jumpTarget.z] : [focusCenter.x, focusCenter.y, focusCenter.z];
    this.params.focusNoteFamily = focusRing.family ?? this.params.focusNoteFamily ?? 0;
    this.params.simSpeed += ((this.params.targetSimSpeed ?? 1) - (this.params.simSpeed ?? 1)) * (1 - Math.pow(0.002, Math.max(0.001, dt)));
    this.pan.lerp(this.pan, this.targetPan, 1 - Math.pow(0.001, Math.max(0.001, dt)));
    const current = this.entity.getPosition();
    const cp = Math.cos(this.pitch);
    const grownRadius = this.params.primaryMode === 'demo' && this.params.almightyWaveformMode
      ? Math.max(36, (songFocus?.radius ?? this.params.songUniverseRadius ?? 42) * (1.25 + (this.params.demoBuildProgress ?? 0) * 0.35))
      : this.params.primaryMode === 'piano' && songFocus
        ? Math.max(34, songFocus.radius * 1.18)
        : 96 * (this.params.universeScale ?? 1);
    const sphereRadius = Math.max(this.params.primaryMode === 'demo' ? 48 : this.params.primaryMode === 'piano' ? 42 : 115, grownRadius);
    let desiredEye;
    let lookTarget;
    if (state === 'outside') {
      const d = sphereRadius * (this.params.primaryMode === 'demo' ? 2.05 : 2.55 - depth * 1.35);
      desiredEye = new pc.Vec3(Math.sin(this.yaw) * cp * d, Math.sin(this.pitch) * d * 0.85, Math.cos(this.yaw) * cp * d);
      lookTarget = new pc.Vec3(0, 0, 0);
      this.entity.camera.fov = this.params.primaryMode === 'demo' ? 44 : 38;
    } else if (state === 'free') {
      const targetFree = (jumpTarget ? jumpTarget.clone().lerp(this.freePos, jumpTarget, Math.min(1, (this.params.jumpProgress ?? 0) * 0.9)) : focusCenter.clone()).add(this.pan);
      this.freePos.lerp(this.freePos, targetFree, 1 - Math.pow(0.01, Math.max(0.001, dt)));
      const freeT = smoothstep(0.2, 0.88, depth);
      const d = sphereRadius * (0.62 - freeT * 0.54);
      desiredEye = new pc.Vec3(
        this.freePos.x + Math.sin(this.yaw) * cp * d,
        this.freePos.y + Math.sin(this.pitch) * d,
        this.freePos.z + Math.cos(this.yaw) * cp * d
      );
      lookTarget = this.freePos.clone().lerp(this.freePos, focusCenter, 0.62);
      this.entity.camera.fov = 62 + (this.params.travelBlend ?? 0) * 6;
    } else {
      const anchor = jumpTarget ?? (focusCenter.length() > 0.001 ? focusCenter : new pc.Vec3(Math.sin(this.yaw) * 14, 0, Math.cos(this.yaw) * 14));
      desiredEye = anchor.clone().add(new pc.Vec3(Math.sin(this.yaw) * 2.2, Math.sin(this.pitch) * 2.2, Math.cos(this.yaw) * 2.2));
      lookTarget = desiredEye.clone().add(new pc.Vec3(Math.sin(this.yaw) * Math.cos(this.pitch) * 24, Math.sin(this.pitch) * 24, Math.cos(this.yaw) * Math.cos(this.pitch) * 24));
      this.entity.camera.fov = 72 + audioPulse * 4;
    }
    const inertia = 1 - Math.pow(0.0008, Math.max(0.001, dt));
    current.lerp(current, desiredEye, inertia);
    this.entity.setPosition(current);
    this.entity.lookAt(lookTarget);
    this.params.cameraPosition = [current.x, current.y, current.z];
    const fx = lookTarget.x - current.x;
    const fy = lookTarget.y - current.y;
    const fz = lookTarget.z - current.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    const forward = [fx / fl, fy / fl, fz / fl];
    const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0]
    ];
    this.params.cameraForward = forward;
    this.params.cameraRight = right;
    this.params.cameraUp = up;
    this.forwardTravel = 0;
    this.params.speedMultiplier = 1;
    this.params.tunnelTightness = 1;
    this.params.cameraYaw = this.yaw;
    this.params.cameraPitch = this.pitch;
    this.params.dragging = this.dragging;
    this.params.cameraDistance = current.clone().sub(lookTarget).length();
  }

  selectRingAt(clientX, clientY, jump = false) {
    const rings = this.params.ringInstances ?? [];
    if (!rings.length || !this.entity.camera?.worldToScreen) return;
    const rect = this.app.graphicsDevice.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const width = this.app.graphicsDevice.width;
    const height = this.app.graphicsDevice.height;
    let best = -1;
    let bestScore = Infinity;
    const screen = new pc.Vec3();
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const c = ring.center ?? [0, 0, 0];
      this.entity.camera.worldToScreen(new pc.Vec3(c[0], c[1], c[2]), width, height, screen);
      if (screen.z < 0) continue;
      const dx = screen.x - x;
      const dy = screen.y - y;
      const radius = Math.max(18, Math.min(90, (ring.radius ?? 5) * 160 / Math.max(40, screen.z)));
      const score = Math.hypot(dx, dy) - radius - (ring.activity ?? 0) * 24;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0 || bestScore > 72) return;
    this.params.selectedRingIndex = best;
    this.params.selectedTarget = rings[best]?.center ? [...rings[best].center] : null;
    this.params.focusRingIndex = best;
    this.params.focusNoteFamily = rings[best]?.family ?? 0;
    if (jump) this.jumpToSelectedRing();
  }

  jumpToSelectedRing() {
    const rings = this.params.ringInstances ?? [];
    const index = this.params.selectedRingIndex >= 0 ? this.params.selectedRingIndex : this.params.focusRingIndex ?? 0;
    const ring = rings[index];
    if (!ring?.center) return;
    this.params.focusRingIndex = index;
    this.params.focusNoteFamily = ring.family ?? 0;
    this.params.jumpTarget = [...ring.center];
    this.params.selectedTarget = [...ring.center];
    this.params.jumpProgress = 0;
    this.params.jumpActive = true;
    this.params.targetZoomDepth = 1;
  }

  songObjectFocus() {
    const objects = this.params.primaryMode === 'demo' || this.params.primaryMode === 'piano' ? (this.params.songObjects ?? []) : [];
    if (!objects.length) return null;
    let weightSum = 0;
    const center = new pc.Vec3();
    for (const object of objects) {
      const age = Math.min(1, (object.age ?? 0) / 8);
      const weight = (0.25 + (object.energy ?? 0) + (object.strength ?? 0) * 0.6 + age * 0.45) * (object.kind === 'origin-star' ? 0.35 : 1);
      center.x += (object.position?.[0] ?? 0) * weight;
      center.y += (object.position?.[1] ?? 0) * weight;
      center.z += (object.position?.[2] ?? 0) * weight;
      weightSum += weight;
    }
    if (weightSum <= 0) return null;
    center.mulScalar(1 / weightSum);
    let radius = 18;
    for (const object of objects) {
      const dx = (object.position?.[0] ?? 0) - center.x;
      const dy = (object.position?.[1] ?? 0) - center.y;
      const dz = (object.position?.[2] ?? 0) - center.z;
      radius = Math.max(radius, Math.hypot(dx, dy, dz) + (object.scale ?? 4) * 2.4);
    }
    return { center, radius };
  }

  bridgePoint(nodes, barycenter, focusCenter, t) {
    if (!nodes.length) return focusCenter;
    const focus = nodes.find((node) => node.index === this.params.focusNodeIndex) ?? nodes[0];
    const source = nodes.find((node) => node.index !== focus.index) ?? { center: [barycenter.x, barycenter.y, barycenter.z] };
    const a = new pc.Vec3(source.center[0], source.center[1], source.center[2]);
    const b = focusCenter.clone();
    const p = new pc.Vec3().lerp(a, b, t);
    const bow = Math.sin(t * Math.PI);
    p.x += Math.sin(t * Math.PI * 2 + focus.index) * bow * 8;
    p.y += bow * (8 + focus.index * 2);
    p.z += Math.cos(t * Math.PI * 2 + focus.index) * bow * 10;
    return p;
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
