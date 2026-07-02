# build.js — Building System Digest (G.Build)

Source: `design/undead_bunker/game/js/build.js` (IIFE writing onto `window.G`, Three.js r128 as `THREE`).

## Constants

| name | value |
|---|---|
| `GRID` | 2 (m, horizontal grid) |
| `MODULE` | 2.4 (m, vertical module / wall height) |
| `COST` | 50 points per placement |
| `REFUND` | 25 points on removal |
| facing dirs `DIRS` | `[[0,-1],[-1,0],[0,1],[1,0]]` — f: 0=-z, 1=-x, 2=+z, 3=+x |

## Materials / textures

- **plankTex**: 128×128 canvas. Base fill `#7a5127`. Plank rows every 21px: plank fill `rgba(90+rand*30, 60+rand*20, 28, 1)` 19px tall; 2px gap line `rgba(30,16,5,.6)`; per plank 4 grain strokes `rgba(45,25,8,.35)` from `(0, y+4+rand*12)` to `(128, yy+rand*4-2)`. `CanvasTexture`, `wrapS=wrapT=RepeatWrapping`, `encoding=sRGBEncoding`.
- **woodMat**: `MeshStandardMaterial({ map: plankTex, roughness: 0.85 })` — used for placed pieces and icons.
- **ghostOk**: `MeshBasicMaterial({ color: 0x4dff7a, transparent: true, opacity: 0.38, depthWrite: false })`.
- **ghostBad**: same but `color: 0xff4d4d`.

## Piece geometries — `pieceBoxes(piece, cx, y0, cz, f)` → AABB list

All pieces are lists of axis-aligned boxes `{minX,maxX,minY,maxY,minZ,maxZ, walkTop?}`; centered at grid cell `(cx, cz)` with base `y0`.

| piece | boxes (exact) |
|---|---|
| **wall** | 1 box. `alongX = (f===0 || f===2)`. If alongX: x `cx±1`, z `cz±0.08`; else x `cx±0.08`, z `cz±1`. y `y0 .. y0+2.4`. (2 × 2.4 × 0.16) |
| **floor** | 1 box: x `cx±1`, z `cz±1`, y `y0 .. y0+0.16`, `walkTop: true`. (2 × 0.16 × 2) |
| **stairs** | 6 boxes, i = 0..5. `[dx,dz] = DIRS[f]`; `off = -1 + 0.17 + i*0.34`; step center `(cx+dx*off, cz+dz*off)`; half-extents `w2 = dx===0 ? 1 : 0.17`, `d2 = dz===0 ? 1 : 0.17`; y `y0 .. y0 + 0.4*(i+1)` (columns 0.4..2.4 tall); each `walkTop: true`. Steps rise toward the facing direction; total rise 2.4 over 2m run. |
| **bench** | 1 box: x `cx±0.8`, z `cz±0.5`, y `y0 .. y0+0.95`. (1.6 × 0.95 × 1.0) |
| **anvil** | 1 box: x `cx±0.45`, z `cz±0.3`, y `y0 .. y0+0.66`. (0.9 × 0.66 × 0.6) |

`meshFromBoxes(boxes, mat)`: `THREE.Group` of one `BoxGeometry(dx,dy,dz)` mesh per box, positioned at box center, `castShadow = receiveShadow = true`.

`G.buildPieceModel(piece)` = `meshFromBoxes(pieceBoxes(piece, 0, 0, 0, 0), woodMat)` — local-space, facing 0; used by inventory.js for 128px icons and library.js showcase cards.

## State object `G.Build` (= `B`)

```js
{ active: null, valid: false, placed: [], cx: 0, cz: 0, y0: 0, f: 0, ghost: null, ghostKey: '' }
```

- `B.setActive(piece)`: sets `B.active = piece || null`; if cleared, hides ghost. Called from player.js `G.onSelectionChanged()`: piece = `item.piece` for `type:'build'` items, `item.kind` for `type:'place'` items (bench/anvil), else `null`.

## Ghost placement — `B.update()` (called every frame from game.js when not driving)

1. If `!B.active`: hide ghost, return.
2. Ray from camera world position, direction `(0,0,-1)` rotated by `camera.quaternion`.
3. `hitT = G.rayVsSolids ? G.rayVsSolids(origin, dir, 5.5) : 5.5`; `t = min(5.5, hitT + 0.05)`; target point `tgt = origin + dir * max(2, t)` (min reach 2m, max 5.5m, penetrates 0.05 past a hit surface).
4. **Grid snap**: `cx = Math.round(tgt.x / 2) * 2`; `cz = Math.round(tgt.z / 2) * 2`.
5. **Vertical**: `surf = G.groundAt(cx, cz, tgt.y + 0.6)`. Then
   ```js
   B.y0 = (tgt.y - surf < 0.5 && tgt.y - surf > -1.2) ? surf : Math.max(0, Math.round(tgt.y / 2.4) * 2.4);
   ```
   i.e. surface-snap when target is within (−1.2, +0.5) of the walkable surface below, else snap to the nearest 2.4m module, clamped ≥ 0.
6. **Yaw snap**: `B.f = ((Math.round(G.player.yaw / (Math.PI/2)) % 4) + 4) % 4` (player yaw quantized to 90°).
7. **Validity**: `B.valid = !overlapsSolids(boxes) && !containsPlayer(boxes) && G.state.points >= 50`.
8. Ghost rebuild is keyed on `` `${active}|${cx}|${cz}|${y0}|${f}|${valid}` ``; on change, old ghost removed from `G.scene`, new one built via `meshFromBoxes(boxes, valid ? ghostOk : ghostBad)` with shadows disabled on all meshes; ghost set visible.

### Validity checks (exact)

- `overlapsSolids(boxes)`: for each box vs every `s` in `G.solids`, AABB overlap with margin `M = 0.05` shrinking the candidate: `b.minX + M < s.maxX && b.maxX - M > s.minX` (same for Y, Z) → invalid. (Allows flush adjacency; blocks true overlap.)
- `containsPlayer(boxes)`: player pos `p = G.player.pos`, radius `r = 0.34`, height 1.7: overlap test `p.x + r > b.minX && p.x - r < b.maxX && p.z + r > b.minZ && p.z - r < b.maxZ && p.y + 1.7 > b.minY && p.y < b.maxY` → invalid.
- Points: `G.state.points >= 50` even for bench/anvil (ghost validity always requires 50 pts, although place is free for them — prototype quirk).

## Placement — `B.place(opts = {})` → bool

- If `!B.active || !B.valid`: `G.audio.deny()`, return false.
- If `!opts.free`: `G.spend(50)` must succeed else return false. (player.js: LMB on a `build` item → `B.place()`; LMB on a `place` item (bench/anvil) → `B.place({ free: true })`, and on success the inventory slot is cleared: `G.Inv.slots[G.Inv.sel] = null; G.Inv.render(); G.onSelectionChanged();`.)
- Boxes recomputed via `pieceBoxes(active, cx, y0, cz, f)`.
- **bench/anvil**: visual `group = G.buildBenchModel()` / `G.buildAnvilModel()` (from crafting.js), `group.position.set(cx, y0, cz)`, `group.rotation.y = f * Math.PI/2`; pushes `{ kind, pos: new Vector3(cx, y0, cz), group }` onto `G.stations` (interactable via F, crafting.js).
- **wall/floor/stairs**: `group = meshFromBoxes(boxes, woodMat)`.
- `G.scene.add(group)`.
- **Solid/walkable registration** — for every box:
  - push a copy `{minX,maxX,minY,maxY,minZ,maxZ}` onto `G.solids` (map.js collision list; zombies/player/rays all use it).
  - if `box.walkTop`: push `{minX,maxX,minZ,maxZ, y: box.maxY}` onto `G.walkables` (used by `G.groundAt` for landing/surface snap).
- Record `B.placed.push({ group, solids, walks, boxes, piece })` (the exact object references, for later removal).
- `G.audio.boardAdd()`; `B.ghostKey = ''` (forces ghost rebuild); return true.

## Removal — `B.removeTargeted()` → bool (RMB while holding a build item)

- Raymarch from camera along view dir: `for (t = 0.4; t < 6; t += 0.05)`, point `p = origin + dir*t`.
- Hit test each placed piece's boxes inflated by `M = 0.08`: `p.x > minX-M && p.x < maxX+M && p.y > minY-M && p.y < maxY+M && p.z > minZ-M && p.z < maxZ+M`.
- On first hit: remove `group` from `G.scene`; splice each stored solid out of `G.solids` (by `indexOf`) and each walkable out of `G.walkables`; splice the entry from `B.placed`.
- If piece was `bench`/`anvil`: remove its entry from `G.stations` (matched by `s.group === pl.group`) and return the item to inventory via `G.Inv.addItemAt({ type: 'place', kind: pl.piece })` — **no points refund**.
- Else (wall/floor/stairs): `G.addPoints(25)`.
- `G.audio.boardRip()`; return true. Returns false if nothing hit within 6m.

## G.* contract surface

**Exported by build.js**: `G.Build` (`.active .valid .placed .cx .cz .y0 .f .ghost .ghostKey .setActive(piece) .update() .place(opts) .removeTargeted()`), `G.buildPieceModel(piece)`.

**Consumed (external deps, one line each)**:
- `G.solids`, `G.walkables`, `G.groundAt(x,z,yFrom)` — map.js (AABB collision + walkable surface query).
- `G.rayVsSolids(origin, dir, maxT)` — player.js (slab-method ray vs `G.solids`; optional — falls back to 5.5).
- `G.spend(n)`, `G.addPoints(n)`, `G.state.points`, `G.scene`, `G.camera` — game.js.
- `G.player` (`.pos`, `.yaw`) — player.js.
- `G.buildBenchModel()`, `G.buildAnvilModel()`, `G.stations` — crafting.js.
- `G.Inv.addItemAt(item)` — inventory.js.
- `G.audio.deny() / .boardAdd() / .boardRip()` — audio.js.

**Callers**: game.js calls `G.Build.update()` each frame (skipped while driving); player.js calls `setActive`, `place`, `place({free:true})`, `removeTargeted`, `buildPieceModel`; inventory.js/library.js use `buildPieceModel` for icons/showcase.

## Behavioral notes (exact, non-obvious)

- One shared ghost; rebuilt only when the ghostKey changes (includes validity → color swap rebuilds mesh).
- Placed pieces never merge; each placement is independent and individually removable.
- Zombies do not attack built pieces; they only path/collide around the registered `G.solids` (README quirk, keep for v1).
- Stairs walkable tops are 6 flat strips at heights 0.4, 0.8, 1.2, 1.6, 2.0, 2.4 — stepped, not a ramp.
- `B.place` reuses the last `B.update` snap state (`cx, cz, y0, f`) — no re-raycast at click time.
