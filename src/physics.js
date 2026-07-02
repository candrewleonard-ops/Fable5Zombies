// Shared AABB collision for player + zombies.
// Colliders are { minX, minY, minZ, maxX, maxY, maxZ }.
// Entities are capsule-ish cylinders: feet position (Vector3), radius, height.
// Step-up: boxes whose top is within STEP_HEIGHT of the feet don't block —
// the entity is snapped on top of them instead, which is what makes stairs climbable.

export const STEP_HEIGHT = 0.55;
export const GRAVITY = 22;
const EPS = 0.001;

export function aabb(minX, minY, minZ, maxX, maxY, maxZ) {
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function boxCollider(cx, cy, cz, sx, sy, sz) {
  return aabb(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
}

function overlapsXZ(c, x, z, r) {
  return x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ;
}

// Can an entity of `height` standing on `top` at (x, z) fit below all ceilings?
// Only geometry that STARTS above the candidate floor counts as a ceiling —
// columns rising from below (e.g. the next stair step) are the horizontal
// resolver's job, not a headroom problem.
function fitsAt(colliders, x, z, radius, top, height, self) {
  for (const o of colliders) {
    if (o === self) continue;
    if (!overlapsXZ(o, x, z, radius)) continue;
    if (o.minY > top + EPS && o.minY < top + height - EPS) return false;
  }
  return true;
}

// Highest surface the entity can stand on at (x, z) given current feet height.
// Considers box tops at or below feet + STEP_HEIGHT. Ground plane is y = 0.
// When `height` is given, tops without headroom for the entity are rejected so
// we never snap someone up into overhead geometry.
export function groundHeightAt(colliders, x, z, feetY, radius, height = 0) {
  let ground = 0;
  for (const c of colliders) {
    if (!overlapsXZ(c, x, z, radius)) continue;
    if (c.maxY > feetY + STEP_HEIGHT + EPS || c.maxY <= ground) continue;
    if (height > 0 && !fitsAt(colliders, x, z, radius, c.maxY, height, c)) continue;
    ground = c.maxY;
  }
  return ground;
}

// Is a box a wall for this entity (blocks horizontally) rather than a step/floor/ceiling?
// A box low enough to step onto still counts as a wall if the entity wouldn't
// fit on top of it (e.g. a knee-high ledge right under a ceiling).
function isWallFor(colliders, c, x, z, radius, feetY, height) {
  if (c.maxY <= feetY + EPS) return false;            // entirely below the feet
  const aboveHead = c.minY >= feetY + height - EPS;   // fully above us
  if (aboveHead) return false;
  const stepOk = c.maxY <= feetY + STEP_HEIGHT + EPS; // low enough to step onto
  if (!stepOk) return true;
  return !fitsAt(colliders, x, z, radius, c.maxY, height, c);
}

// Move an entity with axis-separated collide & slide + gravity + step-up.
// Mutates pos and vel. Returns { grounded, hitWall, bumpedHead }.
export function moveEntity(colliders, pos, vel, dt, radius, height, bounds) {
  const res = { grounded: false, hitWall: false, bumpedHead: false };

  // --- horizontal, one axis at a time so we slide along walls.
  // Push out through the NEAREST face (minimal penetration), never by velocity
  // sign: a head grazing a wide slab must nudge out locally, not snap the
  // entity to the slab's far edge across the map.
  for (const axis of ['x', 'z']) {
    pos[axis] += vel[axis] * dt;
    for (const c of colliders) {
      if (!overlapsXZ(c, pos.x, pos.z, radius)) continue;
      if (!isWallFor(colliders, c, pos.x, pos.z, radius, pos.y, height)) continue;
      const min = axis === 'x' ? c.minX : c.minZ;
      const max = axis === 'x' ? c.maxX : c.maxZ;
      // one-way colliders (window barricades) always eject toward their
      // declared side — tunneling through them is impossible by construction
      const oneWay = axis === 'x' ? c.pushX : c.pushZ;
      if (oneWay) {
        pos[axis] = oneWay > 0 ? max + radius + EPS : min - radius - EPS;
        res.hitWall = true;
        continue;
      }
      const pushLow = pos[axis] + radius - min;   // distance to exit through min face
      const pushHigh = max - (pos[axis] - radius); // distance to exit through max face
      pos[axis] += pushLow < pushHigh ? -(pushLow + EPS) : pushHigh + EPS;
      res.hitWall = true;
    }
  }

  if (bounds) {
    pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
    pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));
  }

  // --- vertical ---
  vel.y -= GRAVITY * dt;
  pos.y += vel.y * dt;

  // ceiling bump
  if (vel.y > 0) {
    for (const c of colliders) {
      if (!overlapsXZ(c, pos.x, pos.z, radius)) continue;
      if (c.minY >= pos.y + height * 0.5 && pos.y + height > c.minY && pos.y < c.minY) {
        pos.y = c.minY - height;
        vel.y = 0;
        res.bumpedHead = true;
      }
    }
  }

  // floor / step snap (headroom-checked so we never snap into a ceiling)
  const ground = groundHeightAt(colliders, pos.x, pos.z, pos.y, radius, height);
  if (pos.y <= ground + EPS && vel.y <= 0) {
    pos.y = ground;
    vel.y = 0;
    res.grounded = true;
  }

  return res;
}

// Simple ray vs AABB list — used for line-of-sight and bullet world-hits.
// Returns smallest t in (0, maxDist) or Infinity.
export function raycastColliders(colliders, origin, dir, maxDist) {
  let best = Infinity;
  for (const c of colliders) {
    const t = rayBox(origin, dir, c);
    if (t !== null && t > 0 && t < maxDist && t < best) best = t;
  }
  return best;
}

function rayBox(o, d, c) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [['x', c.minX, c.maxX], ['y', c.minY, c.maxY], ['z', c.minZ, c.maxZ]];
  for (const [ax, mn, mx] of axes) {
    const od = o[ax], dd = d[ax];
    if (Math.abs(dd) < 1e-9) {
      if (od < mn || od > mx) return null;
    } else {
      let t1 = (mn - od) / dd, t2 = (mx - od) / dd;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : (tmax > 0 ? tmax : null);
}
