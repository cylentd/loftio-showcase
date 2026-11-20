(function(root){
  // One line per track. Each fight (Play Again) plays a random one, never the same twice in a row. Add a track: add its path here and to game/build/rumble-files.json.
  const tracks=['audio/plushie-bumper-rush.mp3','audio/plush-arena-rumble.mp3','audio/meadow-joyride.mp3'];
  const selections=Object.freeze([
    Object.freeze({id:'shuffle',label:'Shuffle'}),
    Object.freeze({id:'plushie-bumper-rush',label:'Plushie Bumper Rush'}),
    Object.freeze({id:'plush-arena-rumble',label:'Plush Arena Rumble'}),
    Object.freeze({id:'meadow-joyride',label:'Meadow Joyride'}),
  ]);
  root.LoftRumbleMusicData=Object.freeze({tracks:Object.freeze(tracks),selections,selectionLabel:'Track',selectionKey:'loftRumbleMusicTrack',volume:0.16,preferenceKey:'loftRumbleMusic'});
})(globalThis);
