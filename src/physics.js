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

// Highest surface the entity can stand on at (x, z) given current feet height.
// Considers box tops at or below feet + STEP_HEIGHT. Ground plane is y = 0.
export function groundHeightAt(colliders, x, z, feetY, radius) {
  let ground = 0;
  for (const c of colliders) {
    if (!overlapsXZ(c, x, z, radius)) continue;
    if (c.maxY <= feetY + STEP_HEIGHT + EPS && c.maxY > ground) ground = c.maxY;
  }
  return ground;
}

// Is a box a wall for this entity (blocks horizontally) rather than a step/floor/ceiling?
function isWallFor(c, feetY, height) {
  const stepOk = c.maxY <= feetY + STEP_HEIGHT + EPS; // low enough to step onto
  const aboveHead = c.minY >= feetY + height - EPS;   // fully above us
  return !stepOk && !aboveHead;
}

// Move an entity with axis-separated collide & slide + gravity + step-up.
// Mutates pos and vel. Returns { grounded, hitWall, bumpedHead }.
export function moveEntity(colliders, pos, vel, dt, radius, height, bounds) {
  const res = { grounded: false, hitWall: false, bumpedHead: false };

  // --- horizontal, one axis at a time so we slide along walls ---
  for (const axis of ['x', 'z']) {
    pos[axis] += vel[axis] * dt;
    for (const c of colliders) {
      if (!overlapsXZ(c, pos.x, pos.z, radius)) continue;
      if (!isWallFor(c, pos.y, height)) continue;
      if (axis === 'x') {
        pos.x = vel.x > 0 ? c.minX - radius : c.maxX + radius;
      } else {
        pos.z = vel.z > 0 ? c.minZ - radius : c.maxZ + radius;
      }
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

  // floor / step snap
  const ground = groundHeightAt(colliders, pos.x, pos.z, pos.y, radius);
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
