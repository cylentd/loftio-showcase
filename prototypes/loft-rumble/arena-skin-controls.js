(() => {
  const config = window.LoftRumbleArenaSkins;
  const menu = document.getElementById('menu');
  if (!config || !menu || !window.LoftRumbleArt) return;
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem(config.storageKey); } catch {}
  root.dataset.arenaSkin = config.options.some(option => option.id === saved) ? saved : config.defaultId;
  const label = document.createElement('label');
  label.className = 'arena-skin-control';
  label.htmlFor = 'arena-skin';
  const caption = document.createElement('span');
  caption.textContent = config.label;
  const select = document.createElement('select');
  select.id = 'arena-skin';
  for (const skin of config.options) {
    const option = document.createElement('option');
    option.value = skin.id;
    option.textContent = skin.label;
    select.append(option);
  }
  select.value = root.dataset.arenaSkin;
  select.addEventListener('change', () => {
    if (!config.options.some(option => option.id === select.value)) return;
    root.dataset.arenaSkin = select.value;
    try { localStorage.setItem(config.storageKey, select.value); } catch {}
    window.dispatchEvent(new Event(config.changeEvent));
  });
  label.append(caption, select);
  menu.prepend(label);
})();
