import { POSTCARD_RENDER as PRINT, type PostcardBorder } from "./postcard-data";
import { css } from "./scene";

function airmail(ink: CanvasRenderingContext2D, width: number, height: number): void {
  for (let offset = -PRINT.stripe; offset < Math.max(width, height); offset += PRINT.stripe) {
    ink.fillStyle = css(offset / PRINT.stripe % 2 === 0 ? "--postcard-red" : "--postcard-blue");
    for (const top of [0, height - PRINT.rail]) {
      ink.beginPath(); ink.moveTo(offset, top); ink.lineTo(offset + PRINT.stripe, top);
      ink.lineTo(offset + PRINT.stripe - PRINT.rail, top + PRINT.rail); ink.lineTo(offset - PRINT.rail, top + PRINT.rail); ink.fill();
    }
    for (const left of [0, width - PRINT.rail]) {
      ink.beginPath(); ink.moveTo(left, offset); ink.lineTo(left, offset + PRINT.stripe);
      ink.lineTo(left + PRINT.rail, offset + PRINT.stripe - PRINT.rail); ink.lineTo(left + PRINT.rail, offset - PRINT.rail); ink.fill();
    }
  }
}

function leaf(ink: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  ink.save(); ink.translate(x,y); ink.rotate(angle);
  ink.beginPath(); ink.moveTo(0,0);
  ink.quadraticCurveTo(PRINT.leafWidth,-PRINT.leafWidth,PRINT.leafLength,0);
  ink.quadraticCurveTo(PRINT.leafWidth,PRINT.leafWidth,0,0); ink.fill(); ink.restore();
}

export function postcardBorder(ink: CanvasRenderingContext2D, width: number, height: number, style: PostcardBorder): void {
  if (style === "airmail") { airmail(ink,width,height); return; }
  const inset = PRINT.ornamentInset;
  ink.save(); ink.lineWidth = PRINT.lineWidth;
  ink.strokeStyle = css(style === "storybook" ? "--postcard-leaf" : "--postcard-thread");
  ink.fillStyle = ink.strokeStyle;
  if (style === "quilt") ink.setLineDash([PRINT.stitchDash,PRINT.stitchGap]);
  ink.beginPath(); ink.roundRect(inset,inset,width-inset*2,height-inset*2,PRINT.frameRadius); ink.stroke();
  for (let offset = PRINT.ornamentGap; offset < width - PRINT.ornamentGap / 2; offset += PRINT.ornamentGap) {
    for (const top of [inset,height-inset]) {
      leaf(ink,offset,top,-PRINT.leafAngle); leaf(ink,offset,top,Math.PI-PRINT.leafAngle);
    }
  }
  for (let offset = PRINT.ornamentGap; offset < height - PRINT.ornamentGap / 2; offset += PRINT.ornamentGap) {
    for (const left of [inset,width-inset]) {
      leaf(ink,left,offset,Math.PI/2-PRINT.leafAngle); leaf(ink,left,offset,-Math.PI/2-PRINT.leafAngle);
    }
  }
  ink.restore();
}
