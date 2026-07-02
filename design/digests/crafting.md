# crafting.js — Implementation Digest

Source: `design/undead_bunker/game/js/crafting.js` (IIFE on shared `window.G`; Three.js r128 as `T`).
Covers: materials, recipes, 2×2/3×3/anvil craft UI, wand craft animations, zombie drops, scavenge gathering, jetpack fuel.

## Shared materials (module-local `MeshStandardMaterial`s)

| name | color | other |
|---|---|---|
| `woodM` | `#8a5c2e` | roughness 0.85 |
| `woodDk` | `#4e3018` | roughness 0.9 |
| `coalM` | `#111114` | roughness 0.55, metalness 0.25 |
| `steelM` | `#3c3f46` | metalness 0.85, roughness 0.4 |

## Model builders (all return `T.Group`)

### `G.buildWandModel()`
- Shaft 1: Cylinder(r 0.008→0.012, len 0.24, 7 seg), `woodDk`, `rotation.x = PI/2`, `position.z = -0.06`.
- Shaft 2 (branch): Cylinder(0.006→0.009, len 0.12, 6 seg), `woodDk`, `rotation.x = PI/2 - 0.18`, pos `(0.008, 0.012, -0.2)`.
- Tip: Octahedron(0.026), material color `#0a3038`, emissive `#66e8ff`, emissiveIntensity 1.8, pos `(0.01, 0.02, -0.27)`.
- Ring: Torus(0.016, 0.004, 6, 14), `steelM`, `position.z = -0.13`.
- Empty `Object3D` at tip position → `group.userData.tip`; tip mesh → `group.userData.tipMesh`.

### `G.buildMatModel(mat)`
- `'wand'` → returns `G.buildWandModel()`.
- `'wood'`: 3 planks Box(0.5, 0.09, 0.16) `woodM` at `[x,y,z,rotY]` = `[0,0,0,0]`, `[0,0.09,0,PI/2]`, `[0,0.18,0,0.2]`; each `position.set(x, y+0.05, z)`.
- else (coal): 5 lumps Icosahedron(`0.09 + Math.random()*0.05`, detail 0) `coalM` at `((rand-.5)*0.22, 0.08 + (i===4 ? 0.13 : 0), (rand-.5)*0.22)`.

### `G.buildBenchModel()`
- Top texture: 128×128 canvas, fill `#7a5127`; stroke `rgba(40,20,6,.8)` lineWidth 4: rect(14,14,100,100) + grid lines x=47,81 and y=47,81 (3×3 grid drawing); `CanvasTexture`, sRGBEncoding.
- Top: Box(1.5, 0.12, 0.95), map=gridTex, roughness 0.8, y=0.86, castShadow.
- 4 legs Box(0.13, 0.82, 0.13) `woodDk` at `(±0.65, 0.41, ±0.38)`, castShadow.
- Shelf Box(1.3, 0.07, 0.7) `woodDk` y=0.28; tools Box(0.4, 0.12, 0.3) `steelM` at `(-0.4, 0.36, 0)`.

### `G.buildAnvilModel()`
- Base Box(0.62, 0.22, 0.5) `woodDk` y=0.11 (castShadow); waist Box(0.3, 0.28, 0.26) `steelM` y=0.36; top Box(0.78, 0.16, 0.3) `steelM` y=0.56 (castShadow); horn Cone(r 0.11, h 0.32, 10 seg) `steelM`, `rotation.z = PI/2`, pos `(0.52, 0.56, 0)`.

## Recipes — `G.RECIPES` (exact, order = display order)

All recipes are **shapeless with exact counts** (see matching). `grid: 2` = pocket 2×2 (also shown at bench); `grid: 3` = bench 3×3 only; `grid: 'anvil'` = anvil only.

| id | name | grid | needs | output | anim | desc string |
|---|---|---|---|---|---|---|
| `bench` | Crafting Bench | 2 | wood:4 | `gives {type:'place', kind:'bench'}` | — | `placeable · 3×3 crafting` |
| `wand` | Magic Wand | 2 | wood:2, coal:1 | `gives {type:'mat', mat:'wand', count:1}` | — | `catalyst for weaponcraft` |
| `rshot` | Random Shotgun | 2 | wand:1, wood:2 | `pool ['trench']` | `shotgun` | `consumes a wand` |
| `rar` | Random Assault Rifle | 2 | wand:1, coal:2 | `pool ['stg','smg','mg42']` | `ar` | `consumes a wand` |
| `rww` | Random Wonder Weapon | 2 | wand:1, coal:3 | `pool ['arc','laser']` | `wonder` | `consumes a wand` |
| `anvil` | Anvil | 3 | wood:4, coal:4 | `gives {type:'place', kind:'anvil'}` | — | `placeable · smelting` |
| `jetpack` | Jetpack | 3 | wand:1, wood:4, coal:4 | `special 'jetpack'` | — | `hold SPACE to fly` |
| `fuel` | Jet Fuel | anvil | coal:3 | `special 'fuel'` | — | `+50% jetpack fuel` |

Pool result pick: `key = pool[(Math.random() * pool.length) | 0]` — uniform.

## Craft state — `G.Craft` (aka `C`)

```js
{ mode: 'pocket',            // 'pocket' | 'bench' | 'anvil'
  slots: new Array(9).fill(null),   // craft grid items (same item objects as inventory)
  anim: null,                // active weapon-craft animation
  match: null }              // currently matched recipe or null
```
Also exports `G.stations = []` (placed bench/anvil registry, populated by build.js).

Grid sizes — `C.gridSize()`: bench → **9**, anvil → **3**, pocket → **4**. Titles (`#craftTitle`): `Crafting Bench 3×3` / `Anvil — Smelt` / `Crafting 2×2`. `gridEl.className = mode` (CSS lays out 2×2 / 3×3 / anvil row). Slots with index ≥ gridSize get `display:none`.

## Material helpers

- `C.countMat(mat)` — sums `count` over **both** `G.Inv.slots` and `C.slots` for entries with `type==='mat' && mat===mat`.
- `C.hasMats(needs)` — `Object.keys(needs).every(m => C.countMat(m) >= needs[m])`.
- `C.consumeMats(needs)` — for each mat, deducts from **`C.slots` first, then `G.Inv.slots`**, decrementing `count`, nulling emptied slots; then `G.Inv.render(); C.renderGrid();`.
- `C.consumeGridOnly(needs)` — ignores `needs`; **clears all 9 grid slots to null** (safe because a match requires the grid to contain exactly the needs) and re-renders.

## UI — `C.initUI()` (appended into `#invInner` of the inventory panel)

```html
<div id="craftWrap">
  <div id="craftLeft">
    <h3 id="craftTitle">Crafting 2×2</h3>
    <div id="craftGrid"></div>
    <div id="craftArrowRow"><span id="craftArrow">➜</span>
      <div id="craftResult" class="slot"><img draggable="false"><span class="cnt"></span></div></div>
  </div>
  <div id="recipeBar"><h3>Recipes</h3><div id="recipeList"></div></div>
</div>
```
- 9 grid slot divs created (`class="slot"`, `<img draggable=false><span class="cnt">`), each `onclick = C.gridClick(i)`.
- `resultEl.onclick`: `if (C.match) { C.consumeGridOnly(C.match.needs); C.produce(C.match); }`.
- Initial mode: `C.setMode('pocket')`.

### Manual grid interaction — `C.gridClick(i)` (only when `G.Inv.open`)
- Held item + same-mat stack in slot → merge counts into slot, clear held.
- Held item otherwise → swap: slot gets held, held gets previous slot (or null).
- No held, slot occupied → pick up (held = slot item, slot = null).
- Then `G.Inv._updateGhost(); C.refresh(); G.Inv.render();`.

### Matching — `C.matchGrid()` (shapeless, exact)
1. Tally `counts[mat] += count` over slots `0..gridSize()-1`; **any non-`mat` item in the grid → return null**; empty grid → null.
2. For each recipe in `C.recipesForMode()`: match iff `Object.keys(r.needs).length === Object.keys(counts).length` AND every `counts[k] === r.needs[k]` (**strict equality — extra amounts or extra material types fail**).

`C.recipesForMode()`: anvil mode → recipes with `grid==='anvil'`; otherwise `grid===2` plus (`grid===3` only when mode is `bench`).

### `C.refresh()`
- Re-renders grid; sets `C.match = C.matchGrid()`.
- Result slot: on match, `img.src = C.resultIcon(match)`, show, add class `canCraft`; else hide + remove class.
- **Recipe bar** rebuilt every refresh: for each mode recipe, a `<button class="recipeBtn">` (`+' off'` class when `!C.hasMats(r.needs)`); inner HTML: `<img src="{icon}"><span><b>{name}</b><i>{needTxt}</i><i>{desc}</i></span>` where `needTxt = "4 wood + 4 coal"` style (`\`${r.needs[m]} ${m}\`` joined with `' + '`). Clickable **only when hasMats**: `onclick = () => { C.consumeMats(r.needs); C.produce(r); }` (auto-craft pulling from grid+inventory).

### `C.resultIcon(r)`
- `r.pool` → `G.Inv.icons['m:wand']`; `special==='jetpack'` → `icons['jetpack'] || icons['m:coal']`; `special==='fuel'` → `icons['m:coal']`; `gives.type==='place'` → `icons['p:'+kind]`; `gives.type==='mat'` → `icons['m:'+mat]`; else `''`.

## Production — `C.produce(r)`

- `r.pool` → `G.Inv.toggle(false)` (close inventory) then `C.startWeaponCraft(r)`; return.
- `special==='jetpack'`: if `G.player.jetpack` already → `G.showMsg('Jetpack already built'); G.audio.deny();` abort. Else `G.player.jetpack = true; G.player.jetFuel = 100; G.updateFuelHUD(); G.audio.perkJingle(); G.showMsg('Jetpack equipped — hold SPACE to fly')`.
- `special==='fuel'`: requires `G.player.jetpack` else `'Craft a jetpack first'` + `deny()`. Else `jetFuel = Math.min(100, jetFuel + 50)`; `updateFuelHUD(); G.audio.buy(); showMsg('Jet fuel +50%')`.
- `gives.type==='mat'` → `G.Inv.addMat(mat, count)`; `gives.type==='place'` → `G.Inv.addItemAt({type:'place', kind})`; both play `G.audio.boardAdd()`.
- Ends with `C.refresh(); G.Inv.render();`.

## Weapon craft sequence (3.0 s)

`C.startWeaponCraft(recipe)`:
```js
C.anim = { type: recipe.anim, pool: recipe.pool, t: 0, dur: 3.0, tick: 0, burst: 0 };
G.setHandModel(G.buildWandModel());              // wand appears in hand
document.getElementById('craftBar').style.display = 'block';
craftLabel.textContent = 'ITEM CRAFTING — ' + recipe.name.toUpperCase();
```
Progress each frame: `#craftFill.style.width = Math.min(100, a.t/a.dur*100) + '%'`.

Wand tip in world space — `C.tipWorld()`:
```js
new T.Vector3(0.2, -0.12, -0.62).applyQuaternion(G.camera.quaternion).add(G.camera.position)
```

### Per-recipe FX (in `C.update(dt)` while `anim` active)

| anim | interval | FX |
|---|---|---|
| `ar` | spark every frame; audio tick every **0.34 s** (`a.tick`) | Orange spiral orbiting tip: `ang = a.t*9; p = tip + (cos(ang)*0.25, sin(a.t*5)*0.12, sin(ang)*0.25)`; `G.spawnSpark(p, 0xffa040)`; `G.audio.craftTick()` per tick |
| `shotgun` | burst every **0.5 s** (`a.burst`) | 3 sparks `0xff5030` at `tip + ((rand-.5)*0.5, (rand-.5)*0.3, (rand-.5)*0.5)`; `G.shake(0.02)`; `G.audio.craftTick()` |
| `wonder` | burst every **0.36 s** | target `to = tip + ((rand-.5)*1.6, rand*1.1, (rand-.5)*1.6)`; `G.spawnBeam(tip, to, 0x9b4dff)` + `G.spawnSpark(to, 0x9b4dff)` + `G.audio.zap()` |

### Finish (`a.t >= 3.0`)
```js
C.anim = null; craftBar hidden;
for (let i = 0; i < 4; i++) G.spawnSpark(tip, type === 'wonder' ? 0x9b4dff : 0xffd060);
const key = a.pool[(Math.random() * a.pool.length) | 0];
const pap = Math.random() < 0.3;                  // 30% pre-Pack-a-Punch (pre-★)
G.Inv.addWeapon(key, { pap });
G.audio.perkJingle();
G.showMsg((pap ? '★ ' : '') + G.WEAPONS[key].name + ' crafted!');
```

### Craft bar DOM/CSS (defined in `Undead Bunker.html`)
`<div id="craftBar"><div id="craftLabel">ITEM CRAFTING</div><div id="craftTrack"><div id="craftFill"></div></div></div>` — fixed, centered, `bottom:94px`, width 360px; label gold `#f7d774`, 17px Barlow Condensed, letter-spacing 3px; track h 10px `rgba(10,10,12,.75)` + 2px black border + inset `#3a3a3e`; fill `linear-gradient(90deg, #b8860b, #f7d774)`.

## Inventory open/close & stations

- `C.onInvToggle(open)`: on close, every non-null grid slot returned via `G.Inv.addItemAt(item)` then nulled; `C.setMode('pocket')`. On open: `C.refresh()`.
- `C.openStation(kind)`: `G.Inv.toggle(true)` then `setMode(kind === 'bench' ? 'bench' : 'anvil')`. (Called by player F-interact on placed stations.)

## Scavenge nodes — gather + respawn

Node data lives in `G.scavenge` (created in map.js: `{ pos, mat, cd: 0, group }`; positions: wood (12.6,4.2) MAIN, coal (−16,6.8) ARMORY, wood (−13,29.5) + coal (−4,13) CAMP; interact range 2.2 m, prompt `F — Gather {mat}`, handled in player.js).

`C.gather(node)`:
- Blocked while `node.cd > 0`.
- Sets `node.cd = 8` (**8 s respawn**), `node.group.scale.setScalar(0.5)` (shrinks to half).
- Yield: `n = 1 + (Math.random() < 0.35 ? 1 : 0)` → **+1 mat, 35% chance of +2**.
- `G.Inv.addMat(node.mat, n); G.audio.pickup(); G.showMsg(\`+${n} ${node.mat}\`)`.

Regrow (in `C.update`, every frame): `if (n.cd > 0) { n.cd -= dt; n.group.scale.setScalar(Math.min(1, 1 - (n.cd/8) * 0.5)); }` — linear scale 0.5 → 1.0 over the 8 s.

## Zombie material drops — `G.Drops`

Spawn trigger (game.js): `G.onZombieKilled` → `Math.random() < 0.12` → `G.Drops.spawn(z.pos)` (**12% per kill**).

`G.Drops.spawn(pos)`:
- Hard cap: skip if `drops.length > 24`.
- Material: `Math.random() < 0.35 ? 'coal' : 'wood'` (**35% coal / 65% wood**).
- Mesh: Box(0.16³); coal color `#111114` emissive `#000022`(`0x223`), wood color `#8a5c2e` emissive `#3a2408`; emissiveIntensity 0.5, roughness 0.7. Position `(pos.x, pos.y + 0.4, pos.z)`. Stored `{ mesh, mat, t: Math.random()*6 }` (random bob phase).

`G.Drops.update(dt)` per drop:
- Idle: `rotation.y += dt*2`; bob `position.y += Math.sin(t*3) * dt * 0.12`.
- Magnet: if horizontal dist to player `< 2.4` AND `|Δy| < 1.8`: move toward player at **7 m/s** horizontally (`+= d/dist * dt * 7`), vertical lerp `y += (P.pos.y + 1 - y) * dt * 5`.
- Collect at dist `< 0.5`: `G.Inv.addMat(mat, 1); G.audio.pickup();` remove mesh.
- Despawn at `t > 45` (**45 s lifetime**).

## G.* contract surface

**Provided by crafting.js:** `G.buildWandModel`, `G.buildMatModel(mat)`, `G.buildBenchModel`, `G.buildAnvilModel`, `G.RECIPES`, `G.Craft` (`.mode .slots .anim .match .countMat .hasMats .consumeMats .initUI .gridClick .gridSize .setMode .renderGrid .recipesForMode .matchGrid .consumeGridOnly .refresh .resultIcon .produce .startWeaponCraft .tipWorld .update(dt) .onInvToggle(open) .openStation(kind) .gather(node)`), `G.stations` (array), `G.Drops` (`.spawn(pos)`, `.update(dt)`).

**Consumed (dependencies):** `G.Inv` (`.slots .open .held ._updateGhost() .render() .iconFor(item) .icons{} .addMat(mat,n) .addItemAt(item) .addWeapon(key,{pap}) .toggle(bool)`) from inventory.js · `G.scavenge` from map.js · `G.player` (`.jetpack .jetFuel .pos`), `G.setHandModel` from player.js · `G.camera`, `G.scene`, `G.spawnSpark(pos,hex)`, `G.spawnBeam(from,to,hex)`, `G.shake(amt)`, `G.showMsg(str)`, `G.updateFuelHUD()`, `G.WEAPONS` (names) from game.js/weapons.js · `G.audio.{deny, perkJingle, buy, boardAdd, craftTick, zap, pickup}` from audio.js · DOM ids `#invInner #craftBar #craftLabel #craftFill` from the HTML shell.

One-line dependency note: crafting.js is UI/logic only — node positions (map.js), interact prompts/ranges (player.js), drop trigger chance 12% (game.js), placement of bench/anvil (build.js), and all icons/inventory storage (inventory.js) live in sibling files.
