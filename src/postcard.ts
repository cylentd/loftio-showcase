import "./postcard.css";
import type { Application } from "pixi.js";

import { POSTCARD } from "./copy";
import { icon } from "./icons";
import { postcardCanvas } from "./postcard-frame";
import { previewPostcard } from "./postcard-preview";
import { nextCaption } from "./postcard-caption";
import { PostcardDesign } from "./postcard-design";

export function installPostcard(app: Application): void {
  let previous: string | null = null;
  const button = document.createElement("button"); button.type = "button"; button.className = "postcard-action room-action";
  button.append(icon("postcard")); button.setAttribute("aria-label", POSTCARD.save); button.title = POSTCARD.save;
  const status = document.createElement("p"); status.className = "visually-hidden postcard-status"; status.setAttribute("role", "status");
  button.addEventListener("click", async () => {
    button.disabled = true; status.textContent = POSTCARD.working;
    try {
      const greeting = nextCaption(POSTCARD.greetings, previous, Math.random());
      app.render();
      const scene = document.createElement("canvas"); scene.width = app.screen.width; scene.height = app.screen.height;
      scene.getContext("2d")!.drawImage(app.canvas,0,0,scene.width,scene.height);
      const render = (design: PostcardDesign) => new Promise<Blob>((resolve,reject) => {
        postcardCanvas(scene,design.greeting,design.border,design.showCaption).toBlob(image => {
          if (image) { previous = design.greeting; resolve(image); } else reject(new Error("Empty postcard"));
        },"image/png");
      });
      const design = new PostcardDesign(greeting);
      const blob = await render(design);
      previous = greeting;
      status.textContent = ""; previewPostcard(blob, design, render, button);
    } catch { status.textContent = POSTCARD.error; }
    finally { button.disabled = false; }
  });
  document.body.append(button, status);
}
