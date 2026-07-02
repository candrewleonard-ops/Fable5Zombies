# weapons.js — Implementation Digest

Source: `design/undead_bunker/game/js/weapons.js` (Three.js r128, global `window.G`, no modules).
Units: meters. Viewmodel space: −Z = forward (toward muzzle), +Y = up. Player mounts viewmodel group at camera-local `(0.24, -0.22, -0.45)`.

## Exports (G.* contract surface)

| Symbol | Type | Consumers |
|---|---|---|
| `G.WEAPONS` | `{key: def}` stat table | player.js (fire/reload/ADS), inventory.js (`Inv.weaponStats`, icons), game.js (mystery box roll), map.js (wall-buys via `wb.key`), crafting.js (weapon pools), library.js (showcase) |
| `G.BOX_POOL` | `['smg','mg42','stg','arc','laser','trench','kar98']` | game.js mystery box |
| `G.buildWeaponModel(key)` | `def.build()` + `traverse: o.isMesh → o.castShadow = true`; returns `THREE.Group` | inventory icon renderer, mystery box display, PaP tray, library |

Def fields consumed elsewhere: `sound` → `G.audio.shot(kind)`; `beam` (color hex) → `G.spawnBeam`/`G.spawnSpark` per pellet; `flash` (color hex) → muzzle flash/light tint; `projectile:true` → `G.fireProjectile`; `bolt:true` → 0.8s bolt-work anim + `G.audio.bolt()` at +350ms; `boxOnly:true` → excluded from wall-buys; `cost` → wall-buy price (ammo refill = `Math.round(def.cost/2/10)*10`).

## G.WEAPONS (verbatim)

```js
G.WEAPONS = {
  mauser: { name: 'Mauser C96', sound: 'pistol', dmg: 40, headMult: 3.0, mag: 10, reserve: 80,  rpm: 300, auto: false, reload: 2.0, spread: 0.012, pellets: 1, kick: 0.02,  build: buildMauser, cost: 0 },
  kar98:  { name: 'K-98 Bolt Rifle', sound: 'rifle', dmg: 160, headMult: 4.0, mag: 5, reserve: 50, rpm: 46, auto: false, reload: 3.0, spread: 0.004, pellets: 1, kick: 0.06, bolt: true, build: buildKar, cost: 600 },
  trench: { name: 'M97 Trench Gun', sound: 'shotgun', dmg: 26, headMult: 1.5, mag: 6, reserve: 60, rpm: 65, auto: false, reload: 3.2, spread: 0.055, pellets: 8, kick: 0.08, build: buildTrench, cost: 1200 },
  smg:    { name: 'M1928 SMG', sound: 'smg', dmg: 34, headMult: 2.0, mag: 30, reserve: 210, rpm: 620, auto: true, reload: 2.6, spread: 0.02, pellets: 1, kick: 0.014, build: buildSMG, cost: 1750 },
  mg42:   { name: 'MG-42', sound: 'lmg', dmg: 42, headMult: 2.0, mag: 75, reserve: 300, rpm: 900, auto: true, reload: 4.6, spread: 0.028, pellets: 1, kick: 0.018, build: buildMG, boxOnly: true },
  stg:    { name: 'STG-44', sound: 'rifle', dmg: 55, headMult: 2.5, mag: 30, reserve: 180, rpm: 500, auto: true, reload: 2.8, spread: 0.014, pellets: 1, kick: 0.016, build: buildSTG, boxOnly: true },
  laser:  { name: 'HELIOS-8 Scatter Laser', sound: 'laser', dmg: 60, headMult: 2.0, mag: 8, reserve: 64, rpm: 85, auto: false, reload: 2.8, spread: 0.05, pellets: 8, kick: 0.05, beam: 0x35e6ff, flash: 0x4de8ff, build: buildLaser, boxOnly: true },
  arc:    { name: 'Arc Projector', sound: 'arc', dmg: 1200, headMult: 1.0, mag: 3, reserve: 18, rpm: 90, auto: false, reload: 3.2, spread: 0.002, pellets: 1, kick: 0.05, projectile: true, flash: 0x9fe8ff, build: buildArc, boxOnly: true },
};
```
Reload in seconds. `rpm` → fire cooldown `60/(rpm * (rapidPerk ? 1.12 : 1))`. Spread is radians-ish jitter: `dir.x += (rand-0.5)*spread*2; dir.y += (rand-0.5)*spread*2; dir.z += (rand-0.5)*spread*0.5; normalize()`; ADS multiplies spread by 0.4 (when `ads > 0.5`). Kick: `vmKick = min(0.2, vmKick + kick)`, camera `pitch += kick*0.35`, screen `G.shake(kick*1.4)`.

## Shared helpers (inside IIFE, not exported)

```js
tex(w, h, draw)          // canvas → THREE.CanvasTexture, RepeatWrapping, sRGBEncoding
box(w,h,d, mat, x,y,z, rx=0,ry=0,rz=0)          // BoxGeometry mesh
cyl(r1,r2,h, mat, x,y,z, rx=Math.PI/2, seg=14)  // CylinderGeometry(r1,r2,h,seg); default rx points cylinder along Z
torus(r,t, mat, x,y,z, rx=0,ry=0)               // TorusGeometry(r,t,8,20)
grp(...kids)                                     // THREE.Group
muzzleAt(g, x,y,z)  // adds empty Object3D at (x,y,z), stores as g.userData.muzzle, returns g
```

### Procedural textures (128×128 canvas)
- `gripWood`: fill `#5a3418`; horizontal bezier grain lines every 3px, stroke `rgba(30,15,4, 0.15+rand*0.25)`, control points jitter ±2px; 40 flecks `rgba(90,55,25,.3)` 2×1px.
- `wornMetal`: fill `#26272c`; 260 scratches `rgba(140–200,140–200,150–210, rand*0.09)` width 1–5×1px; 100 dark pits `rgba(0,0,0, rand*0.25)` 2×2px.

### Material palette `M` (MeshStandardMaterial)
| key | color | map | metalness | roughness | emissive / notes |
|---|---|---|---|---|---|
| metal | 0x9aa0ac | wornMetal | 0.85 | 0.42 | |
| metal2 | 0x3a3b40 | — | 0.8 | 0.45 | |
| steel | 0x62656e | — | 0.92 | 0.28 | |
| blued | 0x7c86a0 | wornMetal | 0.9 | 0.35 | |
| wood | 0xa9885f | gripWood | 0.05 | 0.75 | |
| woodD | 0x7a5a38 | gripWood | 0.05 | 0.8 | |
| energy | 0x18323a | — | 0.7 | 0.4 | emissive 0x0f5f6e @ 0.6 |
| armor | 0xd6dbe2 | — | 0.35 | 0.42 | laser-gun white armor |
| gun2 | 0x1b1d24 | — | 0.75 | 0.4 | laser-gun black chassis |
| cyan | 0x0a3038 | — | 0.4 | 0.35 | emissive 0x35e6ff @ 1.5 |
| amber | 0x3a1c04 | — | 0.4 | 0.35 | emissive 0xff8a2a @ 1.3 |

## Muzzle anchor convention

Every builder ends `return muzzleAt(g, x, y, z)` — an empty `Object3D` child stored in `group.userData.muzzle`. player.js: `vmWeapon.userData.muzzle.getWorldPosition(mz)` (fallback: vmRoot world pos). Muzzle flash = 0.22×0.22 plane, MeshBasicMaterial color 0xffd9a0 (or `def.flash`), additive, depthWrite false, opacity set to 0.9 on shot, random `rotation.z = rand*6`, billboarded to camera quaternion; plus PointLight(0xffc070 or `def.flash`, intensity→2.4, dist 9, decay 1.8) at mz. Both decay per frame: `value *= Math.pow(0.0001, dt)`.

| weapon | muzzle (x, y, z) |
|---|---|
| mauser | 0, 0.016, −0.35 |
| laser | 0, 0.004, −0.43 |
| kar98 | 0, 0.025, −0.56 |
| trench | 0, 0.025, −0.47 |
| smg | 0, 0.02, −0.38 |
| mg42 | 0, 0.02, −0.6 |
| stg | 0, 0.03, −0.44 |
| arc | 0, 0.02, −0.35 |

## Viewmodel builders (exact primitives; args in helper order)

### buildMauser (hero detail)
- Barrel: `cyl(0.016,0.0125,0.055, blued, 0,0.016,−0.115)` taper base; `cyl(0.0105,0.0105,0.20, blued, 0,0.016,−0.24)` tube; `cyl(0.0128,0.0128,0.018, steel, 0,0.016,−0.338)` stepped muzzle.
- Sights: front blade `box(0.0075,0.02,0.007, blued, 0,0.032,−0.332)`; sight base `box(0.011,0.006,0.014, blued, 0,0.024,−0.318)`; tangent rear `box(0.024,0.008,0.05, metal2, 0,0.05,−0.075)`; leaf `box(0.02,0.005,0.045, steel, 0,0.056,−0.078, rx=−0.12)`.
- Receiver: `box(0.042,0.052,0.135, blued, 0,0.004,−0.035)`; side panel relief `box(0.046,0.036,0.09, metal2, 0,0,−0.03)`; lower rail `box(0.043,0.01,0.1, steel, 0,−0.024,−0.035)`.
- Bolt: channel `box(0.024,0.018,0.15, steel, 0,0.037,−0.02)`; rear bolt `cyl(0.011,0.011,0.035, steel, 0,0.037,0.062)`; serration cap `box(0.028,0.006,0.02, metal2, 0,0.047,0.05)`.
- Ring hammer: `torus(0.0115,0.0032, steel, 0,0.038,0.083, rx=0, ry=π/2)`; spur `box(0.008,0.014,0.01, steel, 0,0.025,0.08)`.
- Magazine (ahead of trigger): `box(0.03,0.072,0.05, blued, 0,−0.052,−0.075)`; ribs `box(0.032,0.062,0.004, steel)` at z −0.052 and −0.098 (x 0, y −0.052); floorplate `box(0.034,0.006,0.054, metal2, 0,−0.09,−0.075)`.
- Trigger/guard: `box(0.006,0.005,0.03, steel, 0,−0.055,−0.018)`; `box(0.006,0.024,0.005, steel, 0,−0.066,−0.006)`; `box(0.006,0.005,0.032, steel, 0,−0.077,−0.02)`; blade `box(0.006,0.016,0.004, steel, 0,−0.062,−0.036, rx=0.25)`.
- Broomhandle grip: `cyl(0.0165,0.023,0.095, woodD, 0,−0.078,0.048, rx=0.38)`; cap `cyl(0.024,0.024,0.008, metal2, 0,−0.121,0.066, rx=0.38)`; lanyard ring `torus(0.008,0.0022, steel, 0,−0.132,0.072, rx=0.4, ry=0)`.
- Frame screws: `cyl(0.004,0.004,0.046, steel, 0,0.004,0.02, rx=0, seg=8)` and `(…, 0,−0.01,−0.09, rx=0, seg=8)`.

### buildLaser (HELIOS-8)
- Chassis `box(0.058,0.066,0.33, gun2, 0,0.004,−0.1)`; top armor cowl `box(0.064,0.026,0.3, armor, 0,0.045,−0.09)`; rear wedge `box(0.064,0.03,0.09, armor, 0,0.036,0.09, rx=0.18)`; front cowl `box(0.05,0.05,0.07, armor, 0,−0.006,−0.29, rx=−0.14)`.
- Glowing rails (cyan): `box(0.008,0.01,0.3)` at x ±0.033, y −0.012, z −0.1; belly rail `box(0.05,0.008,0.2, cyan, 0,−0.038,−0.13)`.
- 8-barrel emitter: shroud `cyl(0.037,0.041,0.075, gun2, 0,0.004,−0.365)`; for i=0..7, `a=(i/8)*2π`: barrel `cyl(0.0062,0.0062,0.085, steel, cos(a)*0.022, 0.004+sin(a)*0.022, −0.375)` + tip `cyl(0.004,0.004,0.01, cyan, same x/y, −0.418)`.
- Hot core `cyl(0.011,0.011,0.05, amber, 0,0.004,−0.39)`; muzzle ring `torus(0.037,0.005, cyan, 0,0.004,−0.402, 0,0)`.
- Energy drum: `cyl(0.034,0.034,0.055, gun2, 0,−0.055,0.02, rx=0)` then `rotation.z = π/2`; rings `torus(0.035,0.006, amber, 0,−0.055,0.02, rx=0, ry=π/2)` and `torus(0.035,0.004, cyan, 0,−0.055,0.041, rx=0, ry=π/2)`.
- Vents (amber): i=0..2, `box(0.004,0.02,0.03)` at x ±0.031, y 0.012, z `−0.2 + i*0.045`.
- Holo sight: posts `box(0.006,0.022,0.006, gun2)` at x ±0.012, y 0.068, z −0.03; pane `box(0.026,0.02,0.002, MeshBasicMaterial({color:0x66f0ff, transparent, opacity:0.35}), 0,0.085,−0.03)`; dot `box(0.005,0.005,0.002, cyan, 0,0.085,−0.028)`.
- Grips: rear `box(0.024,0.07,0.03, gun2, 0,−0.062,0.075, rx=0.3)`; fore `box(0.024,0.06,0.026, gun2, 0,−0.055,−0.24, rx=−0.25)`; trigger-guard base `box(0.02,0.02,0.05, steel, 0,−0.085,−0.02)`.

### buildKar (K-98)
`box(0.038,0.06,0.62, wood, 0,−0.01,−0.12)` stock fore; `box(0.045,0.075,0.16, wood, 0,−0.03,0.20)` butt; `cyl(0.012,0.012,0.5, steel, 0,0.025,−0.30)` barrel; `box(0.04,0.045,0.14, blued, 0,0.02,0.05)` receiver; bolt handle `cyl(0.008,0.008,0.055, steel, 0.045,0.03,0.05, rx=0, seg=8)`; front sight `box(0.008,0.024,0.008, steel, 0,0.055,−0.53)`; rear sight `box(0.028,0.008,0.04, steel, 0,0.052,−0.02)`; trigger guard `box(0.014,0.03,0.03, metal2, 0,−0.045,0.09)`; muzzle cap `cyl(0.013,0.013,0.02, steel, 0,0.025,−0.545)`.

### buildTrench (M97)
Barrel `cyl(0.014,0.014,0.44, steel, 0,0.025,−0.24)`; pump tube `cyl(0.017,0.017,0.30, wood, 0,−0.012,−0.20)`; receiver `box(0.045,0.06,0.16, blued, 0,0.005,0)`; stock `box(0.04,0.06,0.2, woodD, 0,−0.02,0.17)`; heat shield `box(0.05,0.02,0.4, steel, 0,0.055,−0.22)`; trigger guard `box(0.014,0.03,0.03, metal2, 0,−0.045,0.04)`.

### buildSMG (M1928)
Drum mag: `cyl(0.05,0.05,0.03, metal2, 0,−0.07,−0.10, rx=0)` then `rotation.set(0, π/2, π/2)`. Barrel `cyl(0.013,0.013,0.28, steel, 0,0.02,−0.22)`; top rib `box(0.05,0.024,0.3, steel, 0,0.05,−0.2)`; receiver `box(0.045,0.06,0.2, blued, 0,0.005,−0.01)`; stock `box(0.04,0.06,0.16, woodD, 0,−0.02,0.16)`; foregrip `cyl(0.016,0.02,0.07, woodD, 0,−0.06,−0.24, rx=0.3)`; pistol grip `cyl(0.016,0.02,0.07, woodD, 0,−0.065,0.05, rx=0.3)`.

### buildMG (MG-42)
Barrel `cyl(0.016,0.016,0.55, steel, 0,0.02,−0.3)`; shroud `box(0.06,0.05,0.55, metal2, 0,0.02,−0.28)`; receiver `box(0.055,0.08,0.24, blued, 0,−0.005,0.06)`; stock `box(0.04,0.055,0.14, woodD, 0,−0.01,0.23)`; left feed cover `box(0.02,0.1,0.07, metal2, −0.045,−0.03,0)`; grip `cyl(0.015,0.018,0.07, woodD, 0,−0.07,0.1, rx=0.3)`; bipod legs `box(0.012,0.06,0.012, steel, ±0.02,−0.09,−0.42, rx=±0.5)` (x +0.02 with rx 0.5, x −0.02 with rx −0.5).

### buildSTG (STG-44)
Barrel `cyl(0.012,0.012,0.3, steel, 0,0.03,−0.28)`; receiver `box(0.045,0.06,0.3, blued, 0,0.01,−0.06)`; curved mag `box(0.035,0.12,0.06, metal2, 0,−0.075,−0.11, rx=0.25)`; stock `box(0.04,0.05,0.18, woodD, 0,0,0.18)`; grip `cyl(0.015,0.019,0.075, woodD, 0,−0.06,0.02, rx=0.3)`; front sight `box(0.008,0.025,0.008, steel, 0,0.06,−0.4)`; rear block `box(0.03,0.03,0.06, metal2, 0,0.045,−0.02)`.

### buildArc (Arc Projector)
Body `box(0.05,0.07,0.2, metal2, 0,0,−0.02)`; core rod `cyl(0.012,0.012,0.3, steel, 0,0.02,−0.2)`; 3 energy discs `cyl(r,r,0.02, energy, 0,0.02,z, rx=π/2, seg=16)` with (r,z) = (0.028,−0.16), (0.024,−0.22), (0.02,−0.28); emitter sphere `SphereGeometry(0.02,12,10)` with `M.energy.clone()` positioned post-hoc at `(0, 0.02, −0.33)` (it is `g.children[5]`); grip `cyl(0.016,0.02,0.075, woodD, 0,−0.065,0.04, rx=0.3)`; top capacitor `box(0.02,0.05,0.1, energy, 0,0.055,0)`.

## Pack-a-Punch transforms (defined in inventory.js/player.js, applied to G.WEAPONS defs)

Stats (`G.Inv.weaponStats(item)`, when `item.pap`):
```js
dmg: base.dmg * 2.5,
mag: Math.ceil(base.mag * 1.5),
reserve: Math.ceil(base.reserve * 1.5),
reload: base.reload * 0.85,
displayName: '★ ' + base.name,
```
Viewmodel tint (player.js, on equip when `item.pap`): traverse meshes, clone material, set `emissive = 0x7a2bd6`, `emissiveIntensity = 0.4`.
Hotbar slot glow (CSS): `.slot.pap { box-shadow: inset 0 0 12px rgba(160,70,255,.8); }` (kept alongside white sel inset when selected). PaP machine cost 2500; only non-★ weapons insertable; wall-buy ammo lookup ignores ★ copies (`!s.pap`).

## Laser / Arc special rendering (game.js)

- `G.spawnBeam(from, to, color)`: shared `CylinderGeometry(0.014, 0.014, 1, 6, 1, openEnded:true)`; `MeshBasicMaterial({color, transparent, opacity:0.85, blending:AdditiveBlending, depthWrite:false})`; positioned at midpoint, quaternion from +Y to dir, `scale.y = len`; lifetime 0.11 s with `opacity = 0.85*(1 − t/0.11)`, then removed + material disposed. Laser fires one beam per pellet (8) from `userData.muzzle` world pos to ray end (`def.beam` = 0x35e6ff) plus `G.spawnSpark(end, 0x35e6ff)` (6 particles, speed 2.6, grav 2).
- `G.fireProjectile(origin, dir)` (arc, replaces raycast entirely; origin = camera world pos, start offset `+dir*0.5`): sphere `SphereGeometry(0.09,10,8)`, `MeshBasicMaterial(0x9fe8ff)`, child `PointLight(0x66d4ff, 1.6, 7, 1.6)`; velocity `dir*26` m/s, no gravity. Detonates on: age > 2.5 s, point-in-AABB vs `G.solids`, y < 0.05, or within 0.8 m of any live zombie center (`z.pos + (0,1,0)`).
- `explode(at)`: `G.audio.explosion()`; particles: 30× 0x9fe8ff (speed 7, grav 2) + 20× 0xfff3c0 (speed 5, grav 3); `PointLight(0x9fe8ff, 4, 14, 1.5)` removed after 130 ms; zombies within 4.2 m take `1200 * (1 − d/5)` as 'body' (+10 pts per hit, +50 on kill); player within 3 m takes 15; `G.shake(0.08)`.

## Dependencies
Requires global `THREE` (r128 CDN) and DOM canvas; consumed via `window.G` — beam/spark/projectile helpers live in game.js, stat/PaP math in inventory.js, firing/muzzle-flash logic in player.js.
