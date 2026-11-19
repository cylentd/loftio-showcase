/** Rebound speed off plain ground (not springs, monsters, rocks or a held-jump chain).
 *  Landings softer than `plantBelow` plant the resident; harder ones keep `keep` of the excess, so there is no pop at the threshold
 *  and the rebound lands softer than `plantBelow` again: one bounce at most. */
export function groundBounce(hard, plantBelow, keep) {
  return Math.max(hard - plantBelow, 0) * keep;
}
