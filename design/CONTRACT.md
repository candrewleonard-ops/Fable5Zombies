# Fable5Zombies engine contract (for module authors)

Target: ES modules, `import * as THREE from 'three'` (r185). Meters, y-up. No globals — export classes/functions.
Everything procedural (primitives + canvas textures). Match the design digests in `design/digests/` for exact values.

## Existing modules you may import

### `src/physics.js`
- `groundHeightAt(colliders, x, z, feetY, radius, height=0) → y` — highest standable collider top ≤ feetY+0.55 (0 = ground plane). `height` adds a headroom check.
- `moveEntity(colliders, pos, vel, dt, radius, height, bounds) → {grounded, hitWall, bumpedHead}` — axis-slide + gravity + step-up (mutates pos/vel; pos = FEET).
- `raycastColliders(colliders, origin, dir, maxDist) → t or Infinity`.
- Colliders are plain `{minX,maxX,minY,maxY,minZ,maxZ}` objects.

### `src/items.js`
- `WEAPONS` (keys: mauser kar98 trench smg mg42 stg laser arc raygun), `weaponDef(item)`, `papStats(def)`, `BOX_POOL`, `ECON`, `ROUND`, `makeWeaponItem(key,{pap})`, `makeMaterial('wood'|'coal',n)`, `makeTool(key)`, `RECIPES`.
- Inventory items are plain objects `{id, kind:'weapon'|'material'|'tool'|'armor', name, icon, icon3d, stack, count, ...}`; weapons carry `mag`, `reserve`, `pap` (bool), `weaponKey`.

### `src/weapons.js`
- `buildGunModel(key) → THREE.Group` — procedural viewmodel/world model, has child `Object3D` named `'muzzle'`.
- `makeRayGunMesh() → Group|null` — the uploaded STL model once loaded (null before).

### `src/world.js` → `createWorld(scene)` returns `world`:
- `colliders` (movement), `shotSolids` (bullets/LOS), `bounds`
- `rooms` (`{MAIN,ARMORY,STORAGE,CAMP,UPPER}`, each `{rects,unlocked}`), `roomAt(pos)`, `pathChain(fromRoom,toRoom)`
- `windows`, `doors`, `openDoor(door)`, `ripBoard(win,board)`, `addBoard(win)`
- `perks`, `wallBuys`, `boxPads` (`{x,z,ry}`×3), `papPos` (Vector3 8.5,0,17.2 — cabinet faces ry π), `scavenge`, `trap`, `bulbs`
- `spawnPoint`, `update(dt,time)`, `moonLight`, `materials` (`{wall,floor,ceil,wood,woodDark,metal,dirt}` shared MeshStandardMaterials), `textures.qTex`, `textures.woodTex`

### `src/player.js` (instance `player`)
- `pos` (FEET Vector3), `vel`, `dead`, `health`, `maxHealth`, `ads`, `grounded`
- `yaw` (Object3D holding camera rig; `yaw.rotation.y` = heading), `camera`
- `eyePosition() → Vector3`, `eyeDirection() → Vector3`, `takeDamage(d)`
- `perks: Set<'tonic'|'rapid'|'fleet'|'deadeye'>`, `jetpack: bool`, `jetFuel: 0..100`

### `src/effects.js` (instance `effects`)
- `blood(pos,dir,count,speed,floor)`, `gib(pos,floor)`, `sparks(pos)`, `smoke(pos,n)`, `bloodDecal(x,z,y,scale)`, `damageNumber(worldPos,amount,crit)`, `explosion(at,colorHex,radius)`.

### `src/audio.js` (`audio` singleton)
- Named one-shots (extend if the digest names one that's missing): `shoot(kind) dryFire reload hit headshot kill zombieGroan(dist) zombieBite attackSnarl(vol) boardRip boardAdd vaultThud buy deny doorOpen perkJingle boxJingle teddy roundStart roundEnd papHum papDing zap craftTick pickup equip heal playerHurt explosion jet footstep jump land slowmo(on) waveHorn`.

### ZombieManager (`src/zombies.js`, instance `zombies`)
- `zombies: Zombie[]` — each `{pos, dead, alive, state, takeDamage(dmg, part, hitPoint, dir) → {killed,head}|null}`
- `zoneDamage(zone, dps, dt)`, `blastDamage(center,radius,dmg,onHit)`.

## Conventions
- Register solid geometry by pushing collider objects into BOTH `world.colliders` and `world.shotSolids` (movement-only: colliders only). Anything with a collider top is standable automatically.
- To remove a solid: splice it out of both arrays.
- Keep materials/geometries disposed when you remove meshes permanently.
- `main.js` wires everything; expose a small clean API and DO NOT reach into modules you don't need.
- Player camera: while a module "owns" the camera (driving), main skips player view control — signal via a boolean like `carSys.driving`.
