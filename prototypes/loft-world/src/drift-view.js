import * as THREE from 'three';
import {softMaterial} from './glsl.js';
import {merge, place, tint} from './util.js';

const DRIFT = {
  segments: 24, rings: 16, crown: [4.8, 3.1, 4.2], crownY: 1.2,
  mantle: [4.5, .7, 3.9], mantleY: -.5, ribbons: [-2.4, 0, 2.4],
  ribbonScale: [.65, 1.8, .65], ribbonY: -2.1,
  eyeX: 1.35, eyeY: 1.2, eyeZ: 4.25, eyeScale: [.65, .85, .32],
  pupilScale: [.28, .42, .18], pupilZ: 4.5,
  coat: '#74bab7', rim: '#bce9cc', ribbon: '#67959f', eye: '#fff6df', pupil: '#26394d',
  spotY: 4.35, spotScale: [1.9, .5, 1.9], spot: '#ffd27a', glow: .75,
};

export function buildDrift() {
  const group = new THREE.Group(), body = [], face = [];
  const oval = (color, position, scale, glow = 0) => place(
    tint(new THREE.SphereGeometry(1, DRIFT.segments, DRIFT.rings), color, glow),
    ...position, 0, 0, 0, ...scale);
  body.push(oval(DRIFT.coat, [0, DRIFT.crownY, 0], DRIFT.crown));
  body.push(oval(DRIFT.rim, [0, DRIFT.mantleY, 0], DRIFT.mantle));
  for (const offset of DRIFT.ribbons) {
    body.push(oval(DRIFT.ribbon, [offset, DRIFT.ribbonY, 0], DRIFT.ribbonScale));
  }
  for (const side of [-1, 1]) {
    face.push(oval(DRIFT.eye, [side * DRIFT.eyeX, DRIFT.eyeY, DRIFT.eyeZ], DRIFT.eyeScale));
    face.push(oval(DRIFT.pupil, [side * DRIFT.eyeX, DRIFT.eyeY, DRIFT.pupilZ], DRIFT.pupilScale));
  }
  group.add(new THREE.Mesh(merge(body), softMaterial({fuzz: .2, gloss: .3})));
  group.add(new THREE.Mesh(merge(face), softMaterial({fuzz: 0, gloss: .8})));
  const spot = new THREE.Mesh(oval(DRIFT.spot, [0, 0, 0], [1, 1, 1], DRIFT.glow), softMaterial({fuzz: 0}));
  spot.position.y = DRIFT.spotY;
  spot.scale.set(...DRIFT.spotScale);
  group.add(spot);
  group.userData.spot = spot;
  return group;
}
