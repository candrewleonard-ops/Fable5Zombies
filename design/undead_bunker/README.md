# Handoff: UNDEAD BUNKER — Wave-Survival Zombies Game

## Overview
A complete, playable browser FPS: a round-based zombies survival game (original Nacht-der-Untoten-style homage — no Activision IP) with barricaded windows, a points economy, buyable doors, wall-buy weapons, a relocating mystery box with teddy bear, four perk machines, a Pack-a-Punch ("The Reforger"), Minecraft-style hotbar + inventory, a Fortnite-style wood building system, a 2×2/3×3/anvil crafting system with materials, a drivable car, an electric trap, and a fuel-based jetpack. Includes a separate 3D Asset Library showcase page.

## About the Design Files
The files in `game/` are a **working prototype built in HTML + plain JavaScript + Three.js r128** (CDN, no build step — open `Undead Bunker.html` in a browser). They are the reference for look, feel, and exact behavior. The task for Claude Code is to **rebuild this game exactly** in the target environment. If no environment is prescribed, the prototype's stack (Three.js, vanilla JS modules, no bundler) is a valid choice — you may port it to ES modules / TypeScript / a newer Three.js, but preserve every mechanic and value in this document. All 3D assets are procedural (primitives + canvas textures): keep them procedural or swap in GLB models with the same silhouettes.

## Fidelity
**High-fidelity.** All mechanics, numbers, layouts, and HUD styling are final. Recreate gameplay values exactly; visual polish may exceed the prototype (better models/shaders) but must keep the same reading: dark WWII bunker at night, warm flickering bulbs, moonlight, blood-red gothic round counter.

## Architecture (prototype)
All scripts share one global namespace `window.G`. Load order matters:
`three.js → audio.js → weapons.js → zombies.js → car.js → map.js → pap.js → build.js → crafting.js → inventory.js → player.js → game.js`

- **js/audio.js** — all SFX synthesized with WebAudio (noise bursts + oscillators). No audio files. Named functions: shot(kind), groan, boardRip/Add, buy/deny, doorOpen, perkJingle, boxJingle, roundStart/End, papHum/papDing, teddy, zap, craftTick, pickup, jet, explosion, etc.
- **js/weapons.js** — weapon stat table `G.WEAPONS` + procedural viewmodel builders (each gun ~20–40 primitives, muzzle anchor in `userData.muzzle`).
- **js/zombies.js** — procedural rigged zombie (`G.makeZombieBody`) + `G.Zombie` AI class.
- **js/car.js** — `G.buildCarModel` (original teal coupe) + `G.CarSys` arcade driving.
- **js/map.js** — map geometry/textures, AABB collision (`G.solids`), walkable surfaces (`G.walkables`), rooms/portals pathing, windows/barricades, doors, perks, wall-buys, mystery box + pads + teddy, campsite, scavenge nodes, electro-trap data, `G.moveWithCollision`, `G.groundAt`, `G.roomAt`, `G.pathChain`.
- **js/pap.js** — Pack-a-Punch model + insert/work/eject state machine.
- **js/build.js** — build ghost + placement on 2m grid (`G.Build`), wood wall/floor/stairs + bench/anvil placement.
- **js/crafting.js** — materials, recipes, craft UIs (2×2 / 3×3 / anvil), wand craft animations, zombie drops, scavenge gathering.
- **js/inventory.js** — 36-slot inventory (9 hotbar), Minecraft-style UI, 3D-rendered item icons (offscreen renderer → dataURL).
- **js/player.js** — FPS controller, viewmodel, shooting (raycast + AABB wall occlusion), interactions, jetpack physics.
- **js/game.js** — renderer setup, HUD, rounds/spawner, mystery box/teddy states, trap update, particles/beams, projectiles, main loop, menus.
- **js/library.js + Asset Library.html** — one WebGL canvas, scissored viewport per card, turntable pedestals for 21 assets.

## Controls
- WASD move (W forward), Shift+W sprint, mouse look (pointer lock; graceful fallback if blocked)
- LMB fire / place build piece / deploy car · RMB aim-down-sights / remove build piece
- R reload · F interact (buy, rebuild barricades, enter car, gather, use bench/anvil, PaP, trap) · hold F to rebuild boards
- 1–9 hotbar select, mouse wheel cycles · E inventory (pauses game) · Space jetpack thrust (once crafted) · Esc pause

## Core Loop & Economy
- Start: 500 points, Mauser C96 (slot 1), build pieces wall/floor/stairs (slots 2–4), Car Keys (slot 5).
- Points: +10 per bullet hit, +50 kill bonus (+90 if headshot kill), +10 per board repaired. Costs: doors 750/1000/1250/1500, wall-buys (below), box 950, perks 2000–3000, PaP 2500, trap 1000, build piece 50 (25 refund), ammo refill = half gun cost.
- Rounds: count = min(45, round(5 + r·4.2)); zombie hp = 60 + r·45 (r≤9), then ×1.08 per round; walkers 1.0–1.5, joggers 1.7–2.4, sprinters 3.1–3.9 with chance min(0.55, (r−3)·0.09); alive cap min(12, 6+r); spawn interval max(0.8, 2.4 − r·0.12); 8s intermission; round banner + drone sting.
- Player: 100 hp (250 with Tough Tonic), regen 40/s after 3.5s, zombie hit = 22 dmg. Death → stats + restart.

## Weapons (`G.WEAPONS`)
| key | name | dmg | headMult | mag | reserve | rpm | auto | reload | pellets | source |
|---|---|---|---|---|---|---|---|---|---|---|
| mauser | Mauser C96 | 40 | 3.0 | 10 | 80 | 300 | no | 2.0 | 1 | start |
| kar98 | K-98 Bolt Rifle | 160 | 4.0 | 5 | 50 | 46 | no (bolt) | 3.0 | 1 | wall 600 |
| trench | M97 Trench Gun | 26 | 1.5 | 6 | 60 | 65 | no | 3.2 | 8 | wall 1200 |
| smg | M1928 SMG | 34 | 2.0 | 30 | 210 | 620 | yes | 2.6 | 1 | wall 1750 |
| mg42 | MG-42 | 42 | 2.0 | 75 | 300 | 900 | yes | 4.6 | 1 | box |
| stg | STG-44 | 55 | 2.5 | 30 | 180 | 500 | yes | 2.8 | 1 | box |
| laser | HELIOS-8 Scatter Laser | 60/pellet | 2.0 | 8 | 64 | 85 | no | 2.8 | 8 | box — 8 cyan additive beam cylinders + sparks, cyan muzzle flash |
| arc | Arc Projector | 1200 AoE | — | 3 | 18 | 90 | no | 3.2 | projectile | box — glowing bolt, 4.2m blast, small self-damage |

Limb hits ×0.8. Shots are camera raycasts vs zombie part meshes, occluded by wall AABBs (slab-method ray vs `G.solids`). Muzzle flash plane + point light; recoil kick on viewmodel + camera pitch; ADS lowers FOV 75→59 and spread ×0.4.
**Pack-a-Punch upgrade (`item.pap`)**: ×2.5 dmg, ×1.5 mag & reserve (ceil), ×0.85 reload, name "★ <name>", purple emissive tint on viewmodel, purple glow on hotbar slot.

## Zombies
States: `toWindow → tearing (rips 1 board / ~1.4–2.3s) → vault (1.15s arc through window) → hunt → dead`. Hunt uses room-portal pathing: `G.roomAt(pos)` → BFS over unlocked rooms → waypoint chain (stairs are a 3-point chain); same room = direct steering with zombie-zombie separation (skip if Δy>1.5). Attack: range 1.7, 1.15s cooldown, 22 dmg after 280ms windup with arm swipe. Headshot kill hides head + big blood burst; bodies fall, sink, despawn ~4.5s. Ambient groans with distance attenuation; 12% chance to drop wood/coal pickup.

## Map (all coordinates in meters, y-up)
**Bunker** — MAIN hall x −14..14, z −10..10, double-height (6.4m) north half, mezzanine (UPPER) at y 3.2 over x −14..6.8, z 0..10 with stair opening x −14..−9.7, z 8.2..10; stairs (10 steps, 0.32 rise) along west wall behind 1250-pt debris; balcony rail at z=0 (droppable). ARMORY x −26..−14, z −2..10 (door 750 at (−14,4)). STORAGE x 5.2..14, z 10..18 (door 1000 at (9.5,10)); contains PaP at (8.5,17.2). **CAMPSITE** x −34..0, z 10..34 (door 1500 in armory south wall at (−20,10)): palisade fence, campfire (flickering orange light), 2 tents, watchtower with steps + platform (2.7m), lanterns, rocks, crates.
**Windows/barricades (6 boards each, repairable)**: MAIN ×4, ARMORY ×2, STORAGE ×2, UPPER ×3 (sill 4.1), CAMP ×3 free-standing frames + 1 open gate (no boards) at (0,18.2) defended by the trap.
**Wall-buys (chalk outlines)**: kar98 (4,1.7,−9.79), trench (10.5,1.7,17.79), smg on mezzanine east wall (6.61,4.9,5).
**Perks (max 4)**: Tough Tonic 2500 (13.45,−9.2) +150 max hp · Rapid Rounds 3000 (−25.35,9.2) reload ×0.55 + rpm ×1.12 · Fleet Foot 2000 mezzanine (−13.35,2) speed ×1.17 · Deadeye 2500 (13.45,17.2) dmg ×1.4. Machines: black cabinets, colored emissive canvas labels, colored point lights; HUD shows colored initial badges.
**Mystery box**: 1.9m crate, gold trim, two '?' marks per long face pulsing slowly (additive opacity 0.25–0.8, offset phases), faint 60m sky beam always on at active pad. 950 pts: lid opens, blue beam, weapons cycle ~3.6s, then F to take (9s window). **Teddy (10%)**: plush bear rises + spins 2.6s with giggle jingle, 950 refunded, box relocates to another of 3 pads (armory (−24.9,0.8), campsite (−16,19.5), main (8.5,−8.6)) — wooden pallets mark all pads.
**Electro-trap**: two tipped posts at the camp gate; F on switch, 1000 pts → 25s of random arcing beams + zap SFX, ~375 dmg/s to zombies in zone (x −0.9..0.9, z 16.8..19.6), 8 dmg/0.5s to the player; 40s cooldown. Prompt shows Ready/Active/Cooling.
**Scavenge nodes** (F, ~8s respawn, +1–2 mats): logs (12.6,4.2) MAIN, coal (−16,6.8) ARMORY, logs (−13,29.5) + coal (−4,13) CAMP.
Lighting: hemisphere + moon directional (shadows), ~10 warm flickering bulbs/lanterns/campfire, night sky dome with painted moon + stars, fog 16→62.

## Building (`G.Build`)
Hold a build item → snapped ghost (green valid / red invalid) on 2m grid, 2.4m vertical module, surface-snap to floors/mezzanine; facing from camera yaw (90° snap). LMB place (50 pts), RMB remove (raymarch 0.05 steps, +0.08 inflation; 25 refund). Pieces: **wall** 2×2.4×0.16, **floor** 2×0.16×2 (walkable), **stairs** 6 steps rising 2.4 (walkable). All become collision solids that zombies path around. Bench/anvil place through the same ghost (consumes the item, no points; removing returns the item).

## Inventory & Hotbar
36 slots (9 hotbar). Minecraft-style beveled slots, white selected outline, item icons rendered from the actual 3D models at init (128px, transparent). Click-to-pick/swap in the panel (held item follows cursor); materials stack with count badges; weapon slots show mag count. Opening inventory pauses the game and releases pointer lock.

## Crafting (`G.Craft`, in-inventory panel)
Left: inventory. Right: craft grid + result slot + **Recipes bar** (buttons show icon, name, ingredients, description; greyed when missing mats; click = auto-craft from inventory). Grid also works manually: exact shapeless match lights the result slot.
- **2×2 (pocket)**: Crafting Bench = 4 wood · Magic Wand = 2 wood + 1 coal · Random Shotgun = wand + 2 wood · Random Assault Rifle = wand + 2 coal (pool stg/smg/mg42) · Random Wonder Weapon = wand + 3 coal (pool arc/laser)
- **3×3 (placed bench, F to use)**: all 2×2 recipes + Anvil = 4 wood + 4 coal · Jetpack = wand + 4 wood + 4 coal
- **Anvil (placed, F)**: Jet Fuel = 3 coal → +50% jetpack fuel
**Weapon craft sequence (3.0s)**: inventory closes, magic wand appears in hand, bottom loading bar "ITEM CRAFTING — <recipe>"; unique FX per recipe — AR: orange spark spiral orbiting the wand tip + ticks; Shotgun: red spark bursts every 0.5s + screen kick; Wonder: purple lightning beams zapping outward every 0.36s. Finish: spark flash, jingle, random weapon from pool lands in hand (30% pre-★).

## Car ("Riptide Coupe" — original design, no branding)
Hotbar "Car Keys": LMB deploys 4.6m ahead (one car; redeploy moves it). F to enter: third-person chase cam (FOV widens with speed), W/S accel/brake-reverse (max 15 / −5.5), A/D steer (speed-scaled), body roll, spinning wheels, headlight spotlight, crash slowdown + thud + shake, running over zombies at speed deals 80+22·speed dmg and awards points. F (when slow) exits.

## Jetpack
Craft once → fuel gauge (vertical bar, right side; cyan, red under 25%). Hold Space: vy ramps to 4.4 m/s, fuel drains 18/s, thrust SFX + orange sparks below; release → gravity (−13 m/s²), head-bump check vs ceilings, land on any walkable (including built floors/watchtower). Refuel via anvil.

## Pack-a-Punch — "The Reforger"
Dark cabinet + copper pipes, purple rune strip, amber furnace window, pulsing purple light. F with a non-★ gun + 2500: gun rides the sliding tray in, rollers spin, stamp head pounds, purple sparks, ~3.4s papHum; tray ejects the gun glowing purple, floating/bobbing; F to take (auto-selects). States: idle → in → work → out → ready.

## HUD
Pirata One (gothic) for round number (blood red, bottom-left) and titles; Barlow Condensed elsewhere. Points + animated +/− feed (left), weapon name + mag/reserve (right, red when low, blinking RELOAD hint), perk badges, fuel bar, crosshair dot, white/red hitmarkers, center-bottom interact prompt with gold keys, top-center gold messages, red round banner on round change, radial blood vignette scaling with damage, hotbar bottom-center. Menu: title, controls grid, Enter button, Asset Library link. Pause + death overlays.

## Asset Library page
Standalone page; one fixed WebGL canvas behind a scrolling DOM grid; each card renders its own scene via scissored viewport (clear FULL canvas with scissor test off first). 21 turntable cards in 5 sections (Weapons ×8, Vehicle, Machines ×6 incl. bench/anvil/wand, Horde ×3 posed zombies, Buildables ×3) on metal pedestals, key/rim lights, animated ticks (PaP rollers, car wheels, zombie sway).

## Design Tokens
- Colors: blood red #b81414/#a31111, parchment #e8dfcf/#d8cdb8, muted #9a917f/#8a8172, gold #f7d774, bg #0c0d10/#141519, slot #1f1f23, box-blue #86c8ff, laser cyan #35e6ff, PaP purple #b04aff/#7a2bd6, fuel #3fa7c8, ember #ff8a30.
- Fonts: Pirata One (display), Barlow Condensed 400/600/700 (UI), Georgia (in-world canvas labels/chalk).
- All textures are canvas-generated: concrete noise + cracks, stained floor, wood grain, plank barricades, chalk wall-buys, perk labels, '?' marks, sky dome.

## Known prototype quirks (fix or keep)
- Pointer lock fails in sandboxed iframes → automatic mouse-look fallback + Esc pause (keep the fallback).
- Zombies don't attack player-built structures (they path around) — acceptable v1.
- Single save-less session; restart reloads the page.

## Files
- `game/Undead Bunker.html` — entry, HUD DOM/CSS, overlays
- `game/Asset Library.html` + `game/js/library.js` — showcase
- `game/js/*.js` — all systems as listed under Architecture
