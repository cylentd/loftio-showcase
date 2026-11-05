import { POSTCARD_RENDER as PRINT } from "./postcard-data.ts";

export function postcardLayout(width: number, height: number, lines = 1) {
  const scale = Math.max(1, width / PRINT.referenceWidth);
  const sceneWidth = width / scale, sceneHeight = height / scale;
  const compact = sceneWidth + PRINT.border * 2 < PRINT.compactWidth;
  const fontSize = compact ? PRINT.compactTitleFont : PRINT.titleFont;
  const captionWidth = compact ? sceneWidth : sceneWidth - PRINT.stampWidth - PRINT.postmarkRadius * 2 - PRINT.stampInset * 2;
  const captionBottom = PRINT.titleInset + lines * fontSize * PRINT.captionLeading + PRINT.bylineGap + PRINT.smallFont;
  const occupiedFooter = compact ? captionBottom + PRINT.bylineGap + PRINT.stampHeight + PRINT.stampInset - PRINT.border : captionBottom;
  const footer = Math.ceil(Math.max(compact ? PRINT.compactFooter : PRINT.footer, occupiedFooter));
  return { scale, sceneWidth, sceneHeight, width: sceneWidth + PRINT.border * 2,
    height: sceneHeight + PRINT.border * 2 + footer, compact, fontSize, captionWidth, footer };
}
