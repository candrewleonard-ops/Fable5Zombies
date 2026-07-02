# HUD Digest — `game/Undead Bunker.html` (190 lines, no inline `<script>` logic)

Source: `/home/user/Fable5Zombies/design/undead_bunker/game/Undead Bunker.html`. All HUD/overlay DOM+CSS lives in this file's single `<style>` block. All behavior is in `js/*.js` (shared `window.G` namespace). This digest also records the exact JS that drives each HUD node (from `game.js`, `inventory.js`, `crafting.js`, `player.js`).

## 1. Head / fonts / script load order

- `<title>UNDEAD BUNKER — Wave Survival</title>`; viewport `width=device-width, initial-scale=1.0`; charset UTF-8.
- Fonts (Google, with `preconnect` to `https://fonts.googleapis.com`):
  `https://fonts.googleapis.com/css2?family=Pirata+One&family=Barlow+Condensed:wght@400;600;700&display=swap`
- Script load order (all classic `<script src>`, end of `<body>`, order is load-bearing):
  1. `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
  2. `js/audio.js` 3. `js/weapons.js` 4. `js/zombies.js` 5. `js/car.js` 6. `js/map.js` 7. `js/pap.js` 8. `js/build.js` 9. `js/crafting.js` 10. `js/inventory.js` 11. `js/player.js` 12. `js/game.js`
- `game.js` bootstraps on `DOMContentLoaded` (or immediately if `document.readyState !== 'loading'`).

## 2. Global CSS

```css
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:100%; height:100%; overflow:hidden; background:#000; font-family:'Barlow Condensed',sans-serif; }
#game { position:fixed; inset:0; }
#game canvas { display:block; }
```

Renderer (game.js `init()`): WebGLRenderer antialias, `powerPreference:'high-performance'`, `setPixelRatio(Math.min(devicePixelRatio, 1.75))`, PCFSoftShadowMap, sRGBEncoding, ACESFilmicToneMapping exposure 1.1, appended into `#game`. Camera: PerspectiveCamera(75, aspect, 0.05, 200). Scene background `0x05070c`.

## 3. Full body DOM (exact structure)

```html
<div id="game"></div>

<div id="hud">                                   <!-- display:none until game start -->
  <div id="crosshair"></div>
  <div id="hitmarker"><span></span><span></span><span></span><span></span></div>
  <div id="roundLabel">Round</div>
  <div id="round">1</div>
  <div id="pointsVal">500</div>
  <div id="pointsFeed"></div>
  <div id="ammoBlock">
    <div id="weaponName">Mauser C96</div>
    <div id="ammo">10 <span class="res">/ 80</span></div>
    <div id="reloadHint">Reload — R</div>
  </div>
  <div id="perksRow"></div>
  <div id="fuelWrap"><span id="fuelLabel">FUEL</span><div id="fuelFill"></div></div>
  <div id="hotbar"></div>
  <div id="prompt"></div>
  <div id="msg"></div>
  <div id="waveBanner">Round 1</div>
  <div id="bloodOverlay"></div>
  <div id="vignette"></div>
</div>

<div id="invPanel"><div id="invInner"><div id="invLeft"><h3>Inventory</h3>
  <div class="invGrid"></div><div class="invHotRow"></div></div></div></div>
<div id="craftBar"><div id="craftLabel">ITEM CRAFTING</div>
  <div id="craftTrack"><div id="craftFill"></div></div></div>
<div id="heldGhost"><img draggable="false"></div>

<div id="menuOverlay" class="overlay">
  <h1>UNDEAD BUNKER</h1>
  <div class="sub">Wave Survival &nbsp;·&nbsp; A Nacht-style homage</div>
  <button id="startBtn" class="bigbtn">Enter the Bunker</button>
  <div id="controls">
    <b>WASD</b><span>Move · Shift sprint</span>
    <b>Mouse</b><span>Fire / Place · RMB aim / remove</span>
    <b>1–9</b><span>Hotbar · scroll to cycle</span>
    <b>E</b><span>Inventory</span>
    <b>R</b><span>Reload</span>
    <b>F</b><span>Interact · Enter car · Gather · Rebuild</span>
    <b>Space</b><span>Jetpack (craft it first)</span>
  </div>
  <a id="libLink" href="Asset Library.html">View the 3D Asset Library →</a>
</div>

<div id="deadOverlay" class="overlay">
  <h1>YOU DIED</h1>
  <div id="survStats">Survived 1 round</div>
  <button id="restartBtn" class="bigbtn">Try Again</button>
</div>

<div id="pauseOverlay" class="overlay">
  <h2>PAUSED</h2>
  <button id="resumeBtn" class="bigbtn">Resume</button>
</div>

<div id="loadNote">loading…</div>
```

Note: `#hotbar` is inside `#hud` (pointer-events:none inherited); `#invPanel`, `#craftBar`, `#heldGhost` are siblings of `#hud` (interactive).

## 4. HUD element CSS — exact values

### #hud container
`position:fixed; inset:0; pointer-events:none; display:none;` → set to `display:block` on start.

### Crosshair `#crosshair`
| prop | value |
|---|---|
| position | absolute; left:50%; top:50%; transform:translate(-50%,-50%) |
| size | 6px × 6px; border-radius:50% |
| background | rgba(255,255,255,.85) |
| box-shadow | 0 0 4px rgba(0,0,0,.8) |

### Hitmarker `#hitmarker` (4 `<span>` ticks)
- Container: absolute center (same transform as crosshair), 26×26px, `opacity:0`; `.show { opacity:1; }`.
- Each span: `position:absolute; width:11px; height:2px; background:#fff; box-shadow:0 0 3px #000;`
- Tick placement/rotation: (1) `left:0; top:2px; rotate(45deg)` (2) `right:0; top:2px; rotate(-45deg)` (3) `left:0; bottom:2px; rotate(-45deg)` (4) `right:0; bottom:2px; rotate(45deg)`.
- Headshot: `#hitmarker.head span { background:#ff3b30; }`
- JS (`G.hitmarker(head)`): toggles `.head`, adds `.show`, removes after **70 ms** (`setTimeout`).

### Round counter
| element | CSS |
|---|---|
| `#round` | absolute; left:34px; bottom:26px; font:'Pirata One',serif; font-size:88px; line-height:.9; color:#a31111; text-shadow: 0 0 18px rgba(163,17,17,.55), 0 2px 2px #000 |
| `#roundLabel` | absolute; left:36px; bottom:118px; font-size:17px; letter-spacing:4px; color:#c9beae; opacity:.7; text-transform:uppercase; text "Round" |

JS: `startRound(r)` sets `#round.textContent = r`.

### Points + feed
| element | CSS |
|---|---|
| `#points` | absolute; left:34px; bottom:0px (empty anchor, unused visually) |
| `#pointsVal` | absolute; left:150px; bottom:34px; font-size:34px; font-weight:700; color:#e8dfcf; text-shadow:0 2px 2px #000; initial text "500" |
| `#pointsFeed` | absolute; left:150px; bottom:70px; display:flex; flex-direction:column-reverse; gap:2px |
| `.pf` | font-size:19px; font-weight:600; color:#f7e9b0; text-shadow:0 1px 1px #000; animation:pfUp 1s ease-out forwards |
| `.pf.neg` | color:#ff6a5e |

```css
@keyframes pfUp { 0%{opacity:0; transform:translateY(8px);} 15%{opacity:1;} 80%{opacity:1;} 100%{opacity:0; transform:translateY(-12px);} }
```

JS (`game.js`):
- `G.addPoints(n)`: `state.points += n`; feed entry text `(n>0?'+':'')+n`, class `'pf'+(n<0?' neg':'')`; entry removed after **1000 ms**; if feed has **> 6** children, remove first child.
- `G.spend(n)`: if `state.points < n` → `G.showMsg('Not enough points')`, return false. Else subtract, append `.pf.neg` entry `'-'+n` (removed after 1000 ms), return true.
- `G.deny()` = `G.audio.deny()`.

### Weapon / ammo block
| element | CSS |
|---|---|
| `#ammoBlock` | absolute; right:38px; bottom:26px; text-align:right |
| `#weaponName` | font-size:20px; letter-spacing:2px; color:#c9beae; text-transform:uppercase; opacity:.85 |
| `#ammo` | font-size:46px; font-weight:700; color:#e8dfcf; text-shadow:0 2px 2px #000 |
| `#ammo .res` | font-size:26px; color:#9a917f |
| `#ammo.low` | color:#ff5a4d |
| `#reloadHint` | font-size:16px; letter-spacing:3px; color:#ff5a4d; text-transform:uppercase; opacity:0; text "Reload — R" |
| `#reloadHint.show` | opacity:1; animation:blink 1s infinite |

```css
@keyframes blink { 50%{opacity:.25;} }
```

JS `G.updateAmmoHUD()` (game.js):
- No item: clear `weaponName`, `ammo`, remove `.show`/`.low`.
- Weapon: name = `G.Inv.weaponStats(item).displayName`; `ammo.innerHTML = `${item.mag} <span class="res">/ ${item.reserve}</span>``; low when `item.mag <= Math.max(2, st.mag * 0.25)`; reloadHint `.show` when `item.mag === 0 && item.reserve > 0`.
- Build item: name = `G.Inv.nameFor(item)`; ammo = `<span class="res">50 pts · LMB place · RMB remove</span>`.
- Car keys: name "Car Keys"; ammo = `<span class="res">LMB — deploy · F — enter</span>`.

### Perk badges
| element | CSS |
|---|---|
| `#perksRow` | absolute; right:40px; bottom:130px; display:flex; gap:8px; flex-direction:row-reverse |
| `.perkIcon` | width:44px; height:44px; border-radius:50%; flex center; font:'Pirata One',serif; font-size:22px; color:#fff; border:2px solid rgba(255,255,255,.35); box-shadow: 0 0 10px rgba(0,0,0,.6), inset 0 0 8px rgba(0,0,0,.5); text-shadow:0 1px 2px #000 |

JS `G.perkHUD()` (game.js) rebuilds row from `G.player.perks`; per-badge inline style `background: radial-gradient(circle at 35% 30%, <color>, #100a08 130%)`:

```js
const PERK_STYLE = { tonic:['#9e1b1b','T'], rapid:['#b08414','R'], fleet:['#1c5d8a','F'], deadeye:['#5b2a7a','D'] };
```

### Fuel bar (jetpack)
| element | CSS |
|---|---|
| `#fuelWrap` | absolute; right:40px; bottom:200px; width:16px; height:130px; display:none; flex-direction:column; justify-content:flex-end; background:rgba(10,10,12,.7); border:2px solid #000; box-shadow:inset 0 0 0 1px #3a3a3e |
| `#fuelFill` | width:100%; height:0%; background:#3fa7c8 |
| `#fuelLabel` | absolute; right:-4px; top:-22px; font-size:13px; letter-spacing:2px; color:#9a917f; text "FUEL" |

JS `G.updateFuelHUD()`: wrap `display = G.player.jetpack ? 'flex' : 'none'`; `fill.style.height = Math.round(G.player.jetFuel) + '%'` (fuel is 0–100); `fill.style.background = G.player.jetFuel < 25 ? '#c8401e' : '#3fa7c8'`. Fuel drains 18/s while thrusting (player.js); Jet Fuel craft adds `Math.min(100, jetFuel + 50)`.

### Interact prompt `#prompt`
`position:absolute; left:50%; top:58%; transform:translateX(-50%); font-size:22px; letter-spacing:1px; color:#f2ead8; text-shadow:0 1px 3px #000; background:rgba(10,8,6,.55); padding:8px 18px; border:1px solid rgba(255,255,255,.14); display:none; white-space:nowrap;`
`#prompt b { color:#f7d774; }` (gold keys/costs).

JS `G.setPrompt(html)`: null → `display:none`; else `display:block`, sets innerHTML only if changed. Prompt strings built in player.js/car.js (exact formats):
- `'<b>Hold F</b> — Rebuild barricade <b>+10</b>'`
- `` `<b>F</b> — Open ${d.name} <b>[${d.cost}]</b>` ``
- `` `<b>F</b> — Buy ${pm.name} <b>[${pm.cost}]</b>` ``
- `` `<b>F</b> — ${ownedItem ? 'Ammo for' : 'Buy'} ${def.name} <b>[${cost}]</b>` ``
- `` `<b>F</b> — Mystery Box <b>[${mb.cost}]</b>` `` / `` `<b>F</b> — Take ${G.WEAPONS[mb.weapon].name}` ``
- `` `<b>F</b> — Reforge ${P.curWeapon.displayName} <b>[${G.PaP.cost}]</b>` `` / `` `<b>F</b> — Take ★ ${G.WEAPONS[G.PaP.item.key].name}` `` / `'Reforging…'`
- `'<b>F</b> — Enter vehicle'` / `'<b>F</b> — Exit vehicle'` (car, shown when `Math.abs(speed) < 1`)
- `` `<b>F</b> — Gather ${n.mat}` ``
- `` `<b>F</b> — Use ${st.kind === 'bench' ? 'Crafting Bench (3×3)' : 'Anvil'}` ``
- Trap: `` `<b>F</b> — Electro-trap <b>[${G.Trap.cost}]</b>` ``; active `'⚡ TRAP ACTIVE ⚡'`; cooling `` `Trap cooling — ${Math.ceil(G.Trap.t)}s` ``

### Gold message `#msg`
`position:absolute; left:50%; top:24%; transform:translateX(-50%); font-size:24px; letter-spacing:2px; color:#f7d774; text-shadow:0 2px 4px #000; opacity:0; transition:opacity .3s; text-transform:uppercase;`

JS `G.showMsg(t)`: set text, opacity 1; timeout re-set opacity 0 after **1800 ms** (clears previous timeout).

### Round banner `#waveBanner`
`position:absolute; left:0; right:0; top:33%; text-align:center; font:'Pirata One',serif; font-size:120px; color:#a31111; text-shadow: 0 0 30px rgba(163,17,17,.8), 0 3px 4px #000; opacity:0; pointer-events:none;`
`#waveBanner.show { animation:wave 3.4s ease forwards; }`

```css
@keyframes wave { 0%{opacity:0; transform:scale(1.6); filter:blur(6px);} 18%{opacity:1; transform:scale(1); filter:blur(0);} 80%{opacity:1;} 100%{opacity:0; transform:scale(.96);} }
```

JS `startRound(r)`: text `'Round ' + r`; restart animation via `classList.remove('show'); void el.offsetWidth; classList.add('show');` plus `G.audio.roundStart()`.

### Vignette + blood overlay
- `#vignette`: `position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 0 180px rgba(0,0,0,.85);` (static).
- `#bloodOverlay`: `position:absolute; inset:0; pointer-events:none; opacity:0; background:radial-gradient(ellipse at center, rgba(120,0,0,0) 42%, rgba(120,0,0,.55) 78%, rgba(80,0,0,.85) 100%);`

JS `G.updateHealthFx()`:
```js
const base = Math.max(0, (1 - P.hp / P.maxHp) * 1.05 - 0.05);
hud.bloodOverlay.style.opacity = Math.min(1, base + state.hurtFlash || 0);
```
`G.damagePlayer(amt)` sets `state.hurtFlash = 0.6`; main loop decays `state.hurtFlash -= dt * 1.2` (clamped ≥ 0), calling `updateHealthFx()` each frame while > 0.

## 5. Hotbar / Inventory / Crafting UI CSS

### Hotbar `#hotbar` + `.slot`
| element | CSS |
|---|---|
| `#hotbar` | absolute; left:50%; bottom:14px; translateX(-50%); display:flex; padding:3px; background:rgba(10,10,12,.72); border:2px solid #000; box-shadow: inset 0 0 0 2px #3a3a3e, 0 2px 8px rgba(0,0,0,.6) |
| `.slot` | 56×56px; position:relative; background:#1f1f23; border:2px solid; border-color:#0c0c0e #4a4a50 #4a4a50 #0c0c0e (bevel); box-sizing:border-box |
| `.slot img` | width/height:100%; object-fit:contain; display:none (shown when item present) |
| `.slot .cnt` | absolute; right:3px; bottom:1px; font-size:15px; font-weight:700; color:#fff; text-shadow: 1px 1px 0 #000, -1px 1px 0 #000; font-family:'Barlow Condensed' |
| `.slot.sel` | border-color:#fff; box-shadow: inset 0 0 0 2px #fff, 0 0 10px rgba(255,255,255,.35); z-index:1 |
| `.slot.pap` | box-shadow: inset 0 0 12px rgba(160,70,255,.8) |
| `.slot.sel.pap` | box-shadow: inset 0 0 0 2px #fff, inset 0 0 12px rgba(160,70,255,.8) |

Slots are generated by `inventory.js Inv.init()` — 9 hotbar slots into `#hotbar`, 27 into `.invGrid`, 9 mirrored hotbar into `.invHotRow`; each slot innerHTML: `'<img draggable="false"><span class="cnt"></span>'`, `dataset.i = index`. `.cnt` shows: weapon → `item.mag`; build → `'50⚡'`; mat with count>1 → `item.count`; else empty. Icons = dataURL PNGs from offscreen 3D render (128px). Starting loadout slots 0–4: mauser weapon, build wall, build floor, build stairs, car keys.

### Inventory panel
| element | CSS |
|---|---|
| `#invPanel` | fixed; inset:0; display:none (→flex when open); align/justify center; z-index:6; background:rgba(0,0,0,.45); overflow:auto |
| `#invInner` | (merged from two rules) display:flex; flex-wrap:wrap; max-width:min(96vw,1080px); max-height:94vh; overflow:auto; gap:26px; align-items:flex-start; background:#2a2a2e; border:3px solid; border-color:#4e4e55 #101013 #101013 #4e4e55; padding:16px 18px; box-shadow:0 10px 40px rgba(0,0,0,.7) |
| `#invInner h3` | 'Barlow Condensed'; font-size:20px; letter-spacing:3px; color:#d8cdb8; uppercase; margin-bottom:10px |
| `.invGrid` | display:grid; grid-template-columns:repeat(9, 56px) |
| `.invHotRow` | display:grid; grid-template-columns:repeat(9, 56px); margin-top:12px |
| `#invPanel .slot` | cursor:pointer; `:hover` background:#33333a |
| `#heldGhost` | fixed; 52×52px; pointer-events:none; display:none; z-index:7; filter:drop-shadow(0 2px 6px rgba(0,0,0,.8)); img 100%/contain; follows cursor at `clientX+14, clientY+10` |

### Crafting UI (DOM injected into `#invInner` by `crafting.js C.initUI()`)
Injected markup:
```html
<div id="craftWrap">
  <div id="craftLeft"><h3 id="craftTitle">Crafting 2×2</h3><div id="craftGrid"></div>
    <div id="craftArrowRow"><span id="craftArrow">➜</span>
      <div id="craftResult" class="slot"><img draggable="false"><span class="cnt"></span></div></div></div>
  <div id="recipeBar"><h3>Recipes</h3><div id="recipeList"></div></div>
</div>
```
| element | CSS |
|---|---|
| `#craftWrap` | display:flex; gap:20px; align-items:flex-start |
| `#craftLeft` | width:190px |
| `#craftGrid` | display:grid; grid-template-columns:repeat(2,56px); `.bench`/`.anvil` → repeat(3,56px) |
| `#craftArrowRow` | display:flex; align-items:center; gap:12px; margin-top:12px |
| `#craftArrow` | font-size:26px; color:#8a7f6a |
| `#craftResult.canCraft` | border-color:#4dff7a; box-shadow:inset 0 0 0 2px #4dff7a; cursor:pointer |
| `#recipeBar` | width:255px; max-height:430px; overflow-y:auto |
| `.recipeBtn` | display:flex; gap:10px; width:100%; align-items:center; background:#1f1f23; border:2px solid; border-color:#4a4a50 #0c0c0e #0c0c0e #4a4a50; padding:6px 8px; margin-bottom:6px; cursor:pointer; color:#d8cdb8; 'Barlow Condensed'; text-align:left; `:hover` #2c2c33 |
| `.recipeBtn.off` | opacity:.38; cursor:default |
| `.recipeBtn img` | 40×40px; object-fit:contain; flex:none |
| `.recipeBtn b` | font-size:17px; display:block; letter-spacing:.5px |
| `.recipeBtn i` | font-size:13.5px; font-style:normal; color:#8a8172; display:block; line-height:1.25 |

### Craft progress bar (weapon craft sequence)
| element | CSS |
|---|---|
| `#craftBar` | fixed; left:50%; bottom:94px; translateX(-50%); width:360px; display:none; z-index:5; text-align:center |
| `#craftLabel` | 'Barlow Condensed'; font-size:17px; letter-spacing:3px; color:#f7d774; text-shadow:0 1px 2px #000; margin-bottom:6px |
| `#craftTrack` | height:10px; background:rgba(10,10,12,.75); border:2px solid #000; box-shadow:inset 0 0 0 1px #3a3a3e |
| `#craftFill` | height:100%; width:0%; background:linear-gradient(90deg,#b8860b,#f7d774) |

JS (crafting.js): label text `'ITEM CRAFTING — ' + recipe.name.toUpperCase()`; fill width `Math.min(100, a.t / a.dur * 100) + '%'`.

## 6. Overlays / menu CSS

| element | CSS |
|---|---|
| `.overlay` | fixed; inset:0; flex column center; background: radial-gradient(ellipse at center, rgba(14,11,9,.86) 0%, rgba(4,3,2,.96) 100%); z-index:10 |
| `.overlay h1` | 'Pirata One'; font-size:clamp(60px, 9vw, 120px); color:#b81414; text-shadow: 0 0 40px rgba(184,20,20,.5), 0 4px 3px #000; letter-spacing:2px |
| `.overlay .sub` | font-size:20px; letter-spacing:6px; color:#b6a992; uppercase; margin:6px 0 34px |
| `.bigbtn` | pointer-events:auto; cursor:pointer; 'Barlow Condensed'; font-size:26px; font-weight:700; letter-spacing:4px; uppercase; color:#f2ead8; background:#4a0d0d; border:1px solid #8a2020; padding:14px 58px; transition:all .15s; `:hover` background:#6d1414; box-shadow:0 0 24px rgba(184,20,20,.45) |
| `#controls` | margin-top:38px; display:grid; grid-template-columns:auto auto; gap:6px 22px; font-size:17px; color:#9a917f; letter-spacing:1px; align-items:start; `span` line-height:1.3, max-width:300px; `b` color:#d8cdb8, font-weight:600, text-align:right, display:block |
| `#deadOverlay` | display:none; h1 color:#8a0f0f |
| `#survStats` | font-size:24px; color:#c9beae; letter-spacing:2px; margin-bottom:30px |
| `#pauseOverlay` | display:none; background:rgba(0,0,0,.6); h2 'Pirata One' 54px #c9beae margin-bottom:20px |
| `#libLink` | margin-top:26px; font-size:17px; letter-spacing:2px; color:#8a7f6a; text-decoration:none; border-bottom:1px dotted #6b6355; padding-bottom:2px; pointer-events:auto; `:hover` color:#d8cdb8 |
| `#loadNote` | fixed; left:50%; bottom:22px; translateX(-50%); color:#6b6355; font-size:15px; letter-spacing:2px; z-index:11; text "loading…" |

Overlay wiring (game.js):
- `#loadNote` hidden (`display:none`) at end of init.
- `#startBtn.onclick = start` → `G.audio.resume()`; menuOverlay `display:none`; `#hud` `display:block`; `tryLock()`; `state.playing=true`; player pos = `G.spawnPoint`; `setTimeout(() => startRound(1), 900)`.
- `#resumeBtn.onclick` → pauseOverlay none, `state.paused=false`, `tryLock()` unless `G.noLock`.
- `#restartBtn.onclick = () => location.reload()`.
- `pointerlockchange`: if lock lost while playing & alive & inventory closed → pauseOverlay `display:flex`, `state.paused=true`; else hide/unpause. (Skipped entirely when `G.noLock`.)
- No-lock fallback (`tryLock` failure or lock not gained within 400 ms → `enableNoLock()`): sets `G.noLock=true`, `canvas.style.cursor='none'`, shows msg `'Mouse-look active · Esc to pause'`; then keydown `Escape` toggles `state.paused` + pauseOverlay flex/none.
- Death (`die()` in `G.damagePlayer` when hp ≤ 0): `state.playing=false`; `document.exitPointerLock()`; `#survStats.textContent = `Survived ${state.round} round${state.round>1?'s':''} · ${state.kills} kills``; deadOverlay `display:flex`.
- Inventory open (E, inventory.js `Inv.toggle`): `#invPanel` `display:flex`; game pause + pointer-lock release handled there; `G.Craft.setMode('pocket'|'bench'|'anvil')` toggles `#craftGrid` class and `#craftTitle`.

## 7. G.* contract surface (HUD-relevant; definer → consumers)

| API | Defined in | Purpose / callers |
|---|---|---|
| `G.state` | game.js | `{ playing, paused, round, points, kills, toSpawn, spawnT, intermission, time, shake, hurtFlash }` |
| `G.addPoints(n)` | game.js | points + feed; called by player.js (hits/kills/boards), game.js (trap, explode, teddy refund 950) |
| `G.spend(n)` | game.js | returns bool; player.js buys (doors/perks/wallbuys/box/PaP/trap/build) |
| `G.deny()` | game.js | deny SFX |
| `G.updateAmmoHUD()` | game.js | player.js on fire/reload/select; inventory.js |
| `G.perkHUD()` | game.js | player.js after perk buy |
| `G.setPrompt(html)` | game.js | player.js interaction scan (every frame, nearest of list), car.js |
| `G.showMsg(t)` | game.js | everywhere (1.8 s gold toast) |
| `G.hitmarker(head)` | game.js | player.js on hit (70 ms flash) |
| `G.updateHealthFx()` | game.js | damage + hurtFlash decay loop |
| `G.updateFuelHUD()` | game.js | player.js thrust drain; crafting.js jetpack/fuel crafts |
| `G.damagePlayer(amt)` | game.js | zombies.js attack (22), trap (8/0.5 s), explosion (15) |
| `G.shake(a)` | game.js | clamp `min(0.12, shake+a)`; decay `shake *= Math.pow(0.002, dt)` per frame |
| `G.onZombieKilled(z)` | game.js | zombies.js; kills++, 12% `G.Drops.spawn(z.pos)` |
| `G.openDoor(d)` / `G.rollBox()` / `G.takeBoxWeapon()` | game.js | player.js F-interactions |
| `G.spawnBlood/Dust/Spark`, `G.spawnBeam`, `G.fireProjectile` | game.js | weapons/zombies/trap FX |
| `G.tryLock`, `G.noLock` | game.js | pointer-lock + fallback |
| `G.Inv` (`.init .render .select .selected .addWeapon .addMat .addItemAt .weaponStats .nameFor .iconFor .updateCounts .toggle .open .slots .sel`) | inventory.js | owns `#hotbar`, `#invPanel`, `#heldGhost` |
| `G.Craft` (`.initUI .setMode .refresh .update`), `G.RECIPES`, `G.Drops` | crafting.js | owns injected craft UI + `#craftBar` |
| `G.player`, `G.updatePlayer`, `G.initPlayer`, `G.bindInput`, `G.onSelectionChanged`, `G.setHandModel`, `G.giveWeapon`, `G.keys`, `G.mouse`, `G.rayVsSolids` | player.js | |
| `G.WEAPONS`, `G.BOX_POOL`, `G.buildWeaponModel` | weapons.js | box roll display, ammo HUD stats |
| `G.audio.*` (resume, roundStart/End, buy, deny, doorOpen, boxJingle, teddy, zap, explosion, playerHurt, …) | audio.js | |
| map.js surface | map.js | `G.buildMap, G.solids, G.walkables, G.windows, G.doors, G.rooms, G.roomAt, G.pathChain, G.moveWithCollision, G.groundAt, G.volAt, G.perkMachines, G.wallbuys, G.scavenge, G.mysteryBox, G.boxPads, G.moveMysteryBox, G.ripBoard, G.addBoard, G.flyingBoards, G.bulbs, G.Trap, G.spawnPoint, G.buildPerkModel, G.buildMysteryBoxModel` |
| others | | `G.Zombie, G.makeZombieBody` (zombies.js); `G.CarSys, G.buildCarModel` (car.js); `G.PaP, G.initPaP, G.buildPaPModel` (pap.js); `G.Build, G.buildPieceModel` (build.js); `G.buildWandModel, G.buildMatModel, G.buildBenchModel, G.buildAnvilModel` (crafting.js) |

## 8. Round/HUD timing constants (game.js, for reference)

- Round size `Math.min(45, Math.round(5 + r*4.2))`; first `spawnT = 1.2`; interval `Math.max(0.8, 2.4 - round*0.12)`; alive cap `Math.min(12, 6 + round)`; intermission 8 s + msg `'Round clear'`.
- Zombie hp `r<=9 ? 60 + r*45 : (60+9*45)*1.08^(r-9)`; speeds: r≤1 → 0.9+rand*0.4; sprint chance `min(0.55, max(0,(r-3)*0.09))` → 3.1+rand*0.8; roll<0.65 → 1.7+rand*0.7; else 1.0+rand*0.5. Spawn window weighted `1/(4 + dist(win, player))` among unlocked rooms.
- Mystery box HUD-adjacent timings: roll 3.6 s (cycle interval `0.16 + t*0.04`), teddy 10% (rise 2.6 s, +950 pts, msg `'The box moves…'`), take window 9 s, close 1.2 s; `?`-mark opacity `0.25 + 0.55*(0.5 + 0.5*sin(time*1.3 + i*1.1))`.
- Bulb flicker: `f = 0.82 + 0.18*sin(t*11+seed)*sin(t*4.7+seed*2)`, blackout ×0.2 when `sin(t*0.7+seed*3) > 0.985`.
- Frame dt clamp `Math.min(0.05, ms/1000)`.

## 9. Dependencies

This HTML is DOM/CSS only; all ids above are consumed by `js/game.js` (HUD/overlays), `js/inventory.js` (`#hotbar #invPanel #heldGhost`), `js/crafting.js` (`#invInner #craftBar #craftLabel #craftFill` + injected craft DOM), `js/player.js`/`js/car.js` (prompt strings) — load order in §1 is required since every file appends to `window.G`.
