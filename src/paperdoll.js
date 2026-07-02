import * as THREE from 'three';
import { ARMOR_TIERS } from './items.js';

// Live 3D character preview in the inventory screen. The head (and a little
// of the body) turns to look at your cursor, Minecraft-style, and equipped
// armor pieces render on the model.

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c9987a'; g.fillRect(0, 0, 64, 64);          // skin
  g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, 64, 16);          // hair
  g.fillRect(0, 16, 6, 8); g.fillRect(58, 16, 6, 8);
  g.fillStyle = '#fff';                                        // eyes
  g.fillRect(14, 26, 12, 8); g.fillRect(38, 26, 12, 8);
  g.fillStyle = '#2e6b4f';
  g.fillRect(20, 28, 6, 6); g.fillRect(38, 28, 6, 6);
  g.fillStyle = '#8a5c46'; g.fillRect(29, 36, 6, 6);          // nose
  g.fillStyle = '#6e3f33'; g.fillRect(22, 48, 20, 4);         // mouth
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Paperdoll {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(canvas.width, canvas.height, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, canvas.width / canvas.height, 0.1, 20);
    this.camera.position.set(0, 1.05, 3.1);
    this.camera.lookAt(0, 0.95, 0);

    const key = new THREE.DirectionalLight(0xfff2dd, 1.6);
    key.position.set(1.6, 2.4, 2.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fd4ff, 0.9);
    rim.position.set(-2, 1.5, -2);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x404550, 1.2));

    this._buildCharacter();

    this.targetYaw = 0;
    this.targetPitch = 0;
    this.headYaw = 0;
    this.headPitch = 0;
    this.time = 0;
  }

  _buildCharacter() {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const skin = new THREE.MeshStandardMaterial({ color: 0xc9987a, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 1 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2c3240, roughness: 1 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 });

    // head with painted face on -z
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 1.5;
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.9 });
    const headMats = [skin, skin, skin, skin, faceMat, skin]; // face on +z, toward the camera
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMats);
    head.position.y = 0.25;
    this.headPivot.add(head);
    this.root.add(this.headPivot);

    // body pivot lets the torso lag behind the head turn
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), shirt);
    torso.position.y = 1.12;
    this.bodyPivot.add(torso);

    this.armPivots = [];
    for (const side of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(side * 0.31, 1.44, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), skin);
      arm.position.y = -0.32;
      p.add(arm);
      this.bodyPivot.add(p);
      this.armPivots.push(p);
    }

    this.legPivots = [];
    for (const side of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(side * 0.13, 0.75, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.2), pants);
      leg.position.y = -0.34;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.26), shoes);
      shoe.position.set(0, -0.65, 0.02);
      p.add(leg, shoe);
      this.root.add(p);
      this.legPivots.push(p);
    }

    // ---- armor overlays (hidden until equipped) ----
    this.armorMeshes = { helmet: [], chest: [], legs: [], boots: [] };
    const overlay = (parent, geo, x, y, z, slot) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: 0.65, roughness: 0.35,
      }));
      m.position.set(x, y, z);
      m.visible = false;
      parent.add(m);
      this.armorMeshes[slot].push(m);
      return m;
    };

    overlay(this.headPivot, new THREE.BoxGeometry(0.58, 0.34, 0.58), 0, 0.36, 0, 'helmet');
    overlay(this.headPivot, new THREE.BoxGeometry(0.6, 0.12, 0.6), 0, 0.2, 0, 'helmet');
    overlay(this.bodyPivot, new THREE.BoxGeometry(0.58, 0.62, 0.32), 0, 1.16, 0, 'chest');
    overlay(this.armPivots[0], new THREE.BoxGeometry(0.18, 0.24, 0.18), 0, -0.08, 0, 'chest'); // pauldrons
    overlay(this.armPivots[1], new THREE.BoxGeometry(0.18, 0.24, 0.18), 0, -0.08, 0, 'chest');
    overlay(this.legPivots[0], new THREE.BoxGeometry(0.24, 0.42, 0.24), 0, -0.22, 0, 'legs');
    overlay(this.legPivots[1], new THREE.BoxGeometry(0.24, 0.42, 0.24), 0, -0.22, 0, 'legs');
    overlay(this.legPivots[0], new THREE.BoxGeometry(0.26, 0.16, 0.3), 0, -0.63, -0.02, 'boots');
    overlay(this.legPivots[1], new THREE.BoxGeometry(0.26, 0.16, 0.3), 0, -0.63, -0.02, 'boots');
  }

  setArmor(equipped) {
    for (const slot of ['helmet', 'chest', 'legs', 'boots']) {
      const item = equipped[slot];
      for (const m of this.armorMeshes[slot]) {
        m.visible = !!item;
        if (item) m.material.color.setHex(ARMOR_TIERS[item.tier].color);
      }
    }
  }

  // cursorX/Y in viewport px; the head looks toward the cursor.
  onCursor(cursorX, cursorY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.28; // roughly the head's screen height
    const dx = (cursorX - cx) / window.innerWidth;
    const dy = (cursorY - cy) / window.innerHeight;
    this.targetYaw = THREE.MathUtils.clamp(dx * 4.2, -1.1, 1.1);
    this.targetPitch = THREE.MathUtils.clamp(dy * 3.4, -0.7, 0.85);
  }

  update(dt) {
    this.time += dt;
    const k = 1 - Math.exp(-10 * dt);
    this.headYaw += (this.targetYaw - this.headYaw) * k;
    this.headPitch += (this.targetPitch - this.headPitch) * k;

    // Minecraft feel: head does most of the turn, body follows a third of it
    this.headPivot.rotation.y = this.headYaw * 0.75;
    this.headPivot.rotation.x = this.headPitch;
    this.bodyPivot.rotation.y = this.headYaw * 0.28;
    this.root.rotation.y = this.headYaw * 0.06;

    // idle breathing + tiny arm sway
    const b = Math.sin(this.time * 1.7) * 0.012;
    this.bodyPivot.position.y = b;
    this.headPivot.position.y = 1.5 + b;
    this.armPivots[0].rotation.x = Math.sin(this.time * 1.3) * 0.05;
    this.armPivots[1].rotation.x = Math.sin(this.time * 1.3 + 2) * 0.05;
    this.armPivots[0].rotation.z = 0.05;
    this.armPivots[1].rotation.z = -0.05;

    this.renderer.render(this.scene, this.camera);
  }
}
