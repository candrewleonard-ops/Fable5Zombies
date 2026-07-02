# player.js — FPS Controller Digest (Undead Bunker prototype)

Source: `design/undead_bunker/game/js/player.js`. IIFE attaching to `window.G`. Uses Three.js (`THREE` as `T`).

## Player state object `G.player` (local `P`)

| Field | Initial | Notes |
|---|---|---|
| `pos` | `Vector3(0, 0, 4)` | feet position |
| `yaw`, `pitch` | 0, 0 | pitch clamped to [-1.45, 1.45] rad |
| `hp` / `maxHp` | 100 / 100 | tonic perk → both 250 |
| `baseSpeed` | 4.3 | m/s |
| `perks` | `new Set()` | keys: `rapid`, `fleet`, `tonic` (+deadeye elsewhere); max 4 |
| `curItem`, `curWeapon` | null | curWeapon = `G.Inv.weaponStats(item)` when item.type==='weapon' |
| `reloading`, `reloadTotal`, `fireCd`, `ads`, `boltT` | 0 | timers (s); `ads` is 0..1 blend |
| `lastDamageT` | -99 | seconds (performance.now()/1000 scale) |
| `dead` | false | update loop returns early if true |
| `vmKick`, `bobT`, `repairT`, `deployCd` | 0 | viewmodel kick, bob phase, board-repair hold timer, car deploy cooldown |
| `jetpack`, `jetFuel`, `vy`, `jetSnd` | undefined until granted | set by crafting system |

Also: `G.keys = {}` (by `e.code`), `G.mouse = { down, rdown, clicked, rclicked }` (clicked/rclicked are edge flags cleared each frame).

## Movement

- Input: `KeyW` mz+1, `KeyS` mz-1, `KeyA` mx-1, `KeyD` mx+1; vector normalized via `Math.hypot`.
- Sprint condition: `G.keys['ShiftLeft'] && mz > 0 && P.reloading <= 0` (forward-only, not while reloading).
- Speed formula (verbatim):
  ```js
  spd = P.baseSpeed * (P.perks.has('fleet') ? 1.17 : 1) * (sprinting ? 1.42 : 1) * (P.ads > 0.5 ? 0.55 : 1);
  ```
  i.e. base 4.3, fleet ×1.17, sprint ×1.42, ADS ×0.55 (ADS multiplier gates on blend > 0.5).
- Yaw-relative displacement:
  ```js
  dx = (mx * cos(yaw) - mz * sin(yaw)) * spd * dt;
  dz = (-mx * sin(yaw) - mz * cos(yaw)) * spd * dt;
  G.moveWithCollision(P.pos, dx, dz, 0.34);   // 0.34 = player collision radius
  ```
- Bob phase: `P.bobT += dt * (sprinting ? 11 : 7.5)` only while moving.

### Vertical / jetpack physics

- Ground: `gy = G.groundAt(P.pos.x, P.pos.z, P.pos.y)`.
- Thrust condition: `P.jetpack && G.keys['Space'] && P.jetFuel > 0 && !G.Inv.open`.
- Thrust: `P.vy = min((P.vy||0) + 20*dt, 4.4)` — 20 m/s² ramp, 4.4 m/s cap.
- Fuel drain: `P.jetFuel = max(0, P.jetFuel - 18*dt)` (18/s) → `G.updateFuelHUD()`.
- Jet SFX loop: `P.jetSnd` timer, retrigger every 0.12 s → `G.audio.jet()`.
- Thrust sparks: `if (Math.random() < dt*30)` spawn `G.spawnSpark` at `(x + (rand-.5)*0.4, y + 0.15, z + (rand-.5)*0.4)` color `0xffa040`.
- Airborne when `thrust || P.pos.y > gy + 0.03`:
  - Gravity (no thrust): `P.vy -= 13 * dt` (−13 m/s²).
  - `P.pos.y += P.vy * dt`.
  - Ceiling: `if (P.vy > 0 && headBlocked()) P.vy = 0` — `headBlocked()` = point test of `(x, y+1.78, z)` inside any `G.solids` AABB.
  - Land: `if (P.pos.y <= gy) { P.pos.y = gy; P.vy = 0; }`.
  - Altitude cap: `if (P.pos.y > 50) { P.pos.y = 50; P.vy = min(P.vy, 0); }`.
- Grounded: `P.vy = 0; P.pos.y += (gy - P.pos.y) * min(1, dt * (gy > P.pos.y ? 14 : 9))` — exponential snap, faster (14) going up steps than down (9).

### Camera

```js
G.camera.position.set(P.pos.x, P.pos.y + 1.62 + Math.sin(P.bobT) * (moving ? 0.025 : 0), P.pos.z);
G.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
```
Eye height 1.62; head bob amplitude 0.025 while moving.

## Mouse look / input binding (`G.bindInput(canvas)`)

- Sensitivity: `0.0021 * (1 - P.ads * 0.45)` per pixel; `yaw -= movementX*sens`, `pitch -= movementY*sens`; pitch clamp ±1.45.
- Blocked when: `P.dead || !G.state.playing || G.state.paused || G.CarSys.driving`, or pointer not locked (unless `G.noLock` fallback).
- mousedown (button 0/2) sets down+clicked / rdown+rclicked; mouseup clears down flags; contextmenu prevented.
- Wheel: hotbar cycle `G.Inv.select(((G.Inv.sel + d) % 9 + 9) % 9)` where `d = deltaY > 0 ? 1 : -1`; blocked when inventory open / paused / driving.
- `KeyR` keydown → `tryReload()`.

## ADS

- Want: `def && G.mouse.rdown && P.reloading <= 0 ? 1 : 0` (weapons only).
- Blend: `P.ads += (want - P.ads) * min(1, dt * 9)`.
- FOV: `G.camera.fov = 75 - P.ads * 16` (75→59) + `updateProjectionMatrix()`.
- Effects of ADS: spread ×0.4 (when ads > 0.5), move speed ×0.55, sensitivity ×(1−0.45·ads), viewmodel centers (below), bob ×(1−0.8·ads).

## Viewmodel (`G.initPlayer`, per-frame pose)

- `vmRoot = new T.Group()`, child of `G.camera`, hip position `(0.24, -0.22, -0.45)`.
- Muzzle flash: `PlaneGeometry(0.22, 0.22)`, `MeshBasicMaterial{ color 0xffd9a0, transparent, opacity 0, AdditiveBlending, depthWrite false }`, in scene (not camera).
- Flash light: `PointLight(0xffc070, 0, distance 9, decay 1.8)`, in scene.
- Per-frame pose (verbatim):
  ```js
  P.vmKick *= Math.pow(0.001, dt);
  bobX = Math.sin(P.bobT) * 0.012 * (moving ? 1 : 0.2) * (1 - P.ads * 0.8);
  bobY = Math.abs(Math.cos(P.bobT)) * 0.014 * (moving ? 1 : 0.2) * (1 - P.ads * 0.8);
  tx = 0.24 * (1 - P.ads);
  ty = -0.22 * (1 - P.ads) - 0.155 * P.ads;      // ADS target y = -0.155, x = 0
  vmRoot.position.set(tx + bobX, ty - bobY + P.vmKick * 0.3, -0.45 + P.vmKick);
  vmRoot.rotation.set(P.vmKick * 1.6, 0, bobX * 0.6);
  ```
- Reload animation: `k = 1 - abs(P.reloading/P.reloadTotal - 0.5) * 2` (triangle 0→1→0); `rotation.x -= k*0.9; position.y -= k*0.12`. On finish: `take = min(def.mag - item.mag, item.reserve)`; mag += take, reserve -= take; `G.audio.reloadEnd()`, `G.updateAmmoHUD()`, `G.Inv.updateCounts()`.
- Bolt anim: while `P.boltT > 0`: `rotation.z += Math.sin((0.8 - P.boltT) * 8) * 0.06`.
- Craft anim overlay (`G.Craft.anim` with `t`, `type`): `rotation.z += sin(a.t * (type==='ar' ? 14 : type==='shotgun' ? 6 : 9)) * 0.1; rotation.x += -0.15 + sin(a.t*7)*0.05; position.y += sin(a.t*9)*0.015`.
- Sprint pose: `rotation.x += 0.35; position.y -= 0.05` (applied after everything).
- Flash decay per frame: `muzzleFlash.material.opacity *= Math.pow(0.0001, dt)`; same for `flashLight.intensity`.

### Hand-model transforms per item type (`G.onSelectionChanged`)

| type | model source | scale | position | rotY |
|---|---|---|---|---|
| weapon | `G.WEAPONS[key].build()` | 1 | (0,0,0) | 0 |
| build | `G.buildPieceModel(item.piece)` | 0.07 | (0.02, -0.06, -0.05) | 0.4 |
| mat | `G.buildMatModel(item.mat)` | wand: 1, else 0.35 | (0, -0.06, -0.05) | 0 |
| place | bench → `G.buildBenchModel()`, else `G.buildAnvilModel()` | 0.12 | (0.02, -0.08, -0.05) | 0.5 |
| car | `G.buildCarModel()` | 0.055 | (0, -0.04, 0) | 2.6 |

- PaP'd weapon tint: clone each mesh material, `emissive = 0x7a2bd6`, `emissiveIntensity = 0.4`.
- All viewmodel meshes: `castShadow = false; frustumCulled = false`.
- On selection change: `P.reloading = 0; P.fireCd = 0.25; P.boltT = 0`; `G.Build.setActive(piece|kind|null)`; `G.updateAmmoHUD()`.
- `G.setHandModel(model)` — override hand model (null restores via `G.onSelectionChanged()`); used by crafting.
- `G.giveWeapon(key, opts)` → `G.Inv.addWeapon(key, opts)`.

## Reload (`tryReload`)

- Guards: no item/def, already reloading, `item.mag >= def.mag`, `item.reserve <= 0`.
- Time: `def.reload * (P.perks.has('rapid') ? 0.55 : 1)`; sets `reloading = reloadTotal = time`; `G.audio.reloadStart()`.

## Shooting (`fire()`)

Trigger logic (per frame, weapon item, not during craft anim):
```js
wantFire = def.auto ? G.mouse.down : G.mouse.clicked;
if (wantFire && P.fireCd <= 0 && P.reloading <= 0 && P.boltT <= 0 && !sprinting) fire();
```
- Empty mag: `G.audio.empty(); tryReload(); P.fireCd = 0.3; return`.
- `item.mag--`; `P.fireCd = 60 / (def.rpm * (rapid ? 1.12 : 1))`.
- Bolt weapons: `P.boltT = 0.8; setTimeout(() => G.audio.bolt(), 350)`.
- Recoil: `P.vmKick = min(0.2, P.vmKick + def.kick)`; `P.pitch += def.kick * 0.35`; `G.shake(def.kick * 1.4)`.
- Muzzle FX at `vmWeapon.userData.muzzle` world pos (fallback vmRoot): flash opacity 0.9, random `rotation.z = Math.random()*6`, billboard to camera quaternion; `flashLight.intensity = 2.4`; colors `def.flash || 0xffc070` (light) / `def.flash || 0xffd9a0` (plane).
- Projectile weapons: `G.fireProjectile(origin, camDir(0))` from camera world pos, then return.

### Raycast + occlusion

- Hit candidates: `z.hitMeshes` for every zombie with `z.alive && z.state !== 'dead'`.
- Per pellet (`def.pellets`):
  - `dir = camDir(def.spread * (P.ads > 0.5 ? 0.4 : 1))`.
  - `raycaster.set(origin, dir); raycaster.far = 60`.
  - Occlusion: `wallT = rayVsSolids(origin, dir, 60)` — slab-method ray vs every AABB in `G.solids` (epsilon 1e-8 for parallel axes; returns nearest entry t, capped at maxDist). Exported as `G.rayVsSolids`.
  - `hits = raycaster.intersectObjects(hitMeshes, false)` (non-recursive).
  - Default endpoint: `end = origin + dir * min(wallT - 0.02, 45)`.
  - For each hit: `if (h.distance > wallT + 0.1) break;` (wall blocks); zombie via `h.object.userData.zombie`, part via `h.object.userData.part`; `res = z.takeDamage(def.dmg, part, h.point)`; on res: `G.hitmarker(res.head)`, `G.audio.hitTick(res.head)`, `G.addPoints(10)`, kill bonus `G.addPoints(res.head ? 90 : 50)`. First valid hit only (break).
  - Miss into wall (`wallT < 60`): `G.spawnDust(end)`.
  - Beam weapons: `G.spawnBeam(mz, end, def.beam); G.spawnSpark(end, def.beam)` per pellet.
- After volley: `G.updateAmmoHUD(); G.Inv.updateCounts()`.

### Spread (`camDir(spread)`)

```js
dir = (0,0,-1).applyQuaternion(camera.quaternion);
dir.x += (Math.random()-0.5) * spread * 2;
dir.y += (Math.random()-0.5) * spread * 2;
dir.z += (Math.random()-0.5) * spread * 0.5;
dir.normalize();
```

## Interaction (F)

F key edge/hold tracked by separate listeners: `fHeld` (down state), `fEdge` (one frame on press; cleared at end of `updatePlayer`).

### Prompt scan `nearestInteract()` — eye = `P.pos + (0,1.6,0)`; collects candidates, sorts by `d` ascending, returns nearest

| type | source | range | distance from | condition | prompt (HTML) |
|---|---|---|---|---|---|
| window | `G.windows` | < 2.3 | win.group.position with y=win.floorY, to `P.pos` | room unlocked && some board off | `<b>Hold F</b> — Rebuild barricade <b>+10</b>` |
| door | `G.doors` | < 2.4 | d.pos to eye | !d.open | `<b>F</b> — Open ${d.name} <b>[${d.cost}]</b>` |
| perk | `G.perkMachines` | < 2.2 | pm.pos + (0,1.2,0) to eye | !perks.has(pm.key) | `<b>F</b> — Buy ${pm.name} <b>[${pm.cost}]</b>` |
| wallbuy | `G.wallbuys` | < 2.4 | wb.pos to eye | always | Buy or `Ammo for` + name + cost |
| box / boxTake | `G.mysteryBox` | < 2.5 | mb.pos to `P.pos` | state idle / ready | box: cost prompt (d=1); take: `Take ${name}` (d=0.5) |
| pap / papTake / papWait | `G.PaP` | < 2.6 | PaP.pos to `P.pos` | idle + held non-★ weapon / ready / other | Reforge [cost] (d=0.6) / Take ★ (d=0.4) / `Reforging…` (d=0.7, noop) |
| car | `G.CarSys` | < 2.9 | CarSys.pos to `P.pos` | deployed && !driving | `<b>F</b> — Enter vehicle` |
| scav | `G.scavenge` | < 2.2 | n.pos to `P.pos` | n.cd <= 0 | `<b>F</b> — Gather ${n.mat}` |
| station | `G.stations` | < 2.3 | st.pos to `P.pos` | always | `Use Crafting Bench (3×3)` or `Use Anvil` |
| trap / noop | `G.Trap` | < 2.5 | switchPos to eye | state ready / else | ready: cost prompt (d=1); active: `⚡ TRAP ACTIVE ⚡`; else `Trap cooling — ${ceil(G.Trap.t)}s` |

Wallbuy ammo pricing: `ownedItem` = non-pap weapon of same key in `G.Inv.slots`; `cost = ownedItem ? Math.round(def.cost / 2 / 10) * 10 : def.cost` (half price rounded to nearest 10).

Per frame: `G.setPrompt(it ? it.prompt : null)`; `if (it) doInteract(it, dt)`; `if (!it) P.repairT = 0`.

### Actions `doInteract(it, dt)`

- **window (hold-F board repair)**: while `fHeld`: `P.repairT += dt; if (P.repairT > 0.55) { P.repairT = 0; if (G.addBoard(it.win)) G.addPoints(10); }` — one board per 0.55 s held, +10 pts each; timer resets on release.
- All others require `fEdge` (single press):
  - **door**: `G.spend(cost)` → `G.openDoor(door)` else `G.deny()`.
  - **perk**: reject if `perks.size >= 4` (`G.showMsg('Max 4 perks')` + deny); on buy: `perks.add(key)`; `tonic` → `maxHp = 250; hp = 250`; `G.audio.perkJingle(); G.perkHUD(); G.showMsg(name + ' acquired')`.
  - **wallbuy** owned: reject if `reserve >= stats.reserve` (`'Ammo full'`); else spend → `reserve = stats.reserve`, `G.audio.buy()`, `G.Inv.render()`, `G.updateAmmoHUD()`. Not owned: spend → `G.Inv.addWeapon(key)` + `G.audio.buy()`.
  - **box**: spend `G.mysteryBox.cost` → `G.rollBox()`. **boxTake**: `G.takeBoxWeapon()`.
  - **pap**: spend `G.PaP.cost` → clear current slot (`G.Inv.slots[G.Inv.sel] = null`), `G.Inv.render()`, `G.PaP.insert(item)`, `G.onSelectionChanged()`.
  - **papTake**: `upgraded = G.PaP.takeOut()`; `G.Inv.addItemAt(upgraded, G.Inv.slots[G.Inv.sel] ? null : G.Inv.sel)`; msg `displayName + ' ready'`; perkJingle.
  - **car**: `G.CarSys.enter()`. **scav**: `G.Craft.gather(node)`. **station**: `G.Craft.openStation(st.kind)`.
  - **trap**: spend `G.Trap.cost` → `G.Trap.state = 'active'; G.Trap.t = 25; G.audio.zap(); G.showMsg('Trap active')`.

## Per-item LMB/RMB actions (in `updatePlayer`)

- weapon: fire logic above.
- build: LMB clicked → `G.Build.place()`; RMB clicked → `G.Build.removeTargeted()`.
- place (bench/anvil): LMB clicked && `G.Build.place({ free: true })` → clear slot, `G.Inv.render()`, `G.onSelectionChanged()`.
- car: LMB clicked && `P.deployCd <= 0` → `deployCd = 1.2`; deploy point = `P.pos + fwd * 4.6` where `fwd = (-sin(yaw), 0, -cos(yaw))`; `G.CarSys.deploy(dp, P.yaw)`.
- Edge flags cleared at end: `G.mouse.clicked = false; G.mouse.rclicked = false`.

## Health regen

```js
if (performance.now()/1000 - P.lastDamageT > 3.5 && P.hp < P.maxHp) {
  P.hp = Math.min(P.maxHp, P.hp + 40 * dt);   // 40 hp/s after 3.5 s without damage
  G.updateHealthFx();
}
```
(Damage intake is external; zombie hit = 22 dmg per README, setting `lastDamageT`.)

## G.* contract surface

**Defined here:** `G.player`, `G.keys`, `G.mouse`, `G.initPlayer()`, `G.onSelectionChanged()`, `G.setHandModel(model)`, `G.giveWeapon(key, opts)`, `G.bindInput(canvas)`, `G.rayVsSolids(origin, dir, maxDist)`, `G.updatePlayer(dt)`.

**Consumed from other files:**
- game.js: `G.camera`, `G.scene`, `G.state.{playing,paused}`, `G.noLock`, `G.zombies`, `G.shake`, `G.hitmarker`, `G.addPoints`, `G.spawnDust`, `G.spawnBeam`, `G.spawnSpark`, `G.fireProjectile`, `G.updateAmmoHUD`, `G.updateFuelHUD`, `G.updateHealthFx`, `G.setPrompt`, `G.showMsg`, `G.spend`, `G.deny`, `G.perkHUD`, `G.mysteryBox`, `G.rollBox`, `G.takeBoxWeapon`
- map.js: `G.solids`, `G.moveWithCollision`, `G.groundAt`, `G.windows`, `G.rooms`, `G.doors`, `G.openDoor`, `G.addBoard`, `G.perkMachines`, `G.wallbuys`, `G.scavenge`, `G.stations`, `G.Trap`
- weapons.js: `G.WEAPONS` (fields used: `build()`, `cost`, `name`, `mag`, `reserve`, `rpm`, `auto`, `bolt`, `reload`, `dmg`, `pellets`, `spread`, `kick`, `sound`, `flash`, `beam`, `projectile`, `displayName` via stats)
- inventory.js: `G.Inv.{selected, weaponStats, addWeapon, addItemAt, select, sel, slots, open, render, updateCounts}`
- build.js: `G.Build.{setActive, place, removeTargeted}`, `G.buildPieceModel`, `G.buildBenchModel`, `G.buildAnvilModel`
- crafting.js: `G.Craft.{gather, openStation, anim}`, `G.buildMatModel`
- car.js: `G.CarSys.{driving, deployed, pos, enter, deploy}`, `G.buildCarModel`
- pap.js: `G.PaP.{pos, state, cost, item, insert, takeOut}`
- audio.js: `G.audio.{shot, empty, bolt, reloadStart, reloadEnd, buy, deny→(G.deny), perkJingle, hitTick, jet, zap}`

Dependency note: relies on load order `audio → weapons → zombies → car → map → pap → build → crafting → inventory → player → game`; all helpers above must exist before `G.updatePlayer` runs (game.js main loop calls it).
