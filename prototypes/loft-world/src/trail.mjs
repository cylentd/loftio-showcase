/** Opacity of the flight trail: full while airborne, drained to nothing over `fadeSeconds` once grounded,
 *  so the last flight's dots never hang in the grass. */
export function trailOpacity(current, airborne, dt, full, fadeSeconds) {
  if (airborne) return full;
  return Math.max(current - (full * dt) / fadeSeconds, 0);
}
