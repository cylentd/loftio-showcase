(function(root){
  'use strict';
  // Hero ability effects (LM2, docs/design/LOFT-RUMBLE-LIVING-MAGIC.md "Normal abilities and effect origins").
  // Look only: damage, attribution, charge and combo never read these numbers. Lengths are logical arena units, times seconds.
  root.LoftRumbleHeroFxData=Object.freeze({
    // Texture names in art/ (copies of assets/living-magic/hero-abilities/textures/, loaded by art-renderer.js).
    textures:Object.freeze({seed:'fx-seed-projectile',crescent:'fx-shockwave-crescent',beam:'fx-puff-beam-strip',
      impact:'fx-puff-beam-impact',contact:'fx-ally-contact'}),
    // How long each activation's effect shows. Shockwave lingers long enough to read its reach; the beam is a snap.
    life:Object.freeze({springy:.3,heavy:.62,piercing:.4}),
    // Small cream tick where the mover crossed the ally. Core share from studies/calibrate_hero_fx.py.
    contact:Object.freeze({life:.22,size:22,grow:.45,coreX:.49,coreY:.457}),
    // Seed bolt: 96x57 texture facing right, drawn at its aspect; a short fading trail of recent positions.
    seed:Object.freeze({length:27,height:16,trail:8,trailWidth:5,trailAlpha:.65,trailColour:'seed',glow:'seed-glow',  // page colour tokens (--seed, --seed-glow)
glowRadius:7,glowAlpha:.35}),
    // Shockwave crescent. The texture's circle centre sits far above the image (pivotY < 0); fitted by
    // studies/calibrate_hero_fx.py (max residual 9.5 px of 647). radiusShare is that circle's radius over the texture width.
    shock:Object.freeze({
      pivotX:.4988,pivotY:-1.287,radiusShare:.6318,
      startShare:.3,          // the wave starts at this share of its logical radius and eases out to the full 230
      fronts:Object.freeze([  // broken crescents: each front is a few arcs around the origin, the trailing one inside and fainter
        Object.freeze({share:1,arcs:3,alpha:1,spin:0}),
        Object.freeze({share:.72,arcs:2,alpha:.55,spin:Math.PI/2})
      ]),
      thickness:1,            // vertical scale of the crescent band for the newest wave
      olderThickness:.55,     // older waves thin to this
      fadeStart:.55           // share of its life after which a wave fades out
    }),
    // Beam: 512x52 strip stretched from the ally to the enemy; its width never depends on that distance.
    // The strip's white-blue core is only about an eighth of its height (the rest is soft glow), so 44 units gives the
    // mockup's thick beam, about 6 units of core.
    beam:Object.freeze({width:44,snapLife:.07,snapWidth:1.7,fadeStart:.35,
      // impactGrow: the impact flash starts this share larger and settles to impactSize.
      impactSize:40,impactGrow:.25,impactLife:.28,impactInset:.45,coreX:.383,coreY:.595}),
    // Newest activation bright, each older one fainter, down to a floor.
    overlap:Object.freeze({fade:.5,floor:.2}),
    // Friendly effects drop to this share while an enemy danger zone is up, so its edge and countdown stay readable.
    dangerDim:.7
  });
})(globalThis);
