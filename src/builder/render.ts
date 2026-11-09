import { CATALOG, SURPRISE, type CatalogOption } from './catalog-data.ts';
import { COPY } from './copy.ts';
import type { BuilderState } from './controller.ts';
import type { SelectionField } from './selections.ts';
import { imageSource } from './image-source.ts';

export const element = <T extends HTMLElement>(id: string) => {
  const found = document.getElementById(id);
  if (!found) throw new Error('Missing builder element: ' + id);
  return found as T;
};

export const fields: SelectionField[] = ['creature', 'personality', 'signatureDetail', 'palette'];

export function prepareForm(copy = COPY) {
  document.title = copy.title + ' · Loftio';
  element('preview').parentElement?.setAttribute('aria-label', copy.preview);
  document.querySelectorAll<HTMLElement>('[data-copy]').forEach(target => {
    const value = copy[target.dataset.copy as keyof typeof copy];
    if (typeof value === 'string') target.textContent = value;
  });
  const groups: Record<SelectionField, readonly CatalogOption[]> = {
    creature: CATALOG.creatures, personality: CATALOG.personalities,
    signatureDetail: CATALOG.signatureDetails, palette: CATALOG.palettes,
  };
  for (const field of fields) {
    const select = element<HTMLSelectElement>(field);
    const automatic = field === 'palette' ? new Option(copy.choosePalette, '') : new Option(copy.surprise, SURPRISE);
    select.replaceChildren(automatic, ...groups[field].map(option => new Option(option.label, option.id)));
  }
}

const describe = (resolved: BuilderState['kept'][number]['resolvedSelections']) =>
  [resolved.creature.label, resolved.personality.label, resolved.signatureDetail.label, resolved.palette.label].join(' · ');

function renderGallery(state: BuilderState, copy: typeof COPY) {
  element('gallery-empty').hidden = state.kept.length > 0;
  element('gallery').replaceChildren(...state.kept.map(resident => {
    const item = document.createElement('li');
    const image = document.createElement('img');
    image.src = imageSource(resident.image);
    image.alt = copy.previewAlt;
    const label = document.createElement('p');
    label.textContent = describe(resident.resolvedSelections);
    item.append(image, label);
    return item;
  }));
}

function renderPreview(state: BuilderState, copy: typeof COPY) {
  const preview = state.preview;
  const image = element<HTMLImageElement>('preview-image');
  image.hidden = !preview;
  element('preview-empty').hidden = !!preview;
  element('reveal-actions').hidden = !preview;
  if (preview) {
    const source = imageSource(preview.image);
    if (image.getAttribute('src') !== source) image.src = source;
    image.alt = copy.previewAlt;
    element('resolved').textContent = describe(preview.generation.resolvedSelections);
    const verdict = preview.check.verdict;
    element('image-check').textContent = [verdict === 'transparent' ? copy.transparent
      : verdict === 'checkerboard-suspect' ? copy.checkerboard : verdict === 'empty' ? copy.margins : copy.opaque,
    preview.check.marginOk === false ? copy.margins : ''].filter(Boolean).join(' · ');
  }
}

export function render(state: BuilderState, copy = COPY) {
  const busy = state.status === 'generating';
  element<HTMLFieldSetElement>('selections').disabled = busy || state.saving;
  for (const field of fields) element<HTMLSelectElement>(field).value = state.selections[field] ?? '';
  element<HTMLButtonElement>('create').disabled = busy || state.saving;
  element('create').classList.toggle('primary', !state.preview);
  element('create').textContent = busy ? copy.generating : copy.create;
  element('cancel').hidden = !busy;
  element<HTMLButtonElement>('keep').disabled = busy || state.saving || state.previewKept;
  element('keep').textContent = state.saving ? copy.saving : state.previewKept ? copy.kept : copy.keep;
  element<HTMLButtonElement>('another').disabled = busy || state.saving;
  element('preview').setAttribute('aria-busy', String(busy));
  element('status').textContent = busy ? state.stage === 'preparing' ? copy.preparing : copy.generating : state.previewKept ? copy.kept : state.status === 'ready' ? copy.revealed : '';
  element('error').hidden = !state.error;
  element('error').textContent = state.error?.message ?? '';
  element('usage').textContent = state.usage ? copy.usage(state.usage.used, state.usage.cap) : '';
  renderPreview(state, copy);
  renderGallery(state, copy);
}
