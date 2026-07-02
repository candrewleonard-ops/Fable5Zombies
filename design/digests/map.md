# map.js — Implementation Digest (Undead Bunker)

Source: `design/undead_bunker/game/js/map.js`. IIFE writing into global `window.G`. Units: meters, y-up. All meshes are THREE r128 primitives with canvas textures.

**Dependencies on other prototype files:** `G.scene` (game.js), `G.audio.boardRip/boardAdd` (audio.js), `G.WEAPONS[key].name/.cost` (weapons.js), `G.player.pos` (player.js, used by `G.volAt`).

## G.* contract surface (defined here)

| Name | Type | Notes |
|---|---|---|
| `G.solids` | array of AABBs `{minX,maxX,minY,maxY,minZ,maxZ}` | collision + shot occlusion |
| `G.walkables` | array `{minX,maxX,minZ,maxZ,y}` | ground surfaces (y = top) |
| `G.windows` | array of window objects (see Windows) | |
| `G.doors` | array `{group,solid,cost,name,unlockRoom,open:false,pos:v3(x,1.2,z),anim:0}` | |
| `G.perkMachines` | array `{group,key,name,color,cost,pos,light}` | |
| `G.wallbuys` | array `{mesh,key,pos}` | |
| `G.flyingBoards` | array `{mesh,vel,rot,t,win}` | populated by `G.ripBoard` |
| `G.scavenge` | array `{pos,mat,cd:0,group}` | |
| `G.rooms` | `ROOMS` table | `unlocked` flags mutated by door buys |
| `G.roomAt(pos)` | fn → room key | |
| `G.pathChain(from,to)` | fn → waypoint Vector3[] or null | BFS over unlocked rooms |
| `G.moveWithCollision(pos,dx,dz,radius)` | fn | axis-separated AABB slide |
| `G.groundAt(x,z,feet=Infinity)` | fn → y | highest walkable under feet |
| `G.volAt(pos)` | fn → 0..1 | `1/(1+d*0.22)`, d = XZ dist to player (20 if no player) |
| `G.ripBoard(win,board)` / `G.addBoard(win)` | fns | barricade board remove/repair |
| `G.buildPerkModel(name,color)` / `G.buildMysteryBoxModel(open)` | fns → Group | asset-library display models |
| `G.buildMap()` | fn | builds everything below |
| `G.bulbs` | array `{light,mesh,base,seed}` | flicker driven elsewhere |
| `G.boxPads`, `G.mysteryBox`, `G.moveMysteryBox(i)` | mystery box system | |
| `G.Trap` | electro-trap data | |
| `G.spawnPoint` | `v3(0,0,4)` | |

## Texture generators (`makeTex(w,h,draw,rx=1,ry=1)`)

`makeTex`: canvas → `CanvasTexture`, `RepeatWrapping` both axes, `repeat.set(rx,ry)`, `sRGBEncoding`.
`noiseOn(ctx,w,h,n,alpha,dark)`: n rects of size 1–4px at random pos, fill `rgba(0|255 ×3, alpha*random())` (dark→0, light→255).

| Tex | Size | Repeat | Recipe |
|---|---|---|---|
| concrete | 256×256 | 2,1.5 | fill `#5d5a54`; noiseOn(900,0.08,dark); noiseOn(500,0.05,light); 5 cracks: stroke `rgba(30,28,25,.35)` lw1, random start, 4 segments of dx=(rand−.5)*60, dy=rand*40 |
| floor | 256×256 | 6,6 | fill `#46433e`; noiseOn(1200,0.1,dark); noiseOn(300,0.04,light); 8 stain ellipses `rgba(20,16,12,.18)` r=(10–50, 8–38) random rot; border strokeRect `rgba(0,0,0,.25)` |
| wood | 256×128 | 1,1 | fill `#6b4a2a`; grain: every 4px in y, bezier stroke `rgba(40,22,8, 0.1+rand*0.2)` with ±3px wobble; noiseOn(300,0.08,dark) |
| sky dome | 1024×512 | — | vertical gradient `#0a1220`→(0.55)`#060a12`→`#03040a`; 260 star px `rgba(255,255,255, rand*0.7)` in top 60%; moon at (0.72w, 0.26h): radial glow r8→90 `rgba(210,225,255,.9)`→`rgba(180,200,240,.35)`@0.2→0; disc `#dfe8f5` r22; crater `rgba(160,175,200,.5)` r6 at (mx−7,my+4) |
| perk label | 128×256 | — | bg `#0d0d10`; color panel rect(8,8,w−16,h−16) = perk color; dark band `rgba(0,0,0,.45)` rect(14,60,w−28,130); text `#f5eeda` bold 26px Georgia centered, words stacked at y=105+i*34; `♦` 44px Georgia at y46 |
| chalk wall-buy | 256×128 | — | dashed border `rgba(235,230,215,.85)` lw3 dash[9,6] rect(6,6,w−12,h−12); gun doodle strokes lw4 `rgba(235,230,215,.9)`: (40,58)→(150,58)→(210,52); (70,58)→(70,74)→(92,74); (120,58)→(116,80); text `rgba(235,230,215,.92)` 20px Georgia: `WPN.NAME.toUpperCase()` at y32, `COST <wpn.cost>` at y108 |
| '?' marks | 256×128 | — | transparent; `#eaf4ff` bold 96px Georgia, '?' at (0.3w,0.55h) and (0.7w,0.55h), baseline middle |

## Materials (`MAT`)

| Key | Def |
|---|---|
| wall | MeshStandard, map=concreteTex, roughness 0.95 |
| floor | MeshStandard, map=floorTex, roughness 0.9 |
| ceil | color `0x3a3733`, roughness 0.95 |
| wood | map=woodTex, roughness 0.85 |
| woodDark | color `0x3e2c18`, roughness 0.9 |
| metal | color `0x2e2f33`, metalness 0.7, roughness 0.5 |
| dirt | color `0x2a2620`, roughness 1 |

## Geometry helpers

- `solid(minX,maxX,minY,maxY,minZ,maxZ)` → pushes AABB to `G.solids`, returns it.
- `boxMesh(w,h,d,mat,x,y,z,opts)`: BoxGeometry at (x,y,z); `opts.ry` rotation.y; castShadow unless `cast:false`; receiveShadow always. Adds solid unless `solid:false` **or `ry` set** (rotated boxes never collide). `walkTop:true` pushes `{x±w/2, z±d/2, y: y+h/2}` to walkables.
- Wall thickness `TH = 0.35`.
- `wall(axis,fixed,a0,a1,y0,h,openings)`: openings `{c,w,b,t}` (center along axis, width, bottom Y abs, top Y abs), sorted by c; emits solid wall segments (skips segments < 0.01); axis `'x'` = wall running along X at z=fixed, `'z'` = along Z at x=fixed. Segment mesh: `boxMesh(len, yt−yb, TH, MAT.wall, mid, (yb+yt)/2, fixed)` (or swapped for 'z').
- `openingBlocker(axis,fixed,c,w,b,t)`: thin solid across an opening — depth `fixed±0.15`, span `c±w/2`, y `b..t`. Used for windows and boarded fence gaps (keeps zombies/players from walking through until vault/never).

## Windows (`addWindow(axis, fixed, c, sillY, room, normalSign)`)

Constants: width `w=1.7`, bottom `b=sillY`, top `t=sillY+1.3`. Adds openingBlocker (permanent).
Key points (n = normalSign, outward):
- axis 'x': `outer=(c, 0, fixed+n*0.7)`, `inner=(c, floorY, fixed−n*1.2)`, `spawn=(c+(rand−.5)*2, 0, fixed+n*(6+rand*3))`, frameRot 0.
- axis 'z': same with x/z swapped, frameRot `π/2`.
- `floorY = (b−0.9 < 1) ? 0 : 3.2` (upper windows land on mezzanine); outer.y=0, spawn.y=0.

Visuals (Group at (c/fixed), rot.y=frameRot): frame Box(w+0.15, 1.45, 0.1) woodDark at y=(b+t)/2; black hole Box(w−0.1, 1.28, 0.06) MeshBasic `0x05070c` same y; **6 boards** Box(w+0.35, 0.19, 0.05) MAT.wood at `x=(rand−.5)*0.12`, `y=b+0.18+i*0.2`, `z = i%2 ? 0.09 : 0.13`, `rot.z=(rand−.5)*0.22`.

Window object: `{group, boards[{mesh,on,home,rot}], outer, inner, spawn, floorY, room, axis, fixed, c, sill:b}`.

`G.ripBoard(win,board)`: `board.on=false`; `G.audio.boardRip()`; push flying board `vel = v3((rand−.5)*2, 2+rand*2, (rand−.5)*2) + normalize(group.pos − inner) * (−2.5)`, `rot = v3(rand*6 ×3)`, `t:0`.
`G.addBoard(win)`: first `!on` board → on, reparent to group, restore home/rot/scale 1, remove from flyingBoards, `G.audio.boardAdd()`, returns true (false if all on).

### Free-standing barricades (`addBarricadeFrame(x,z,nx,nz,room,boardless)`)
Campsite fence gaps. `ry = |nx|>0.5 ? π/2 : 0`; `w=1.7, b=0.15, t=2.2`. Posts Box(0.22,2.5,0.22) woodDark at x=±(w/2+0.15), y=1.25; top beam Box(w+0.7,0.22,0.26) at y=2.42. If not boardless: `openingBlocker(axis, fixed, c, 0.2, 2.2)` **(NB: only 5 args — w=0.2? actually c-slot: blocker width param w=0.2? call is `(axis, fixed, c, 0.2, 2.2)` so w=0.2, b=2.2, t=undefined→NaN top; replicate verbatim or treat as prototype quirk)** and 6 boards Box(w+0.35,0.19,0.05) at y=0.35+i*0.32 (z offset/rot same pattern as windows). `outer=(x+nx*0.8, 0, z+nz*0.8)`, `inner=(x−nx*1.3, 0, z−nz*1.3)`, `spawn=(x,z) + n*(6+rand*3) ± (rand−.5)*2` perpendicular. floorY 0, sill 0.

## Rooms & pathing

```js
ROOMS = {
  MAIN:    { rects:[{x0:-14,x1:14, z0:-10,z1:10}], lo:true, unlocked:true },
  ARMORY:  { rects:[{x0:-26,x1:-14,z0:-2, z1:10}], lo:true, unlocked:false },
  STORAGE: { rects:[{x0:5.2,x1:14, z0:10, z1:18}], lo:true, unlocked:false },
  CAMP:    { rects:[{x0:-34,x1:0,  z0:10, z1:34}], lo:true, unlocked:false },
  UPPER:   { rects:[{x0:-14,x1:6.8,z0:0,  z1:10}], hi:true, unlocked:false },
}
PORTALS = [
  { a:'MAIN',   b:'ARMORY',  pts:[v3(-14,0,4)] },
  { a:'MAIN',   b:'STORAGE', pts:[v3(9.5,0,10)] },
  { a:'MAIN',   b:'UPPER',   pts:[v3(-9.5,0,9.05), v3(-12.9,3.2,9.05), v3(-12.3,3.2,7.3)] },  // stair chain
  { a:'ARMORY', b:'CAMP',    pts:[v3(-20,0,10)] },
]
STAIR_ZONE = { x0:-13.6, x1:-9.3, z0:8.2, z1:10 }
```
- `G.roomAt(pos)`: inside STAIR_ZONE → `pos.y > 1.6 ? 'UPPER' : 'MAIN'`. Else `hi = pos.y > 1.8`; skip room if `r.hi && !hi` or `r.lo && hi`; first rect containing (x,z) wins; fallback `'MAIN'`.
- `G.pathChain(from,to)`: null if same. BFS over PORTALS restricted to `ROOMS[nb].unlocked`. Returns **only the first portal's pts** (cloned), reversed if traversing b→a. Null if unreachable.

## Collision & ground

```js
G.moveWithCollision(pos,dx,dz,radius):
  feet = pos.y
  hits(x,z): for s of G.solids:
    if (s.maxY - feet < 0.5 || s.minY > feet + 1.6) continue   // step-up 0.5, head 1.6
    if (x+radius > s.minX && x-radius < s.maxX && z+radius > s.minZ && z-radius < s.maxZ) return true
  if (!hits(pos.x+dx, pos.z)) pos.x += dx     // per-axis slide
  if (!hits(pos.x, pos.z+dz)) pos.z += dz

G.groundAt(x,z,feet=Infinity):
  best = 0; for w of G.walkables:
    if (x,z inside w && w.y <= feet + 0.55 && w.y > best) best = w.y
  return best
```

## Display models (asset library)

- `G.buildPerkModel(name,color)`: body Box(0.8,1.75,0.55) MeshStandard `0x1c1d21` metal 0.5/rough 0.5 at y 0.875; label face Plane(0.72,1.6) with perk-label tex as map+emissiveMap, emissive `0xffffff`, intensity 0.55, rough 0.6, at (0, 0.9, 0.283). (Same build as in-world machines minus light/solid.)
- `G.buildMysteryBoxModel(open)`: crate Box(1.9,0.62,0.62) wood y0.45; gold trim Box(1.94,0.08,0.66) color `0xc7a24a` metal 0.8 rough 0.35 emissive `0x66500f`@0.5 y0.72; legs Box(1.72,0.16,0.5) woodDark y0.08; lid Group at (0,0.76,−0.31) with slab Box(1.9,0.07,0.62) woodDark at (0,0.035,0.31); '?' planes 1.6×0.52 MeshBasic map=qTex, transparent, opacity 0.85, AdditiveBlending, depthWrite false, color `0x86c8ff` at z ±0.315, y 0.45 (back rotated π). If open: `lid.rotation.x = −1.9` + glow Plane(1.7,0.52) `0x86c8ff` opacity 0.5 additive, rot.x −π/2, y 0.78.

## G.buildMap()

### Atmosphere / lighting
- Fog: `new Fog(0x05070c, 16, 62)`.
- Sky: Sphere(r140, 24×16 seg), MeshBasic map=sky tex, BackSide, fog:false.
- HemisphereLight(`0x223044`, `0x0a0806`, 0.5).
- Moon: DirectionalLight `0x9db4dd` 0.5 at (40,50,−60), castShadow, shadow map 2048², ortho cam ±42, near 5, far 200.

### Ground / floors / ceilings
- Ground: Plane 280×280 MAT.dirt, rot.x −π/2, y −0.02; walkable `{−140..140, −140..140, y:0}`.
- `floor(x0,x1,z0,z1,y)`: Box((x1−x0), 0.25, (z1−z0)) MAT.floor centered at y−0.125; walkable at y; if y>0 also solid (y−0.25..y).
  - `floor(-14,14,-10,10, 0.02)` MAIN · `floor(-26,-14,-2,10, 0.02)` ARMORY · `floor(5.2,14,10,18, 0.02)` STORAGE
  - Mezzanine: `floor(-14,6.8,0,8.2, 3.2)` + `floor(-9.7,6.8,8.2,10, 3.2)` (stair opening = x −14..−9.7, z 8.2..10)
- `ceil(x0,x1,z0,z1,y)`: Box 0.25 thick MAT.ceil at y+0.125, no solid: `(-14,14,-10,10, 6.4)`, `(-26,-14,-2,10, 3.2)`, `(5.2,14,10,18, 3.2)`.

### Walls — `wall(axis, fixed, a0, a1, y0, h, openings[])`
| # | Call | Purpose |
|---|---|---|
| 1 | `wall('x', -10, -14, 14, 0, 6.4, [{c:-8,w:1.7,b:0.9,t:2.2},{c:0,w:1.7,b:0.9,t:2.2}])` | MAIN north, 2 windows |
| 2 | `wall('z', 14, -10, 10, 0, 6.4, [{c:-4,w:1.7,b:0.9,t:2.2}])` | MAIN east, window |
| 3 | `wall('z', -14, -10, -2, 0, 6.4, [{c:-6,w:1.7,b:0.9,t:2.2}])` | MAIN west (north part), window |
| 4 | `wall('z', -14, -2, 10, 0, 3.2, [{c:4,w:1.5,b:0,t:2.5}])` | MAIN/ARMORY shared + door opening |
| 5 | `wall('z', -14, -2, 10, 3.2, 3.2, [])` | mezz west face (upper) |
| 6 | `wall('x', 10, -14, 5.2, 0, 3.2, [])` | main south ground |
| 7 | `wall('x', 10, 5.2, 14, 0, 3.2, [{c:9.5,w:1.5,b:0,t:2.5}])` | storage shared + door |
| 8 | `wall('x', 10, -14, 6.8, 3.2, 3.2, [{c:-8,w:1.7,b:4.1,t:5.4},{c:-1,w:1.7,b:4.1,t:5.4},{c:4,w:1.7,b:4.1,t:5.4}])` | upper south + 3 windows (sill 4.1) |
| 9 | `wall('x', 10, 6.8, 14, 3.2, 3.2, [])` | upper south (east of mezz) |
| 10 | `wall('z', 6.8, 0, 10, 3.2, 3.2, [])` | mezz east wall |
| 11 | `wall('z', -26, -2, 10, 0, 3.2, [{c:4,w:1.7,b:0.9,t:2.2}])` | armory west, window |
| 12 | `wall('x', -2, -26, -14, 0, 3.2, [{c:-20,w:1.7,b:0.9,t:2.2}])` | armory north, window |
| 13 | `wall('x', 10, -26, -14, 0, 3.2, [{c:-20,w:1.5,b:0,t:2.5}])` | armory south + campsite door |
| 14 | `wall('z', 14, 10, 18, 0, 3.2, [{c:14,w:1.7,b:0.9,t:2.2}])` | storage east, window |
| 15 | `wall('x', 18, 5.2, 14, 0, 3.2, [{c:9,w:1.7,b:0.9,t:2.2}])` | storage south, window |
| 16 | `wall('z', 5.2, 10, 18, 0, 3.2, [])` | storage west |

### Stairs (MAIN → mezzanine) + stringer
10 steps, run 0.33 in −x, rise 0.32, tread depth (x) 0.34, width (z) 1.5, at z=9.05:
```js
for (i=0..9): sx = -9.9 - i*0.33
  boxMesh(0.34, 0.32*(i+1), 1.5, MAT.wall, sx, 0.32*(i+1)/2, 9.05, {walkTop:true})
```
Top step: x≈−12.87, top y=3.2 (meets mezzanine). Side stringer: `boxMesh(3.9, 3.2, 0.14, MAT.wood, -11.6, 1.6, 8.22)` (solid).

### Columns / mezz beam / railings
- Columns (solid): Box(0.7,6.4,0.7) wall @ (5,3.2,−3) and (−5,3.2,−3); Box(0.5,3.2,0.5) wall @ (−8,1.6,0) and (2,1.6,0).
- Mezz edge beam: Box(21,0.3,0.35) woodDark @ (−3.5,3.05,0.05) `{solid:false}`.
- Rail top: Box(20.9,0.09,0.09) woodDark @ (−3.55,3.98,0.04) `{solid:false,cast:false}`; balusters Box(0.07,0.78,0.07) at x = −13.5 to 6.6 step 2.5, y 3.6, z 0.04 (non-solid) — rail is droppable (no collision).
- Stair-opening rails: Box(0.09,0.09,1.85) @ (−9.7,3.98,9.1); Box(4.3,0.09,0.09) @ (−11.85,3.98,8.22), both non-solid non-cast.

### Interior props (boxMesh; solid unless noted)
| Mesh | Pos | Notes |
|---|---|---|
| Box(1.1,1.0,1.1) wood | (12, 0.5, −8) | crate MAIN |
| Box(0.9,0.9,0.9) wood | (11, 0.45, −8.7) | crate |
| Box(0.9,0.75,0.9) wood | (11.5, 1.28, −8.3) | stacked, `solid:false` |
| Box(2.2,0.55,0.9) dirt | (0.5, 0.275, −2.2) | sandbag, `walkTop` |
| Box(1.6,0.5,0.8) dirt | (0.5, 0.8, −2.25) | sandbag tier 2, `walkTop` |
| Box(2.0,0.55,0.9) dirt | (3.1, 0.275, −2.2) | sandbag, `walkTop` |
| Cylinder(r0.42,h1.05,14) metal | (13,8), (−12.5,−9.2), (−25.2,−1.1), (13.2,11) | barrels; manual solid x±0.42, y 0..1.05, z±0.42 |
| Box(1.0,0.95,1.0) wood | (−24.5, 0.475, 8.6) | armory crate |
| Box(0.9,0.85,0.9) wood | (−15.6, 0.43, −1.2) | armory crate |
| Box(1.0,0.95,1.0) wood ×2 | (6.2, 0.475, 17.1) and (6.2, 0.475, 16.0) | storage crates |
| Box(0.9,0.8,0.9) wood | (6.25, 1.35, 16.6) | stacked, `solid:false` |
| Box(1.0,0.95,1.0) wood | (5.8, 3.675, 1.4) | mezz crate (y = 3.2+0.475) |
| Box(2.0,0.5,0.9) dirt | (0, 3.45, 8.8) | mezz sandbag, `walkTop` |
| Box(0.9,0.85,0.9) wood | (−12.2, 3.63, 6.4) | mezz crate |
| Box(0.3,0.3,19.6) woodDark | x = −12..12 step 4, y 6.15, z 0 | 7 ceiling beams, `solid:false,cast:false` |

### Hanging bulbs (`bulb(x,y,z,shadow,wireLen=0.5)`)
Wire Cylinder(r0.012, wireLen) metal above; bulb Sphere(0.07) color `0xffd9a0` emissive `0xffc070`@2.2; PointLight `0xffb35c` intensity 0.95, dist 12, decay 1.6 at y−0.05; shadow map 512² if `shadow`. Pushed to `G.bulbs` `{light,mesh,base:0.95,seed:rand*10}`.
Calls: `(0,4.6,−5,true,1.75)`, `(−8,4.6,−3,false,1.75)`, `(9.5,4.4,4.5,false,1.95)`, `(−5,2.72,5.5)`, `(2,2.72,2.5)`, `(−20,2.72,4)`, `(9.5,2.72,14)`, `(−4,5.75,6,true,0.6)`.

### Doors (`mkDoor(x,z,ry,cost,name,unlockRoom)`)
Visual: 6 planks Box(0.24,2.45,0.09) wood at x=−0.62+i*0.25, y 1.22, z=(i%2)*0.05, rot.z ±0.03; cross beam Box(1.55,0.2,0.06) woodDark at (0,1.5,0.1) rot.z 0.25.
Solid: ry==0 → `solid(x−0.8, x+0.8, 0, 2.5, z−0.18, z+0.18)`; else `solid(x−0.18, x+0.18, 0, 2.5, z−0.8, z+0.8)`.
Object: `{group, solid, cost, name, unlockRoom, open:false, pos:v3(x,1.2,z), anim:0}`.

| Door | Pos | ry | Cost | Unlocks |
|---|---|---|---|---|
| Armory | (−14, 4) | π/2 | 750 | ARMORY |
| Storage Room | (9.5, 10) | 0 | 1000 | STORAGE |
| Upper Quarters | (−9.45, 9.05) | π/2 | 1250 | UPPER (stair debris) |
| Campsite | (−20, 10) | 0 | 1500 | CAMP |

### Windows (11 bunker + 4 campsite frames)
`addWindow(axis, fixed, c, sill, room, n)`:
| axis | fixed | c | sill | room | n |
|---|---|---|---|---|---|
| x | −10 | −8 | 0.9 | MAIN | −1 |
| x | −10 | 0 | 0.9 | MAIN | −1 |
| z | 14 | −4 | 0.9 | MAIN | +1 |
| z | −14 | −6 | 0.9 | MAIN | −1 |
| z | −26 | 4 | 0.9 | ARMORY | −1 |
| x | −2 | −20 | 0.9 | ARMORY | −1 |
| z | 14 | 14 | 0.9 | STORAGE | +1 |
| x | 18 | 9 | 0.9 | STORAGE | +1 |
| x | 10 | −8 | 4.1 | UPPER | +1 |
| x | 10 | −1 | 4.1 | UPPER | +1 |
| x | 10 | 4 | 4.1 | UPPER | +1 |

Campsite `addBarricadeFrame(x,z,nx,nz,'CAMP',boardless)`: `(−34,22,−1,0)`, `(−17,34,0,1)`, `(0,26,1,0)`, `(0,18.2,1,0,true)` — last is the open gate (no boards, trap-defended).

### Perk machines (`mkPerk(x,z,ry,key,name,color,cost,y=0)`)
Body/label/face identical to `buildPerkModel`; plus PointLight(color, 0.8, 5, 1.8) at (0,1.4,0.6) local; solid `x±0.45, y..y+1.75, z±0.32`.
| key | name | pos (x,z,y) | ry | color | cost |
|---|---|---|---|---|---|
| tonic | TOUGH TONIC | (13.45, −9.2, 0) | −π/2 | `#9e1b1b` | 2500 |
| rapid | RAPID ROUNDS | (−25.35, 9.2, 0) | π/2 | `#b08414` | 3000 |
| fleet | FLEET FOOT | (−13.35, 2, 3.2) | π/2 | `#1c5d8a` | 2000 |
| deadeye | DEADEYE | (13.45, 17.2, 0) | −π/2 | `#5b2a7a` | 2500 |

### Wall-buys (`mkWallbuy(x,y,z,ry,key)`)
Plane 1.5×0.75, MeshBasic chalk tex, transparent, opacity 0.92. Reads `G.WEAPONS[key]`.
| key | pos | ry |
|---|---|---|
| kar98 | (4, 1.7, −9.79) | 0 |
| trench | (10.5, 1.7, 17.79) | π |
| smg | (6.61, 4.9, 5) | −π/2 (mezz east wall) |

### Mystery box
Pads (wooden pallets Box(2.2,0.1,1.0) woodDark at y0.05, rot.y=p.ry, at each pad):
```js
G.boxPads = [ {x:-24.9, z:0.8, ry:π/2}, {x:-16, z:19.5, ry:0}, {x:8.5, z:-8.6, ry:0} ]
```
Box build = `buildMysteryBoxModel` geometry ('?' opacity **0.7** here) plus:
- beam: Cylinder(rT 0.16, rB 0.34, h 3.2, 12 seg, openEnded) `0x86c8ff` opacity **0.0** additive DoubleSide, y 2.2 (lid-open effect, animated elsewhere).
- skyBeam: Cylinder(0.35, 1.3, 60, 10, open) `0x86c8ff` opacity 0.045 additive fog:false, y 30.
- skyCore: Cylinder(0.1, 0.45, 60, 8, open) `0xbfe2ff` opacity 0.08 additive fog:false, y 30.
- holder Group at y 1.15 (weapon display); boxLight PointLight `0x86c8ff` intensity 0, dist 6, decay 1.6 at (0,1.4,0).
- Teddy bear (hidden, y 0.5): fur `#6b4728`, dark fur `#4e3018` rough 0.95; boxes: body(0.36,0.42,0.28)@(0,0.21,0), belly(0.2,0.24,0.06)furD@(0,0.18,0.13), head(0.3,0.28,0.26)@(0,0.56,0), ears(0.1,0.11,0.07)furD@(±0.12,0.73,0), muzzle(0.09,0.06,0.07)furD@(0,0.52,0.14), eyes(0.035,0.05,0.03)`#0a0a0a`@(±0.07,0.6,0.135), arms(0.1,0.3,0.11)@(±0.23,0.24,0.03), legs(0.12,0.14,0.3)@(±0.12,0.07,0.12).

```js
G.mysteryBox = { group, lid, beam, holder, light, qMats:[qMatF,qMatB], teddy,
                 solid: mbSolid /* starts (0,0,0,0,0,0) */, padIndex:0, pos:v3(0,0,0),
                 state:'idle', t:0, cost:950, weapon:null, displayModel:null }
G.moveMysteryBox(i):  // sets padIndex, group pos/rot, mbx.pos; resizes solid:
  alongZ = |sin(ry)| > 0.5;  hw = alongZ ? 0.36 : 1.0;  hd = alongZ ? 1.0 : 0.36
  solid = { x±hw, y 0..0.85, z±hd }
G.moveMysteryBox(0)  // initial pad = armory
```

### Campsite (x −34..0, z 10..34)
**Palisade** `palisade(x,z,len,alongX)`: solid rail Box(len,2.3,0.24) (or 0.24×len) MAT.wood at y1.15 + decorative posts Cylinder(0.09→0.11, h2.55, 7 seg) woodDark every `len/floor(len/1.6)` at y1.27 (non-solid).
Calls: west `(−34,15.5,11,false)`, `(−34,28.5,11,false)` (gap @ z=22) · south `(−26,34,16,true)`, `(−8,34,16,true)` (gap @ x=−17) · east `(0,13.5,7,false)`, `(0,22.25,5.7,false)`, `(0,30.45,7.1,false)` (gaps @ z≈18.2 trap gate and z≈26) · north stub `(−30,10,8,true)`.

**Campfire** at (−17,0,22): 9 stones Box(0.28,0.2,0.22) MAT.wall on r=0.75 circle y0.1 rot.y=angle; 3 logs Cylinder(0.09,0.09,1.0,7) woodDark rot.z=π/2−0.5, rot.y=i*2.1, y0.22; flame Cone(0.32,0.85,8) color `0x3a1404` emissive `0xff7a1a`@2.4 opacity 0.9 y0.6; flame2 Cone(0.18,0.55,7) color `0x401800` emissive `0xffc040`@2.8 @(0.12,0.5,0.08); PointLight `0xff8a30` 1.6, dist 14, decay 1.5 at (−17,1.1,22), pushed to G.bulbs (base 1.6, seed 3.3); solid `(−17.8..−16.2, 0..0.5, 21.2..22.8)`; log bench Box(1.6,0.4,0.45) woodDark @(−17,0.2,24.2) `walkTop`; second bench @(−19.4,0.2,21.2) `ry:0.9, solid:false`.

**Tents** `tent(x,z,ry)`: canvas mat color `0x50493a` rough 0.95; panels Box(2.6,0.08,2.2) at x∓0.78, y1.05, rot.z ±1.02; back Box(2.2,1.9,0.06) @(0,0.8,−1.06); solid `x±1.3, 0..1.9, z±1.15` (axis-aligned regardless of ry). Calls: `tent(−28,15.5,0.35)`, `tent(−30,25,−0.5)`.

**Watchtower** at (−8,·,30): 4 legs Box(0.22,2.7,0.22) woodDark at (−8±1.3, 1.35, 30±1.3) (non-solid, scene-added directly); platform `boxMesh(3.2,0.18,3.2, wood, −8,2.7,30, {walkTop:true})` (solid; top y=2.79); rails non-solid non-cast: Box(3.2,0.1,0.1)@(−8,3.75,28.45), @(−8,3.75,31.55), Box(0.1,0.1,3.2)@(−9.55,3.75,30). **Steps**: 8, `h=0.35*(i+1)`, `boxMesh(0.38, h, 1.2, wood, −4.6−i*0.36, h/2, 30, {walkTop:true})` — run 0.36 in −x, rise 0.35, width 1.2, top step x≈−7.12 top y=2.8.

**Lanterns** `lantern(x,z)`: pole Box(0.14,2.4,0.14) woodDark (solid); globe Sphere(0.09) `0xffd9a0`/emissive `0xffc070`@2 at (x,2.28,z+0.22); PointLight `0xffb35c` 0.85, dist 10, decay 1.6 at (x,2.2,z+0.22); → G.bulbs (base 0.85). Calls: `(−10,24)`, `(−26,20)`.

**Camp crates/rocks**: Box(1.0,0.95,1.0) wood @(−6,0.48,28.2); Box(0.85,0.8,0.85) wood @(−6.6,0.4,27.1). `rock(x,z,s)`: Sphere(s,7,5) MAT.wall, y=s*0.5, scale.y 0.7, non-solid: `(−31.5,12,0.55)`, `(−2.5,31.5,0.75)`, `(−22,32.5,0.5)`.

### Scavenge nodes (`scavNode(x,z,mat)`)
wood: 3 logs Cylinder(0.14,0.14,1.5,8) MAT.wood rot.z π/2 at y 0.15/0.15/0.42, z −0.17/0.17/0. coal: sack Box(0.8,0.5,0.8) `#1a1a1c` y0.25 + 5 lumps Sphere(0.09,5,4) `#0c0c0e` rough 0.6 metal 0.3 at y0.53 scattered ±0.25. Solid `x±0.5, 0..0.55, z±0.5`. Entry `{pos:v3(x,0,z), mat, cd:0, group}`.
Calls: `(12.6,4.2,'wood')` MAIN · `(−16,6.8,'coal')` ARMORY · `(−13,29.5,'wood')` CAMP · `(−4,13,'coal')` CAMP.

### Electro-trap (open camp gate)
Posts at x=0: `trapPost(z)` → pole Cylinder(0.09→0.12, 2.5, 8) color `0x2e2f33` metal 0.8 rough 0.4 at y1.25; tip Sphere(0.09) color `0x0a2030` emissive `0x66d4ff`@1.2 at y2.55; returns tip. Posts at z=16.9 and z=19.5. Switch box: `boxMesh(0.34,0.5,0.2, MAT.metal, 0,1.3,16.3, {solid:false})`.
```js
G.Trap = { tips:[tipA,tipB], switchPos:v3(0,1.2,16.3), state:'ready', t:0, cost:1000,
           posA:v3(0,0.2,17.0), posB:v3(0,0.2,19.4),
           zone:{ x0:-0.9, x1:0.9, z0:16.8, z1:19.6 } }
```
(Timing/damage — 25s active, 40s cooldown, ~375 dmg/s zombies, 8 dmg/0.5s player — lives in game.js per README.)

### Exterior dressing (all non-solid)
Trees `tree(x,z,s)`: mat color `0x17130e` rough 1; trunk Cylinder(0.14s→0.26s, 4.4s, 7) y 2.2s; 4 branches Cylinder(0.03s→0.09s, 1.9s, 5) at radius 0.5s, y 2.4s+i*0.5s, rot.z 0.7+rand*0.7, rot.y i*1.9.
Positions: (−10,−20,1.1) (14,−18,0.9) (24,−6,1.2) (28,10,1) (18,24,1.15) (−6,26,0.85) (−22,20,0.95) (−33,2,1.1) (−31,−12,0.9) (6,−27,1.05).
Broken fence: 20 posts Box(0.12,1.1,0.12) woodDark at x=−30+i*3.1, z=−23+sin(i*2.7)*0.5, y0.55, rot.z ±0.1; rail Box(62,0.06,0.06) @(0.5,0.85,−23).

### Spawn
`G.spawnPoint = v3(0, 0, 4)` (MAIN hall).
