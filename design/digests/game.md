# game.js — Implementation Digest

Source: `design/undead_bunker/game/js/game.js` (522 lines, IIFE on `window.G`, Three.js r128, `T = THREE`).
Depends on helpers defined in other prototype files: `G.buildMap/G.initPaP/G.windows/G.rooms/G.solids/G.boxPads/G.moveMysteryBox/G.mysteryBox/G.bulbs/G.flyingBoards/G.spawnPoint/G.Trap` (map.js), `G.initPlayer/G.updatePlayer/G.bindInput/G.player/G.giveWeapon/G.onSelectionChanged` (player.js), `G.Zombie` (zombies.js), `G.Inv` (inventory.js), `G.Build` (build.js), `G.Craft`, `G.Drops` (crafting.js), `G.CarSys` (car.js), `G.PaP` (pap.js), `G.BOX_POOL`/`G.buildWeaponModel` (weapons.js), `G.audio.*` (audio.js).

## Global state

```js
state = { playing:false, round:0, points:500, kills:0, toSpawn:0, spawnT:2, intermission:0, time:0, shake:0 }
// later fields: state.paused, state.hurtFlash
G.zombies = []; G.state = state;
```

## Renderer / scene setup (init)

| Item | Value |
|---|---|
| Scene background | `0x05070c` |
| Camera | `PerspectiveCamera(75, innerWidth/innerHeight, 0.05, 200)`, added to scene |
| Renderer | `WebGLRenderer({ antialias:true, powerPreference:'high-performance' })` |
| Pixel ratio | `Math.min(devicePixelRatio, 1.75)` |
| Shadows | `shadowMap.enabled = true`, `PCFSoftShadowMap` |
| Encoding | `outputEncoding = sRGBEncoding` |
| Tone mapping | `ACESFilmicToneMapping`, `toneMappingExposure = 1.1` |
| Canvas parent | `#game` |
| Resize handler | updates camera aspect + projection matrix + renderer size |

HUD element ids cached: `round, pointsVal, pointsFeed, ammo, weaponName, prompt, msg, waveBanner, bloodOverlay, hitmarker, perksRow, reloadHint, hud`.

Init call order: `G.buildMap()` → `G.initPaP(8.5, 17.2, Math.PI)` → `G.initPlayer()` → `G.Inv.init()` → `G.onSelectionChanged()` → `G.bindInput(renderer.domElement)` → `initParticles()` → hide `#loadNote` → wire buttons → `requestAnimationFrame(loop)`. Init runs on `DOMContentLoaded` (or immediately if already loaded).

## Lighting (scene lights live in map.js — values for reference)

| Light | Value |
|---|---|
| Fog | `new T.Fog(0x05070c, 16, 62)` |
| Sky dome | `SphereGeometry(140, 24, 16)`, `MeshBasicMaterial({ map: 1024×512 canvas sky, side: BackSide, fog:false })` |
| Hemisphere | `HemisphereLight(0x223044, 0x0a0806, 0.5)` |
| Moon | `DirectionalLight(0x9db4dd, 0.5)` at `(40,50,-60)`, castShadow, shadow map 2048², ortho cam ±42, near 5, far 200 |
| Hanging bulbs | `PointLight(0xffb35c, 0.95, 12, 1.6)`; bulb mesh `SphereGeometry(0.07,10,8)`, `MeshStandardMaterial({ color:0xffd9a0, emissive:0xffc070, emissiveIntensity:2.2 })`; shadow bulbs use 512² maps |
| Bulb positions (x,y,z, shadow, wireLen) | `(0,4.6,-5,true,1.75) (-8,4.6,-3,false,1.75) (9.5,4.4,4.5,false,1.95) (-5,2.72,5.5) (2,2.72,2.5) (-20,2.72,4) (9.5,2.72,14) (-4,5.75,6,true,0.6)` |
| Box sky beam | outer `CylinderGeometry(0.35,1.3,60,10,1,open)` color `0x86c8ff` opacity 0.045; core `CylinderGeometry(0.1,0.45,60,8,1,open)` color `0xbfe2ff` opacity 0.08; both AdditiveBlending, DoubleSide, depthWrite:false, fog:false, y=30 |

**Bulb flicker (in game.js main loop, runs every frame even when paused):**
```js
f = 0.82 + 0.18 * Math.sin(state.time*11 + b.seed) * Math.sin(state.time*4.7 + b.seed*2);
black = Math.sin(state.time*0.7 + b.seed*3) > 0.985 ? 0.2 : 1;   // random blackout dips
b.light.intensity = b.base * f * black;
b.mesh.material.emissiveIntensity = 2.2 * f * black;
```
Bulb entries: `{ light, mesh, base, seed }` (base 0.95 bulbs, 1.6 campfire, 0.85 lanterns).

## Pointer lock & menus

- `tryLock()`: `canvas.requestPointerLock()`; on promise rejection or exception → `enableNoLock()`; also after 400ms timeout if lock not acquired → `enableNoLock()`. Exposed as `G.tryLock`.
- `enableNoLock()`: sets `G.noLock = true`, `canvas.style.cursor = 'none'`, if playing shows msg `'Mouse-look active · Esc to pause'`.
- `pointerlockchange`: skipped if `G.noLock` or `G.Inv.open`; if lock lost while `state.playing && !G.player.dead` → show `#pauseOverlay` (flex) + `state.paused = true`; otherwise hide + unpause.
- Keydown `Escape` (only when `G.noLock && state.playing && !G.player.dead && !G.Inv.open`): toggles `state.paused` + `#pauseOverlay`.
- Buttons: `#startBtn` → `start()`; `#resumeBtn` → hide overlay, unpause, `tryLock()` if not noLock; `#restartBtn` → `location.reload()`.

**start():** `G.audio.resume()` → hide `#menuOverlay` → show `#hud` (`display:block`) → `tryLock()` → `state.playing = true` → `G.player.pos.copy(G.spawnPoint)` → `setTimeout(() => startRound(1), 900)`.

**die():** `G.player.dead = true; state.playing = false; document.exitPointerLock();` → `#survStats` = `` `Survived ${round} round${round>1?'s':''} · ${kills} kills` `` → show `#deadOverlay` (flex). Restart = page reload.

## Rounds / spawner

```js
zHp(r)      = r <= 9 ? 60 + r*45 : (60 + 9*45) * Math.pow(1.08, r - 9)      // 465 base after r9
pickSpeed(r):
  if (r <= 1) return 0.9 + rnd*0.4;                                          // round 1: walkers only
  sprintChance = Math.min(0.55, Math.max(0, (r - 3) * 0.09));
  roll < sprintChance  → 3.1 + rnd*0.8   // sprinter
  roll < 0.65          → 1.7 + rnd*0.7   // jogger
  else                 → 1.0 + rnd*0.5   // walker
```

**startRound(r):** `state.round = r; state.toSpawn = Math.min(45, Math.round(5 + r*4.2)); state.spawnT = 1.2;` set `#round` text, set `#waveBanner` text `'Round ' + r`, remove/re-add class `show` (with `offsetWidth` reflow to restart CSS anim), `G.audio.roundStart()`.

**updateRound(dt)** (per frame while playing):
- If `intermission > 0`: decrement; at ≤0 → `startRound(round + 1)`; return.
- If `toSpawn > 0`: `spawnT -= dt`; alive cap `Math.min(12, 6 + round)`; when `spawnT <= 0 && aliveCount() < cap` → `spawnT = Math.max(0.8, 2.4 - round*0.12)` and `spawnZombie()`.
- Else if `aliveCount() === 0 && round > 0`: `intermission = 8`, `G.audio.roundEnd()`, `G.showMsg('Round clear')`.

`aliveCount()` = zombies with `z.alive && z.state !== 'dead'`.

**spawnZombie():** candidate windows = `G.windows.filter(w => G.rooms[w.room].unlocked)`; weighted pick with weight `1 / (4 + distance(window.group.position, player.pos))` (closer windows favored); `state.toSpawn--`; `new G.Zombie(win, { hp: zHp(round), speed: pickSpeed(round) })` pushed to `G.zombies`.

**G.onZombieKilled(z):** `state.kills++`; `if (z && z.pos && Math.random() < 0.12) G.Drops.spawn(z.pos)` (12% drop chance).

## Economy / points feed HUD

- `G.addPoints(n)`: `points += n`; update `#pointsVal`; append `<div class="pf">` (`+ ' neg'` if n<0), text `(n>0?'+':'') + n`; auto-remove after **1000ms**; if feed has **>6 children** remove firstChild.
- `G.spend(n)`: if `points < n` → `G.showMsg('Not enough points')`, return false. Else deduct, update, append `.pf.neg` div `'-' + n` (1000ms lifetime), return true.
- `G.deny()` = `G.audio.deny()`.

## HUD helpers

| API | Behavior |
|---|---|
| `G.updateAmmoHUD()` | weapon: name = `G.Inv.weaponStats(item).displayName`; ammo HTML `` `${item.mag} <span class="res">/ ${item.reserve}</span>` ``; class `low` when `mag <= Math.max(2, st.mag*0.25)`; `reloadHint.show` when `mag===0 && reserve>0`. build item: name via `G.Inv.nameFor`, ammo `50 pts · LMB place · RMB remove`. else (keys): name `'Car Keys'`, ammo `LMB — deploy · F — enter`. No item: clear all. |
| `G.perkHUD()` | rebuilds `#perksRow`: per perk a `.perkIcon` div, `background: radial-gradient(circle at 35% 30%, ${c}, #100a08 130%)`, letter text. `PERK_STYLE = { tonic:['#9e1b1b','T'], rapid:['#b08414','R'], fleet:['#1c5d8a','F'], deadeye:['#5b2a7a','D'] }` |
| `G.setPrompt(html)` | null → hide `#prompt`; else show, set innerHTML only if changed |
| `G.showMsg(t)` | `#msg` text, opacity 1, fades (opacity 0) after **1800ms** (clearTimeout on re-call) |
| `G.hitmarker(head)` | toggle class `head` by truthiness, add `show`, remove `show` after **70ms** |
| `G.updateHealthFx()` | `bloodOverlay.opacity = Math.min(1, Math.max(0, (1 - hp/maxHp)*1.05 - 0.05) + state.hurtFlash||0)` |
| `G.updateFuelHUD()` | `#fuelWrap` display flex iff `G.player.jetpack`; `#fuelFill` height `Math.round(jetFuel)+'%'`; color `#c8401e` if fuel < 25 else `#3fa7c8` |
| `G.damagePlayer(amt)` | if dead return; `hp -= amt`; `lastDamageT = performance.now()/1000`; `state.hurtFlash = 0.6`; `G.audio.playerHurt()`; `G.shake(0.05)`; `G.updateHealthFx()`; hp ≤ 0 → `die()` |
| `G.shake(a)` | `state.shake = Math.min(0.12, state.shake + a)` |

## Doors

`G.openDoor(d)`: `d.open = true`; remove `d.solid` from `G.solids`; `G.rooms[d.unlockRoom].unlocked = true`; also unlock each room in `d.wins` array; `G.audio.doorOpen()` + `G.audio.buy()`; `G.showMsg(d.name + ' opened')`; push to `animDoors`.
Door anim (in loop, runs even when paused): `d.group.position.y -= dt * 1.4`; when `y < -2.7` → `group.visible = false`, remove from list.

## Mystery box state machine

States: `idle → rolling → (ready | teddy) → closing → idle`. `mb.t` resets on every state change.

Entry points: `G.rollBox()` → `state='rolling', t=0, G.audio.boxJingle()`. `G.takeBoxWeapon()` → only if `state==='ready'`: `G.giveWeapon(mb.weapon)`, `G.audio.buy()`, `closeBox()`. `closeBox()` → `state='closing', t=0`, remove `displayModel` from `mb.holder`.

**updateBox(dt)** every frame (playing only):
- `?`-mark pulse: `mb.qMats[i].opacity = 0.25 + 0.55 * (0.5 + 0.5*Math.sin(state.time*1.3 + i*1.1))` (range 0.25–0.80).
- Lid: target rotation.x = **-2.0** rad in rolling/ready, else 0; eased `lid.rotation.x += (target - cur) * Math.min(1, dt*5)`.
- Beam opacity target: rolling **0.35**, ready **0.15**, else **0**; eased `* Math.min(1, dt*4)`.
- Box light intensity target: rolling **1.6**, ready **0.9**, else **0**; eased `* Math.min(1, dt*4)`.

| State | Behavior |
|---|---|
| `rolling` | Weapon cycle: `mb.cycleT -= dt`; on ≤0 → `cycleT = 0.16 + mb.t*0.04` (slows over time); swap `displayModel` = `G.buildWeaponModel(random key from G.BOX_POOL)`, `scale.setScalar(1.6)`, `rotation.y = Math.PI/2`, added to `mb.holder`. Holder rises: `holder.position.y = 1.0 + Math.min(0.5, mb.t*0.2)`. At `mb.t > 3.6`: 10% → teddy, else pick weapon from `G.BOX_POOL` excluding keys already in `G.Inv.slots` weapons (fallback: full pool if all owned); set displayModel same way; `state='ready', t=0`. |
| `teddy` (entry) | `t=0`; remove displayModel; `teddy.visible=true, teddy.position.y=0.5, teddy.rotation.y=0`; `G.audio.teddy()`; **`G.addPoints(950)`** (refund); `G.showMsg('The box moves…')`. |
| `ready` | `holder.rotation.y += dt*1.2`; `holder.position.y = 1.5 + Math.sin(mb.t*2)*0.05` (bob); take window: **auto-close at `mb.t > 9`** (`closeBox()`). |
| `teddy` (update) | `teddy.position.y = 0.5 + Math.min(1.1, mb.t*0.7)` (rises 1.1m); `teddy.rotation.y += dt*3`; light overridden: `intensity = 1.4 + Math.sin(mb.t*8)*0.6`; at `mb.t > 2.6`: hide teddy, `closeBox()`, relocate: `others = G.boxPads indices !== mb.padIndex`; `G.moveMysteryBox(random of others)`. |
| `closing` | `holder.rotation.y = 0`; at `mb.t > 1.2` → `state='idle'`. |

Box object fields used: `mb.state, mb.t, mb.cycleT, mb.qMats[], mb.lid, mb.beam, mb.light, mb.holder, mb.displayModel, mb.weapon, mb.teddy, mb.padIndex` (all built in map.js).

## Particles

- Pool: **260** meshes, `PlaneGeometry(0.06, 0.06)`, `MeshBasicMaterial({ color:0x7a0f0a, transparent:true, opacity:0, depthWrite:false })`, initially invisible, pre-added to scene.
- `emit(pos, n, color, spread, grav)`: reuse dead particles (`p.t >= p.life`); `vel = ((rnd-.5)*spread, rnd*spread*0.7, (rnd-.5)*spread)`; `life = 0.5 + rnd*0.5`; scale `0.7 + rnd*1.6`.
- Update: `vel.y -= grav*dt`; position += vel*dt; `opacity = 1 - t/life`; billboard via `quaternion.copy(G.camera.quaternion)`; hidden when expired.

| API | emit args |
|---|---|
| `G.spawnBlood(pos, n)` | `emit(pos, n, 0x6e0d08, 3.4, 6)` |
| `G.spawnDust(pos)` | `emit(pos, 5, 0x8d8678, 1.4, 1.5)` |
| `G.spawnSpark(pos, color)` | `emit(pos, 6, color, 2.6, 2)` |

## Laser beams

- Shared geo: `CylinderGeometry(0.014, 0.014, 1, 6, 1, openEnded:true)`.
- `G.spawnBeam(from, to, color)`: material `MeshBasicMaterial({ color, transparent:true, opacity:0.85, blending:AdditiveBlending, depthWrite:false })`; positioned at midpoint, `quaternion.setFromUnitVectors(yAxis, dir.normalized)`, `scale.set(1, len, 1)` with `len = max(0.1, dir.length())`.
- Fade/lifetime: `opacity = 0.85 * (1 - t/0.11)`; removed + material disposed at **t > 0.11s**.

## Projectiles (Arc Projector)

- `G.fireProjectile(origin, dir)`: bolt = `SphereGeometry(0.09, 10, 8)` + `MeshBasicMaterial({ color:0x9fe8ff })`, spawned at `origin + dir*0.5`, child `PointLight(0x66d4ff, 1.6, 7, 1.6)`; velocity `dir * 26` (m/s); `t = 0`.
- Detonation conditions (updateProjectiles): `t > 2.5` OR `pointInSolid(pos)` (AABB containment vs `G.solids`) OR `pos.y < 0.05` OR distance < **0.8** to any live zombie chest point `(z.pos.x, z.pos.y+1, z.pos.z)`.
- **explode(at):** `G.audio.explosion()`; `emit(at, 30, 0x9fe8ff, 7, 2)` + `emit(at, 20, 0xfff3c0, 5, 3)`; flash `PointLight(0x9fe8ff, 4, 14, 1.5)` removed after **130ms**; AoE radius **4.2** vs zombie chest: `z.takeDamage(1200 * (1 - d/5), 'body', hitPoint(z.pos.y+1.2))`; per hit `G.addPoints(10)`, kill `+G.addPoints(50)`; self-damage: if player chest distance < **3** → `G.damagePlayer(15)`; `G.shake(0.08)`.

## Electro-trap update (`G.Trap` from map.js; fields: state, t, posA, posB, zone{x0,x1,z0,z1}, tips[], hurtT)

- `active`: `t -= dt`. Visual arcs: chance `dt * 14` per frame → beam from `posA`/`posB` clones with `y = 0.3 + rnd*2.1` each, color `0x9fd8ff`; 35% chance `G.audio.zap()` per arc. Zombie damage: any live zombie with `pos.y <= 2` inside zone AABB → `takeDamage(360*dt + 15, 'body', chest y+1)`; kill → `G.addPoints(50)`. Player: inside zone and `y < 2` → tick timer `hurtT`, every **0.5s** → `G.damagePlayer(8)`. Tips flicker: `emissiveIntensity = 2 + rnd*2`. On `t <= 0` → `state='cooldown', t=40`, tips emissive **0.3**.
- `cooldown`: `t -= dt`; on ≤0 → `state='ready'`, tips emissive **1.2**.
- (Activation — 1000 pts, 25s active — happens in map/player interaction code, not here.)

## Flying boards (barricade rip debris, `G.flyingBoards`)

Per entry `{ mesh, vel, rot, t, attached }`: first frame `G.scene.attach(mesh)`; gravity `vel.y -= 9*dt`; position += vel*dt; rotation.x/y/z += rot.x/y/z*dt; hide + remove at **t > 1.4s**. Runs even while paused.

## Main loop (exact order)

```js
requestAnimationFrame(loop);
dt = Math.min(0.05, (now - last)/1000);   // clamped to 50ms
state.time += dt;
// 1. bulb flicker (always)
if (state.playing && !G.player.dead && !state.paused) {
  if (!G.CarSys.driving) { G.updatePlayer(dt); G.Build.update(); }   // skipped while driving
  G.CarSys.update(dt);
  G.PaP.update(dt);
  G.Craft.update(dt);
  G.Drops.update(dt);
  updateTrap(dt);
  updateRound(dt);
  for (const z of G.zombies) z.update(dt);
  G.zombies = G.zombies.filter(z => z.alive);
  updateBox(dt);
  updateProjectiles(dt);
}
updateBoards(dt); updateParticles(dt); updateBeams(dt);   // always
// door anims (always): group.position.y -= dt*1.4; hide below -2.7
// hurt flash decay (always): state.hurtFlash = max(0, hurtFlash - dt*1.2); G.updateHealthFx();
// camera shake (always, when shake > 0.0005):
//   camera.rotation.x += (rnd-.5)*shake*0.5; camera.rotation.y += (rnd-.5)*shake*0.5;
//   state.shake *= Math.pow(0.002, dt);
renderer.render(G.scene, G.camera);
```

## G.* contract surface

**Defined by game.js (consumed elsewhere):** `G.state`, `G.zombies`, `G.scene`, `G.camera`, `G.tryLock`, `G.noLock`, `G.onZombieKilled`, `G.addPoints`, `G.spend`, `G.deny`, `G.updateAmmoHUD`, `G.perkHUD`, `G.setPrompt`, `G.showMsg`, `G.hitmarker`, `G.updateHealthFx`, `G.updateFuelHUD`, `G.damagePlayer`, `G.shake`, `G.openDoor`, `G.rollBox`, `G.takeBoxWeapon`, `G.spawnBlood`, `G.spawnDust`, `G.spawnSpark`, `G.spawnBeam`, `G.fireProjectile`.

**Consumed by game.js (defined elsewhere):** `G.buildMap`, `G.initPaP`, `G.initPlayer`, `G.bindInput`, `G.onSelectionChanged`, `G.spawnPoint`, `G.player` (`pos, dead, hp, maxHp, perks, curItem, jetpack, jetFuel, lastDamageT`), `G.updatePlayer`, `G.giveWeapon`, `G.Inv` (`init, open, slots, weaponStats, nameFor`), `G.Build.update`, `G.Craft.update`, `G.Drops` (`spawn, update`), `G.CarSys` (`driving, update`), `G.PaP.update`, `G.Zombie` (ctor `(window, {hp, speed})`; instance `alive, state, pos, update, takeDamage(dmg, part, point) → {killed}|falsy`), `G.windows` (`w.room, w.group.position`), `G.rooms[name].unlocked`, `G.solids` (AABBs `minX..maxZ`), `G.mysteryBox`, `G.boxPads`, `G.moveMysteryBox(i)`, `G.BOX_POOL`, `G.buildWeaponModel(key)`, `G.bulbs`, `G.flyingBoards`, `G.Trap`, `G.audio` (`resume, roundStart, roundEnd, deny, buy, doorOpen, boxJingle, teddy, playerHurt, explosion, zap`).

**DOM ids required:** `game, loadNote, startBtn, resumeBtn, restartBtn, menuOverlay, pauseOverlay, deadOverlay, survStats, hud, round, pointsVal, pointsFeed, ammo, weaponName, prompt, msg, waveBanner, bloodOverlay, hitmarker, perksRow, reloadHint, fuelWrap, fuelFill`. CSS classes: `pf, pf neg, show (waveBanner/hitmarker/reloadHint), head, low, perkIcon`.
