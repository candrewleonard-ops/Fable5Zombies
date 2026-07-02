# Pack-a-Punch ("The Reforger") — pap.js implementation digest

Source: `game/js/pap.js`. IIFE on shared namespace `window.G`. Placement (game.js): `G.initPaP(8.5, 17.2, Math.PI)` — STORAGE room, front (+Z) rotated to face −Z world.

## Contract surface (G.*)

| Export | Signature / shape |
|---|---|
| `G.buildPaPModel()` | → `THREE.Group`, front faces +Z; `group.userData = { tray, rollers, stamp, light, runeMat }`. Also used by library.js (asset showcase spins `rollers`). |
| `G.PaP` | singleton `P = { state:'idle', t:0, item:null, model:null, weaponModel:null, pos:null, cost:2500 }` |
| `G.initPaP(x, z, ry)` | builds model, `position.set(x,0,z)`, `rotation.y = ry`, adds to `G.scene`; pushes collision AABB into `G.solids`: `{minX:x-0.85, maxX:x+0.85, minY:0, maxY:1.9, minZ:z-0.55, maxZ:z+0.55}` (NOT rotated by ry); sets `P.pos = Vector3(x,0,z)` |
| `P.canInsert(item)` | `P.state==='idle' && item && item.type==='weapon' && !item.pap` (defined but player.js duplicates this check inline instead of calling it) |
| `P.insert(item)` | see State machine |
| `P.takeOut()` | see State machine; returns upgraded item or `null` |
| `P.update(dt)` | called every frame from game.js main loop |

Consumed from other files (one-line dependency note): `THREE` (r128 global), `G.scene`/`G.solids`/`G.spawnSpark` (game.js — `G.spawnSpark = (pos,color) => emit(pos, 6, color, 2.6, 2)`), `G.buildWeaponModel(key)` (weapons.js), `G.Inv.weaponStats(item)` (inventory.js), `G.audio.reloadStart/papHum/papDing/buy` (audio.js).

## Materials

| Name | Type | color | metalness | roughness | emissive | emissiveIntensity |
|---|---|---|---|---|---|---|
| dark | MeshStandardMaterial | `#191b20` | 0.7 | 0.45 | — | — |
| steel | MeshStandardMaterial | `#565a63` | 0.9 | 0.3 | — | — |
| copper | MeshStandardMaterial | `#8a5a2a` | 0.95 | 0.35 | — | — |
| runeM | MeshStandardMaterial | `#1a0a24` | — | — | `#b04aff` | 1.4 (animated at runtime) |
| hotM | MeshStandardMaterial | `#2a1004` | — | — | `#ff7a1a` | 1.2 (static) |

Builder helpers (all meshes `castShadow = true`):
- `bx(w,h,d,mat,x,y,z,rx=0)` → BoxGeometry(w,h,d) at (x,y,z), `rotation.x = rx`
- `cy(r,h,mat,x,y,z,rz=Math.PI/2)` → CylinderGeometry(r,r,h,12) at (x,y,z), `rotation.z = rz` (default = axis along X; rz=0 = vertical)

## Model parts (local coords, y-up, front = +Z)

| Part | Geometry (w×h×d or r,h) | Mat | Position | Rotation |
|---|---|---|---|---|
| base cabinet | box 1.5×0.95×0.85 | dark | (0, 0.475, 0) | — |
| mid band | box 1.5×0.22×0.9 | steel | (0, 1.02, 0) | — |
| upper housing | box 1.34×0.55×0.7 | dark | (0, 1.4, −0.05) | — |
| console top | box 1.34×0.3×0.72 | steel | (0, 1.78, −0.05) | rx −0.15 |
| rune strip | box 1.52×0.06×0.87 | runeM | (0, 1.14, 0) | — |
| rune accents ×2 | box 0.09×0.06×0.4 | runeM | (±0.55, 1.81, −0.02) | rx −0.15 |
| side pipes (vertical) ×2 | cyl r 0.07, h 1.5 | copper | (±0.82, 0.9, −0.25) | rz 0 (vertical) |
| pipe tops (horizontal) ×2 | cyl r 0.11, h 0.5 | copper | (±0.82, 1.62, −0.25) | rz π/2 (axis X) |
| furnace window | box 0.9×0.34×0.06 | hotM | (0, 1.38, 0.31) | — |
| rollers ×2 (`userData.rollers`) | cyl r 0.06, h 0.85 | steel | (0, 1.06, 0.28 + i·0.16) → z = 0.28, 0.44 | rz π/2 (axis X) |
| stamp head (`userData.stamp`) | box 0.5×0.22×0.4 | steel | (0, 1.42, 0.38) | — |
| tray (`userData.tray`) — Group | — | — | (0, 0.86, 0.55) rest pose | slides along local Z |
| └ tray plate | box 0.95×0.06×0.55 | steel | (0,0,0) in tray | — |
| └ tray front lip | box 0.95×0.1×0.05 | dark | (0, 0.04, 0.27) in tray | — |
| light (`userData.light`) | PointLight color `#b04aff`, intensity 0.7, distance 6, decay 1.8 | — | (0, 1.6, 0.8) | — |

## State machine (`P.update(dt)`, `P.t += dt` every frame; shared `pulse = 1 + Math.sin(P.t*3)*0.25`)

Flow: `idle → in → work → out → ready → (takeOut) → idle`.

### idle
- `light.intensity = 0.55 * pulse` (range 0.4125–0.6875, period 2π/3 ≈ 2.09 s)
- `runeMat.emissiveIntensity = 1.2 + Math.sin(P.t*2)*0.3`

### insert (`P.insert(item)` — entry to `in`)
1. `P.item = item; P.state = 'in'; P.t = 0`
2. Remove old `P.weaponModel` from tray if any
3. `P.weaponModel = G.buildWeaponModel(item.key)`; `scale.setScalar(1.5)`; `rotation.y = Math.PI/2`; `position.set(0, 0.12, 0)`; added as child of `tray`
4. `tray.position.z = 1.0` (extended)
5. `G.audio.reloadStart()`

### in (tray slides in)
- `tray.position.z = Math.max(0.18, tray.position.z - dt*1.4)` — 1.0 → 0.18 at 1.4 m/s ⇒ **≈0.586 s**
- On `z <= 0.18`: `state='work'; t=0;` `G.audio.papHum()` (audio.js: `tone(70,3.2,{type:'sawtooth',gain:0.18,slide:95}); tone(105,3.2,{type:'sawtooth',gain:0.12,slide:140}); noise(3.0,{f:300,gain:0.12})`)

### work (fixed **3.4 s**)
- Rollers: `r.rotation.x += dt * 14` (14 rad/s, about X)
- Stamp pound: `stamp.position.y = 1.42 - Math.abs(Math.sin(P.t*6)) * 0.16` (y 1.26–1.42; |sin| ⇒ ~1.91 pounds/s)
- `light.intensity = 1.6 + Math.sin(P.t*12)*0.8` (0.8–2.4)
- `runeMat.emissiveIntensity = 2.2 + Math.sin(P.t*9)*1` (1.2–3.2)
- Sparks: per frame `if (P.weaponModel && Math.random() < dt*6)` → `G.spawnSpark(P.model.localToWorld(new T.Vector3(0,1.1,0.3)), 0xb04aff)` (~6 sparks/s, purple `#b04aff`)
- On `P.t > 3.4`: `state='out'; t=0;` then apply upgraded glow to display weapon: `weaponModel.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.emissive = new T.Color(0x7a2bd6); o.material.emissiveIntensity = 0.45; } })`; `G.audio.papDing()` (audio.js: triangles 880/1320/1760 Hz, 0.4 s, gain 0.14, delays i·0.16 s + square 220 Hz 0.5 s gain 0.08)

### out (tray slides back out)
- `tray.position.z = Math.min(1.0, tray.position.z + dt*1.2)` — 0.18 → 1.0 at 1.2 m/s ⇒ **≈0.683 s**
- Stamp returns exponentially: `stamp.position.y += (1.42 - stamp.position.y) * Math.min(1, dt*6)` (rate 6/s)
- On `z >= 1.0`: `state='ready'; t=0`

### ready (waits indefinitely for take)
- `light.intensity = 1.2 * pulse` (0.9–1.5)
- Float/bob: `weaponModel.position.y = 0.16 + Math.sin(P.t*2.5)*0.03` (note: bob center 0.16 ≠ insert y 0.12; period 2π/2.5 ≈ 2.51 s, ±0.03 amplitude)
- Timer clamp: `if (P.t > 40) P.t = 10` — never ejects; keeps `P.t` bounded (quirk: 40→10 is not sin-period-aligned, causes a one-frame bob phase jump)

### takeOut (`P.takeOut()` — only if `state === 'ready'`, else returns `null`)
1. `item.pap = true`
2. `const st = G.Inv.weaponStats(item); item.mag = st.mag; item.reserve = st.reserve` (full refill at upgraded capacities)
3. `P.item = null; P.state = 'idle'; P.t = 0`; remove & null `P.weaponModel`
4. Tray reset: dead-code line `u.tray.position.z = 0.55 - P.model.position.z + P.model.position.z;` (≡ 0.55) immediately overridden by `u.tray.position.set(0, 0.86, 0.55)` — net effect: tray back to rest pose (0, 0.86, 0.55)
5. `G.audio.buy()`; returns item

## Gun ride path (summary)

Weapon is a child of `tray` at local (0, 0.12, 0), scale 1.5, rotY π/2 (barrel along tray X, broadside to player). Tray local z: **1.0 (extended, insert) → 0.18 (under rollers/stamp, work) → 1.0 (eject)**; tray height constant local y 0.86. World-space follows machine transform (rotation.y = ry).

## Upgrade stat effect (`item.pap === true`, applied by `G.Inv.weaponStats` in inventory.js)

- damage ×2.5 · mag & reserve ×1.5 (ceil) · reload ×0.85 · displayName `"★ " + name` · purple emissive tint `#7a2bd6` @ 0.45 on viewmodel · purple glow on hotbar slot. PaP purple design tokens: `#b04aff` (light/runes/sparks), `#7a2bd6` (weapon glow).

## Take/insert interaction (player.js, F key edge-triggered)

Proximity gate: `G.PaP.pos.distanceTo(P.pos) < 2.6`. Prompt priority values (lower d wins among nearby interactables):

| Condition | d | type | Prompt |
|---|---|---|---|
| `state==='idle' && curItem && curItem.type==='weapon' && !curItem.pap` | 0.6 | `pap` | `<b>F</b> — Reforge ${P.curWeapon.displayName} <b>[2500]</b>` |
| `state==='ready'` | 0.4 | `papTake` | `<b>F</b> — Take ★ ${G.WEAPONS[G.PaP.item.key].name}` |
| any other non-idle state | 0.7 | `papWait` | `Reforging…` (no key) |

- **Insert** (`pap`): `if (G.spend(2500)) { const item = P.curItem; G.Inv.slots[G.Inv.sel] = null; G.Inv.render(); G.PaP.insert(item); G.onSelectionChanged(); } else G.deny();` — held weapon leaves inventory (hand goes empty) while machine works.
- **Take** (`papTake`): `const upgraded = G.PaP.takeOut(); if (upgraded) { G.Inv.addItemAt(upgraded, G.Inv.slots[G.Inv.sel] ? null : G.Inv.sel); G.showMsg(G.Inv.weaponStats(upgraded).displayName + ' ready'); G.audio.perkJingle(); }` — auto-selects: goes back into the currently selected slot if it is still empty, otherwise first free slot.

## Per-frame hook

game.js main loop calls `G.PaP.update(dt)` unconditionally (guarded internally by `if (!P.model) return`).
