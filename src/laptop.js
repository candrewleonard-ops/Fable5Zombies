import * as THREE from 'three';

// The Wifi Radio: a placeable set — desk + laptop + boombox + a radio tower
// 3× the desk's height. Pressing F at the desk opens a REAL browser panel
// (iframe) on the laptop: YouTube embeds play right inside the game. Walk
// away while a video plays and the SAME panel shrinks to a picture-in-picture
// player in the top-right corner (no reload — the iframe never re-parents),
// tucked under the HUD so it blocks nothing.

export function buildRadioSetModels() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e24, metalness: 0.5, roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0c1018, emissive: 0x3a6aff, emissiveIntensity: 0.7, roughness: 0.2 });
  // desk
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.9), wood);
  top.position.y = 0.78;
  top.castShadow = true;
  g.add(top);
  for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.78, 0.09), dark);
    leg.position.set(x, 0.39, z);
    g.add(leg);
  }
  // laptop
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.36), dark);
  base.position.set(-0.3, 0.84, 0);
  g.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.025), dark);
  lid.position.set(-0.3, 1.0, -0.17);
  lid.rotation.x = -0.25;
  g.add(lid);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), screenMat);
  screen.position.set(-0.3, 1.0, -0.155);
  screen.rotation.x = -0.25;
  g.add(screen);
  // boombox with ports
  const bb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.24), dark);
  bb.position.set(0.5, 0.94, 0);
  g.add(bb);
  for (const s of [-1, 1]) {
    const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0x30343c, metalness: 0.6, roughness: 0.4 }));
    spk.rotation.x = Math.PI / 2;
    spk.position.set(0.5 + s * 0.18, 0.94, 0.125);
    g.add(spk);
  }
  for (let i = 0; i < 4; i++) { // ports strip
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
    port.position.set(0.36 + i * 0.09, 0.82, 0.125);
    g.add(port);
  }
  // radio tower — 3× the desktop's height (~0.85m → 2.6m lattice)
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x8a2c1c, metalness: 0.6, roughness: 0.5 });
  const tower = new THREE.Group();
  const H = 2.6;
  for (const [sx, sz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
    const legT = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, H, 6), towerMat);
    legT.position.set(sx * (1 - 0.4), H / 2, sz * (1 - 0.4));
    legT.rotation.x = sz * 0.12;
    legT.rotation.z = -sx * 0.12;
    tower.add(legT);
  }
  for (let i = 1; i <= 4; i++) {
    const w = 0.34 * (1 - i * 0.18);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, w), towerMat);
    ring.position.y = (H / 5) * i;
    tower.add(ring);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xff2020, emissiveIntensity: 2.4 }));
  beacon.position.y = H + 0.03;
  tower.add(beacon);
  tower.position.set(1.35, 0, -0.2);
  g.add(tower);
  g.userData.beacon = beacon;
  return g;
}

function toEmbed(input) {
  const s = input.trim();
  if (!s) return null;
  // full youtube URLs → embed
  const watch = s.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{6,})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}?autoplay=1`;
  const shorts = s.match(/youtube\.com\/shorts\/([\w-]{6,})/);
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}?autoplay=1`;
  if (/^https?:\/\//.test(s)) return s; // any other URL — try it raw
  if (/^[\w-]{8,14}$/.test(s)) return `https://www.youtube.com/embed/${s}?autoplay=1`; // bare video id
  // otherwise treat as a search — YouTube search can't be embedded, so use
  // the "videoseries" trick via results is unavailable; fall back to a
  // no-cookie search results page attempt
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(s)}`;
}

const QUICK = [
  ['lofi radio', 'jfKfPfyJRdk'],
  ['synthwave', '4xDzrJKXOOY'],
  ['jazz', 'Dx5qFachd3A'],
];

export class Laptop {
  constructor() {
    this.box = document.createElement('div');
    this.box.id = 'browserBox';
    this.box.className = 'hiddenBrowser';
    this.box.innerHTML = `
      <div class="bb-bar">
        <span class="bb-title">📻 WIFI RADIO</span>
        <input id="bb-url" placeholder="Paste a YouTube link / video id — Enter to play" spellcheck="false">
        <span class="bb-quick">${QUICK.map(([n, id]) => `<button data-vid="${id}">${n}</button>`).join('')}</span>
        <button id="bb-close">✕</button>
      </div>
      <div class="bb-frame"><iframe id="bb-iframe" src="about:blank" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    document.body.appendChild(this.box);
    this.iframe = this.box.querySelector('#bb-iframe');
    this.urlEl = this.box.querySelector('#bb-url');
    this.playing = false;
    this.mode = 'hidden'; // hidden | full | pip
    this.onClose = null;

    this.urlEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const url = toEmbed(this.urlEl.value);
        if (url) { this.iframe.src = url; this.playing = true; }
      }
    });
    this.box.querySelector('.bb-quick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-vid]');
      if (!b) return;
      this.iframe.src = `https://www.youtube.com/embed/${b.dataset.vid}?autoplay=1`;
      this.playing = true;
    });
    this.box.querySelector('#bb-close').addEventListener('click', () => this.close());
  }

  get isOpen() { return this.mode === 'full'; }

  open() {
    this.mode = 'full';
    this.box.className = 'fullBrowser';
    if (!this.playing) setTimeout(() => this.urlEl.focus(), 50);
  }

  // walking away: keep the video alive in a corner PiP (same iframe node —
  // no reparenting, so playback never resets)
  close() {
    if (this.playing && this.iframe.src !== 'about:blank') {
      this.mode = 'pip';
      this.box.className = 'pipBrowser';
    } else {
      this.mode = 'hidden';
      this.box.className = 'hiddenBrowser';
    }
    if (this.onClose) this.onClose();
  }

  stop() {
    this.iframe.src = 'about:blank';
    this.playing = false;
    this.mode = 'hidden';
    this.box.className = 'hiddenBrowser';
  }
}
