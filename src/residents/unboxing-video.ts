export type VideoPhase = 'ready' | 'loading' | 'playing' | 'retry' | 'revealed' | 'closed';
export function revealVideo(video: HTMLVideoElement, enabled: () => boolean, changed: (phase: VideoPhase) => void, handoff?: () => Promise<void>) {
  let phase: VideoPhase = 'ready', attempt = 0;
  let frame: number | undefined;
  let holding = false;
  const cancelFrame = () => {
    if (frame !== undefined) video.cancelVideoFrameCallback(frame);
    frame = undefined;
  };
  const set = (next: VideoPhase) => { phase = next; changed(next); };
  const presented = () => {
    if (phase !== 'loading' || holding) return;
    if (!handoff) { set('playing'); return; }
    const current = attempt; holding = true; video.pause();
    void handoff().then(() => {
      if (attempt !== current || phase !== 'loading') return;
      video.muted = !enabled(); set('playing');
      return video.play();
    }).catch(() => { if (attempt === current) failed(); });
  };
  const finish = () => {
    if (phase === 'closed' || phase === 'revealed') return;
    attempt += 1; cancelFrame(); video.pause(); set('revealed');
  };
  const ended = () => { if (phase === 'playing' || phase === 'loading') finish(); };
  const playing = () => {
    if (!video.requestVideoFrameCallback && phase === 'loading' && video.readyState >= video.HAVE_CURRENT_DATA) presented();
  };
  const failed = () => {
    if (phase !== 'playing' && phase !== 'loading') return;
    attempt += 1; cancelFrame(); video.pause(); set('retry');
  };
  video.addEventListener('ended', ended);
  video.addEventListener('error', failed);
  video.addEventListener('playing', playing);
  return {
    play() {
      if (phase !== 'ready' && phase !== 'retry') return;
      const retry = phase === 'retry', current = ++attempt;
      holding = false; video.muted = !!handoff || !enabled(); set('loading');
      try {
        if (retry) video.load();
        if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(() => {
          if (attempt !== current || phase !== 'loading') return;
          frame = undefined; presented();
        });
        void video.play().catch(error => {
          if (attempt === current && !(holding && error?.name === 'AbortError')) failed();
        });
      } catch { if (attempt === current) failed(); }
    },
    skip: finish,
    mute() { video.muted = true; },
    dispose() {
      if (phase === 'closed') return;
      attempt += 1; cancelFrame(); set('closed'); video.pause(); video.muted = true;
      video.removeEventListener('ended', ended); video.removeEventListener('error', failed);
      video.removeEventListener('playing', playing);
      video.removeAttribute('src'); video.load();
    },
  };
}
