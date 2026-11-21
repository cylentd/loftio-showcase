(() => {
  const data = window.LoftRumbleHeroCardData;
  if (!data) return;
  const namespace = 'http://www.w3.org/2000/svg';

  function glyph(paths) {
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', data.viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', data.strokeWidth);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const pathData of paths) {
      const path = document.createElementNS(namespace, 'path');
      path.setAttribute('d', pathData);
      svg.append(path);
    }
    return svg;
  }

  function traitChip(card, view) {
    const existing = card.querySelector('.trait-chip');
    if (existing?.dataset.trait === view.trait) return;
    const chip = document.createElement('span');
    chip.className = 'trait-chip';
    chip.dataset.trait = view.trait;
    chip.title = view.description;
    const label = document.createElement('span');
    label.className = 'trait-label';
    label.textContent = view.traitLabel;
    chip.append(glyph(data.icons[view.trait]), label);
    card.querySelector('em').replaceChildren(chip);
  }

  function update(card, view) {
    card.dataset.motion = view.motion;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', view.accessibleLabel);
    traitChip(card, view);
    card.title = view.traitLabel + ': ' + view.description;
    const status = card.querySelector('small');
    status.title = view.stateLabel;
    if (view.motion !== 'available') status.append(glyph(data.icons[view.motion]));
    card.querySelector('.badge').append(glyph(data.icons.special));
    if (!document.documentElement.hasAttribute('data-rumble-demo')) return;
    if (!card.querySelector('.dock-meter')) {
      const meter = document.createElement('div');
      meter.className = 'dock-meter';
      meter.setAttribute('role', 'progressbar');
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(data.dock.percent));
      const charge = document.createElement('span');
      charge.className = 'dock-charge';
      const danger = document.createElement('span');
      danger.className = 'dock-danger';
      danger.textContent = data.dock.danger;
      card.append(meter, charge, danger);
    }
    card.querySelector('.dock-meter').setAttribute('aria-label', view.name + ' special charge');
    charge(card, view.specialCharge);
    if (view.motion === 'stunned') status.textContent = data.dock.stunned + ' ' + view.stunRemaining.toFixed(1) + data.dock.seconds;
  }

  // The card's width over height, read once per card size: a read after the frame's style writes forces a layout.
  const aspects = new WeakMap();
  const sized = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => { for (const entry of entries) aspects.delete(entry.target); }) : null;
  function aspect(card) {
    if (aspects.has(card)) return aspects.get(card);
    const value = card.clientHeight > 0 ? card.clientWidth / card.clientHeight : data.dock.cardAspect;
    if (sized) { aspects.set(card, value); sized.observe(card); }
    return value;
  }

  // A charge-only change: the meter and its readout (the page sets the card's --charge). No glyph or label is rebuilt.
  function charge(card, specialCharge) {
    const meter = card.querySelector('.dock-meter');
    if (!meter) return;
    const percent = Math.round(specialCharge * data.dock.percent);
    meter.setAttribute('aria-valuenow', String(percent));
    card.querySelector('.dock-charge').textContent = percent === data.dock.percent
      ? data.dock.special : data.dock.special + ' ' + percent + '%';
    meter.title = percent === data.dock.percent ? data.dock.ready : data.dock.special + ' ' + percent + '%';
    // The border lights clockwise from the rune socket as the special charges (owner direction, 2026-11-15): the ready
    // frame shows through a conic mask up to this angle, placed so the lit front moves at one speed round the card.
    const sweep = window.LoftRumbleHudModel?.chargeSweep(specialCharge, aspect(card));
    if (sweep !== undefined) meter.style.setProperty('--sweep', sweep + 'deg');
  }

  window.LoftRumbleHeroCards = Object.freeze({ update, charge });
})();
