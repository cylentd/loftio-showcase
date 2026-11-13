(function(root){
  'use strict';
  root.LoftRumbleCinematicData=Object.freeze({
    source:'video/loft-rumble-intro-d07190fd.mp4',
    // Hard escape hatch for a stalled download/playback; longer than the approved film.
    timeoutMs:90000,
    hintDurationMs:4000,
    icons:Object.freeze({
      sound:'M4 9h4l5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8 M20 5a10 10 0 0 1 0 14',
      muted:'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',
    }),
    copy:Object.freeze({label:'Loft Rumble cinematic',skipTouch:'Tap to skip',skipPointer:'Click to skip',soundOn:'Turn sound off',soundOff:'Turn sound on'}),
  });
})(globalThis);
