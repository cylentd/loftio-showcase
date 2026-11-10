(() => {
  const config = window.LoftRumbleStageLayoutData;
  const menu = document.getElementById('menu');
  if (!config || !menu) return;
  let saved;
  try { saved = localStorage.getItem(config.storageKey); } catch {}
  let selected = config.options.find(option => option.id === saved)
    ?? config.options.find(option => option.id === config.defaultId);
  const root = document.documentElement;
  const label = document.createElement('label');
  label.className = 'arena-skin-control';
  label.htmlFor = 'stage-layout';
  const caption = document.createElement('span');
  caption.textContent = config.label;
  const select = document.createElement('select');
  select.id = 'stage-layout';
  select.setAttribute('aria-describedby', 'stage-layout-note');
  for (const stage of config.options) {
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = stage.label;
    select.append(option);
  }
  const note = document.createElement('small');
  note.id = 'stage-layout-note';
  note.textContent = config.note;
  const status = document.createElement('span');
  status.id = 'stage-label';
  document.querySelector('.battle-status').prepend(status);

  function render() {
    root.dataset.stageLayout = selected.id;
    select.value = selected.id;
    status.textContent = selected.shortLabel;
  }

  select.addEventListener('change', () => {
    const next = config.options.find(option => option.id === select.value);
    if (!next || next.id === selected.id) return;
    selected = next;
    render();
    try { localStorage.setItem(config.storageKey, selected.id); } catch {}
    window.dispatchEvent(new Event(config.changeEvent));
  });
  label.append(caption, select, note);
  menu.prepend(label);
  render();
  window.LoftRumbleStageLayouts = Object.freeze({
    current: () => selected,
    changeEvent: config.changeEvent
  });
})();
