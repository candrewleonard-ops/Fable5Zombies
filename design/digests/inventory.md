# inventory.js — Implementation Digest

Source: `design/undead_bunker/game/js/inventory.js` (IIFE writing to `window.G`; load after `crafting.js`, before `player.js`).
Related CSS/DOM: `design/undead_bunker/game/Undead Bunker.html` lines 61–77, 144.

## Constants & Data Model

| Name | Value |
|---|---|
| `HOT` | 9 (hotbar slot count) |
| `TOTAL` | 36 (total slots) |
| `Inv.slots` | `new Array(36).fill(null)` — single flat array; indices 0–8 = hotbar, 9–35 = backpack grid |
| `Inv.sel` | 0 (selected hotbar index) |
| `Inv.open` | false (panel open flag) |
| `Inv.held` | null (item picked up by cursor in panel) |
| `Inv.icons` | `{}` — icon key → dataURL string |

### Item object shapes (stored in `Inv.slots[i]`)
| type | fields |
|---|---|
| weapon | `{ type:'weapon', key, mag, reserve, pap:bool }` |
| build | `{ type:'build', piece }` — piece ∈ `wall`, `floor`, `stairs` |
| mat | `{ type:'mat', mat, count }` — mat ∈ `wood`, `coal`, `wand` |
| place | `{ type:'place', kind }` — kind ∈ `bench`, `anvil` |
| car | `{ type:'car' }` |

### Icon key scheme (`Inv.iconFor`)
```
weapon → icons['w:' + item.key]
build  → icons['b:' + item.piece]
mat    → icons['m:' + item.mat]
place  → icons['p:' + item.kind]
else   → icons['car']
```

### Display names (`Inv.nameFor`)
| item | name |
|---|---|
| weapon | `Inv.weaponStats(item).displayName` (`'★ ' + base.name` if pap) |
| build wall/floor/stairs | `Wood Wall` / `Wood Floor` / `Wood Stairs` |
| mat wood/coal/wand | `Wood` / `Coal` / `Magic Wand` |
| place bench/anvil | `Crafting Bench` / `Anvil` |
| car | `Car Keys` |

## `Inv.weaponStats(item)` — PaP formula (verbatim)
Base = `G.WEAPONS[item.key]`. If `!item.pap`: `Object.assign({}, base, { displayName: base.name })`. If pap:
```js
dmg: base.dmg * 2.5,
mag: Math.ceil(base.mag * 1.5),
reserve: Math.ceil(base.reserve * 1.5),
reload: base.reload * 0.85,
displayName: '★ ' + base.name,
pap: true,
```

## Icon Rendering Pipeline (`renderIcon(model, zoom = 1)`)
- Lazy singleton `new THREE.WebGLRenderer({ alpha: true, antialias: true })`
- `setSize(128, 128)`; `outputEncoding = THREE.sRGBEncoding`
- Per icon: fresh `THREE.Scene` with:
  - `HemisphereLight(0xcfd8e8, 0x40352a, 1.1)`
  - `DirectionalLight(0xffffff, 1.1)` at position `(2, 4, 3)`
- Model wrapped in a `Group`; model recentred: `model.position.sub(bboxCenter)` (Box3 from object)
- Wrap rotation: `wrap.rotation.set(0.42, -0.72, 0)` (radians)
- `r = Math.max(size.x, size.y, size.z)` from bbox size
- Camera: `PerspectiveCamera(30, 1, 0.01, 50)`; `cam.position.set(0, 0, r * 2.15 / zoom)`; `lookAt(0,0,0)`
- Render, return `iconRenderer.domElement.toDataURL()` (transparent PNG dataURL)

### `genIcons()` — run once at `Inv.init()`, then renderer disposed
| icon key | model builder | zoom |
|---|---|---|
| `w:<key>` for every key in `G.WEAPONS` | `G.buildWeaponModel(key)` | 1.12 |
| `car` | `G.buildCarModel()` | 1.05 |
| `b:wall`, `b:floor`, `b:stairs` | `G.buildPieceModel(p)` | 1 (default) |
| `m:wood`, `m:coal`, `m:wand` | `G.buildMatModel(m)` | wand: 1.15, else 1 |
| `p:bench` | `G.buildBenchModel()` | 1 (default) |
| `p:anvil` | `G.buildAnvilModel()` | 1.1 |

Teardown: `iconRenderer.dispose(); iconRenderer.forceContextLoss && iconRenderer.forceContextLoss(); iconRenderer = null;`

## DOM Structure & Init (`Inv.init()`)
Order: `genIcons()` → grab elements → build slots → mousemove ghost → `G.Craft.initUI()` → starting loadout → `Inv.render()`.

- Elements: `#hotbar` (HUD hotbar), `#invPanel` (panel overlay), `#heldGhost` (cursor ghost).
- `mkSlot(i, arr, parent)`: `<div class="slot" data-i>` with innerHTML `'<img draggable="false"><span class="cnt"></span>'`.
- Three slot-element arrays:
  - `slotEls[0..8]` — HUD hotbar children of `#hotbar` (NO click handlers).
  - `panelSlotEls[9..35]` — children of `#invPanel .invGrid`, `onclick = () => slotClick(i)`.
  - `panelSlotEls2[0..8]` — children of `#invPanel .invHotRow`, `onclick = () => slotClick(i)` (mirror of hotbar inside panel).
- Ghost follows cursor via `#invPanel` mousemove: `ghostEl.style.left = e.clientX + 14 + 'px'; ghostEl.style.top = e.clientY + 10 + 'px';`

### Starting loadout
| slot | item |
|---|---|
| 0 | `{ type:'weapon', key:'mauser', mag: G.WEAPONS.mauser.mag, reserve: G.WEAPONS.mauser.reserve, pap:false }` |
| 1 | `{ type:'build', piece:'wall' }` |
| 2 | `{ type:'build', piece:'floor' }` |
| 3 | `{ type:'build', piece:'stairs' }` |
| 4 | `{ type:'car' }` |

## Click / Swap / Held Rules (`slotClick(i)`)
- No-op unless `Inv.open`.
- If `Inv.held`: place held into slot i; `Inv.held = cur || null` (swap if occupied).
- Else if slot occupied: pick up (`Inv.held = cur; Inv.slots[i] = null`).
- Then `updateGhost(); Inv.render();` and if `i === Inv.sel || Inv.held` → `G.onSelectionChanged && G.onSelectionChanged()`.
- `updateGhost()`: if held, `ghostEl.style.display = 'block'` and set its `img.src = Inv.iconFor(Inv.held)`; else `display = 'none'`. Exposed as `Inv._updateGhost()`.
- No stack-splitting, no right-click behavior, no drag — click-only pick/place/swap.

## Render (`Inv.render()`)
`paint(el, item, isSel)` per slot:
- `el.classList.toggle('sel', !!isSel)`
- If item: `img.src = Inv.iconFor(item)`, `img.style.display='block'`, `el.classList.toggle('pap', !!item.pap)`, `el.title = Inv.nameFor(item)`
- Count badge (`.cnt` text), verbatim:
```js
cnt.textContent = item.type === 'weapon' ? item.mag
  : item.type === 'build' ? '50⚡'
  : item.type === 'mat' && item.count > 1 ? item.count : '';
```
  (weapon badge = current mag; build badge = literal string `50⚡` i.e. cost; mats show count only when >1; car/place/single-mat show nothing)
- Empty slot: hide img, clear `.cnt` and `title`, remove `pap` class.
- Loop: slots 0–8 painted into BOTH `slotEls[i]` and `panelSlotEls2[i]` with `isSel = (i === Inv.sel)`; slots 9–35 into `panelSlotEls[i]` with `isSel = false`.
- Tail: `if (G.Craft && Inv.open && G.Craft.refresh) G.Craft.refresh();`

`Inv.updateCounts()`: cheap per-frame path — for hotbar slots 0–8 only, if weapon, sets `slotEls[i] .cnt` text to `it.mag` (does not touch panel mirrors).

## Stack Rules (`Inv.addMat(mat, n)`)
- Find FIRST existing slot with `s.type === 'mat' && s.mat === mat` → `stack.count += n` (no max stack size).
- Else first empty slot 0–35 gets `{ type:'mat', mat, count:n }`.
- No empty slot → `G.showMsg('Inventory full')`, return `false`. Otherwise `Inv.render()`, return `true`.
- Only mats stack; weapons/build/place/car never stack.

## Selection
- `Inv.select(i)`: reject if `i < 0 || i >= 9` or `i === Inv.sel`; else set `Inv.sel = i`, `Inv.render()`, fire `G.onSelectionChanged`.
- `Inv.selected()` → `Inv.slots[Inv.sel]`.

## `Inv.addWeapon(key, opts = {})` (pap via `opts.pap`)
1. Duplicate check: `findIndex(s => s && s.type==='weapon' && s.key===key && !!s.pap === pap)` — if found, refill `mag`/`reserve` to `weaponStats` values, `Inv.select(existing)` if `existing < 9`, render, return that item.
2. New item `{ type:'weapon', key, mag: st.mag, reserve: st.reserve, pap }`. Slot search: first empty 0–8, then first empty 9–35.
3. If none: if currently selected item is a weapon → REPLACE it in `Inv.sel`; else `G.showMsg('Inventory full')`, return `null`.
4. If placed in slot < 9 → `Inv.select(slot)`; else `G.showMsg('Sent to inventory (E)')`.
5. `Inv.render()`; fire `G.onSelectionChanged`; return item.

## `Inv.addItemAt(item, prefer)`
- If `prefer != null` and that slot is empty → place there; else first empty 0–35; none → `G.showMsg('Inventory full')`, return `false`.
- `Inv.render()`; fire `G.onSelectionChanged`; return `true`.

## Open/Close & Pause (`Inv.toggle(force)`)
```js
const want = force != null ? force : !Inv.open;
if (want === Inv.open) return;
```
- `panelEl.style.display = want ? 'flex' : 'none'`
- `G.state.paused = want` (opening inventory pauses the game)
- Opening: `if (document.pointerLockElement) document.exitPointerLock();`
- Closing: if `Inv.held` → `Inv.addItemAt(Inv.held); Inv.held = null; updateGhost();` (held item auto-returns to first empty slot). Then re-lock: `if (!G.noLock && G.state.playing && !G.player.dead) G.tryLock && G.tryLock();`
- Always: `G.Craft && G.Craft.onInvToggle && G.Craft.onInvToggle(want);` then `Inv.render()`.

## Keyboard (document-level `keydown` in this file)
- Guard: return if `!G.state || !G.state.playing || G.player.dead`.
- `KeyE` → `Inv.toggle()` (works open or closed).
- Closed only: `Digit1`–`Digit9` → `Inv.select(n - 1)` (parsed via `+e.code.slice(5)`, accepted for 1–9).
- Open only: `Escape` → `Inv.toggle(false)`.
- Mouse-wheel hotbar cycling is NOT in this file (lives in player/game input code).

## CSS (Undead Bunker.html, exact)
```css
#hotbar { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); display:flex; padding:3px; background:rgba(10,10,12,.72); border:2px solid #000; box-shadow:inset 0 0 0 2px #3a3a3e, 0 2px 8px rgba(0,0,0,.6); }
.slot { width:56px; height:56px; position:relative; background:#1f1f23; border:2px solid; border-color:#0c0c0e #4a4a50 #4a4a50 #0c0c0e; box-sizing:border-box; }
.slot img { width:100%; height:100%; object-fit:contain; display:none; }
.slot .cnt { position:absolute; right:3px; bottom:1px; font-size:15px; font-weight:700; color:#fff; text-shadow:1px 1px 0 #000, -1px 1px 0 #000; font-family:'Barlow Condensed',sans-serif; }
.slot.sel { border-color:#fff; box-shadow:inset 0 0 0 2px #fff, 0 0 10px rgba(255,255,255,.35); z-index:1; }
.slot.pap { box-shadow:inset 0 0 12px rgba(160,70,255,.8); }
.slot.sel.pap { box-shadow:inset 0 0 0 2px #fff, inset 0 0 12px rgba(160,70,255,.8); }
#invPanel { position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:6; background:rgba(0,0,0,.45); overflow:auto; }
#invInner { background:#2a2a2e; border:3px solid; border-color:#4e4e55 #101013 #101013 #4e4e55; padding:16px 18px; box-shadow:0 10px 40px rgba(0,0,0,.7); }
#invInner h3 { font-family:'Barlow Condensed',sans-serif; font-size:20px; letter-spacing:3px; color:#d8cdb8; text-transform:uppercase; margin-bottom:10px; }
.invGrid { display:grid; grid-template-columns:repeat(9, 56px); }
.invHotRow { display:grid; grid-template-columns:repeat(9, 56px); margin-top:12px; }
#invPanel .slot { cursor:pointer; }
#invPanel .slot:hover { background:#33333a; }
#heldGhost { position:fixed; width:52px; height:52px; pointer-events:none; display:none; z-index:7; filter:drop-shadow(0 2px 6px rgba(0,0,0,.8)); }
#heldGhost img { width:100%; height:100%; object-fit:contain; }
/* also from #invInner (second rule, line 77): */
#invInner { display:flex; flex-wrap:wrap; max-width:min(96vw, 1080px); max-height:94vh; overflow:auto; gap:26px; align-items:flex-start; }
```
DOM (line 144): `<div id="invPanel"><div id="invInner"><div id="invLeft"><h3>Inventory</h3><div class="invGrid"></div><div class="invHotRow"></div></div></div></div>` — backpack grid (27 slots, rows of 9) above the hotbar mirror row. Craft UI is appended into `#invInner` by crafting.js.

Beveled-slot look = asymmetric border colors: top/left `#0c0c0e` (dark), right/bottom `#4a4a50` (light) on `#1f1f23` fill. Selected = white outline `#fff` + white glow. PaP badge = purple inner glow `rgba(160,70,255,.8)` (12px inset).

## G.* Contract Surface
**Exports (this file):** `G.Inv` with: `slots, sel, open, held, icons, weaponStats(item), iconFor(item), nameFor(item), init(), render(), _updateGhost(), addMat(mat,n), updateCounts(), select(i), selected(), addWeapon(key,opts), addItemAt(item,prefer), toggle(force)`.

**Consumes (dependencies, one line each):**
- `G.WEAPONS` (weapons.js) — stat table for mags/reserve/names.
- `G.buildWeaponModel(key)` (weapons.js), `G.buildCarModel()` (car.js), `G.buildPieceModel(p)` (build.js), `G.buildMatModel(m)`, `G.buildBenchModel()`, `G.buildAnvilModel()` (crafting.js) — icon models.
- `G.Craft.initUI()`, `G.Craft.refresh()`, `G.Craft.onInvToggle(open)` (crafting.js).
- `G.onSelectionChanged()` (player.js) — swap viewmodel on any selection/slot change.
- `G.showMsg(text)` (game.js) — HUD messages (`'Inventory full'`, `'Sent to inventory (E)'`).
- `G.state.paused`, `G.state.playing` (game.js); `G.player.dead` (player.js); `G.noLock`, `G.tryLock()` (pointer-lock handling, player/game).
- `THREE` r128 global (`sRGBEncoding` on renderer; `outputEncoding` is the r128 API).
