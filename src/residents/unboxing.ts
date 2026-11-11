import { worldButton } from '../world-ui';
import { RESIDENT_COPY as COPY } from './copy';
import { revealVideo, type VideoPhase } from './unboxing-video';
import { vibrate } from '../tactile';
import './unboxing-video.css';

export function unboxing(source: string, alt: string, reduced: boolean, onOpen: (immediate: boolean) => void, audioEnabled: () => boolean, onPhase?: (phase: VideoPhase) => void, handoff?: () => Promise<void>) {
  const still = reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.createElement('div'); stage.className = 'unboxing-stage unboxing-video-stage';
  stage.dataset.phase = 'ready'; stage.dataset.reduced = String(still);
  const video = document.createElement('video'); video.className = 'unboxing-video';
  video.src = import.meta.env.BASE_URL + 'brand/box-reveal.mp4';
  video.poster = import.meta.env.BASE_URL + 'brand/box-reveal-poster.webp';
  video.preload = 'none'; video.playsInline = true; video.muted = !audioEnabled();
  video.setAttribute('aria-label', COPY.boxVideo);
  const backdrop = new Image(); backdrop.src = video.poster; backdrop.alt = ''; backdrop.className = 'unboxing-video-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img'); image.className = 'unboxing-resident';
  image.src = source; image.alt = alt; image.hidden = true; image.draggable = false;
  const notice = document.createElement('p'); notice.className = 'unboxing-video-notice';
  notice.setAttribute('role', 'status');
  let immediate = still;
  const update = (phase: VideoPhase) => {
    stage.dataset.phase = phase;
    stage.setAttribute('aria-busy', String(phase === 'loading' || phase === 'playing'));
    opener.hidden = phase === 'loading' || phase === 'playing' || phase === 'revealed' || phase === 'closed';
    notice.textContent = phase === 'retry' ? COPY.boxVideoFailure : phase === 'loading' ? COPY.boxVideoLoading : '';
    label.textContent = phase === 'retry' ? COPY.boxVideoRetry : COPY.reveal;
    if (phase === 'revealed') {
      if (!immediate) vibrate('reveal', still);
      else vibrate('cancel', false);
      video.hidden = true; image.hidden = false; skip.hidden = true;
      if (stage.isConnected) onOpen(immediate);
    }
    if (phase === 'retry') opener.focus({ preventScroll: true });
    if (phase === 'loading') skip.focus({ preventScroll: true });
    onPhase?.(phase);
  };
  const playback = revealVideo(video, audioEnabled, update, handoff);
  const open = (skipVideo = false) => {
    immediate = still || skipVideo;
    if (immediate) playback.skip(); else { vibrate('open', still); playback.play(); }
  };
  const opener = worldButton('', () => open()); opener.className = 'unboxing-open unboxing-video-open';
  const label = document.createElement('span'); label.className = 'world-button world-primary'; label.textContent = COPY.reveal;
  opener.append(label);
  const skip = worldButton(COPY.skip, () => open(true)); skip.classList.add('unboxing-skip');
  stage.append(backdrop, video, image, opener, notice);
  return { stage, opener, skip, open, mute: playback.mute, dispose: () => { vibrate('cancel', false); playback.dispose(); } };
}
