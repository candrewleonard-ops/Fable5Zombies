# car.js — Drivable Car ("Riptide Coupe") Digest

Source: `design/undead_bunker/game/js/car.js` (Three.js r128, IIFE writing into `window.G`).
Exports: `G.buildCarModel()` and `G.CarSys` (alias `C`).
External deps (one line): map.js (`G.groundAt`, `G.moveWithCollision`), zombies.js (`G.zombies`, `z.takeDamage`), game.js (`G.scene`, `G.camera`, `G.keys`, `G.addPoints`, `G.shake`, `G.showMsg`, `G.setPrompt`, main loop calls `CarSys.update(dt)`), audio.js (`G.audio.vaultThud`), player.js/inventory (Car Keys hotbar item: LMB calls `C.deploy` 4.6 m ahead of player; F interact calls `C.enter()`).

## Materials (all `THREE.MeshStandardMaterial`)

| name | color | metalness | roughness | emissive | emissiveIntensity |
|---|---|---|---|---|---|
| paint | `0x17858a` | 0.85 | 0.22 | — | — |
| paintD (dark accent) | `0x0e5a5e` | 0.8 | 0.3 | — | — |
| glass | `0x0a1418` | 0.9 | 0.12 | — | — |
| black | `0x101114` | 0.4 | 0.6 | — | — |
| chrome | `0xb8bec6` | 1.0 | 0.18 | — | — |
| tire | `0x151517` | (default) | 0.95 | — | — |
| headM (headlights) | `0xcfe8ff` | — | — | `0xbfe0ff` | 1.4 |
| tailM (tail light) | `0x3a0508` | — | — | `0xff2230` | 1.5 |

## Model construction — `G.buildCarModel()`

Returns a `THREE.Group`. Front faces **−Z**. Helper `bx(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)` = BoxGeometry mesh, `castShadow=true`.

Boxes (w × h × d, material, position (x,y,z), rotation (rx,ry,rz) rad):

| part | size w×h×d | mat | pos | rot |
|---|---|---|---|---|
| main body | 1.86×0.42×4.35 | paint | (0, 0.46, 0) | — |
| hood slope | 1.7×0.16×1.5 | paint | (0, 0.68, −1.25) | rx −0.06 |
| rear deck | 1.78×0.2×0.7 | paint | (0, 0.72, 1.7) | rx 0.1 |
| canopy | 1.55×0.42×1.9 | glass | (0, 0.9, 0.25) | — |
| windshield | 1.5×0.4×0.5 | glass | (0, 0.82, −0.85) | rx −0.55 |
| rear glass | 1.5×0.36×0.45 | glass | (0, 0.84, 1.28) | rx 0.5 |
| roof | 1.6×0.12×2.0 | paint | (0, 1.09, 0.25) | — |
| rocker/underbody | 1.9×0.18×4.3 | black | (0, 0.22, 0) | — |
| splitter | 1.92×0.12×0.5 | black | (0, 0.2, −2.05) | — |
| diffuser | 1.92×0.14×0.35 | black | (0, 0.24, 2.1) | — |
| spoiler lip | 1.7×0.06×0.28 | paintD | (0, 0.95, 2.12) | rx 0.15 |
| headlight L | 0.55×0.045×0.18 | headM | (−0.6, 0.62, −2.16) | rz 0.06 |
| headlight R | 0.55×0.045×0.18 | headM | (0.6, 0.62, −2.16) | rz −0.06 |
| tail light bar | 1.55×0.06×0.1 | tailM | (0, 0.68, 2.2) | — |
| mirror L | 0.1×0.08×0.28 | paintD | (−0.98, 0.86, −0.55) | rz 0.3 |
| mirror R | 0.1×0.08×0.28 | paintD | (0.98, 0.86, −0.55) | rz −0.3 |
| front intake | 1.2×0.16×0.06 | black | (0, 0.5, −2.17) | — |

Wheels — 4 positions `[x,z]`: `[-0.86,-1.42], [0.86,-1.42], [-0.86,1.45], [0.86,1.45]`, each:
- Tire: `CylinderGeometry(0.37, 0.37, 0.28, 18)`, tire mat, `rotation.z = Math.PI/2`, pos `(x, 0.37, z)`, castShadow.
- Hub: `CylinderGeometry(0.19, 0.19, 0.3, 10)`, chrome, `rotation.z = Math.PI/2`, pos `(x, 0.37, z)`.
- Both tire AND hub pushed into `g.userData.wheels` (8 meshes total; all spun by driving code).

## CarSys state (`G.CarSys` / `C`)

```js
{ mesh: null, pos: Vector3, yaw: 0, speed: 0,
  deployed: false, driving: false, fEdge: false, camPos: null,
  headLight: null, thudCd: 0 }
```

Global listener: `keydown` `KeyF` → `C.fEdge = true` (edge flag, cleared at end of every `update` while deployed).

Forward vector everywhere: `fwd = (-sin(yaw), 0, -cos(yaw))`.

## Deploy — `C.deploy(pos, yaw)`

- Lazy-build: first call creates mesh via `G.buildCarModel()`, adds to `G.scene`, creates headlight (below).
- `C.pos.copy(pos); C.pos.y = G.groundAt(pos.x, pos.z, pos.y + 0.5)`.
- `C.yaw = yaw; C.speed = 0; C.deployed = true; mesh.visible = true`; mesh position/rotation.y synced.
- SFX `G.audio.vaultThud()`; `G.showMsg('Vehicle deployed')`.
- Single car; redeploying just moves it. (Caller spawns 4.6 m ahead of the player.)

## Headlight

- `new THREE.SpotLight(0xcfe8ff, 0, 22, 0.5, 0.4, 1.2)` — (color, intensity 0 off, distance 22, angle 0.5 rad, penumbra 0.4, decay 1.2).
- Parented to car mesh at `(0, 0.7, -1.8)`; target = `Object3D` at `(0, 0.2, -10)` also parented to mesh.
- Intensity: `1.6` while driving (set in `enter`), `0` on `exit`.

## Enter / Exit

- `C.enter()`: `driving = true; headLight.intensity = 1.6; camPos = null` (re-seeds chase cam); `G.setPrompt(null)`. Triggered externally by F interact.
- Exit condition (in `update`): prompt `'<b>F</b> — Exit vehicle'` shown only when `|speed| < 1`; `if (C.fEdge && |speed| < 1) C.exit()`.
- `C.exit()`: `driving = false; headLight.intensity = 0`; player placed at driver-side offset:
  ```js
  side = (cos(yaw), 0, -sin(yaw)) * -1.6;
  G.player.pos.set(pos.x + side.x, pos.y, pos.z + side.z);
  G.player.yaw = C.yaw + Math.PI;
  ```

## Physics — `C.update(dt)` (early-return if `!deployed`)

While `driving` (keys from `G.keys`):

| quantity | value / formula |
|---|---|
| accel (W) | `+13` m/s² |
| brake/reverse (S) | `-18` m/s² if `speed > 0.5`, else `-7` m/s² |
| integrate | `speed += (accel + brake) * dt` |
| speed clamp | `speed = max(-5.5, min(15, speed))` (max fwd 15, max reverse −5.5) |
| coast decay (no W/S) | `speed *= Math.pow(0.35, dt)` |
| stop snap | `if (|speed| < 0.04) speed = 0` |
| steer input | `steer = (KeyA ? 1 : 0) - (KeyD ? 1 : 0)` |
| steering | `yaw += steer * dt * 1.9 * Math.min(1, |speed|/5) * Math.sign(speed || 1)` |
| movement | `G.moveWithCollision(C.pos, fwd.x*speed*dt, fwd.z*speed*dt, 1.05)` (radius 1.05) |
| ground follow | `gy = G.groundAt(pos.x, pos.z, pos.y); pos.y += (gy - pos.y) * Math.min(1, dt*10)` |
| wheel spin | `ws = speed * dt * 2.8; wheels.forEach(w => w.rotation.x += ws)` (tires + hubs) |
| player sync | `G.player.pos.copy(C.pos)` every driving frame |

Body roll (runs every frame, even parked — decays to 0):
```js
mesh.rotation.z += ((driving ? -steer * Math.min(1, |speed|/8) * 0.035 : 0) - mesh.rotation.z) * Math.min(1, dt*6);
```
Mesh transform sync at end of update: `mesh.position.copy(pos); mesh.rotation.y = yaw`.

## Crash / impact handling

```js
moved  = pos.distanceTo(posBefore);      // actual displacement this frame
expect = |speed| * dt;
thudCd -= dt;
if (expect > 0.02 && moved < expect * 0.4) {           // crashed into something
  if (|speed| > 5 && thudCd <= 0) { G.audio.vaultThud(); G.shake(0.05); thudCd = 0.5; }
  speed *= Math.pow(0.02, dt);                         // hard bleed-off
}
```
- Thud+shake only above 5 m/s, rate-limited to once per 0.5 s (`thudCd`). Shake amplitude 0.05.

## Zombie run-over

Only when `|speed| > 3.5`. For each `z` of `G.zombies`:
- Skip if `!z.alive || z.state === 'dead'`; skip if `|z.pos.y - C.pos.y| > 1.6` (vertical gate).
- Hit point: `hitP = C.pos + fwd * (Math.sign(speed) * 1.6)` (in front, or behind when reversing).
- Hit test: `Math.hypot(z.pos.x - hitP.x, z.pos.z - hitP.z) < 1.5` (2D radius 1.5).
- Damage (verbatim): `z.takeDamage(80 + Math.abs(C.speed) * 22, 'body', new Vector3(z.pos.x, z.pos.y + 1, z.pos.z))` → 80 + 22·|speed| (max ~410 at 15 m/s).
- If result truthy: `G.addPoints(10)`; if `res.killed`: `G.addPoints(50)`.
- Per hit: `G.audio.vaultThud(); C.speed *= 0.82` (momentum loss per zombie).

## Chase camera (while driving)

- Target: `camTarget = (pos.x - fwd.x*6.2, pos.y + 3.0, pos.z - fwd.z*6.2)` — 6.2 m behind, 3.0 m up.
- Seed on enter (`camPos = null` → clone of target), then `camPos.lerp(camTarget, Math.min(1, dt*5))`.
- `G.camera.position.copy(camPos)`.
- Look-at: `(pos.x + fwd.x*2.5, pos.y + 0.9, pos.z + fwd.z*2.5)` — 2.5 m ahead, 0.9 m up.
- FOV: `G.camera.fov = 72 + Math.abs(speed); updateProjectionMatrix()` — 72° at rest → 87° at max speed. (On-foot FPS FOV is 75; restore handled outside this file.)
- Comment in code: "keep cam out of walls: nudge up if inside solid" — not actually implemented in the prototype.

## Prompts / misc

- Driving prompt: `G.setPrompt(|speed| < 1 ? '<b>F</b> — Exit vehicle' : null)` each frame.
- No-op quirk line 130: `G.player.lastDamageT = G.player.lastDamageT; // regen unaffected`.
- `C.fEdge = false` at the very end of update (consumed once per frame while deployed).

## G.* contract surface

Provided by car.js: `G.buildCarModel()`, `G.CarSys.{deploy(pos,yaw), enter(), exit(), update(dt), mesh, pos, yaw, speed, deployed, driving, fEdge, camPos, headLight, thudCd}`.
Consumed: `G.scene`, `G.camera`, `G.keys[code]`, `G.groundAt(x,z,yHint)`, `G.moveWithCollision(vec3,dx,dz,radius)`, `G.zombies[]` (`{alive, state, pos, takeDamage(dmg, part, worldPos) → {killed}|falsy}`), `G.addPoints(n)`, `G.player.{pos, yaw, lastDamageT}`, `G.shake(amp)`, `G.audio.vaultThud()`, `G.showMsg(text)`, `G.setPrompt(html|null)`.
