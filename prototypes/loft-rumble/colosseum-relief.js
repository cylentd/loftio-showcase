(() => {
  function polygon(ctx, points, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }

  function gradient(ctx, x, y, endX, endY, first, last) {
    const shade = ctx.createLinearGradient(x, y, endX, endY);
    shade.addColorStop(0, first);
    shade.addColorStop(1, last);
    return shade;
  }

  function floor(ctx, left, top, width, height, stone) {
    const relief = stone.relief;
    if (!relief) return;
    const x = left + stone.inset, span = width - stone.inset * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, span, height);
    ctx.clip();
    ctx.fillStyle = relief.mortar;
    ctx.fillRect(x, top, span, height);
    for (let row = 0; row < relief.courses.length - 1; row++) {
      const y = top + height * relief.courses[row];
      const depth = height * (relief.courses[row + 1] - relief.courses[row]);
      const seams = relief.seams[row % relief.seams.length];
      for (let column = 0; column < seams.length - 1; column++) {
        flagstone(ctx, x + span * seams[column], y, span * (seams[column + 1] - seams[column]),
          depth, row, column, relief);
      }
    }
    ctx.fillStyle = gradient(ctx, x, top, x + span, top + height, relief.lightWash, relief.shadeWash);
    ctx.fillRect(x, top, span, height);
    recess(ctx, x, top, relief.recessWidth, height, relief, false);
    recess(ctx, x + span - relief.recessWidth, top, relief.recessWidth, height, relief, true);
    ctx.restore();
  }

  function flagstone(ctx, x, y, width, height, row, column, relief) {
    const gap = relief.seamWidth, cut = relief.cut;
    const shift = (row + column) % 2 === 0 ? relief.cornerShift : -relief.cornerShift;
    const right = x + width - gap, bottom = y + height - gap;
    const points = [[x + cut, y + gap], [right - cut, y + gap + shift], [right, y + cut],
      [right - gap, bottom - cut], [right - cut, bottom], [x + cut, bottom - shift], [x + gap, bottom - cut], [x + gap, y + cut]];
    polygon(ctx, points, relief.slabs[(row + column) % relief.slabs.length]);
    polygon(ctx, points, gradient(ctx, x, y, right, bottom, relief.surfaceLight, relief.surfaceShade));
    for (const [across, down, span, depth] of relief.brushPatches) {
      const brushX = x + width * across, brushY = y + height * down;
      polygon(ctx, [[brushX, brushY], [brushX + width * span, brushY - relief.cut],
        [brushX + width * span - relief.cut, brushY + height * depth], [brushX, brushY + height * depth]],
      (row + column) % 2 === 0 ? relief.brushLight : relief.brushShade);
    }
    ctx.strokeStyle = relief.surfaceLight;
    ctx.lineWidth = gap;
    ctx.beginPath();
    ctx.moveTo(x + cut, y + gap);
    ctx.lineTo(right - cut, y + gap + shift);
    ctx.stroke();
    if ((row + column) % relief.slabs.length !== 0) return;
    ctx.strokeStyle = relief.crack;
    ctx.beginPath();
    ctx.moveTo(right - cut, bottom);
    ctx.lineTo(right - cut * 2, bottom - cut * 2);
    ctx.lineTo(right - cut, bottom - cut * 3);
    ctx.stroke();
  }

  function recess(ctx, x, y, width, height, relief, reverse) {
    ctx.fillStyle = gradient(ctx, x, y, x + width, y,
      reverse ? relief.clear : relief.recess, reverse ? relief.recess : relief.clear);
    ctx.fillRect(x, y, width, height);
  }

  function border(ctx, left, top, width, height, stone) {
    const relief = stone.relief;
    if (!relief) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();
    for (const direction of [1, -1]) {
      const edge = direction === 1 ? left : left + width;
      const x = direction === 1 ? edge + relief.edgeInset : edge - relief.edgeInset - relief.edgeWidth;
      ctx.fillStyle = gradient(ctx, x, top, x + relief.edgeWidth, top,
        direction === 1 ? relief.capShade : relief.face, direction === 1 ? relief.face : relief.capShade);
      ctx.fillRect(x, top, relief.edgeWidth, height);
      const blocks = direction === 1 ? relief.blocks : relief.rightBlocks;
      for (const [position, span, depth] of blocks) {
        brokenColumn(ctx, edge, top + height * position, direction, span, depth, relief);
      }
    }
    ctx.restore();
  }

  function brokenColumn(ctx, edge, y, direction, width, height, relief) {
    const outer = edge + direction * relief.blockInset;
    const inner = edge + direction * width;
    const cut = relief.capCut, depth = relief.ledgeDepth;
    const minX = Math.min(outer, inner), span = Math.abs(inner - outer);
    const cast = relief.castOffset;
    polygon(ctx, [[outer, y + depth], [inner, y + cut], [inner + cast, y + height + cast + depth],
      [outer + cast, y + height + cast + depth]],
    gradient(ctx, minX, y, minX + span + cast, y + height + cast, relief.recess, relief.clear));
    polygon(ctx, [[outer, y + depth], [inner, y + depth], [inner, y + height + depth],
      [outer, y + height + depth]], relief.face);
    polygon(ctx, [[outer, y], [inner - direction * cut, y], [inner, y + cut],
      [inner, y + height - cut], [inner - direction * cut, y + height],
      [outer, y + height]], gradient(ctx, minX, y, minX + span, y + height, relief.capLight, relief.cap));
    polygon(ctx, [[outer, y], [inner - direction * cut, y], [inner, y + cut],
      [outer, y + cut]], relief.capLight);
    polygon(ctx, [[inner - direction * cut, y + cut], [inner, y + cut],
      [inner, y + height - cut], [inner - direction * cut, y + height]], relief.capShade);
    ctx.fillStyle = relief.grooveShade;
    ctx.fillRect(minX + relief.columnGroove, y + depth, relief.seamWidth, height - depth);
    ctx.fillRect(minX + span / 2, y + depth, relief.seamWidth, height - depth);
    polygon(ctx, [[inner - direction * cut, y + height], [inner, y + height - cut],
      [inner - direction * depth, y + height - cut]], relief.chip);
  }

  function ground(ctx, x, y, radius, skinId) {
    const skins = window.LoftRumbleArenaSkins;
    const skin = skins?.options.find(option => option.id === skinId)
      ?? skins?.options.find(option => option.id === skins.defaultId);
    const contact = skin?.masonry.relief?.contact;
    if (!contact) return false;
    ctx.save();
    for (const [scale, colour] of [[contact.softScale, contact.soft], [1, contact.core]]) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.ellipse(x + radius * contact.offsetX, y + radius * contact.offsetY,
        radius * contact.width * scale, radius * contact.depth * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }

  window.LoftRumbleColosseumRelief = Object.freeze({ floor, border, ground });
})();
