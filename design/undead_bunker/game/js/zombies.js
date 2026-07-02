// Procedural zombie model factory + AI
window.G = window.G || {};
(() => {
  const SKINS = [0x8a9a7b, 0x96a186, 0x7d8a6f, 0xa8a28c, 0x8f9c8f];
  const SHIRTS = [0x4a4438, 0x3d3a33, 0x52493a, 0x37413b, 0x4d4032];
  const PANTS = [0x33302b, 0x3a352c, 0x2c2c30, 0x403a2e];

  function makeBody() {
    const skin = new THREE.MeshStandardMaterial({ color: SKINS[(Math.random() * SKINS.length) | 0], roughness: 0.9 });
    const gore = new THREE.MeshStandardMaterial({ color: 0x4a0d08, roughness: 0.85 });
    const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[(Math.random() * SHIRTS.length) | 0], roughness: 0.95 });
    const pants = new THREE.MeshStandardMaterial({ color: PANTS[(Math.random() * PANTS.length) | 0], roughness: 0.95 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x221100, emissive: 0xffb340, emissiveIntensity: 1.6 });

    const root = new THREE.Group();
    const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);

    const torso = new THREE.Group(); hips.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.24), shirt); chest.position.y = 0.32; torso.add(chest);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.22), skin); belly.position.y = 0.02; torso.add(belly);
    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.02), gore); wound.position.set(0.08, 0.3, 0.125); torso.add(wound);

    const neck = new THREE.Group(); neck.position.y = 0.62; torso.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.26), skin); head.position.y = 0.16; neck.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), skin); jaw.position.set(0, 0.02, 0.02); neck.add(jaw);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat); eyeL.position.set(-0.06, 0.19, 0.13); neck.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.06; neck.add(eyeR);
    const headGore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), gore); headGore.position.set(-0.07, 0.2, 0.132); neck.add(headGore);

    function arm(side) {
      const sh = new THREE.Group(); sh.position.set(0.28 * side, 0.52, 0); torso.add(sh);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.13), shirt); upper.position.y = -0.16; sh.add(upper);
      const el = new THREE.Group(); el.position.y = -0.33; sh.add(el);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.11), skin); fore.position.y = -0.15; el.add(fore);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.12), skin); hand.position.y = -0.34; el.add(hand);
      return { sh, el, meshes: [upper, fore, hand] };
    }
    function leg(side) {
      const hip = new THREE.Group(); hip.position.set(0.12 * side, -0.02, 0); hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.17), pants); thigh.position.y = -0.22; hip.add(thigh);
      const kn = new THREE.Group(); kn.position.y = -0.44; hip.add(kn);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.14), pants); shin.position.y = -0.2; kn.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.24), new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.9 })); boot.position.set(0, -0.42, 0.04); kn.add(boot);
      return { hip, kn, meshes: [thigh, shin, boot] };
    }
    const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);

    const parts = { root, hips, torso, neck, armL, armR, legL, legR };
    const hitMeshes = [];
    [[head, 'head'], [jaw, 'head'], [chest, 'body'], [belly, 'body'],
     ...armL.meshes.map(m => [m, 'limb']), ...armR.meshes.map(m => [m, 'limb']),
     ...legL.meshes.map(m => [m, 'limb']), ...legR.meshes.map(m => [m, 'limb'])]
      .forEach(([m, part]) => { m.userData.part = part; m.castShadow = true; hitMeshes.push(m); });
    parts.headMeshes = [head, jaw, eyeL, eyeR, headGore];
    return { root, parts, hitMeshes };
  }

  G.makeZombieBody = makeBody;

  let ZID = 0;
  class Zombie {
    constructor(win, opts) {
      const { root, parts, hitMeshes } = makeBody();
      this.id = ++ZID;
      this.mesh = root; this.parts = parts; this.hitMeshes = hitMeshes;
      hitMeshes.forEach(m => m.userData.zombie = this);
      this.win = win;
      this.hp = opts.hp; this.maxHp = opts.hp;
      this.speed = opts.speed;
      this.scale = 0.95 + Math.random() * 0.14;
      root.scale.setScalar(this.scale);
      this.pos = win.spawn.clone();
      this.pos.x += (Math.random() - 0.5) * 1.5; this.pos.z += (Math.random() - 0.5) * 1.5;
      this.state = 'toWindow';
      this.t = Math.random() * 10; // anim clock
      this.tearTimer = 0.8 + Math.random() * 0.8;
      this.attackCd = 0; this.attackAnim = 0;
      this.vaultT = 0; this.deadT = 0;
      this.repathT = 0; this.chain = null;
      this.groanT = 1 + Math.random() * 4;
      this.alive = true;
      this.radius = 0.32;
      root.position.copy(this.pos);
      G.scene.add(root);
    }

    face(tx, tz, dt, rate = 6) {
      const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
      let d = want - this.mesh.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.mesh.rotation.y += d * Math.min(1, dt * rate);
    }

    stepToward(tx, tz, dt, spd) {
      let dx = tx - this.pos.x, dz = tz - this.pos.z;
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      // separation
      for (const o of G.zombies) {
        if (o === this || !o.alive || o.state === 'dead') continue;
        if (Math.abs(o.pos.y - this.pos.y) > 1.5) continue;
        const sx = this.pos.x - o.pos.x, sz = this.pos.z - o.pos.z;
        const d2 = sx * sx + sz * sz;
        if (d2 < 0.45 && d2 > 0.0001) { const d = Math.sqrt(d2); dx += (sx / d) * 0.55; dz += (sz / d) * 0.55; }
      }
      const n = Math.hypot(dx, dz) || 1;
      G.moveWithCollision(this.pos, (dx / n) * spd * dt, (dz / n) * spd * dt, this.radius, this.state !== 'toWindow' && this.state !== 'tearing');
      this.face(this.pos.x + dx, this.pos.z + dz, dt);
      return len;
    }

    walkAnim(dt, spd) {
      this.t += dt * (2.2 + spd * 2.2);
      const s = Math.sin(this.t), c = Math.cos(this.t);
      const p = this.parts, sw = 0.55;
      p.legL.hip.rotation.x = s * sw; p.legR.hip.rotation.x = -s * sw;
      p.legL.kn.rotation.x = Math.max(0, -c) * 0.9; p.legR.kn.rotation.x = Math.max(0, c) * 0.9;
      p.hips.position.y = 0.92 + Math.abs(c) * 0.03;
      p.torso.rotation.x = 0.22 + s * 0.03; // hunched shamble
      p.torso.rotation.z = Math.sin(this.t * 0.5) * 0.06;
      p.neck.rotation.x = -0.15; p.neck.rotation.z = Math.sin(this.t * 0.3 + this.id) * 0.12;
    }
    armsReach(amt, dt) {
      const p = this.parts, k = Math.min(1, dt * 5);
      const tgt = -1.35 * amt - 0.25;
      p.armL.sh.rotation.x += (tgt - p.armL.sh.rotation.x) * k;
      p.armR.sh.rotation.x += (tgt + Math.sin(this.t * 1.7) * 0.1 * amt - p.armR.sh.rotation.x) * k;
      p.armL.el.rotation.x += (-0.25 * (1 - amt) - p.armL.el.rotation.x) * k;
      p.armR.el.rotation.x += (-0.25 * (1 - amt) - p.armR.el.rotation.x) * k;
    }

    update(dt) {
      if (!this.alive) return;
      const P = G.player;
      if (this.state === 'dead') {
        this.deadT += dt;
        const k = Math.min(1, this.deadT * 2.4);
        this.mesh.rotation.x = -Math.PI / 2 * k * (this.deadDir || 1);
        this.parts.hips.position.y = 0.92 - k * 0.55;
        if (this.deadT > 3.2) { this.mesh.position.y -= dt * 0.35; }
        if (this.deadT > 4.5) this.dispose();
        return;
      }

      this.groanT -= dt;
      if (this.groanT < 0) { this.groanT = 3 + Math.random() * 6; G.audio.groan(G.volAt(this.pos)); }

      const distP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);

      if (this.state === 'toWindow') {
        const o = this.win.outer;
        const d = this.stepToward(o.x, o.z, dt, this.speed * 0.9);
        this.walkAnim(dt, this.speed); this.armsReach(0, dt);
        if (d < 0.55) this.state = this.win.boards.filter(b => b.on).length > 0 ? 'tearing' : 'vault0';
      } else if (this.state === 'tearing') {
        this.face(this.win.inner.x, this.win.inner.z, dt);
        this.t += dt * 6;
        const p = this.parts;
        p.armL.sh.rotation.x = -1.6 + Math.sin(this.t) * 0.5;
        p.armR.sh.rotation.x = -1.6 + Math.sin(this.t + Math.PI) * 0.5;
        p.torso.rotation.x = 0.15 + Math.sin(this.t) * 0.06;
        this.tearTimer -= dt;
        if (this.tearTimer <= 0) {
          this.tearTimer = 1.4 + Math.random() * 0.9;
          const b = this.win.boards.filter(b => b.on);
          if (b.length) { G.ripBoard(this.win, b[b.length - 1]); }
          else this.state = 'vault0';
        }
        if (this.win.boards.filter(b => b.on).length === 0 && Math.random() < dt * 2) this.state = 'vault0';
      } else if (this.state === 'vault0') {
        this.vaultFrom = this.pos.clone(); this.vaultT = 0; this.state = 'vault';
        G.audio.vaultThud();
      } else if (this.state === 'vault') {
        this.vaultT += dt / 1.15;
        const k = Math.min(1, this.vaultT), inn = this.win.inner;
        this.pos.x = this.vaultFrom.x + (inn.x - this.vaultFrom.x) * k;
        this.pos.z = this.vaultFrom.z + (inn.z - this.vaultFrom.z) * k;
        this.pos.y = this.vaultFrom.y + (this.win.floorY - this.vaultFrom.y) * k + Math.sin(k * Math.PI) * 0.6;
        this.parts.torso.rotation.x = 0.9 * Math.sin(k * Math.PI);
        this.parts.legL.hip.rotation.x = -1.2 * Math.sin(k * Math.PI);
        this.parts.legR.hip.rotation.x = -0.8 * Math.sin(k * Math.PI);
        this.armsReach(1, dt);
        this.face(inn.x, inn.z, dt, 10);
        if (k >= 1) { this.state = 'hunt'; this.pos.y = this.win.floorY; }
      } else if (this.state === 'hunt') {
        // pathing: same room → direct; else head to portal
        let tx = P.pos.x, tz = P.pos.z;
        this.repathT -= dt;
        if (this.repathT <= 0) {
          this.repathT = 0.5;
          const myRoom = G.roomAt(this.pos), pRoom = G.roomAt(P.pos);
          if (myRoom !== pRoom) {
            const chain = G.pathChain(myRoom, pRoom);
            if (chain) {
              while (chain.length > 1 && Math.hypot(chain[0].x - this.pos.x, chain[0].z - this.pos.z) < 1.2 && Math.abs(chain[0].y - this.pos.y) < 1.2) chain.shift();
              this.chain = chain;
            } else this.chain = null;
          } else this.chain = null;
        }
        if (this.chain && this.chain.length) {
          const wp = this.chain[0];
          tx = wp.x; tz = wp.z;
          if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.8 && Math.abs(wp.y - this.pos.y) < 1.2) {
            this.chain.shift();
            if (!this.chain.length) this.repathT = 0;
          }
        }
        const spd = this.speed * (distP < 3 ? 1.12 : 1);
        this.stepToward(tx, tz, dt, spd);
        this.walkAnim(dt, spd);
        this.armsReach(distP < 4 ? 1 : (this.speed > 2.4 ? 0.8 : 0.15), dt);
        // snap to floor
        const gy = G.groundAt(this.pos.x, this.pos.z, this.pos.y);
        this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 10);
        // attack
        this.attackCd -= dt;
        if (distP < 1.7 && this.attackCd <= 0 && Math.abs(P.pos.y - this.pos.y) < 1.6) {
          this.attackCd = 1.15; this.attackAnim = 0.4;
          G.audio.attackSnarl(G.volAt(this.pos));
          setTimeout(() => {
            if (!this.alive || this.state === 'dead') return;
            const d2 = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
            if (d2 < 2.0) G.damagePlayer(22);
          }, 280);
        }
        if (this.attackAnim > 0) {
          this.attackAnim -= dt;
          const k = this.attackAnim / 0.4;
          this.parts.armR.sh.rotation.x = -1.9;
          this.parts.armR.sh.rotation.z = -1.2 * Math.sin(k * Math.PI);
          this.parts.torso.rotation.y = 0.4 * Math.sin(k * Math.PI);
        } else { this.parts.armR.sh.rotation.z *= 0.9; this.parts.torso.rotation.y *= 0.9; }
      }

      this.mesh.position.copy(this.pos);
    }

    takeDamage(dmg, part, hitPoint) {
      if (!this.alive || this.state === 'dead') return false;
      const mult = part === 'head' ? G.player.curWeapon.headMult : (part === 'limb' ? 0.8 : 1);
      this.hp -= dmg * mult * (G.player.perks.has('deadeye') ? 1.4 : 1);
      G.spawnBlood(hitPoint, part === 'head' ? 14 : 7);
      if (this.hp <= 0) {
        this.die(part === 'head');
        return { killed: true, head: part === 'head' };
      }
      return { killed: false, head: part === 'head' };
    }

    die(headshot) {
      this.state = 'dead'; this.deadT = 0;
      this.deadDir = Math.random() < 0.5 ? 1 : -1;
      if (headshot) { this.parts.headMeshes.forEach(m => m.visible = false); G.spawnBlood(this.mesh.position.clone().add(new THREE.Vector3(0, 1.6 * this.scale, 0)), 24); }
      this.hitMeshes.forEach(m => m.userData.zombie = null);
      G.onZombieKilled(this);
    }

    dispose() {
      this.alive = false;
      G.scene.remove(this.mesh);
      this.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    }
  }

  G.Zombie = Zombie;
})();
