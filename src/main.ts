import "./tokens.css";
import "./style.css";
import "./settings.css";
import { Application } from "pixi.js";
import { CAST } from "./cast";
import { SCENE_LABEL } from "./copy";
import { Look } from "./look";
import { installDebug } from "./debug";
import { Overlay } from "./overlay";
import { Runtime } from "./runtime";
import { css, makeScene } from "./scene";
import { installRoomAudio } from "./room-audio";
import { MAX_RESOLUTION } from "./tune";
import { SceneSettings } from "./scene-settings";
import { installSceneSettings } from "./scene-settings-view";
import { installResidentControls } from "./resident-controls";
import { FavoriteSpots } from "./favorite-spots";
import { installPostcard } from "./postcard";
import { installLighting } from "./lighting-view";
import { mountSceneActions } from "./scene-actions";
import { installIntro } from "./intro";

async function start(intro: ReturnType<typeof installIntro>): Promise<void> {
  const shell = document.querySelector<HTMLElement>("#grove")!;
  const scroller = document.querySelector<HTMLElement>("#scroller")!;
  const worldEl = document.querySelector<HTMLElement>("#world")!;
  const params = new URLSearchParams(location.search);
  shell.setAttribute("aria-label", SCENE_LABEL);
  const app = new Application();
  await app.init({
    resizeTo: window, resolution: Math.min(devicePixelRatio, MAX_RESOLUTION),
    autoDensity: true, background: css("--color-bg"), antialias: true,
  });
  app.canvas.setAttribute("aria-hidden", "true");
  app.canvas.className = "stage";
  app.stage.eventMode = "none";
  shell.prepend(app.canvas);
  const settings = new SceneSettings({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  const scene = await makeScene(settings, app.renderer);
  app.stage.addChild(scene.world);
  const look = new Look(scroller, worldEl, scene.puff.cast.home.x);
  const roomAudio = installRoomAudio();
  const overlay = new Overlay(worldEl,
    [...CAST].sort((a, b) => a.home.x - b.home.x).map((c) => c.id),
    (id) => { if (!look.frozen) scene.residents.find((r) => r.cast.id === id)?.play("press"); },
    () => { if (!look.frozen) scene.puff.play("nod"); });
  const runtime = new Runtime(scene, look, overlay, params.has("busy"), settings);
  installResidentControls(scene, runtime, overlay, settings);
  const applySettings = () => {
    runtime.syncWander();
    runtime.update(0);
    scene.letter.visible = settings.showCue;
    overlay.setCueVisible(settings.showCue);
  };
  settings.subscribe(applySettings);
  installSceneSettings(settings, (trigger) => overlay.open(trigger));
  installLighting(settings);
  applySettings();
  const favorites = new FavoriteSpots(worldEl, look, settings, overlay, scene.favoriteScenery);
  installPostcard(app);
  mountSceneActions();
  if (params.has("debug")) installDebug(shell, app, scene, runtime, look);
  runtime.update(0);
  app.ticker.add((ticker) => { runtime.update(ticker.deltaMS); favorites.update(); });
  document.addEventListener("visibilitychange", () => document.hidden ? app.stop() : app.start());
  if (document.hidden) app.stop();
  app.render();
  shell.dataset.ready = "true";
  intro.ready(roomAudio.unlock);
}

const intro = installIntro(document.querySelector<HTMLElement>("#grove")!, new URLSearchParams(location.search).has("still"));
void start(intro).catch(error => { console.error(error); intro.fail(); });
