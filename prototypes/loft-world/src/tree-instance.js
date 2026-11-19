// One tree's instance record and matrix. The batch slot and its see-through fade ghost both come from treeMatrix,
// so a ghost is always the size, width and lean of the tree it replaces.
import * as THREE from 'three';
import { treeVariety, treeMatrixParts } from './tree-variety.mjs';
import { TREE_YAW, TREE_ROOT_REACH, TREE_SINK } from './tree-variety-data.mjs';

/** The data every consumer of a tree reads: position, hashed variety and yaw. */
export function treeRef(x, y, z) {
  return { x, y, z, v: treeVariety(x, z), rotY: x * TREE_YAW.x + z * TREE_YAW.z };
}
/** Writes the tree's matrix into `out`; (shakeX, shakeZ) are extra tilt in radians while a bumped tree rocks. */
export function treeMatrix(out, quat, euler, ref, shakeX, shakeZ) {
  const p = treeMatrixParts(ref.v);
  quat.setFromEuler(euler.set(p.leanX + shakeX, ref.rotY, p.leanZ + shakeZ, 'XZY'));
  return out.compose(new THREE.Vector3(ref.x, ref.y, ref.z), quat, new THREE.Vector3(p.scale.x, p.scale.y, p.scale.z));
}
/** Where the trunk base sits: the lowest ground under the root flare, a little below, so a big tree on a slope meets the ground. */
export function treeBaseY(heightAt, x, z) {
  const reach = TREE_ROOT_REACH * treeVariety(x, z).width;
  return Math.min(heightAt(x, z), heightAt(x + reach, z), heightAt(x - reach, z), heightAt(x, z + reach), heightAt(x, z - reach)) - TREE_SINK;
}
