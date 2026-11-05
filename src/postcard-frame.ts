import { SNAPSHOT_RENDER as PRINT, type PostcardBorder } from "./postcard-data";
import { css } from "./scene";
import { POSTCARD } from "./copy";

function captionLines(ink: CanvasRenderingContext2D, greeting: string, width: number): string[] {
  const lines: string[] = []; let line = "";
  for (const word of greeting.split(" ")) {
    const next = line ? line + " " + word : word;
    if (line && ink.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function postcardCanvas(scene: HTMLCanvasElement, greeting: string, border: PostcardBorder = "storybook", showCaption = false): HTMLCanvasElement {
  const scale = Math.max(1, scene.width / PRINT.referenceWidth);
  const width = scene.width / scale, height = scene.height / scale;
  const frameInset = border === "storybook" ? PRINT.paperInset : border === "quilt" ? PRINT.filmInset : 0;
  const inset = Math.round(frameInset * scale) / scale;
  const canvas = document.createElement("canvas");
  const ink = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).getPropertyValue("--font-heading");
  const fontSize = width < PRINT.compactWidth ? PRINT.compactFont : PRINT.titleFont;
  ink.font = fontSize + "px " + font;
  const lines = showCaption ? captionLines(ink, greeting, width - PRINT.captionPadding * 2) : [];
  const captionHeight = lines.length * fontSize * PRINT.leading;
  const footer = lines.length ? PRINT.captionPadding * 2 + captionHeight + PRINT.signatureGap + PRINT.signatureFont : 0;
  canvas.width = scene.width + Math.round(inset * scale) * 2;
  canvas.height = scene.height + Math.round(inset * scale) * 2 + Math.ceil(footer * scale);
  ink.scale(scale, scale);
  ink.fillStyle = css(border === "quilt" ? "--ink" : "--paper");
  ink.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
  ink.drawImage(scene, inset, inset, width, height);
  ink.fillStyle = css(border === "quilt" ? "--paper" : "--ink");
  ink.font = fontSize + "px " + font; ink.textAlign = "center"; ink.textBaseline = "middle";
  lines.forEach((line, index) => ink.fillText(line, width / 2 + inset,
    inset + height + PRINT.captionPadding + fontSize * PRINT.leading * (index + 0.5)));
  if (lines.length) {
    ink.font = "italic " + PRINT.signatureFont + "px " + font;
    ink.globalAlpha = PRINT.signatureOpacity;
    ink.fillText(POSTCARD.signature, width / 2 + inset,
      inset + height + PRINT.captionPadding + captionHeight + PRINT.signatureGap + PRINT.signatureFont / 2);
  }
  return canvas;
}
