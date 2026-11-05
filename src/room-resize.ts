import type { Application } from "pixi.js";
import type { FavoriteSpots } from "./favorite-spots";
import { activeRoom, roomLayoutFor, setRoomLayout } from "./room-layout";
import type { Runtime } from "./runtime";
import { makeScene, type Scene } from "./scene";
import type { SceneSettings } from "./scene-settings";

type Context = {
  app: Application; scene: Scene; runtime: Runtime; settings: SceneSettings;
  favorites: FavoriteSpots; shell: HTMLElement; scroller: HTMLElement; applySettings: () => void;
};

export function installRoomResize(context: Context): () => Promise<void> {
  const { app, scene, runtime, settings, favorites, shell, scroller, applySettings } = context;
  let switching = false;
  const syncRoom = async () => {
    const layout = roomLayoutFor(innerWidth, innerHeight);
    if (switching || layout === activeRoom) return;
    switching = true;
    app.stop();
    scroller.inert = true;
    const previousLayout = activeRoom;
    const previous = { world: scene.world, lighting: scene.lighting, scenery: scene.favoriteScenery };
    let succeeded = false;
    try {
      setRoomLayout(layout);
      const next = await makeScene(settings, app.renderer, scene);
      Object.assign(scene, next);
      app.stage.addChild(scene.world);
      for (const resident of scene.residents) { resident.resetHome(); resident.update(0, runtime.clock, true); }
      favorites.setScenery(scene.favoriteScenery);
      runtime.look.refresh(scene.puff.cast.home.x);
      shell.dataset.room = layout;
      previous.scenery.destroy();
      previous.world.destroy({ children: true });
      previous.lighting.destroy();
      applySettings();
      app.render();
      succeeded = true;
    } catch (error) {
      if (scene.world === previous.world) setRoomLayout(previousLayout);
      runtime.look.refresh(scene.puff.cast.home.x);
      console.error(error);
    } finally {
      switching = false;
      scroller.inert = false;
      if (!document.hidden) app.start();
    }
    if (succeeded && roomLayoutFor(innerWidth, innerHeight) !== activeRoom) void syncRoom();
  };
  addEventListener("resize", () => { void syncRoom(); });
  document.addEventListener("visibilitychange", () => document.hidden || switching ? app.stop() : app.start());
  return syncRoom;
}
