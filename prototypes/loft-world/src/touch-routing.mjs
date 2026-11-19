/**
 * Which job a new finger gets. Each finger keeps it until it lifts.
 *   a button            -> that button
 *   on the resident     -> fling aim (only while no other finger is aiming)
 *   lower-left region   -> the walk stick (only while no other finger holds it)
 *   anywhere else       -> look
 */
export function routeTouch({ onButton, nearLead, flingFree, inRegion, stickFree }) {
  if (onButton) return 'button';
  if (nearLead && flingFree) return 'fling';
  if (inRegion && stickFree) return 'stick';
  return 'look';
}
