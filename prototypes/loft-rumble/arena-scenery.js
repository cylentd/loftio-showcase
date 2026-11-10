(() => {
  function paint(ctx, name, x, top, height, stone, side) {
    if (name !== 'cloudpeak' && name !== 'moonroot') return false;
    ctx.save();
    ctx.beginPath();
    const overhang = name === 'cloudpeak' ? stone.cloudOverhang : 0;
    ctx.rect(x - (side === 'right' ? overhang : 0), top, stone.wallWidth + stone.wallBevel + overhang, height);
    ctx.clip();
    if (name === 'cloudpeak') cloudpeak(ctx, x, top, height, stone, side);
    else moonroot(ctx, x, top, height, stone);
    ctx.restore();
    return true;
  }

  function cloudpeak(ctx, x, top, height, stone, side) {
    ctx.fillStyle = stone.sky;
    ctx.fillRect(x, top, stone.wallWidth + stone.wallBevel, height);
    for (const position of stone.cloudPositions) {
      const center = top + height * position;
      for (const [offset, colour] of [[0, stone.cloudShade], [-stone.cloudOffset, stone.cloud]]) {
        ctx.fillStyle = colour;
        for (const [across, down, scale] of stone.cloudPuffs) {
          const anchor = side === 'left' ? x + stone.wallWidth / 2 : x + stone.wallWidth / 2 - stone.cloudOverhang;
          ctx.beginPath();
          ctx.ellipse(anchor + across, center + offset + down, stone.cloudRadius * scale, stone.cloudHeight * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const inward = side === 'left' ? x + stone.wallWidth - stone.parapetWidth : x;
    ctx.fillStyle = stone.parapet;
    ctx.fillRect(inward, top, stone.parapetWidth, height);
    for (const position of stone.breakPositions) {
      ctx.fillStyle = stone.sky;
      ctx.fillRect(inward, top + height * position, stone.parapetWidth, stone.breakHeight);
    }
    for (const position of stone.pillarPositions) {
      ctx.fillStyle = stone.parapetLight;
      ctx.fillRect(inward - stone.poleWidth, top + height * position, stone.pillarWidth, stone.pillarHeight);
    }
    pennant(ctx, x + stone.wallWidth / 2, top + height * stone.pennantPosition, stone);
  }

  function pennant(ctx, x, y, stone) {
    ctx.fillStyle = stone.pole;
    ctx.fillRect(x, y, stone.poleWidth, stone.poleHeight);
    ctx.fillStyle = stone.pennant;
    ctx.beginPath();
    ctx.moveTo(x + stone.poleWidth, y);
    ctx.lineTo(x + stone.pennantWidth, y + stone.pennantHeight / 2);
    ctx.lineTo(x + stone.poleWidth, y + stone.pennantHeight);
    ctx.closePath();
    ctx.fill();
  }

  function moonroot(ctx, x, top, height, stone) {
    ctx.fillStyle = stone.cave;
    ctx.fillRect(x, top, stone.wallWidth + stone.wallBevel, height);
    ctx.fillStyle = stone.rock;
    for (const position of stone.mushroomPositions) {
      ctx.beginPath();
      ctx.ellipse(x + stone.wallWidth / 2, top + height * position, stone.wallWidth / 2, stone.wallStep, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [lineWidth, colour] of [[stone.rootWidth, stone.rootColour], [stone.rootHighlight, stone.rootLight]]) {
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x + stone.rootAcross * stone.wallWidth, top + height * stone.rootStart);
      ctx.bezierCurveTo(x + stone.rootControl[0] * stone.wallWidth, top + height * stone.rootControl[1],
        x + stone.rootControl[2] * stone.wallWidth, top + height * stone.rootControl[3],
        x + stone.rootAcross * stone.wallWidth, top + height * stone.rootEnd);
      ctx.stroke();
    }
    for (const position of stone.mushroomPositions) {
      const center = top + height * position;
      mushroom(ctx, x + stone.wallWidth / 2, center, stone.mushroomRadius, stone);
      mushroom(ctx, x + stone.wallWidth / 2 + stone.mushroomOffset, center + stone.mushroomOffset, stone.mushroomSmall, stone);
    }
    stone.crystalPositions.forEach((position, index) => {
      for (const [across, down, scale] of stone.crystalPrisms) {
        crystal(ctx, x + stone.wallWidth / 2 + across, top + height * position + down,
          stone.crystalWidth * scale, stone.crystalHeight * scale, stone.crystalColours[index], stone);
      }
    });
  }

  function crystal(ctx, x, y, width, height, colour, stone) {
    ctx.shadowColor = stone.crystalGlow;
    ctx.shadowBlur = stone.crystalBlur;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + width, y - height / 2);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x - width, y);
    ctx.lineTo(x - width, y - height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = stone.crystalFacet;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x, y);
    ctx.lineTo(x - width, y - height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = stone.crystalShade;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y - height / 2);
    ctx.closePath();
    ctx.fill();
  }

  function mushroom(ctx, x, y, radius, stone) {
    ctx.fillStyle = stone.mushroomStem;
    ctx.fillRect(x - stone.stemWidth / 2, y, stone.stemWidth, stone.stemHeight);
    ctx.fillStyle = stone.mushroomCap;
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = stone.mushroomDot;
    ctx.beginPath();
    ctx.arc(x - stone.stemWidth, y - stone.stemWidth, stone.highlight, 0, Math.PI * 2);
    ctx.fill();
  }

  function overlays(ctx, name, left, top, width, height, stone) {
    if (name !== 'colosseum') return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();
    for (const direction of [1, -1]) {
      const edge = direction === 1 ? left : left + width;
      for (const position of direction === 1 ? stone.vinePositions : stone.rightVinePositions) {
        vine(ctx, edge + direction * stone.vineInset, top + height * position,
          direction * stone.vineReach, stone.vineLength, stone);
      }
      for (const position of stone.creeperPositions) {
        vine(ctx, edge + direction * stone.wallWidth, top + height * position,
          direction * stone.creeperReach, stone.creeperLength, stone);
      }
    }
    ctx.restore();
  }

  function vine(ctx, x, y, reach, length, stone) {
    ctx.strokeStyle = stone.vine;
    ctx.lineWidth = stone.vineStroke;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + reach, y + length / 2, x + reach, y + length);
    ctx.stroke();
    for (let index = 0; index < stone.leafCount; index++) {
      const progress = index / stone.leafCount;
      const leafX = x + reach * (2 * progress - progress * progress);
      const leafY = y + length * progress;
      const facing = index % 2 === 0 ? 1 : -1;
      const size = stone.leafScales[index];
      const tipX = leafX + facing * stone.leafLength * size;
      const tipY = leafY - stone.leafLength * size;
      ctx.fillStyle = index % 2 === 0 ? stone.leaf : stone.leafLight;
      ctx.beginPath();
      ctx.moveTo(leafX, leafY);
      ctx.quadraticCurveTo(leafX + facing * stone.leafLength, leafY - stone.leafWidth,
        tipX, tipY);
      ctx.quadraticCurveTo(leafX, tipY, leafX, leafY);
      ctx.fill();
      ctx.strokeStyle = stone.leafShade;
      ctx.lineWidth = stone.highlight;
      ctx.beginPath();
      ctx.moveTo(leafX, leafY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  }

  window.LoftRumbleArenaScenery = Object.freeze({ paint, overlays });
})();
