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
    const status = card.querySelector('small');
    status.title = view.stateLabel;
    if (view.motion !== 'available') status.append(glyph(data.icons[view.motion]));
    card.querySelector('.badge').append(glyph(data.icons.special));
  }

  window.LoftRumbleHeroCards = Object.freeze({ update });
})();
