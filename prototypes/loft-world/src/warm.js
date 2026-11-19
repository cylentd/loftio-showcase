// Shader and geometry warm-up. three.js compiles a program and uploads a geometry or texture the first time an
// object is drawn, and skips hidden or off-screen ones. A fight effect that sits hidden until its first hit would
// then compile in the middle of the fight. So: show everything, draw once behind the loading cover, put it all back.

/**
 * Uploads textures that load after the first frame (the resident paintings: a pose is first drawn mid-fight, and a
 * big image upload then is a dropped frame). step() uploads one loaded texture per call, so no frame carries two,
 * and returns how many are still waiting. renderer.initTexture uploads without drawing.
 */
export function createTextureWarmer(renderer, textures) {
  const waiting = [...textures];
  return {
    step() {
      const i = waiting.findIndex((t) => t.image);
      if (i >= 0) renderer.initTexture(waiting.splice(i, 1)[0]);
      return waiting.length;
    },
  };
}

/** Runs draw() with every object in scene visible and uncullable, then restores each object. Returns draw()'s result. */
export function warmScene(scene, draw) {
  const saved = [];
  scene.traverse((o) => { saved.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
  try { return draw(); } finally { for (const [o, visible, culled] of saved) { o.visible = visible; o.frustumCulled = culled; } }
}
