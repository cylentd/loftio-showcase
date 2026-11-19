// Whole-object see-through for scenery that hides the lead resident (owner request 2026-11-17).
// Every tree of a kind shares one material and one instanced buffer, so a fade never touches them:
//  - a tree that is its own Mesh swaps to a see-through copy of its material while faded, then back;
//  - a tree that is one instance of a batch is hidden in the batch and drawn as a one-instance see-through copy
//    (a pooled mesh sharing the geometry, so it also shares the shader program) while faded, then restored.
// Opaque materials are never made transparent, so normal sorting and cost are unchanged the rest of the time.
import * as THREE from 'three';
import { glassMaterial } from './glsl.js';
import { blockedIds, nextOpacity } from './fade-model.mjs';
import { PLAY } from './play-constants.js';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * fadeables: [{shapes, meshes}] for a tree that is its own mesh group, or [{shapes, ref}] for one instance,
 * where ref = {insts, i} names the batch meshes and the slot (world.js owns it and writes ref.faded while faded).
 */
export function createFader({ scene, fadeables = [] }) {
  const entries = fadeables.map((f, id) => ({ ...f, id, opacity: 1, engaged: false, matrix: new THREE.Matrix4(), ghosts: [] }));
  const live = new Set(), pool = new Map();
  const speed = (1 - PLAY.fadeOpacity) / PLAY.fadeSeconds;

  /** A one-instance mesh on inst's geometry, made before its ghost so the sort (same renderOrder and depth) draws it first. */
  function oneOf(inst, material) {
    const mesh = new THREE.InstancedMesh(inst.geometry, material, 1);
    mesh.frustumCulled = false; scene.add(mesh);
    return mesh;
  }
  /** look.depthFirst: a depth-only twin is drawn just before the ghost, so only the nearest surface blends and a crown of
   * overlapping puffs stays one smooth layer instead of showing every puff behind it (cherry, 2026-11-18). */
  function acquire(inst, look) {
    const free = pool.get(inst.material) ?? [];
    pool.set(inst.material, free);
    let ghost = free.pop();
    if (!ghost) {
      const twin = look?.depthFirst ? oneOf(inst, Object.assign(glassMaterial(inst.material), { colorWrite: false })) : null;
      ghost = oneOf(inst, glassMaterial(inst.material));
      ghost.twin = twin;
    }
    ghost.source = inst.material; show(ghost, true);
    return ghost;
  }
  function show(ghost, on) { ghost.visible = on; if (ghost.twin) ghost.twin.visible = on; }
  function place(entry) {
    entry.ghosts.forEach((ghost) => [ghost, ghost.twin].forEach((m) => { if (m) { m.setMatrixAt(0, entry.matrix); m.instanceMatrix.needsUpdate = true; } }));
  }
  function engage(entry) {
    entry.engaged = true;
    if (entry.meshes) {
      entry.glass ??= entry.meshes.map((mesh) => glassMaterial(mesh.material));
      entry.solid = entry.meshes.map((mesh) => mesh.material);
      entry.meshes.forEach((mesh, k) => { mesh.material = entry.glass[k]; });
      return;
    }
    const { insts, i } = entry.ref;
    insts[0].getMatrixAt(i, entry.matrix);
    entry.ghosts = insts.map((inst) => acquire(inst, entry.look)); place(entry);
    insts.forEach((inst) => { inst.setMatrixAt(i, HIDDEN); inst.instanceMatrix.needsUpdate = true; });
    entry.ref.faded = { setMatrix(m) { entry.matrix.copy(m); place(entry); } };
  }
  function disengage(entry) {
    entry.engaged = false;
    if (entry.meshes) { entry.meshes.forEach((mesh, k) => { mesh.material = entry.solid[k]; }); return; }
    const { insts, i } = entry.ref;
    insts.forEach((inst) => { inst.setMatrixAt(i, entry.matrix); inst.instanceMatrix.needsUpdate = true; });
    entry.ghosts.forEach((ghost) => { show(ghost, false); pool.get(ghost.source).push(ghost); });
    entry.ghosts = []; entry.ref.faded = null;
  }
  function apply(entry) {
    if (entry.opacity < 1 && !entry.engaged) engage(entry);
    if (entry.opacity >= 1 && entry.engaged) { disengage(entry); return; }
    if (!entry.engaged) return;
    for (const material of entry.meshes ? entry.glass : entry.ghosts.map((ghost) => ghost.material)) material.uniforms.uOpacity.value = entry.opacity;
  }

  /**
   * Builds, at load, what the first fade of each tree kind would otherwise build mid-fight: the see-through
   * material and the pooled ghost mesh. They sit hidden; the start-up warm-up (warm.js) draws them once, so the
   * shader compiles then and not the first time a tree hides the lead during a fight.
   */
  function prebuild() {
    const seen = new Set();
    for (const entry of entries) {
      if (entry.meshes) {
        entry.glass ??= entry.meshes.map((mesh) => glassMaterial(mesh.material));
        entry.meshes.forEach((mesh, k) => {
          if (seen.has(mesh.material)) return;
          seen.add(mesh.material);
          const warmMesh = new THREE.Mesh(mesh.geometry, entry.glass[k]);
          warmMesh.visible = false; warmMesh.frustumCulled = false; scene.add(warmMesh);
        });
        continue;
      }
      for (const inst of entry.ref.insts) {
        if (seen.has(inst.material)) continue;
        seen.add(inst.material);
        const ghost = acquire(inst, entry.look);
        show(ghost, false); pool.get(inst.material).push(ghost);
      }
    }
  }
  prebuild();

  return {
    /** from: the camera, to: the lead resident's centre. Fades what hides it, restores what no longer does. */
    update(from, to, dt) {
      const ids = blockedIds({ from, to, objects: entries, faded: [...live].filter((e) => e.target < 1).map((e) => e.id), margin: PLAY.fadeMargin, hysteresis: PLAY.fadeHysteresis, max: PLAY.fadeMax });
      const blocked = new Set(ids);
      for (const id of ids) live.add(entries[id]);
      for (const entry of live) {
        entry.target = blocked.has(entry.id) ? entry.look?.opacity ?? PLAY.fadeOpacity : 1; // look.opacity: a kind's own floor (world.js kinds)
        entry.opacity = nextOpacity(entry.opacity, entry.target, dt, speed);
        apply(entry);
        if (entry.opacity >= 1 && entry.target >= 1) live.delete(entry);
      }
    },
    /** Everything solid again at once (leaving Explore). */
    reset() { for (const entry of live) { entry.opacity = 1; entry.target = 1; apply(entry); } live.clear(); },
    /** Opacity of every object that is not fully solid, for QA. */
    faded() { return [...live].map((entry) => ({ id: entry.id, opacity: entry.opacity, target: entry.target })); },
  };
}
