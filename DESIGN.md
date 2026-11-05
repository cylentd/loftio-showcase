# Grove control desk

Visitors come here to arrange the room, tune its atmosphere and keep a postcard. They should not have to learn a settings hierarchy before trying the scene.

The direction is a paper control desk: warm ivory, brown ink, quiet separators and olive for selected controls. Its light surface separates the controls from the detailed room. The room remains the showcase; settings are an operating surface, not a second attraction.

## Low-distraction interaction standards

- Keep Room, Effects and Sound in the same order, with icons beside words. Use familiar labels rather than icon-only category navigation.
- Keep the panel footprint stable across tabs. Reserve its heading and navigation; scroll only the active content when space runs out.
- At 360 × 800 and 1500 × 920, the default contents of each tab fit without scrolling. Shorter viewports retain a thin, warm scrollbar, touch/wheel scrolling and automatic keyboard focus scrolling. Do not hide an overflow area without a scroll cue.
- Sound controls are visible as soon as Sound is selected. Do not add disclosures around playback, track selection or volume.
- Group sound, Make postcard and Settings in one quiet bottom-right tray. Use matching warm-dark icon buttons, with a small separator before Settings, accessible names and hover/focus hints. Keep track selection and volume inside Settings. Postcard opens directly and returns focus to its own trigger; preview first, then download or copy deliberately.
- Give switches a full label-sized hit area. Show selected state through thumb position and color, not color alone. Keep visible keyboard focus and native form semantics.
- Hide only reference material such as the full resident movement instructions. Everyday actions, including Everyone home, stay outside that disclosure.
- Keep one meaning per accent: olive marks selection or the primary postcard action. Use surface and border contrast for grouping, not extra decorative badges.
- Group Wander, favorite-corner lighting and Everyone home under Residents. Put switches at the end of labelled rows, with short help beside the setting. Keep letter controls together and full movement instructions behind Moving residents.
- Use the same stroke-icon family for categories, effect labels, lighting phases and actions. Pair icons with words inside settings; reserve icon-only controls for familiar close and corner sound/postcard/settings actions with accessible names.
- Keep a visible close button that returns focus to the settings trigger. Center view names the camera button's action; it does not present a gesture instruction as an action.
- Keep music and rain headings stable while playback changes. Play/pause icons and live status convey state. Do not repeat postcard-preview instructions in the settings footer.
- Light the original painted furniture while its resident is held. Use a cool moonlit grade to separate it from the amber room while retaining painted texture and tonal detail. Do not draw rings, borders, landing boxes or separate glow shapes. Still and reduced motion hold the light steady. Release or cancellation immediately restores the painting.
- While held, let residents gently squirm with a small side-to-side rotation, soft squash and slight bob. Keep the landing coordinates fixed; stop the motion on release. Still and reduced motion use a neutral held pose.
- Carry residents continuously at a stable size. Choose a nearby landing separately and snap only on release. Do not draw placement markers or pointer-drag outlines. Keep visible keyboard focus, screen-sized seat tolerance and target hysteresis.
- Keep favorite names in accessible resident descriptions rather than room overlays. Keyboard pickup lights the same furniture as pointer pickup. Show all favorite spots remains an explicit survey setting; ordinary clicks do not leave favorite lighting behind.
- Default postcards to a clean snapshot with no printed words or branding. Offer Paper, Film and Borderless frames. Add a caption is opt-in, with one small italic Loftio signature beneath the words; caption and frame changes reuse one captured scene. Preview, download and clipboard must contain identical PNG bytes. Removing a caption restores the exact clean snapshot. A new postcard excludes the previous selected greeting. Keep caption controls in place when disabled and preserve the preview viewport dimensions when words are toggled.
- Keep movement optional through Still and Wander, and honor reduced motion. Attempt music and rain on load as requested. Use distinct on/off speaker icons in the corner, with an accessible action label and hover title. One tap enables sound after a rejected startup or mutes both playing sources. Keep the icon button the same size as Settings.
- Use softly grained paper, brown serif lettering, a gently uneven oval and a curved tail for speech. Balance short lines and keep the bubble within the viewport while its tail follows the resident. Keep text readable and omit entrance or idle animation.
- Let Wander choose chairs, the pink lounge, ottoman, second-floor beds and the window floor. Approach furniture before hopping onto it. Use the ladder for floor changes, reserve it for one journey at a time, and retain a paused route when Wander is switched off. A cancelled carry resumes the old journey; a completed drop replaces it with the new home and post-drop pause.
- Keep the topmost third floor closed until the artwork provides enough visible headroom for residents. The existing second-floor landing and both painted beds remain usable.
- Use small rung holds, squash and close-to-ladder hops for ascent, with gentler step-downs for descent. Do not replace climbing with a smooth vertical slide or large airborne jumps.
- Keep lighting choices together in Effects, with Auto, Lamplit, Dusk and Moonlit directly selectable. Auto traverses a four-minute evening. Still, reduced motion and hidden tabs pause the cycle and flicker; manual phase selection remains available without animation while frozen. Keep the panel footprint and default no-scroll layout.
- Default live lamp glow to 20% in Lamplit, 300% in Dusk and 0% in Moonlit. Auto interpolates those defaults; save manual glow tuning independently for each lighting mode.
- Reserve sitting surfaces for one resident, including incoming destinations and held origins. An occupied drop returns the carried resident to its origin without displacing the occupant. Floor paths may still cross.
- Keep every resident at its natural perspective size on chairs. Give smaller chair occupants a small cloud booster for table headroom instead of enlarging their sprite. Lift only the presentation; keep placement coordinates and depth unchanged. Hide the booster while carried and preserve its offset through pickup. Other furniture receives no booster.
- Scale snapshot margins and optional captions above a 1080px reference width. Paper uses a 32px cream margin, Film a 14px dark margin, and Borderless none. Without a caption, reserve no text footer. Round the output inset to whole pixels so frame changes preserve every captured scene pixel.
- Transition every painted layer together, including foliage, foreground occluders and favorite furniture; cool residents with the room. The supplied moonlit painting provides the lamps-off view. Preserve the established warm shimmer and add sparse, gentle individual-lamp dips rather than synchronized flashing. Lamp glow controls the live pools, not the baked painting.

These are low-distraction design requirements, not a clinical claim or a completed ADHD usability study. Future changes should retain them and extend the browser checks when adding controls.

## Snapshot and entrance refinements

Keep the postcard photo above one compact toolbar. Reuse Settings ivory, brown lettering and olive actions. Use locally hosted Nunito for interface labels and headings rather than the storybook serif. Keep border choice, caption toggle and caption cycling together; put export actions at the toolbar's end. On phones, use two short rows and accessible icon-only export actions. Reserve preview dimensions so toggling words never shifts the surrounding controls. Status messages overlay the image edge rather than reserving an empty footer band.

Chair clouds use translucent feathered lobes with subtle grain instead of a hard silhouette. Let the cloud and its seated resident drift together by at most three world pixels, without changing natural proportions or landing coordinates. The shared clock freezes this motion in Still, reduced motion and hidden tabs.

Use the owner's transparent primary wordmark over a dimmed, blurred loft. Do not crop it into an oval or frame the entrance as another card. Hold for four seconds after the room is ready, then dissolve. Clicking anywhere or pressing Enter, Space or Escape skips the hold; an early skip waits for the room to finish loading. Keep the underlying scene inert until dismissal. Reduced motion removes the wordmark entrance animation; a missing image uses the Loftio text fallback. A failed room load offers Retry.

Settings retains one stable footprint across Room, Effects and Sound. Use the same rounded interface type as the postcard, subtle tab selection and divider-separated effect sliders. Remove the stacked boxes around individual sliders. Standard phone and desktop contents fit without scrolling; short viewports retain the existing warm scroll treatment.

Sprout's favorite is the second-floor teal sofa. Its hold-only lighting follows the painted sofa and cushion, with no separate marker. Its interest destination reuses the existing right-bed seating node, so wandering uses the ladder and the seat's existing occupancy rule. The initial downstairs home stays unchanged.

## Verification

Pure behavior checks live in tests/showcase-ux.test.ts. scripts/quiet_controls_qa.py verifies the default panel footprint and overflow, direct sound controls, keyboard navigation, contextual hints, caption variety and short-viewport access. Existing audio and postcard checks cover playback and export behavior. All browser scripts reuse the shared server and close their browsers.

scripts/settings_polish_qa.py additionally verifies labelled icon switches, close-button focus restoration, stable tab bounds, standard-height no-scroll layouts and short-screen access. src/settings-components.ts shares row and action presentation without owning setting state.

Sources of truth: src/settings.css for control layout, src/tokens.css for palette and dimensions, src/copy.ts for labels and greetings, and src/favorite-scenery.ts for artwork lighting. scripts/scenery_favorites_qa.py checks painted pixels, immediate restoration and hold-only interaction. scripts/storybook_speech_qa.py checks all six speakers at desktop and phone sizes. The old ring script and FavoriteHint model tests describe the retired inspection prototype, not the active interaction.
