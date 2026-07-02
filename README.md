# FABLE 5: UNDEAD BUNKER 🧟

A round-based zombies survival FPS in the browser — a full port of the
*Undead Bunker* design handoff (see `design/undead_bunker/`) onto a modern
Three.js (r185) + Vite engine. Every model, texture, and sound is procedural;
the one external asset is the **Ray Gun**, built from an uploaded STL
(624K triangles, decimated to 27.7K for the web).

## Play

```bash
npm install
npm run dev        # open http://localhost:5173
```

`npm run build` produces a static bundle (game + Asset Library) in `dist/`.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / `Shift` | Move / sprint |
| `Mouse` `LMB` `RMB` | Aim · fire / place build piece · ADS / remove piece |
| **`Q` / `E`** | **Smooth lean** — swerve and shoot around corners |
| `1–9` / wheel | Hotbar |
| **`T`** | Inventory & crafting |
| `R` | Reload |
| `F` | Interact — buy, gather, enter car, use bench/anvil · **hold** to rebuild barricades |
| `Space` | Jump — or jetpack thrust once you craft it |

## The loop

Start with 500 points and a Mauser C96 in a boarded-up bunker at night.
Zombies rise outside, tear the boards off the windows, and vault in —
**+10 a hit, +50 a kill (+90 headshots), +10 a board repaired**. Spend it on:

- **Doors** (750–1500) — Armory, Storage, the mezzanine stairs, the Campsite
- **Wall-buys** — K-98 (600), Trench Gun (1200), M1928 SMG (1750); half-price ammo refills
- **Mystery Box** (950) — MG-42, STG-44, HELIOS-8 Scatter Laser, Arc Projector,
  or the **Ray Gun**… unless the teddy bear sends the box to another pad
- **Perks** (max 4) — Tough Tonic, Rapid Rounds, Fleet Foot, Deadeye
- **Pack-a-Punch "The Reforger"** (2500) — watch your gun ride the tray under
  the stamp and come back **★**, ×2.5 damage, purple
- **Electro-trap** (1000) — fries the open camp gate for 25 s
- **Building** (50/piece) — Fortnite-style walls, floors, and stairs on a 2m
  grid; your stairs are genuinely climbable and zombies path around walls

Zombies drop **wood and coal**. Gather more at scavenge nodes, then craft in
the inventory (2×2), on a placed **Crafting Bench** (3×3), or an **Anvil**:
a **Magic Wand** (2 wood + 1 coal) turns materials into random weapons with
a channelled craft sequence — shotgun, assault rifle, or a **wonder weapon**
(30% chance it comes out pre-★). Craft the **Jetpack** (wand + 4 wood +
4 coal) and hold Space to fly; forge **Jet Fuel** from 3 coal at the anvil.

The **Riptide Coupe** deploys from your Car Keys — third-person chase cam,
crash physics, and 80+22·speed damage to anything shambling in front of it.

Fable 5 extras kept from the original build: the **Q/E lean**, and the
**armor system** (durability-based pieces shown on a 3D paperdoll whose head
follows your cursor around the inventory screen).

## Asset Library

`/library.html` — 25 turntable cards (all 9 weapons incl. the STL Ray Gun,
the car, mystery box, perk machines, The Reforger, the horde, buildables)
rendered through one scissored WebGL canvas.

## Testing

```bash
npx vite --port 5173 &
node tests/smoke.mjs   # 29 end-to-end checks in a real browser
```

`/?test=1` exposes `window.__game` with a fixed-step `simulate(seconds)` so
assertions don't depend on headless render speed. `&nozombies=1` disables
spawning for movement tests.

## Layout

```
design/undead_bunker/   the original design handoff (prototype + README)
design/digests/         implementation digests extracted from the prototype
public/models/raygun.stl  the uploaded Ray Gun (decimated)
src/
  main.js       orchestration: rounds, economy, F-interactions, loop
  world.js      the bunker: rooms, walls, windows, doors, perks, trap, camp
  physics.js    AABB collide-and-slide with headroom-checked step-up
  zombies.js    articulated rig + toWindow/tearing/vault/hunt AI + pathing
  weapons.js    9-gun arsenal, beams, projectiles, PaP tint, STL loading
  mysterybox.js / pap.js / build.js / car.js / crafting.js
  inventory.js  36 slots + armor + crafting panel   icons.js  3D item icons
  player.js     movement, lean, jetpack             paperdoll.js
  hud.js / audio.js / effects.js / items.js / library.js
```
