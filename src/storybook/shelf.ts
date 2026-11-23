import type { RoomLayout } from '../room-layout';
import shelfCover from './shelf-cover.webp';
import { SHELF } from './constants';
import { STORYBOOK_COPY } from './copy';

export function storybookTrigger(onOpen: (cover: HTMLImageElement) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'storybook-shelf';
  button.dataset.label = STORYBOOK_COPY.title;
  button.setAttribute('aria-label', STORYBOOK_COPY.title);
  const cover = document.createElement('img');
  cover.className = 'storybook-shelf-cover';
  cover.src = shelfCover;
  cover.alt = '';
  cover.draggable = false;
  const label = document.createElement('span');
  label.className = 'storybook-shelf-label';
  label.textContent = STORYBOOK_COPY.title;
  label.setAttribute('aria-hidden', 'true');
  button.append(cover, label);
  button.addEventListener('click', () => { delete button.dataset.introduce; onOpen(cover); });
  return button;
}

type Camera = { scale: number; x: number; y: number; offsetY: number };

export function placeShelf(button: HTMLElement, room: RoomLayout, camera: Camera): void {
  const anchor = SHELF[room];
  const place = (key: string, value: number) => {
    const pixels = `${value}px`;
    if (button.style.getPropertyValue(key) !== pixels) button.style.setProperty(key, pixels);
  };
  place('--sb-shelf-x', (anchor.x - camera.x) * camera.scale);
  place('--sb-shelf-y', camera.offsetY + (anchor.y - camera.y) * camera.scale);
  place('--sb-shelf-width', anchor.width * camera.scale);
}

export function introduceShelf(button: HTMLElement): void {
  try {
    if (localStorage.getItem(SHELF.cueKey)) return;
    localStorage.setItem(SHELF.cueKey, '1');
  } catch { /* The control still works without storage. */ }
  button.dataset.introduce = '';
}
