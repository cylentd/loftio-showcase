(() => {
  window.LoftRumbleStageLayoutData = Object.freeze({
    defaultId: 'boss',
    storageKey: 'loft-rumble-stage-layout',
    changeEvent: 'loft-rumble-stage-layout-change',
    label: 'Stage layout',
    note: 'Layout preview. Changes start a new battle.',
    options: [
      { id: 'tutorial', label: 'Tutorial · first bank', shortLabel: 'Tutorial layout', bumpers: [[.5, .5]] },
      { id: 'normal', label: 'Normal · staggered lanes', shortLabel: 'Normal layout', bumpers: [[.24, .44], [.76, .56], [.5, .5]] },
      { id: 'boss', label: 'Boss · open center', shortLabel: 'Boss layout', bumpers: [[.3, .5], [.7, .5]] }
    ]
  });
})();
