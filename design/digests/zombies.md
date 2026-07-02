# zombies.js — Implementation Digest

Source: `design/undead_bunker/game/js/zombies.js` (Three.js r128, vanilla JS, shared `window.G` namespace, IIFE).
Exports: `G.makeZombieBody()`, `G.Zombie` (class).

## Dependencies (G.* consumed from other files)

One line each — provided by map.js unless noted:
`G.scene` (game.js), `G.zombies` (array, game.js), `G.player` (`.pos`, `.curWeapon.headMult`, `.perks` Set — player.js/weapons.js), `G.moveWithCollision(pos, dx, dz, radius, clampToWalkable)`, `G.groundAt(x, z, y)`, `G.roomAt(pos)`, `G.pathChain(roomA, roomB)` (waypoint array of `{x,y,z}`), `G.ripBoard(win, board)`, `G.damagePlayer(dmg)` (player.js), `G.spawnBlood(point, count)` (game.js), `G.onZombieKilled(zombie)` (game.js — awards points, rolls drops), `G.volAt(pos)` (audio.js distance attenuation), `G.audio.groan(vol)`, `G.audio.vaultThud()`, `G.audio.attackSnarl(vol)` (audio.js).
Window object contract (`this.win`, from map.js): `{ spawn: Vector3, outer: {x,z}, inner: {x,y,z}, floorY: number, boards: [{on: bool}, ...] }`.

## Material palettes (randomized per zombie)

| Material | Colors (pick 1 at random) | Roughness | Notes |
|---|---|---|---|
| skin | `0x8a9a7b, 0x96a186, 0x7d8a6f, 0xa8a28c, 0x8f9c8f` | 0.9 | MeshStandardMaterial |
| shirt | `0x4a4438, 0x3d3a33, 0x52493a, 0x37413b, 0x4d4032` | 0.95 | |
| pants | `0x33302b, 0x3a352c, 0x2c2c30, 0x403a2e` | 0.95 | |
| gore | `0x4a0d08` (fixed) | 0.85 | wounds |
| eyes | color `0x221100`, emissive `0xffb340`, emissiveIntensity `1.6` | — | |
| boots | `0x1d1a16` (fixed) | 0.9 | own material per leg |

## Body rig (`G.makeZombieBody()` → `{ root, parts, hitMeshes }`)

Hierarchy: `root(Group) > hips(Group, y=0.92) > torso(Group) > neck(Group)`; arms hang off torso; legs off hips. All meshes are BoxGeometry except eyes (SphereGeometry). All hit meshes `castShadow = true`.

| Mesh | Geometry (w,h,d) | Parent | Position | Material | hit part |
|---|---|---|---|---|---|
| chest | Box 0.44, 0.55, 0.24 | torso | y=0.32 | shirt | body |
| belly | Box 0.4, 0.18, 0.22 | torso | y=0.02 | skin | body |
| wound | Box 0.2, 0.16, 0.02 | torso | (0.08, 0.3, 0.125) | gore | — |
| neck (Group) | — | torso | y=0.62 | — | — |
| head | Box 0.24, 0.28, 0.26 | neck | y=0.16 | skin | head |
| jaw | Box 0.2, 0.08, 0.2 | neck | (0, 0.02, 0.02) | skin | head |
| eyeL | Sphere r=0.028 (8,6) | neck | (−0.06, 0.19, 0.13) | eyeMat | — |
| eyeR | clone of eyeL | neck | x=0.06 | eyeMat | — |
| headGore | Box 0.1, 0.12, 0.02 | neck | (−0.07, 0.2, 0.132) | gore | — |

Arm (per side; `side` = −1 left / +1 right):

| Node | Geometry | Parent | Position | Material | hit part |
|---|---|---|---|---|---|
| sh (shoulder Group) | — | torso | (0.28·side, 0.52, 0) | — | — |
| upper | Box 0.12, 0.34, 0.13 | sh | y=−0.16 | shirt | limb |
| el (elbow Group) | — | sh | y=−0.33 | — | — |
| fore | Box 0.1, 0.32, 0.11 | el | y=−0.15 | skin | limb |
| hand | Box 0.11, 0.1, 0.12 | el | y=−0.34 | skin | limb |

Leg (per side):

| Node | Geometry | Parent | Position | Material | hit part |
|---|---|---|---|---|---|
| hip (Group) | — | hips | (0.12·side, −0.02, 0) | — | — |
| thigh | Box 0.16, 0.42, 0.17 | hip | y=−0.22 | pants | limb |
| kn (knee Group) | — | hip | y=−0.44 | — | — |
| shin | Box 0.13, 0.4, 0.14 | kn | y=−0.2 | pants | limb |
| boot | Box 0.14, 0.09, 0.24 | kn | (0, −0.42, 0.04) | boots | limb |

- `parts = { root, hips, torso, neck, armL, armR, legL, legR }`; each arm = `{ sh, el, meshes:[upper,fore,hand] }`, each leg = `{ hip, kn, meshes:[thigh,shin,boot] }`.
- `hitMeshes` = head, jaw (part `'head'`), chest, belly (part `'body'`), all 12 limb meshes (part `'limb'`); each mesh gets `userData.part`.
- `parts.headMeshes = [head, jaw, eyeL, eyeR, headGore]` (hidden on headshot kill).

## Zombie constructor (`new G.Zombie(win, opts)`)

| Field | Value |
|---|---|
| id | `++ZID` (module counter starting 0) |
| hp / maxHp | `opts.hp` |
| speed | `opts.speed` (m/s) |
| scale | `0.95 + Math.random() * 0.14`, applied via `root.scale.setScalar` |
| pos | `win.spawn.clone()`, then `x += (rand−0.5)*1.5`, `z += (rand−0.5)*1.5` |
| state | `'toWindow'` |
| t (anim clock) | `Math.random() * 10` |
| tearTimer (first) | `0.8 + Math.random() * 0.8` s |
| attackCd / attackAnim / vaultT / deadT / repathT | 0 |
| chain | null |
| groanT (first) | `1 + Math.random() * 4` s |
| radius | 0.32 |
| alive | true |

Each hit mesh gets `userData.zombie = this` (weapon raycasts read it); mesh added to `G.scene`.

Spawner values (game.js, per README — `opts` passed in): count `min(45, round(5 + r*4.2))`; hp `60 + r*45` for r≤9 then `*1.08` per round; speed tiers walkers `1.0–1.5`, joggers `1.7–2.4`, sprinters `3.1–3.9` with sprinter chance `min(0.55, (r-3)*0.09)`; alive cap `min(12, 6+r)`; spawn interval `max(0.8, 2.4 - r*0.12)` s.

## Movement helpers

- `face(tx, tz, dt, rate=6)`: `want = atan2(tx−pos.x, tz−pos.z)`; wrap delta to ±π; `rotation.y += d * min(1, dt*rate)`.
- `stepToward(tx, tz, dt, spd)`: normalize direction to target, then **separation**: for every other alive non-dead zombie with `|Δy| ≤ 1.5`, if planar `d² < 0.45` (and > 0.0001), add `(sx/d)*0.55, (sz/d)*0.55` to the direction. Renormalize; move via `G.moveWithCollision(pos, dx*spd*dt, dz*spd*dt, radius, clamp)` where `clamp = state !== 'toWindow' && state !== 'tearing'`. Faces `pos + dir` at default rate 6. Returns pre-separation distance to target.

## Animation poses

- `walkAnim(dt, spd)`: `t += dt * (2.2 + spd*2.2)`; `s=sin(t), c=cos(t)`; leg hip.rotation.x = `±s*0.55`; knee.rotation.x = `max(0, ∓c)*0.9` (L uses −c, R uses c); `hips.position.y = 0.92 + |c|*0.03`; `torso.rotation.x = 0.22 + s*0.03` (hunch); `torso.rotation.z = sin(t*0.5)*0.06`; `neck.rotation.x = −0.15`; `neck.rotation.z = sin(t*0.3 + id)*0.12`.
- `armsReach(amt, dt)`: lerp factor `k = min(1, dt*5)`; shoulder target `−1.35*amt − 0.25` (right adds `sin(t*1.7)*0.1*amt` wobble); both elbows target `−0.25*(1−amt)`.

## AI state machine (`update(dt)`)

States: `toWindow → tearing → vault0 → vault → hunt → dead`. Ambient groan every `3 + rand*6` s: `G.audio.groan(G.volAt(pos))`.

### toWindow
- `stepToward(win.outer.x, win.outer.z, dt, speed * 0.9)`; `walkAnim(dt, speed)`; `armsReach(0, dt)`.
- When distance `< 0.55`: → `'tearing'` if any board `on`, else → `'vault0'`.

### tearing
- Face `win.inner` (rate 6). `t += dt * 6`. Pose: `armL.sh.rotation.x = −1.6 + sin(t)*0.5`; `armR.sh.rotation.x = −1.6 + sin(t+π)*0.5`; `torso.rotation.x = 0.15 + sin(t)*0.06`.
- `tearTimer −= dt`; on ≤ 0: reset to `1.4 + rand*0.9` s; rip last `on` board via `G.ripBoard(win, boards[last])`; if none left → `'vault0'`.
- Also, if 0 boards remain: per-frame chance `rand < dt*2` → `'vault0'`.

### vault0 (1-frame setup)
- `vaultFrom = pos.clone()`; `vaultT = 0`; → `'vault'`; `G.audio.vaultThud()`.

### vault (duration 1.15 s)
- `vaultT += dt / 1.15`; `k = min(1, vaultT)`; lerp x,z from `vaultFrom` → `win.inner`; `pos.y = vaultFrom.y + (win.floorY − vaultFrom.y)*k + sin(k*π)*0.6` (0.6 m arc).
- Pose: `torso.rotation.x = 0.9*sin(kπ)`; `legL.hip.rotation.x = −1.2*sin(kπ)`; `legR.hip.rotation.x = −0.8*sin(kπ)`; `armsReach(1, dt)`; face inner at rate 10.
- `k >= 1` → `'hunt'`, `pos.y = win.floorY`.

### hunt
- Repath every 0.5 s (`repathT`): if `G.roomAt(pos) !== G.roomAt(P.pos)`, get `chain = G.pathChain(myRoom, pRoom)`; while `chain.length > 1` and waypoint[0] within planar 1.2 and `|Δy| < 1.2`, shift; else `chain = null` (same room = direct).
- Waypoint following: target chain[0]; consume when planar dist `< 0.8` and `|Δy| < 1.2`; when chain empties, `repathT = 0` (immediate repath).
- Speed: `spd = speed * (distP < 3 ? 1.12 : 1)`; `stepToward(tx, tz, dt, spd)`; `walkAnim(dt, spd)`.
- Arm reach amount: `distP < 4 ? 1 : (speed > 2.4 ? 0.8 : 0.15)`.
- Floor snap: `pos.y += (G.groundAt(x, z, y) − pos.y) * min(1, dt*10)`.
- **Attack**: `attackCd −= dt`; trigger when `distP < 1.7` and `attackCd <= 0` and `|P.pos.y − pos.y| < 1.6`. Sets `attackCd = 1.15`, `attackAnim = 0.4`; `G.audio.attackSnarl(G.volAt(pos))`; `setTimeout` **280 ms** windup → if still alive/non-dead and planar dist to player `< 2.0`, `G.damagePlayer(22)`.
- Attack pose (while `attackAnim > 0`, decays by dt; `k = attackAnim/0.4`): `armR.sh.rotation.x = −1.9`; `armR.sh.rotation.z = −1.2*sin(kπ)`; `torso.rotation.y = 0.4*sin(kπ)`. After: `armR.sh.rotation.z *= 0.9`, `torso.rotation.y *= 0.9` per frame.

### dead
- `deadT += dt`; `k = min(1, deadT * 2.4)`; `mesh.rotation.x = −π/2 * k * deadDir` (deadDir = ±1, 50/50); `hips.position.y = 0.92 − k*0.55`.
- `deadT > 3.2`: sink `mesh.position.y −= dt * 0.35`. `deadT > 4.5`: `dispose()`.

End of update: `mesh.position.copy(pos)`.

## Damage / death / dispose

- `takeDamage(dmg, part, hitPoint)` → `false` if dead, else `{ killed, head: part==='head' }`:
  - `mult = part === 'head' ? G.player.curWeapon.headMult : (part === 'limb' ? 0.8 : 1)`
  - `hp -= dmg * mult * (G.player.perks.has('deadeye') ? 1.4 : 1)`
  - `G.spawnBlood(hitPoint, part === 'head' ? 14 : 7)`
  - hp ≤ 0 → `die(part === 'head')`.
- `die(headshot)`: state `'dead'`, `deadT = 0`, `deadDir = rand<0.5 ? 1 : −1`. Headshot: hide all `parts.headMeshes` + `G.spawnBlood(mesh.position + (0, 1.6*scale, 0), 24)`. Clears `userData.zombie` on all hit meshes (no further hits). Calls `G.onZombieKilled(this)`.
- `dispose()`: `alive = false`; remove from `G.scene`; traverse and dispose geometries (materials not disposed).
- Drop chance: **12% wood/coal pickup** per kill — rolled in `G.onZombieKilled` (crafting.js/game.js, per README), not in zombies.js.

## Scoring / external hooks (for context, from README)

+10/bullet hit, +50 kill, +90 headshot kill — handled by shooter code + `G.onZombieKilled`; zombie hit deals 22 to player (100 hp base, 250 with Tough Tonic).
