// Drivable car: original teal sports coupe + arcade driving
window.G = window.G || {};
(() => {
  const T = THREE;
  const paint = new T.MeshStandardMaterial({ color: 0x17858a, metalness: 0.85, roughness: 0.22 });
  const paintD = new T.MeshStandardMaterial({ color: 0x0e5a5e, metalness: 0.8, roughness: 0.3 });
  const glass = new T.MeshStandardMaterial({ color: 0x0a1418, metalness: 0.9, roughness: 0.12 });
  const black = new T.MeshStandardMaterial({ color: 0x101114, metalness: 0.4, roughness: 0.6 });
  const chrome = new T.MeshStandardMaterial({ color: 0xb8bec6, metalness: 1, roughness: 0.18 });
  const tire = new T.MeshStandardMaterial({ color: 0x151517, roughness: 0.95 });
  const headM = new T.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xbfe0ff, emissiveIntensity: 1.4 });
  const tailM = new T.MeshStandardMaterial({ color: 0x3a0508, emissive: 0xff2230, emissiveIntensity: 1.5 });

  function bx(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m;
  }
  // front faces -Z
  G.buildCarModel = () => {
    const g = new T.Group();
    g.add(bx(1.86, 0.42, 4.35, paint, 0, 0.46, 0));                    // main body
    g.add(bx(1.7, 0.16, 1.5, paint, 0, 0.68, -1.25, -0.06));           // hood slope
    g.add(bx(1.78, 0.2, 0.7, paint, 0, 0.72, 1.7, 0.1));               // rear deck
    g.add(bx(1.55, 0.42, 1.9, glass, 0, 0.9, 0.25));                   // canopy
    g.add(bx(1.5, 0.4, 0.5, glass, 0, 0.82, -0.85, -0.55));            // windshield
    g.add(bx(1.5, 0.36, 0.45, glass, 0, 0.84, 1.28, 0.5));             // rear glass
    g.add(bx(1.6, 0.12, 2.0, paint, 0, 1.09, 0.25));                   // roof
    g.add(bx(1.9, 0.18, 4.3, black, 0, 0.22, 0));                      // rocker/underbody
    g.add(bx(1.92, 0.12, 0.5, black, 0, 0.2, -2.05));                  // splitter
    g.add(bx(1.92, 0.14, 0.35, black, 0, 0.24, 2.1));                  // diffuser
    g.add(bx(1.7, 0.06, 0.28, paintD, 0, 0.95, 2.12, 0.15));           // spoiler lip
    g.add(bx(0.55, 0.045, 0.18, headM, -0.6, 0.62, -2.16, 0, 0, 0.06));
    g.add(bx(0.55, 0.045, 0.18, headM, 0.6, 0.62, -2.16, 0, 0, -0.06));
    g.add(bx(1.55, 0.06, 0.1, tailM, 0, 0.68, 2.2));                   // tail light bar
    g.add(bx(0.1, 0.08, 0.28, paintD, -0.98, 0.86, -0.55, 0, 0, 0.3)); // mirrors
    g.add(bx(0.1, 0.08, 0.28, paintD, 0.98, 0.86, -0.55, 0, 0, -0.3));
    g.add(bx(1.2, 0.16, 0.06, black, 0, 0.5, -2.17));                  // front intake
    const wheels = [];
    [[-0.86, -1.42], [0.86, -1.42], [-0.86, 1.45], [0.86, 1.45]].forEach(([x, z]) => {
      const w = new T.Mesh(new T.CylinderGeometry(0.37, 0.37, 0.28, 18), tire);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.37, z); w.castShadow = true; g.add(w); wheels.push(w);
      const hub = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.3, 10), chrome);
      hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.37, z); g.add(hub); wheels.push(hub);
    });
    g.userData.wheels = wheels;
    return g;
  };

  // ---------- driving ----------
  const C = {
    mesh: null, pos: new T.Vector3(), yaw: 0, speed: 0,
    deployed: false, driving: false, fEdge: false, camPos: null,
    headLight: null, thudCd: 0,
  };
  G.CarSys = C;

  document.addEventListener('keydown', e => { if (e.code === 'KeyF') C.fEdge = true; });

  C.deploy = (pos, yaw) => {
    if (!C.mesh) {
      C.mesh = G.buildCarModel();
      G.scene.add(C.mesh);
      C.headLight = new T.SpotLight(0xcfe8ff, 0, 22, 0.5, 0.4, 1.2);
      C.mesh.add(C.headLight); C.headLight.position.set(0, 0.7, -1.8);
      const tgt = new T.Object3D(); tgt.position.set(0, 0.2, -10); C.mesh.add(tgt);
      C.headLight.target = tgt;
    }
    C.pos.copy(pos); C.pos.y = G.groundAt(pos.x, pos.z, pos.y + 0.5);
    C.yaw = yaw; C.speed = 0; C.deployed = true;
    C.mesh.visible = true;
    C.mesh.position.copy(C.pos); C.mesh.rotation.y = C.yaw;
    G.audio.vaultThud();
    G.showMsg('Vehicle deployed');
  };

  C.enter = () => {
    C.driving = true; C.headLight.intensity = 1.6;
    C.camPos = null;
    G.setPrompt(null);
  };
  C.exit = () => {
    C.driving = false; C.headLight.intensity = 0;
    const side = new T.Vector3(Math.cos(C.yaw), 0, -Math.sin(C.yaw)).multiplyScalar(-1.6);
    G.player.pos.set(C.pos.x + side.x, C.pos.y, C.pos.z + side.z);
    G.player.yaw = C.yaw + Math.PI;
  };

  C.update = (dt) => {
    if (!C.deployed) return;
    const fwd = new T.Vector3(-Math.sin(C.yaw), 0, -Math.cos(C.yaw));
    if (C.driving) {
      const k = G.keys;
      const accel = k['KeyW'] ? 13 : 0;
      const brake = k['KeyS'] ? (C.speed > 0.5 ? -18 : -7) : 0;
      C.speed += (accel + brake) * dt;
      C.speed = Math.max(-5.5, Math.min(15, C.speed));
      if (!k['KeyW'] && !k['KeyS']) C.speed *= Math.pow(0.35, dt);
      if (Math.abs(C.speed) < 0.04) C.speed = 0;
      const steer = (k['KeyA'] ? 1 : 0) - (k['KeyD'] ? 1 : 0);
      C.yaw += steer * dt * 1.9 * Math.min(1, Math.abs(C.speed) / 5) * Math.sign(C.speed || 1);

      const before = C.pos.clone();
      G.moveWithCollision(C.pos, fwd.x * C.speed * dt, fwd.z * C.speed * dt, 1.05);
      const moved = C.pos.distanceTo(before);
      const expect = Math.abs(C.speed) * dt;
      C.thudCd -= dt;
      if (expect > 0.02 && moved < expect * 0.4) {           // crashed into something
        if (Math.abs(C.speed) > 5 && C.thudCd <= 0) { G.audio.vaultThud(); G.shake(0.05); C.thudCd = 0.5; }
        C.speed *= Math.pow(0.02, dt);
      }
      const gy = G.groundAt(C.pos.x, C.pos.z, C.pos.y);
      C.pos.y += (gy - C.pos.y) * Math.min(1, dt * 10);

      // run over zombies
      if (Math.abs(C.speed) > 3.5) {
        for (const z of G.zombies) {
          if (!z.alive || z.state === 'dead') continue;
          if (Math.abs(z.pos.y - C.pos.y) > 1.6) continue;
          const hitP = C.pos.clone().addScaledVector(fwd, Math.sign(C.speed) * 1.6);
          if (Math.hypot(z.pos.x - hitP.x, z.pos.z - hitP.z) < 1.5) {
            const res = z.takeDamage(80 + Math.abs(C.speed) * 22, 'body', new T.Vector3(z.pos.x, z.pos.y + 1, z.pos.z));
            if (res) { G.addPoints(10); if (res.killed) G.addPoints(50); }
            G.audio.vaultThud(); C.speed *= 0.82;
          }
        }
      }

      // sync player to car
      G.player.pos.copy(C.pos);
      G.player.lastDamageT = G.player.lastDamageT; // regen unaffected

      // chase cam
      const camTarget = new T.Vector3(C.pos.x - fwd.x * 6.2, C.pos.y + 3.0, C.pos.z - fwd.z * 6.2);
      if (!C.camPos) C.camPos = camTarget.clone();
      C.camPos.lerp(camTarget, Math.min(1, dt * 5));
      // keep cam out of walls: nudge up if inside solid
      G.camera.position.copy(C.camPos);
      G.camera.lookAt(C.pos.x + fwd.x * 2.5, C.pos.y + 0.9, C.pos.z + fwd.z * 2.5);
      G.camera.fov = 72 + Math.abs(C.speed); G.camera.updateProjectionMatrix();

      G.setPrompt(Math.abs(C.speed) < 1 ? '<b>F</b> — Exit vehicle' : null);
      if (C.fEdge && Math.abs(C.speed) < 1) C.exit();

      // wheel spin
      const ws = C.speed * dt * 2.8;
      C.mesh.userData.wheels.forEach(w => w.rotation.x += ws);
    }
    C.mesh.position.copy(C.pos);
    C.mesh.rotation.y = C.yaw;
    C.mesh.rotation.z += ((C.driving ? -((G.keys['KeyA'] ? 1 : 0) - (G.keys['KeyD'] ? 1 : 0)) * Math.min(1, Math.abs(C.speed) / 8) * 0.035 : 0) - C.mesh.rotation.z) * Math.min(1, dt * 6);
    C.fEdge = false;
  };
})();
