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
    const percent = Math.round(view.specialCharge * data.dock.percent);
    const meter = card.querySelector('.dock-meter');
    meter.setAttribute('aria-label', view.name + ' special charge');
    meter.setAttribute('aria-valuenow', String(percent));
    card.querySelector('.dock-charge').textContent = percent === data.dock.percent
      ? data.dock.special : data.dock.special + ' ' + percent + '%';
    meter.title = percent === data.dock.percent ? data.dock.ready : data.dock.special + ' ' + percent + '%';
    if (view.motion === 'stunned') status.textContent = data.dock.stunned + ' ' + view.stunRemaining.toFixed(1) + data.dock.seconds;
  }

  window.LoftRumbleHeroCards = Object.freeze({ update });
})();
