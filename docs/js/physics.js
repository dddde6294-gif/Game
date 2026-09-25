// Shared jump physics. Used by the game and by tools/make-levels.mjs, so the
// level list always matches how jumps really play.

export const STEP = 1 / 120;       // fixed physics step: every jump plays out the same way
export const HIP_HEIGHT = 0.95;    // the player model's hips sit this far above its feet
export const MAT_TOP = 0.35;       // height of the landing mat surface
export const START_X = -0.45;      // standing spot on the tower (the edge is at x = 0)
export const RUN_SPEED = 2.6;      // forward speed while in the air
export const LAND_SPEED = 22;      // top fall speed near the ground
export const BRAKE_ZONE = 60;      // meters above the mat where super fast falls slow down
export const SPIN_TIME = 0.72;     // seconds per basic backflip while holding

export function levelPhysics(level) {
  return {
    gravity: level.gravity ?? 14,
    jump: level.jump ?? 7,
    terminal: level.terminal ?? LAND_SPEED,
    vx: RUN_SPEED,
  };
}

// Advances a body { x, y, vy } (y = hip height) by one step. Returns true on landing.
export function fallStep(b, phys) {
  b.vy = Math.max(b.vy - phys.gravity * STEP, -phys.terminal);
  if (phys.terminal > LAND_SPEED) {
    // air brakes: really fast falls slow down near the mat so the landing can be timed
    const h = b.y - HIP_HEIGHT - MAT_TOP;
    const cap = LAND_SPEED + (phys.terminal - LAND_SPEED) * Math.min(1, Math.max(0, h / BRAKE_ZONE));
    if (b.vy < -cap) b.vy = -cap;
  }
  b.x += phys.vx * STEP;
  b.y += b.vy * STEP;
  return b.y - HIP_HEIGHT <= MAT_TOP && b.vy < 0;
}

// Plays a whole jump from the top of a tower. Returns air time and landing spot.
export function simulate(phys, towerTop, onStep) {
  const b = { x: START_X, y: towerTop + HIP_HEIGHT, vy: phys.jump };
  let t = 0;
  let landed = false;
  while (!landed && t < 120) {
    landed = fallStep(b, phys);
    t += STEP;
    if (onStep) onStep(t, b.x, b.y);
  }
  return { t, x: b.x };
}
