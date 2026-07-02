# FABLE 5: ZOMBIES 🧟

A wave-based zombies FPS that runs entirely in the browser. No engine, no
asset files — every model, texture, and sound is generated procedurally with
Three.js and WebAudio.

![Genre](https://img.shields.io/badge/genre-zombies%20FPS-red)
![Stack](https://img.shields.io/badge/stack-Three.js%20%2B%20Vite-9dff57)

## Play

```bash
npm install
npm run dev        # then open http://localhost:5173
```

`npm run build` produces a static bundle in `dist/`.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move |
| `Mouse` / `LMB` / `RMB` | Aim / shoot / aim-down-sights |
| **`Q` / `E`** | **Smooth lean** — swerve your body left/right and shoot around corners |
| `Shift` / `Space` | Sprint / jump |
| `R` | Reload |
| **`T`** | **Inventory** (Minecraft-style — moved off `E`, which leans) |
| `1–5` | Hotbar |
| `F` | Quick-use a medkit |

## Features

- **Climbable architecture** — a ruined chapel with a stone staircase to the
  rooftop and an outdoor sniper platform. Step-up collision physics is shared
  by player *and* zombies, so the horde follows you upstairs.
- **Q/E lean** — exponentially smoothed body roll + lateral offset, probed
  against walls so you can't clip your head through stone.
- **Minecraft-style inventory on `T`** — click-to-carry slots, stack merging,
  tooltips, four armor slots (helmet / chest / leggings / boots), right-click
  to equip armor or use medkits.
- **Live 3D paperdoll** — your character renders beside the armor slots
  wearing whatever you equip, and his head follows your cursor around the
  screen, just like the Minecraft inventory doll.
- **Armor tiers** — Scrap, Steel, and Nightforged; armor absorbs 65% of
  incoming damage until it shatters.
- **Four weapons** — M1911, Viper SMG, Gravedigger shotgun, and the rare
  FABLE .500 revolver. Procedural viewmodels with sway, bob, recoil, ADS,
  tracers, ejected casings, and a real muzzle-flash light.
- **Three zombie breeds** — walkers, sprinting runners, and brute tanks that
  guarantee juicy drops. Zombies rise out of graves, take limb-based damage,
  and headshots pop heads clean off.
- **Blood moons** — every 5th wave the sky turns red and the horde gets fast.
- **Wave-clear bullet time** — the last kill of a wave drops the world into
  slow motion.
- **Killstreaks, damage numbers, kill feed, loot beacons, ground mist,
  flickering lamps** — the whole arcade package.
- **100% procedural audio** — gunshots, layered zombie groans, wind and a
  detuned drone bed, all synthesized in WebAudio at runtime.

## Testing

```bash
npx vite --port 5173 &   # dev server
node tests/smoke.mjs     # Playwright end-to-end: stairs, lean, inventory, combat
```

The game exposes a deterministic test hook at `/?test=1` (`window.__game`)
with `simulate(seconds)` so game-logic assertions don't depend on headless
render speed. `&nozombies=1` disables spawning for movement tests.

## Project layout

```
src/
  main.js       game orchestration: waves, drops, pickups, input, loop
  world.js      night graveyard arena, chapel + stairs, lights, mist
  physics.js    shared AABB collide-and-slide with step-up (stairs!)
  player.js     movement, jump, sprint, head-bob, and the Q/E lean rig
  weapons.js    hitscan weapons, viewmodels, recoil, reload, muzzle flash
  zombies.js    wave manager, AI steering, limb damage, deaths
  inventory.js  Minecraft-style inventory + armor slots (T)
  paperdoll.js  3D character preview with cursor-tracking head
  effects.js    pooled particles, tracers, casings, decals, damage numbers
  audio.js      procedural WebAudio sound engine
  hud.js        DOM HUD
  items.js      weapon/armor/consumable definitions
```
