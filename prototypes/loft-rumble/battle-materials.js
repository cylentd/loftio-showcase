(() => {
  const style = window.LoftRumbleBattleMaterialConfig;
  const arena = window.LoftRumbleArtConfig?.arena;
  if (!style || !arena) return;
  const fullTurn = Math.PI * 2;
  const sharedStyles = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
  const sharedColours = Object.freeze(Object.fromEntries(Object.entries(style.uiTokens).map(([name, property]) =>
    [name, sharedStyles?.getPropertyValue(property).trim()])));
  const colour = (name, fallback) => sharedColours[name] || fallback;

  function gradient(ctx, positionX, positionY, height, top, bottom) {
    const fill = ctx.createLinearGradient(positionX, positionY, positionX, positionY + height);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    return fill;
  }

  function disc(ctx, positionX, positionY, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(positionX, positionY, radius, 0, fullTurn);
    ctx.fill();
  }

  function shadow(ctx, positionX, positionY, width, depth, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(positionX, positionY, width, depth, 0, 0, fullTurn);
    ctx.fill();
  }

  function bezel(ctx, name, box) {
    const pad = name === 'ui-bar-boss' ? style.bevelPad : style.teamPad;
    const positionX = box.x - pad, positionY = box.y - pad;
    const width = box.w + pad * 2, height = box.h + pad * 2;
    ctx.save();
    ctx.fillStyle = style.edgeShade;
    ctx.beginPath();
    ctx.roundRect(positionX, positionY + style.teamPad, width, height, height / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(positionX, positionY, width, height, height / 2);
    ctx.fillStyle = gradient(ctx, positionX, positionY, height,
      colour('frameLight', arena.core), colour('frameShade', arena.stoneRim));
    ctx.fill();
    ctx.strokeStyle = colour('frameEdge', arena.stoneBevel);
    ctx.lineWidth = style.rimWidth;
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function meter(ctx, positionX, positionY, width, height, value, chip, max, fill, flash, wash) {
    const fraction = amount => max > 0 ? Math.max(0, Math.min(1, amount / max)) : 0;
    const currentWidth = width * fraction(value), pendingWidth = width * fraction(chip);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(positionX, positionY, width, height, height * style.meterRadius);
    ctx.clip();
    ctx.fillStyle = colour('recess', style.recess);
    ctx.fillRect(positionX, positionY, width, height);
    ctx.fillStyle = colour('pending', style.pending);
    ctx.fillRect(positionX, positionY, pendingWidth, height);
    ctx.fillStyle = fill;
    ctx.fillRect(positionX, positionY, currentWidth, height);
    const light = gradient(ctx, positionX, positionY, height, style.sheen, style.meterShade);
    light.addColorStop(style.shineStop, style.sheenClear);
    light.addColorStop(style.shadeStop, style.sheenClear);
    ctx.fillStyle = light;
    ctx.fillRect(positionX, positionY, Math.max(currentWidth, pendingWidth), height);
    if (flash > 0) {
      ctx.globalAlpha *= Math.min(1, flash);
      ctx.fillStyle = wash;
      ctx.fillRect(positionX, positionY, width, height);
    }
    ctx.restore();
    return true;
  }

  function radial(ctx, positionX, positionY, radius, light, middle, shade) {
    const fill = ctx.createRadialGradient(positionX + radius * style.lightX, positionY + radius * style.lightY,
      0, positionX + radius * style.falloffX, positionY + radius * style.falloffY, radius);
    fill.addColorStop(0, light);
    fill.addColorStop(style.capSheen, middle);
    fill.addColorStop(1, shade);
    return fill;
  }

  function stoneCuts(ctx, positionX, positionY, radius) {
    ctx.strokeStyle = style.stoneShade;
    ctx.lineWidth = radius * style.cutWidth;
    for (const [angle, inset] of style.stoneCuts) {
      ctx.beginPath();
      ctx.moveTo(positionX + Math.cos(angle) * radius * inset, positionY + Math.sin(angle) * radius * inset);
      ctx.lineTo(positionX + Math.cos(angle) * radius, positionY + Math.sin(angle) * radius);
      ctx.stroke();
    }
  }

  function bumper(ctx, skin, position, radius, hit) {
    const impact = Math.max(0, Math.min(1, hit));
    const cap = radius * (1 - impact * arena.compression);
    const { x: positionX, y: positionY } = position;
    ctx.save();
    shadow(ctx, positionX, positionY + radius * style.bumperShadowY, radius * style.bumperShadowWidth,
      radius * style.bumperShadowDepth, style.shadow);
    disc(ctx, positionX, positionY + radius * style.faceOffset, radius * arena.rimSize, style.stoneFace);
    disc(ctx, positionX, positionY, radius, arena.stoneRim);
    disc(ctx, positionX, positionY, radius, radial(ctx, positionX, positionY, radius, style.stoneLight, arena.stoneRim, style.stoneShade));
    stoneCuts(ctx, positionX, positionY, radius);
    ctx.strokeStyle = style.stoneLight;
    ctx.lineWidth = radius * style.rimLightWidth;
    ctx.beginPath();
    ctx.arc(positionX, positionY, radius - ctx.lineWidth, Math.PI * style.rimLightStart, Math.PI * style.rimLightEnd);
    ctx.stroke();
    disc(ctx, positionX, positionY, cap * style.capRim, style.amberEdge);
    disc(ctx, positionX, positionY - radius * style.capInset, cap * arena.amberSize, arena.amber);
    disc(ctx, positionX, positionY - radius * style.capInset, cap * arena.amberSize,
      radial(ctx, positionX, positionY, cap, impact > 0 ? arena.glint : style.amberLight, arena.amber, style.amberShade));
    disc(ctx, positionX + cap * arena.glintOffset, positionY + cap * arena.glintOffset,
      cap * arena.glintSize, arena.glint);
    if (impact > 0) {
      ctx.globalAlpha *= impact;
      ctx.strokeStyle = arena.bevel;
      ctx.lineWidth = arena.pulseWidth;
      ctx.beginPath();
      ctx.arc(positionX, positionY, radius * (arena.rimSize + (1 - impact) * arena.pulseGrowth), 0, fullTurn);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  function ground(ctx, positionX, positionY, radius, skin) {
    if (window.LoftRumbleColosseumRelief?.ground(ctx, positionX, positionY, radius, skin)) return true;
    const across = positionX + radius * style.groundX, down = positionY + radius * style.groundY;
    ctx.save();
    shadow(ctx, across, down, radius * style.groundWidth * style.softScale,
      radius * style.groundDepth * style.softScale, style.shadow);
    shadow(ctx, across, down, radius * style.groundWidth, radius * style.groundDepth, style.shadowCore);
    ctx.restore();
    return true;
  }

  function resident(ctx, image, size, skin) {
    if (!image.complete || !image.naturalWidth) return false;
    ctx.save();
    ctx.filter = style.finish[skin] ?? style.finish.colosseum;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  function panel(ctx, positionX, positionY, width, height, active, accent, world = false) {
    const top = world ? colour('surface', style.surface) : colour('panelSurface', arena.core);
    const bottom = world ? colour('surface', style.surfaceShade) : colour('panelShade', arena.stoneBevel);
    ctx.save();
    ctx.fillStyle = gradient(ctx, positionX, positionY, height, active ? accent : top, bottom);
    ctx.beginPath();
    ctx.roundRect(positionX, positionY, width, height, Math.min(style.panelRadius, height * style.panelRadiusScale));
    ctx.fill();
    ctx.strokeStyle = active ? accent : world ? colour('worldEdge', arena.stoneRim) : colour('frameEdge', arena.stoneBevel);
    ctx.lineWidth = style.rimWidth;
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function intent(ctx, positionX, positionY, width, height, active, accent) {
    return panel(ctx, positionX, positionY, width, height, active, accent, true);
  }

  function hud(ctx, width, height, top, bottom) {
    ctx.save();
    for (const [positionY, depth] of [[0, top], [height - bottom, bottom]]) {
      ctx.fillStyle = gradient(ctx, 0, positionY, depth, colour('surface', style.surface), colour('surface', style.surfaceShade));
      ctx.fillRect(0, positionY, width, depth);
      ctx.fillStyle = colour('worldEdge', arena.stoneRim);
      ctx.fillRect(0, positionY === 0 ? top - style.rimWidth : positionY, width, style.rimWidth);
    }
    ctx.restore();
  }

  window.LoftRumbleBattleMaterials = Object.freeze({ bezel, meter, bumper, ground, resident, panel, intent, hud,
    panelInk: colour('panelInk', arena.core), panelMuted: colour('panelMuted', arena.stoneRim) });
})();
