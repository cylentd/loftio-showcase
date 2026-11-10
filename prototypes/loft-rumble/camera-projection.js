(function (root) {
  'use strict';
  root.LoftRumbleProjection = {
    create(options = {}) {
      const config = root.LoftRumbleCameraConfig;
      let mode = options.mode ?? 'TOP_DOWN', tilt = options.tilt ?? config.tilt;
      const middle = ((options.top ?? config.projectionTop) + (options.bottom ?? config.projectionBottom)) / 2;
      function setMode(value) {
        if (!['TOP_DOWN', 'SHALLOW_2_5D'].includes(value)) throw new RangeError('Unknown camera mode');
        mode = value;
      }
      function setTilt(value) {
        if (!Number.isFinite(value) || value < config.minTilt || value > config.maxTilt) throw new RangeError(`Camera tilt must stay between ${config.minTilt} and ${config.maxTilt} degrees`);
        tilt = value;
      }
      setMode(mode);
      setTilt(tilt);
      const factor = () => mode === 'TOP_DOWN' ? 1 : Math.cos(tilt * Math.PI / config.degreesPerHalfTurn);
      return {
        get mode() { return mode; },
        get tilt() { return tilt; },
        get factor() { return factor(); },
        get uprightScale() { return 1 / factor(); },
        setMode, setTilt,
        project: point => ({ ...point, y: middle + (point.y - middle) * factor() }),
        unproject: point => ({ ...point, y: middle + (point.y - middle) / factor() }),
        sort: entries => [...entries].sort((left, right) => left.y - right.y),
        occluded: (point, bounds) => bounds.some(bound => point.y < bound.groundY &&
          point.x + point.radius > bound.x && point.x - point.radius < bound.x + bound.width &&
          point.y + point.radius > bound.y && point.y - point.radius < bound.y + bound.height),
        begin(context) {
          context.translate(0, middle);
          context.scale(1, factor());
          context.translate(0, -middle);
        },
      };
    },
  };
})(globalThis);
