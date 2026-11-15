(function(root){
  // One line per track, played in this order, one per fight. Add a track: add its path here and to game/build/rumble-files.json.
  const tracks=['audio/plushie-bumper-rush.mp3','audio/plush-arena-rumble.mp3','audio/meadow-joyride.mp3'];
  root.LoftRumbleMusicData=Object.freeze({tracks:Object.freeze(tracks),volume:0.16,preferenceKey:'loftRumbleMusic'});
})(globalThis);
