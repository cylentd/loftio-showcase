export const POSTCARD_BORDERS = ["storybook", "quilt", "airmail"] as const;
export type PostcardBorder = typeof POSTCARD_BORDERS[number];
export const SNAPSHOT_RENDER = { referenceWidth: 1080, paperInset: 32, filmInset: 14, titleFont: 44, compactFont: 30, compactWidth: 640, captionPadding: 28, leading: 1.25, signatureFont: 22, signatureGap: 16, signatureOpacity: 0.7 };
export const POSTCARD_RENDER = {
  referenceWidth: 1080, border: 64, footer: 230, compactFooter: 320, titleFont: 72, compactWidth: 640, compactTitleFont: 64,
  smallFont: 26, stampFont: 28, postmarkFont: 22, captionLeading: 1.18, titleInset: 60, bylineGap: 32,
  stripe: 24, rail: 14, stampWidth: 180, stampHeight: 200, stampInset: 40, postmarkRadius: 48,
  perforation: 14, perforationRadius: 4, lineWidth: 2.5, waveHeight: 6, waveGap: 16,
  ornamentInset: 28, ornamentGap: 90, leafLength: 16, leafWidth: 8, leafAngle: 0.55,
  frameRadius: 24, stitchDash: 8, stitchGap: 10,
};
