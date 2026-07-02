import * as THREE from 'three';

// Pooled particle + tracer + casing + decal systems. One draw call for all
// particles via a custom point shader with per-particle size/color/alpha.

const MAX_PARTICLES = 900;

const PARTICLE_VERT = `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // ---- particles ----
    this.pCount = MAX_PARTICLES;
    this.pPos = new Float32Array(this.pCount * 3);
    this.pVel = new Float32Array(this.pCount * 3);
    this.pLife = new Float32Array(this.pCount);      // remaining
    this.pMaxLife = new Float32Array(this.pCount);
    this.pGravity = new Float32Array(this.pCount);
    this.pDrag = new Float32Array(this.pCount);
    this.pFloor = new Float32Array(this.pCount);     // y to die/rest at
    this.pCursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.aColor = new THREE.BufferAttribute(new Float32Array(this.pCount * 3), 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(this.pCount), 1);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(this.pCount), 1);
    geo.setAttribute('color', this.aColor);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('alpha', this.aAlpha);

    this.pMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // ---- tracers ----
    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    // ---- shell casings ----
    this.casings = [];
    const casingGeo = new THREE.BoxGeometry(0.02, 0.05, 0.02);
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xc8a742, metalness: 0.9, roughness: 0.35 });
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(casingGeo, casingMat);
      mesh.visible = false;
      scene.add(mesh);
      this.casings.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, floor: 0 });
    }
    this.casingCursor = 0;

    // ---- blood decals ----
    this.decals = [];
    const decalTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      for (let i = 0; i < 18; i++) {
        const r = 4 + Math.random() * 16;
        g.fillStyle = `rgba(${38 + Math.random() * 26 | 0}, 2, 3, ${0.35 + Math.random() * 0.3})`;
        g.beginPath();
        g.arc(64 + (Math.random() - 0.5) * 70, 64 + (Math.random() - 0.5) * 70, r, 0, 7);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
        map: decalTex, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
    this.decalCursor = 0;
  }

  // ---------------- particles ----------------
  _emit(pos, vel, life, color, size, gravity, drag, floor = 0) {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % this.pCount;
    this.pPos[i * 3] = pos.x; this.pPos[i * 3 + 1] = pos.y; this.pPos[i * 3 + 2] = pos.z;
    this.pVel[i * 3] = vel.x; this.pVel[i * 3 + 1] = vel.y; this.pVel[i * 3 + 2] = vel.z;
    this.pLife[i] = life; this.pMaxLife[i] = life;
    this.pGravity[i] = gravity; this.pDrag[i] = drag;
    this.pFloor[i] = floor;
    this.aColor.array[i * 3] = color.r; this.aColor.array[i * 3 + 1] = color.g; this.aColor.array[i * 3 + 2] = color.b;
    this.aSize.array[i] = size;
    this.aAlpha.array[i] = 1;
  }

  blood(pos, dir, count = 14, speed = 5, floor = 0) {
    const c1 = new THREE.Color(0x9e0b0f), c2 = new THREE.Color(0x5c0507);
    for (let i = 0; i < count; i++) {
      const v = dir.clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.1, (Math.random() - 0.5) * 1.6))
        .normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.9));
      this._emit(pos, v, 0.4 + Math.random() * 0.5, Math.random() < 0.5 ? c1 : c2,
        0.05 + Math.random() * 0.09, 14, 1.2, floor);
    }
  }

  gib(pos, floor = 0) { // headshot pop
    const c = new THREE.Color(0xb01216);
    for (let i = 0; i < 34; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.6, (Math.random() - 0.5) * 2)
        .normalize().multiplyScalar(3 + Math.random() * 6);
      this._emit(pos, v, 0.5 + Math.random() * 0.7, c, 0.06 + Math.random() * 0.12, 15, 1.0, floor);
    }
  }

  sparks(pos) { this.sparksColored(pos, 0xffcf7a); }

  sparksColored(pos, colorHex) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < 7; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 1.4, (Math.random() - 0.5))
        .normalize().multiplyScalar(2.5 + Math.random() * 4);
      this._emit(pos, v, 0.15 + Math.random() * 0.25, c, 0.035, 10, 0.5);
    }
  }

  dirtBurst(pos) { // zombie rising from grave
    const c = new THREE.Color(0x4a3a24);
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.4, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 1.4)
        .multiplyScalar(1.6);
      this._emit(pos, v, 0.5 + Math.random() * 0.6, c, 0.06 + Math.random() * 0.1, 9, 1.4);
    }
  }

  smoke(pos, count = 3) {
    const c = new THREE.Color(0x778088);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5);
      this._emit(pos, v, 0.5 + Math.random() * 0.4, c, 0.09 + Math.random() * 0.08, -0.6, 2.0);
    }
  }

  explosion(at, colorHex = 0x9fe8ff, radius = 4) {
    const c = new THREE.Color(colorHex);
    const warm = new THREE.Color(0xfff3c0);
    for (let i = 0; i < 30; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.9, (Math.random() - 0.5))
        .normalize().multiplyScalar(3 + Math.random() * 7);
      this._emit(at, v, 0.4 + Math.random() * 0.5, c, 0.09 + Math.random() * 0.12, 8, 1.5);
    }
    for (let i = 0; i < 20; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5))
        .normalize().multiplyScalar(2 + Math.random() * 5);
      this._emit(at, v, 0.3 + Math.random() * 0.4, warm, 0.07 + Math.random() * 0.1, 10, 2);
    }
    const flash = new THREE.PointLight(colorHex, 30, radius * 3.5, 1.5);
    flash.position.copy(at);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 130);
  }

  // ---------------- tracer ----------------
  tracer(from, to, color = 0xffd27f) {
    const t = this.tracers.find(t => t.life <= 0) || this.tracers[0];
    const arr = t.line.geometry.attributes.position.array;
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.85;
    t.line.visible = true;
    t.life = 0.07;
  }

  // ---------------- casing ----------------
  casing(pos, rightDir, floorY) {
    const c = this.casings[this.casingCursor];
    this.casingCursor = (this.casingCursor + 1) % this.casings.length;
    c.mesh.position.copy(pos);
    c.vel.copy(rightDir).multiplyScalar(1.4 + Math.random())
      .add(new THREE.Vector3(0, 2 + Math.random() * 1.2, 0));
    c.spin.set(Math.random() * 14, Math.random() * 14, Math.random() * 14);
    c.life = 2.2;
    c.floor = floorY;
    c.mesh.visible = true;
  }

  // ---------------- decal ----------------
  bloodDecal(x, z, y = 0.02, scale = 1) {
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    d.mesh.position.set(x, y, z);
    d.mesh.rotation.z = Math.random() * Math.PI * 2;
    const s = (0.7 + Math.random() * 0.7) * scale;
    d.mesh.scale.set(s, s, 1);
    d.mesh.material.opacity = 0.55;
    d.mesh.visible = true;
    d.life = 18;
  }

  // ---------------- damage numbers (DOM) ----------------
  damageNumber(worldPos, amount, crit = false) {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'dmg-num';
    el.textContent = Math.round(amount);
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 30) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 16) + 'px';
    el.style.color = crit ? '#ffd23b' : '#ff8f8f';
    el.style.fontSize = crit ? '24px' : '16px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }

  update(dt) {
    // particles
    for (let i = 0; i < this.pCount; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      const i3 = i * 3;
      this.pVel[i3 + 1] -= this.pGravity[i] * dt;
      const drag = Math.exp(-this.pDrag[i] * dt);
      this.pVel[i3] *= drag; this.pVel[i3 + 1] *= drag; this.pVel[i3 + 2] *= drag;
      this.pPos[i3] += this.pVel[i3] * dt;
      this.pPos[i3 + 1] += this.pVel[i3 + 1] * dt;
      this.pPos[i3 + 2] += this.pVel[i3 + 2] * dt;
      if (this.pPos[i3 + 1] < this.pFloor[i]) { this.pPos[i3 + 1] = this.pFloor[i]; this.pVel[i3 + 1] = 0; }
      this.aAlpha.array[i] = Math.max(0, this.pLife[i] / this.pMaxLife[i]);
      if (this.pLife[i] <= 0) this.aAlpha.array[i] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aSize.needsUpdate = true;

    // tracers
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
        if (t.life <= 0) t.line.visible = false;
      }
    }

    // casings
    for (const c of this.casings) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vel.y -= 16 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      if (c.mesh.position.y < c.floor + 0.03 && c.vel.y < 0) {
        c.mesh.position.y = c.floor + 0.03;
        c.vel.y *= -0.35;
        c.vel.x *= 0.6; c.vel.z *= 0.6;
        c.spin.multiplyScalar(0.5);
      }
      if (c.life <= 0) c.mesh.visible = false;
    }

    // decals
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life < 4) d.mesh.material.opacity = Math.max(0, d.life / 4) * 0.55;
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}
