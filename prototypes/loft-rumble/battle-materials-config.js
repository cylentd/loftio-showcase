(() => {
  window.LoftRumbleBattleMaterialConfig = Object.freeze({
    surface: '#26343b', surfaceShade: '#141f25', recess: '#0d181d',
    edgeShade: 'rgba(4,12,16,0.5)',
    sheen: 'rgba(255,251,219,0.34)', sheenClear: 'rgba(255,251,219,0)',
    meterShade: 'rgba(5,19,17,0.3)', pending: '#a49b80',
    bevelPad: 3, teamPad: 2, rimWidth: 1,
    meterRadius: 0.5, shineStop: 0.48, shadeStop: 0.55,
    panelRadius: 12, panelRadiusScale: 0.25,
    shadow: 'rgba(12,19,17,0.24)', shadowCore: 'rgba(12,19,17,0.3)',
    groundX: 0.12, groundY: 0.72, groundWidth: 0.66, groundDepth: 0.19,
    softScale: 1.4, bumperShadowY: 0.35, bumperShadowWidth: 1.22, bumperShadowDepth: 0.48,
    stoneLight: '#d7c9aa', stoneShade: '#655e4e', stoneFace: '#534c3e',
    amberLight: '#ffe9a8', amberShade: '#80532c', amberEdge: '#6d472b',
    lightX: -0.32, lightY: -0.38, falloffX: 0.25, falloffY: 0.35,
    faceOffset: 0.18, rimLightWidth: 0.07, rimLightStart: 1.08, rimLightEnd: 1.86,
    cutWidth: 0.035, stoneCuts: [[0.78, 0.91], [1.92, 0.87], [3.9, 0.9]],
    capRim: 0.79, capInset: 0.08, capSheen: 0.58,
    // Living-magic bumper art (LM6a). The opaque body spans 174 of each 192 px texture (alpha bbox, 2026-11-15), so a width of
    // 2.2 radii puts the body's edge on the collider (32 units at radius 16). The pack README's 2.6 left it 4 units past the
    // collider on each side; the full-screen boss-layout reference draws them smaller still. A hit brightens the art by up to 35%.
    bumperArtWidth: 2.2, bumperArtHitGlow: 0.35,
    // Its contact shadow, in radii, on the floor plane: collider-wide, nudged right and down away from the upper-left light.
    // The stone's 1.22-wide shadow read as a hole round the smaller painted body (captures, 2026-11-15).
    bumperArtShadow: Object.freeze({ x: 0.1, y: 0.3, width: 1, depth: 0.34 }),
    uiTokens: Object.freeze({
      surface: '--scene-actions-bg', recess: '--scene-actions-bg', worldEdge: '--scene-actions-edge',
      frameLight: '--controls-surface', frameShade: '--controls-edge', frameEdge: '--controls-edge',
      pending: '--controls-scroll', panelSurface: '--controls-bg', panelShade: '--controls-hover',
      panelInk: '--controls-ink', panelMuted: '--controls-muted',
    }),
    finish: Object.freeze({
      colosseum: 'contrast(1.08) saturate(0.9)',
      cloudpeak: 'contrast(1.07) saturate(0.92) brightness(0.98)',
      moonroot: 'contrast(1.1) saturate(0.85) brightness(1.04)',
    }),
  });
})();
