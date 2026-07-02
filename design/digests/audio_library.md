# Digest: audio.js + Asset Library (Undead Bunker prototype)

Sources: `game/js/audio.js`, `game/Asset Library.html`, `game/js/library.js`. All timings in seconds, freqs in Hz, colors hex.

---

## 1. audio.js — `G.audio` (procedural WebAudio SFX, zero sample files)

IIFE assigned to `G.audio` on `window.G`. Module state: `ctx` (AudioContext), `master` (GainNode), `noiseBuf` (AudioBuffer).

### 1.1 Setup

- `init()`: idempotent (`if (ctx) return`). Creates `AudioContext || webkitAudioContext`. `master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination)`. Noise buffer: `ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)` (mono, exactly 1 s), filled with white noise `d[i] = Math.random() * 2 - 1`.
- `resume()`: calls `init()`; if `ctx.state === 'suspended'` calls `ctx.resume()` (user-gesture unlock).
- All play functions no-op if `!ctx`.

### 1.2 Core synth primitives (all SFX are built from these two)

**`noise(dur, o = {})`** — looping BufferSource(noiseBuf) → BiquadFilter → Gain → master.
| param | default | behavior |
|---|---|---|
| `o.type` | `'lowpass'` | filter type (`highpass`/`bandpass` used too) |
| `o.f` | `1000` | filter freq, `setValueAtTime` at now |
| `o.fEnd` | — | if set: `frequency.exponentialRampToValueAtTime(o.fEnd, now + dur)` |
| `o.q` | `0.8` | filter Q |
| `o.gain` | `0.4` | peak gain |
| `o.attack` | `0.003` | env: `0.0001` → linearRamp to gain at `now + attack` → exponentialRamp to `0.0001` at `now + dur` |
Source: `start()` now, `stop(now + dur + 0.05)`.

**`tone(freq, dur, o = {})`** — Oscillator → Gain → master.
| param | default | behavior |
|---|---|---|
| `o.type` | `'sine'` | osc type |
| `o.slide` | — | if set: `frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), now + dur)` (pitch glide over full dur) |
| `o.delay` | `0` | everything offset by delay |
| `o.gain` | `0.15` | peak gain |
| `o.attack` | `0.01` | env: `0.0001` at `now+delay` → linearRamp to gain at `now+delay+attack` → exponentialRamp to `0.0001` at `now+delay+dur` |
Osc: `start(now + delay)`, `stop(now + delay + dur + 0.05)`.

### 1.3 Weapon shots — `shot(kind)` dispatches into `shots` table; unknown kind falls back to `pistol`

Each cell is a verbatim layer call. Kinds map to weapons: pistol=mauser, rifle=kar98, shotgun=trench, smg, lmg=mg42 (also stg uses per-game wiring), arc, laser.

| kind | layers (verbatim) |
|---|---|
| `pistol` | `noise(0.14,{f:2400,fEnd:300,gain:0.5})` + `tone(150,0.09,{type:'triangle',gain:0.3,slide:55})` |
| `rifle` | `noise(0.30,{f:3200,fEnd:180,gain:0.65})` + `tone(110,0.22,{type:'triangle',gain:0.42,slide:40})` |
| `shotgun` | `noise(0.32,{f:1600,fEnd:120,gain:0.75,q:0.5})` + `tone(90,0.25,{type:'triangle',gain:0.5,slide:35})` |
| `smg` | `noise(0.10,{f:2600,fEnd:400,gain:0.4})` + `tone(160,0.06,{type:'triangle',gain:0.22,slide:70})` |
| `lmg` | `noise(0.13,{f:2200,fEnd:300,gain:0.5})` + `tone(130,0.09,{type:'triangle',gain:0.3,slide:50})` |
| `arc` | `tone(1200,0.35,{type:'sawtooth',gain:0.18,slide:200})` + `tone(2400,0.3,{type:'square',gain:0.06,slide:500})` + `noise(0.25,{f:6000,fEnd:800,gain:0.2,type:'bandpass',q:3})` |
| `laser` | `tone(2200,0.14,{type:'square',gain:0.1,slide:340})` + `tone(880,0.2,{type:'sawtooth',gain:0.16,slide:110})` + `noise(0.18,{f:5200,fEnd:900,gain:0.3,type:'bandpass',q:2.5})` + `tone(140,0.12,{type:'triangle',gain:0.25,slide:60})` |

### 1.4 Gun handling SFX

| fn | layers (verbatim) |
|---|---|
| `empty()` | `tone(1600,0.05,{type:'square',gain:0.06})` + `tone(900,0.04,{type:'square',gain:0.05,delay:0.07})` |
| `reloadStart()` | `noise(0.06,{f:3000,gain:0.12,type:'highpass'})` + `tone(700,0.04,{type:'square',gain:0.05})` |
| `reloadEnd()` | `tone(1100,0.05,{type:'square',gain:0.08})` + `noise(0.05,{f:2500,gain:0.1,type:'highpass',q:2})` |
| `bolt()` | `tone(500,0.05,{type:'square',gain:0.07})` + `tone(750,0.05,{type:'square',gain:0.07,delay:0.12})` |
| `hitTick(head)` | `tone(head ? 2000 : 1400, 0.05, {type:'square',gain:0.09})` |
| `playerHurt()` | `tone(70,0.4,{type:'triangle',gain:0.4,slide:40})` + `noise(0.3,{f:300,gain:0.25})` |

### 1.5 Zombie vocals (bespoke node graphs)

**`groan(vol)`** — custom graph, not the helpers:
- `v = Math.min(0.5, vol)`; return if `v < 0.01` (caller passes distance-attenuated volume).
- `base = 55 + Math.random()*60`; `dur = 0.9 + Math.random()*1.1`.
- Main osc: `sawtooth` at `base`, `linearRampToValueAtTime(base * (0.75 + Math.random()*0.5), now + dur)`.
- Vibrato LFO: osc freq `4 + Math.random()*6` → GainNode gain `base * 0.25` → connected to `osc.frequency`.
- Filter: lowpass `frequency=500`, `Q=2`.
- Env: `0.0001` → linearRamp to `v * 0.5` at `now + dur*0.3` → exponentialRamp to `0.0001` at `now + dur`.
- Chain: osc → filter → gain → master. Both osc & lfo `start()` now, `stop(now + dur + 0.1)`.

**`attackSnarl(vol)`**: `v = Math.min(0.5, vol)`, skip if `< 0.01`; `noise(0.35,{f:900,fEnd:300,gain:v,type:'bandpass',q:2})` + `tone(120,0.3,{type:'sawtooth',gain:v*0.7,slide:60})`.

### 1.6 Game-event SFX

| fn | layers (verbatim) |
|---|---|
| `boardRip()` | `noise(0.25,{f:1200,fEnd:200,gain:0.35,q:2})` + `tone(220,0.15,{type:'square',gain:0.08,slide:90})` |
| `boardAdd()` | `tone(180,0.07,{type:'square',gain:0.15})` + `tone(240,0.06,{type:'square',gain:0.12,delay:0.08})` + `noise(0.08,{f:1800,gain:0.15})` |
| `buy()` | `tone(520,0.1,{type:'triangle',gain:0.16})` + `tone(780,0.16,{type:'triangle',gain:0.16,delay:0.09})` |
| `deny()` | `tone(160,0.2,{type:'square',gain:0.1})` + `tone(120,0.24,{type:'square',gain:0.1,delay:0.1})` |
| `doorOpen()` | `noise(0.8,{f:400,fEnd:90,gain:0.35})` + `tone(60,0.7,{type:'triangle',gain:0.3,slide:35})` |
| `explosion()` | `noise(0.9,{f:900,fEnd:60,gain:0.8,q:0.4})` + `tone(55,0.8,{type:'triangle',gain:0.5,slide:25})` |
| `vaultThud()` | `tone(90,0.15,{type:'triangle',gain:0.2,slide:50})` + `noise(0.12,{f:500,gain:0.18})` |
| `zap()` | `noise(0.08,{f:4200,fEnd:1500,gain:0.14,type:'bandpass',q:3})` + `tone(2400,0.06,{type:'square',gain:0.05,slide:700})` |
| `craftTick()` | `tone(700 + Math.random()*500, 0.06, {type:'square',gain:0.06})` + `noise(0.05,{f:3200,gain:0.08,type:'highpass'})` |
| `pickup()` | `tone(880,0.08,{type:'triangle',gain:0.1})` + `tone(1320,0.1,{type:'triangle',gain:0.1,delay:0.06})` |
| `jet()` | `noise(0.14,{f:900,fEnd:500,gain:0.1,q:0.6})` (single layer; retrigger while thrusting) |

### 1.7 Jingles / stingers (arpeggio arrays: `arr.forEach((f,i) => tone(f, dur, {…, delay: i*step}))`)

| fn | notes (Hz) | per-note | step | extra layers |
|---|---|---|---|---|
| `perkJingle()` | 523, 659, 784, 1046 | `tone(f,0.16,{type:'triangle',gain:0.14})` | 0.13 | — |
| `boxJingle()` | 392, 523, 659, 523, 784, 659, 1046 | `tone(f,0.22,{type:'triangle',gain:0.1})` | 0.19 | — |
| `papDing()` | 880, 1320, 1760 | `tone(f,0.4,{type:'triangle',gain:0.14})` | 0.16 | + `tone(220,0.5,{type:'square',gain:0.08})` |
| `teddy()` | 1180, 990, 1180, 880, 740 | `tone(f,0.22,{type:'sine',gain:0.16,slide:f*0.92})` | 0.17 | + `tone(160,1.2,{type:'triangle',gain:0.1,slide:60,delay:0.2})` |
| `roundEnd()` | 220, 196, 165, 147 | `tone(f,0.5,{type:'triangle',gain:0.12})` | 0.3 | — |

**`papHum()`** (~3.2 s machine drone): `tone(70,3.2,{type:'sawtooth',gain:0.18,slide:95})` + `tone(105,3.2,{type:'sawtooth',gain:0.12,slide:140})` + `noise(3.0,{f:300,gain:0.12})`.

**`roundStart()`** (drone sting): `tone(55,2.4,{type:'sawtooth',gain:0.16,slide:110})` + `tone(82,2.4,{type:'sawtooth',gain:0.12,slide:165,delay:0.05})` + `noise(2.0,{f:200,gain:0.1,q:1})`.

### 1.8 Exported API (the full `G.audio.*` surface)

```
init, resume, shot(kind), empty, reloadStart, reloadEnd, bolt, hitTick(head), playerHurt,
groan(vol), attackSnarl(vol), boardRip, boardAdd, buy, deny, doorOpen, perkJingle, boxJingle,
explosion, vaultThud, roundStart, roundEnd, papHum, papDing, teddy, zap, craftTick, pickup, jet
```
`noise`/`tone` are private. audio.js has zero dependencies on other prototype files (loads right after three.js).

---

## 2. Asset Library.html (standalone showcase page)

- Fonts (Google): `Pirata+One`, `Barlow+Condensed:wght@400;600;700`.
- Body: bg `#0c0d10`, text `#d8cdb8`, font Barlow Condensed.
- `<canvas id="gl">`: `position:fixed; inset:0; z-index:0; pointer-events:none` — one full-viewport WebGL canvas *behind* the DOM.
- `#page`: `z-index:1; max-width:1280px; margin:0 auto; padding:38px 28px 90px`.
- `h1` "ASSET LIBRARY": Pirata One, 52px, `#b81414`, `text-shadow:0 0 26px rgba(184,20,20,.4), 0 3px 2px #000`, letter-spacing 1px. Header link "← Back to the game" → `Undead Bunker.html` (`#8a7f6a`, 18px, ls 2px, dotted underline `#6b6355`, hover `#d8cdb8`).
- `.note`: `#6f6759` 16px ls 1px, mb 26px.
- `h2` (section titles): 22px, ls 5px, uppercase, `#9a917f`, `margin:38px 0 14px`, bottom border `1px solid #26272c`, pb 8px.
- `.grid`: `display:grid; grid-template-columns:repeat(auto-fill, minmax(255px, 1fr)); gap:18px`.
- `.card`: bg `#141519`, border `1px solid #26272c`, `box-shadow:0 4px 18px rgba(0,0,0,.4)`.
- `.view`: `width:100%; aspect-ratio:1.15` (this empty div's bounding rect drives the scissor viewport).
- `.meta`: `padding:12px 14px 14px; border-top:1px solid #22232a`. `h3`: 21px/700, ls 1px, `#e8dfcf`. `.tag`: 13px, ls 2px, color `#0c0d10` on `#8a7f6a`, `padding:1px 7px; vertical-align:3px; margin-left:8px`. `p`: 15.5px, `#8a8172`, ls .5px, mt 3px.
- Footer: `#5a5347`, 15px, mt 60px.
- DOM: `<div id="sections">` is empty; library.js fills it.
- Script load order (exact): `three.min.js r128 (cdnjs) → js/weapons.js → js/zombies.js → js/car.js → js/map.js → js/pap.js → js/build.js → js/crafting.js → js/library.js`. No audio.js, no game.js, no player/inventory.

---

## 3. library.js — one canvas, scissored turntable per card

IIFE. Aliases: `T = THREE`, `W = G.WEAPONS`.

### 3.1 Dependencies (G.* contract consumed)
| symbol | defined in |
|---|---|
| `G.WEAPONS` (stat table: `.dmg .mag .rpm` read for captions), `G.buildWeaponModel(key)` | weapons.js |
| `G.makeZombieBody()` → `{ root, parts }` with `parts.torso/neck/armL/armR{sh,el}/legL/legR{hip,kn}` | zombies.js |
| `G.buildCarModel` (→ `userData.wheels[]`) | car.js |
| `G.buildPaPModel` (→ `userData.rollers[]`, `userData.stamp`, `userData.light`) | pap.js |
| `G.buildPerkModel(name, color)`, `G.buildMysteryBoxModel(open)` | map.js |
| `G.buildBenchModel`, `G.buildAnvilModel`, `G.buildWandModel` | crafting.js |
| `G.buildPieceModel(piece)` ('wall'/'floor'/'stairs') | build.js |

### 3.2 `poseZombie(kind)` — static poses on `G.makeZombieBody()`
Common to all: `parts.torso.rotation.x = 0.22; parts.neck.rotation.x = -0.15` (overridden per kind below). `root.userData.parts = parts` (needed by sway).
| kind | pose (radians) |
|---|---|
| `shambler` | armL.sh.x=-0.5, armR.sh.x=-0.35, armL.el.x=-0.3, armR.el.x=-0.4, legL.hip.x=0.25, legR.hip.x=-0.2 |
| `runner` | torso.x=0.5, armL.sh.x=-1.4, armR.sh.x=-1.25, legL.hip.x=0.6, legR.hip.x=-0.55, legR.kn.x=0.9 |
| `brute` (else) | `root.scale.setScalar(1.18)`, armL.sh.x=-1.5, armR.sh.x=-1.5, armL.sh.z=0.3, armR.sh.z=-0.3, neck.x=-0.35 |

### 3.3 Caption helper
```js
const wcap = (k, extra) => { const d = W[k]; return `${d.dmg} dmg · ${d.mag} rd · ${d.rpm} rpm · ${extra}`; };
```

### 3.4 The 21 assets — `SECTIONS` (5 sections)

**Weapons (8)** — all `build: () => G.buildWeaponModel(key)`:
| name | tag | caption | key |
|---|---|---|---|
| Mauser C96 | — | `wcap('mauser','starting sidearm')` | mauser |
| K-98 Bolt Rifle | — | `wcap('kar98','wall buy 600')` | kar98 |
| M97 Trench Gun | — | `wcap('trench','wall buy 1200')` | trench |
| M1928 SMG | — | `wcap('smg','wall buy 1750')` | smg |
| MG-42 | — | `wcap('mg42','mystery box')` | mg42 |
| STG-44 | — | `wcap('stg','mystery box')` | stg |
| HELIOS-8 Scatter Laser | ENERGY | `'8 beams · ' + wcap('laser','mystery box')` | laser |
| Arc Projector | ENERGY | `'AoE bolt · mystery box only'` | arc |

**Vehicle (1)**:
| name | tag | caption | build | tick |
|---|---|---|---|---|
| Riptide Coupe | DRIVABLE | `hotbar item · LMB deploy · F drive · mows the horde` | `G.buildCarModel` | `(m,dt) => m.userData.wheels && m.userData.wheels.forEach(w => w.rotation.x += dt * 2.4)` |

**Machines (10)**:
| name | tag | caption | build | tick |
|---|---|---|---|---|
| The Reforger | PACK-A-PUNCH | `insert weapon · 2500 pts · ×2.5 damage` | `G.buildPaPModel` | `(m,dt,t) => { const u=m.userData; u.rollers.forEach(r => r.rotation.x += dt*8); u.stamp.position.y = 1.42 - Math.abs(Math.sin(t*3))*0.1; u.light.intensity = 0.8 + Math.sin(t*4)*0.4; }` |
| Mystery Box | — | `950 pts · random weapon · beware the teddy` | `() => G.buildMysteryBoxModel(true)` (open lid) | — |
| Crafting Bench | CRAFTED | `4 wood · placeable · 3×3 recipes` | `G.buildBenchModel` | — |
| Anvil | CRAFTED | `4 wood + 4 coal · smelts jet fuel` | `G.buildAnvilModel` | — |
| Magic Wand | CATALYST | `2 wood + 1 coal · crafts random weapons` | `G.buildWandModel` | — |
| Tough Tonic | PERK | `+150 max health · 2500 pts` | `() => G.buildPerkModel('TOUGH TONIC', 0x9e1b1b)` | — |
| Rapid Rounds | PERK | `faster reload & fire · 3000 pts` | `() => G.buildPerkModel('RAPID ROUNDS', 0xb08414)` | — |
| Fleet Foot | PERK | `+17% move speed · 2000 pts` | `() => G.buildPerkModel('FLEET FOOT', 0x1c5d8a)` | — |
| Deadeye | PERK | `+40% damage · 2500 pts` | `() => G.buildPerkModel('DEADEYE', 0x5b2a7a)` | — |

**The Horde (3)** — all `sway: true`:
| name | caption | build |
|---|---|---|
| Shambler | `tears barricades · vaults windows` | `() => poseZombie('shambler')` |
| Runner | `sprint variant · round 4+` | `() => poseZombie('runner')` |
| Brute | `heavy frame · glowing eyes` | `() => poseZombie('brute')` |

**Buildables — Wood (3)**:
| name | caption | build |
|---|---|---|
| Wall | `50 pts · blocks the horde` | `() => G.buildPieceModel('wall')` |
| Floor | `50 pts · bridge & platform` | `() => G.buildPieceModel('floor')` |
| Stairs | `50 pts · ramp up 2.4m` | `() => G.buildPieceModel('stairs')` |

### 3.5 Renderer setup
```js
new T.WebGLRenderer({ canvas: #gl, alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.setSize(innerWidth, innerHeight);   // also on window resize
```

### 3.6 Card construction (per item)
DOM: for each section append `<h2>{title}</h2>` + `<div class="grid">` into `#sections`; per item:
```html
<div class="card"><div class="view"></div><div class="meta"><h3>{name}[ <span class="tag">{tag}</span>]</h3><p>{cap}</p></div></div>
```
Each card gets its OWN `T.Scene` with:
- `HemisphereLight(0xc3cdde, 0x2a2018, 0.95)`
- key `DirectionalLight(0xfff2dd, 1.0)` at `(2.5, 3.5, 2.5)`
- rim `DirectionalLight(0x7a9cc8, 0.5)` at `(-3, 1.5, -2.5)`
- `spin = new T.Group()` (the turntable) added to scene.

Model framing:
```js
const bb = new T.Box3().setFromObject(model);
const c = bb.getCenter(new T.Vector3()), s = bb.getSize(new T.Vector3());
model.position.sub(c);            // center at origin
spin.add(model);
const maxDim = Math.max(s.x, s.y, s.z);
```
Pedestal (inside `spin`, rotates with model):
```js
new T.CylinderGeometry(maxDim*0.52, maxDim*0.58, maxDim*0.03, 36)   // topR, bottomR, height, segments
material: MeshStandardMaterial({ color: 0x1e2026, metalness: 0.6, roughness: 0.4 })
ped.position.y = -s.y/2 - maxDim*0.02;
```
Camera (one per card):
```js
new T.PerspectiveCamera(32, 1, 0.01, 100);
cam.position.set(0, maxDim*0.22, maxDim*2.05);
cam.lookAt(0, 0, 0);
```
Card record: `{ el: card.querySelector('.view'), scene, cam, spin, model, tick, sway, t: Math.random()*10 }` (random phase so animations desync).

### 3.7 Render loop (scissor technique)
```js
const dt = Math.min(0.05, (now - last) / 1000);
const H = renderer.domElement.height / renderer.getPixelRatio();  // CSS-pixel canvas height
renderer.setScissorTest(false);
renderer.setClearColor(0x000000, 0);   // transparent
renderer.clear();                       // clear FULL canvas with scissor OFF
renderer.setScissorTest(true);
```
Per card, each frame:
1. `r = card.el.getBoundingClientRect()`; **cull** if `r.bottom < 0 || r.top > innerHeight || r.width === 0`.
2. `card.t += dt`; `card.spin.rotation.y += dt * 0.55` (turntable speed, rad/s).
3. `if (card.tick) card.tick(card.model, dt, card.t)` (car wheels / PaP rollers+stamp+light — see §3.4).
4. Sway (zombies): `card.model.rotation.z = Math.sin(card.t * 1.3) * 0.04;` and if `model.userData.parts` exists: `parts.neck.rotation.z = Math.sin(card.t * 0.9) * 0.15;`.
5. GL rect is y-flipped: `const y = H - r.bottom;` then `renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height);`.
6. `card.cam.aspect = r.width / r.height; card.cam.updateProjectionMatrix(); renderer.render(card.scene, card.cam);`

Driven by `requestAnimationFrame(loop)`; dt clamped to 0.05 s max. Note viewport coords are passed in CSS pixels (three r128 multiplies by pixelRatio internally).
