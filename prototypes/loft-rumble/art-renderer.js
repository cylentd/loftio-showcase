(() => {
  const config = window.LoftRumbleArtConfig;
  if (!config) return;
  const { assets, metrics, arena } = config;
  document.documentElement.classList.add('loft-art');
  const images = new Map();
  const base = document.currentScript.src;
  const ready = Promise.all(assets.map(name => new Promise(resolve => {
    const image = new Image();
    images.set(name, image);
    image.onload = () => {
      document.documentElement.style.setProperty('--art-' + name, 'url("' + image.src + '")');
      if (name === 'bg-arena') document.documentElement.classList.add('loft-art');
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = new URL('art/' + name + '.webp', base).href;
  }))).then(async loaded => {
    await document.fonts?.ready;
    return loaded;
  });

  function available(name) {
    const image = images.get(name);
    return image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null;
  }

  function paint(ctx, name, x, y, width, height = width, stretch = false) {
    if (name === 'ui-banner-victory' || name === 'ui-banner-defeat') return false;
    if (name === 'bg-arena' || name === 'bg-title') {
      ctx.save();
      ctx.fillStyle = arena.floor;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.fillStyle = arena.edge;
      ctx.fillRect(x - width / 2, y - height / 2, arena.edgeWidth, height);
      ctx.fillRect(x + width / 2 - arena.edgeWidth, y - height / 2, arena.edgeWidth, height);
      if (name === 'bg-arena') battlefield(ctx, x, y, width, height);
      ctx.restore();
      return true;
    }
    const image = available(name);
    if (!image) return false;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawnWidth = stretch ? width : image.naturalWidth * scale;
    const drawnHeight = stretch ? height : image.naturalHeight * scale;
    ctx.drawImage(image, x - drawnWidth / 2, y - drawnHeight / 2, drawnWidth, drawnHeight);
    return true;
  }

  function battlefield(ctx, x, y, width, height) {
    const skins = window.LoftRumbleArenaSkins;
    const skin = skins?.options.find(option => option.id === document.documentElement.dataset.arenaSkin)
      ?? skins?.options.find(option => option.id === skins.defaultId);
    const background = skin?.background;
    const painted = background && available(background.asset);
    if (painted) {
      const [across, down, span, depth] = background.crop;
      ctx.drawImage(painted, across * painted.naturalWidth, down * painted.naturalHeight,
        span * painted.naturalWidth, depth * painted.naturalHeight, x - width / 2, y - height / 2, width, height);
      return;
    }
    const stone = skin?.masonry ?? arena.masonry;
    const left = x - width / 2, top = y - height / 2;
    const tileWidth = (width - stone.inset * 2) / stone.columns;
    const tileHeight = height / stone.rows;
    ctx.fillStyle = stone.floor;
    ctx.fillRect(left + stone.inset, top, width - stone.inset * 2, height);
    for (let row = 0; row < stone.rows; row++) {
      for (let column = 0; column < stone.columns; column++) {
        const tileX = left + stone.inset + column * tileWidth + stone.gap;
        const tileY = top + row * tileHeight + stone.gap;
        ctx.fillStyle = stone.slabs[(row * stone.tilePatternStride + column + row * column) % stone.slabs.length];
        if (stone.surface === 'rock') {
          rockSlab(ctx, tileX, tileY, tileWidth - stone.gap, tileHeight - stone.gap, stone);
          continue;
        }
        ctx.fillRect(tileX, tileY, tileWidth - stone.gap, tileHeight - stone.gap);
        ctx.fillStyle = stone.stoneLight;
        ctx.fillRect(tileX, tileY, tileWidth - stone.gap, stone.highlight);
        weatherSlab(ctx, tileX, tileY, tileWidth - stone.gap, tileHeight - stone.gap, row, column, stone);
      }
    }
    window.LoftRumbleColosseumRelief?.floor(ctx, left, top, width, height, stone);
    floorEmblem(ctx, x, y, stone);
    for (const [side, wallX] of [['left', left + arena.edgeWidth], ['right', left + width - stone.wallWidth - arena.edgeWidth]]) {
      if (!window.LoftRumbleArenaScenery?.paint(ctx, skin?.scenery, wallX, top, height, stone, side)) perimeter(ctx, wallX, top, height, stone);
    }
    window.LoftRumbleColosseumRelief?.border(ctx, left, top, width, height, stone);
    window.LoftRumbleArenaScenery?.overlays(ctx, skin?.scenery, left, top, width, height, stone);
  }

  function rockSlab(ctx, x, y, width, height, stone) {
    const cut = stone.rockCut;
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + width - cut, y);
    ctx.lineTo(x + width, y + cut);
    ctx.lineTo(x + width - cut, y + height);
    ctx.lineTo(x + cut, y + height);
    ctx.lineTo(x, y + height - cut);
    ctx.closePath();
    ctx.fill();
  }

  function weatherSlab(ctx, x, y, width, height, row, column, stone) {
    if ((row + column) % stone.chipEvery === 0) {
      ctx.fillStyle = stone.joint;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stone.chipSize, y);
      ctx.lineTo(x, y + stone.chipSize);
      ctx.closePath();
      ctx.fill();
    }
    if ((row * stone.tilePatternStride + column) % stone.crackEvery !== 0) return;
    ctx.strokeStyle = stone.joint;
    ctx.lineWidth = stone.highlight;
    ctx.beginPath();
    stone.crackPoints.forEach(([across, down], index) => {
      if (index === 0) ctx.moveTo(x + across * width, y + down * height);
      else ctx.lineTo(x + across * width, y + down * height);
    });
    ctx.stroke();
  }

  function floorEmblem(ctx, x, y, stone) {
    ctx.save();
    ctx.globalAlpha *= stone.emblemAlpha;
    ctx.strokeStyle = stone.engraving;
    ctx.fillStyle = stone.engraving;
    ctx.lineWidth = stone.emblemWidth;
    for (const radius of [stone.emblemRadius, stone.emblemInner]) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let point = 0; point < stone.compassPoints; point++) {
      const angle = point * Math.PI * 2 / stone.compassPoints;
      const reach = stone.emblemInner * stone.compassReach;
      const base = stone.emblemInner * stone.compassBase;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
      ctx.lineTo(x + Math.cos(angle + Math.PI / 2) * base, y + Math.sin(angle + Math.PI / 2) * base);
      ctx.lineTo(x + Math.cos(angle - Math.PI / 2) * base, y + Math.sin(angle - Math.PI / 2) * base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function perimeter(ctx, x, top, height, stone) {
    ctx.fillStyle = stone.wallShadow;
    ctx.fillRect(x, top, stone.wallWidth + stone.wallBevel, height);
    for (let offset = 0; offset < height; offset += stone.wallStep) {
      const blockHeight = Math.min(stone.wallStep - stone.wallGap, height - offset);
      ctx.fillStyle = stone.wallFace;
      ctx.fillRect(x, top + offset, stone.wallWidth, blockHeight);
      ctx.fillStyle = stone.wallLight;
      ctx.fillRect(x, top + offset, stone.wallWidth, stone.highlight);
      ctx.fillStyle = stone.wallInset;
      ctx.fillRect(x, top + offset + stone.highlight, stone.wallBevel, blockHeight - stone.highlight);
    }
    for (const position of stone.medallionPositions) {
      medallion(ctx, x + stone.wallWidth / 2, top + height * position, stone);
    }
    edgeRoots(ctx, x, top, height, stone);
  }

  function medallion(ctx, x, y, stone) {
    for (const [radiusX, radiusY, colour] of stone.medallionLayers) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = stone.amber;
    ctx.beginPath();
    ctx.moveTo(x, y - stone.gemHeight);
    ctx.lineTo(x + stone.gemWidth, y);
    ctx.lineTo(x, y + stone.gemHeight);
    ctx.lineTo(x - stone.gemWidth, y);
    ctx.closePath();
    ctx.fill();
  }

  function edgeRoots(ctx, x, top, height, stone) {
    ctx.save();
    ctx.strokeStyle = stone.rootColour;
    ctx.lineWidth = stone.rootWidth;
    ctx.lineCap = 'round';
    for (const position of stone.rootPositions) {
      const center = top + height * position;
      for (const path of stone.rootPaths) {
        ctx.beginPath();
        ctx.moveTo(x + path[0] * stone.wallWidth, center + path[1]);
        ctx.bezierCurveTo(x + path[2] * stone.wallWidth, center + path[3],
          x + path[4] * stone.wallWidth, center + path[5], x + path[6] * stone.wallWidth, center + path[7]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function frame(ctx, name, index, x, y, size) {
    const image = available(name);
    if (!image || image.naturalWidth !== image.naturalHeight * metrics.frames) return false;
    const cell = image.naturalHeight;
    const selected = Math.max(0, Math.min(metrics.frames - 1, Math.floor(index)));
    ctx.drawImage(image, selected * cell, 0, cell, cell, x - size / 2, y - size / 2, size, size);
    return true;
  }

  function horn(ctx, definition, broken, radius, length, stump) {
    const name = broken ? 'boss-horn-stub' : 'boss-horn-' + definition.id;
    if (!available(name)) return false;
    const reach = length * (broken ? stump : 1);
    const center = radius * metrics.hornBase + reach / 2;
    const sourceAngle = definition.id === 'left' ? metrics.leftHornAngle : metrics.rightHornAngle;
    ctx.save();
    ctx.translate(Math.cos(definition.angle) * center, Math.sin(definition.angle) * center);
    ctx.rotate(definition.angle - (broken ? -Math.PI / 2 : sourceAngle));
    paint(ctx, name, 0, 0, reach * metrics.hornWidth, reach * metrics.hornHeight);
    ctx.restore();
    return true;
  }

  function shield(ctx, shieldState, enemy, radius) {
    const name = shieldState.cracks ? 'boss-shield-cracked' : 'boss-shield';
    if (!available(name)) return false;
    ctx.save();
    ctx.globalAlpha *= shieldState.up;
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(shieldState.angle + metrics.shieldRotation);
    paint(ctx, name, radius / 2, -radius / 2, radius, radius, true);
    ctx.restore();
    return true;
  }

  function bar(ctx, name, box) {
    if (window.LoftRumbleBattleMaterials) return window.LoftRumbleBattleMaterials.bezel(ctx, name, box);
    ctx.save();
    ctx.strokeStyle = arena.metal;
    ctx.lineWidth = arena.edgeWidth;
    ctx.strokeRect(box.x - arena.edgeWidth, box.y - arena.edgeWidth,
      box.w + arena.edgeWidth * 2, box.h + arena.edgeWidth * 2);
    ctx.restore();
    return true;
  }

  function bumper(ctx, skin, position, radius, hit) {
    if (window.LoftRumbleBattleMaterials) return window.LoftRumbleBattleMaterials.bumper(ctx, skin, position, radius, hit);
    const impact = Math.max(0, Math.min(1, hit));
    const coreRadius = radius * (1 - impact * arena.compression);
    const disc = (size, fill, offset = 0, across = 0) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(position.x + across, position.y + offset, size, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.save();
    disc(radius * arena.rimSize, arena.rim, arena.shadowOffset);
    disc(radius, arena.stoneRim);
    disc(coreRadius * arena.bevelSize, arena.stoneBevel);
    disc(coreRadius * arena.amberSize, impact > 0 ? arena.glint : arena.amber);
    disc(coreRadius * arena.glintSize, arena.glint, coreRadius * arena.glintOffset, coreRadius * arena.glintOffset);
    if (impact > 0) {
      ctx.globalAlpha *= impact;
      ctx.strokeStyle = arena.bevel;
      ctx.lineWidth = arena.pulseWidth;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius * (arena.rimSize + (1 - impact) * arena.pulseGrowth), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  function beam(ctx, effect, feel, length) {
    if (effect.t < feel.windup) return;
    const after = effect.t - feel.windup - feel.travel;
    if (after >= feel.beamFade) return;
    const travel = Math.min(1, (effect.t - feel.windup) / feel.travel);
    const fade = after < 0 ? 1 : 1 - after / feel.beamFade;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.rotate(-Math.PI / 2);
    paint(ctx, 'fx-beam-strip', 0, 0, feel.beamHalf * 2 * fade, length * 2 * travel, true);
    ctx.restore();
  }

  function panel(ctx, x, y, width, height, fill) {
    if (window.LoftRumbleBattleMaterials) return window.LoftRumbleBattleMaterials.panel(ctx, x - width / 2, y - height / 2, width, height, false, fill);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = arena.metal;
    ctx.lineWidth = arena.edgeWidth;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, arena.panelRadius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function effects(ctx, state, constants, feel, enemy, calm) {
    ctx.save();
    for (const ring of state.rings) {
      const age = 1 - ring.life / (ring.max ?? constants.ringLife);
      const name = ring.colour === 'perfect' ? 'fx-perfect-burst'
        : ring.colour === 'warning' && ring.big ? 'fx-special-ring' : null;
      if (!name) continue;
      ctx.globalAlpha = 1 - age;
      const size = metrics.effectSize * (calm ? 1 : metrics.pulseStart + age * metrics.pulseGrowth);
      paint(ctx, name, ring.x, ring.y, size);
    }
    if (state.enemyFlash > 0) {
      const age = 1 - state.enemyFlash / feel.enemyFlash;
      ctx.globalAlpha = 1;
      const index = calm ? 1 : Math.floor(age * metrics.frames);
      if (!frame(ctx, 'fx-hit-spark-sheet', index, enemy.x, enemy.y, metrics.hitSize)) {
        paint(ctx, 'fx-hit-spark', enemy.x, enemy.y, metrics.hitSize);
      }
    }
    if (state.shield.down > feel.shieldReform - feel.shieldFade) {
      ctx.globalAlpha = (state.shield.down - feel.shieldReform + feel.shieldFade) / feel.shieldFade;
      paint(ctx, 'fx-shield-shatter', enemy.x, enemy.y, metrics.effectSize);
    }
    if (state.teamFlash === 'heal' && state.teamBarHit > 0) {
      ctx.globalAlpha = state.teamBarHit / feel.barFlash;
      const position = state.heart ?? { x: state.w / 2, y: state.h - constants.hudBottom - metrics.effectSize / 2 };
      paint(ctx, 'fx-heal', position.x, position.y, metrics.effectSize);
    }
    ctx.restore();
  }

  window.LoftRumbleArt = Object.freeze({ available, ready, metrics, paint, frame, horn, shield, bar, bumper, beam, panel, effects });
})();
