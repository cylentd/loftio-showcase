// Pure maths for how a resident sits on the ground: how strong its contact shadow is, and where the moon throws it.

/** The contact shadow as a function of height above the floor: near is 1 on the ground and 0 at look.shadowReach. */
export function shadowShape(height, look) {
  const near = 1 - Math.min(Math.max(height, 0) / look.shadowReach, 1);
  return {near, scale: look.shadowGrow + look.shadowSwell * near, opacity: look.shadowOpacity * near * near};
}

/**
 * Ground offset of a shadow cast by something `reach` high, with the light at unit direction `moon` (towards the light).
 * It falls away from the light; a low light stretches it, so the length is capped at `cap`.
 */
export function shadowOffset(moon, reach, cap) {
  const horizontal = Math.hypot(moon.x, moon.z);
  if (horizontal === 0) return {x: 0, z: 0};
  const stretch = moon.y > 0 ? Math.min(reach / moon.y, cap / horizontal) : cap / horizontal;
  return {x: 0 - moon.x * stretch, z: 0 - moon.z * stretch}; // 0 - avoids a negative zero
}
