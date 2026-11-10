// Runtime image prompt v4.2: the v4 handoff template (RUNTIME-IMAGE-PROMPT.template.md) plus David's 2026-11-05
// clarification under "User's creative selections". Any wording change bumps PROMPT_VERSION in prompt.ts, because kept
// residents record the version they were made with.

export const PROMPT_TEMPLATE = `# Loftio Character Builder — Runtime Image Prompt v4.2

Create **one** original resident for Loftio, a cozy, whimsical world of lovable collectible creatures.

## User's creative selections

- Creature / inspiration: {{creature}}
- Personality: {{personality}}
- Signature detail: {{signature_detail}}
- Color palette: {{resolved_palette}}

Interpret these selections creatively. They express intent, not anatomical assembly instructions. When a selection asks you to invent, decide that trait yourself beyond the preset catalog while preserving every explicit selection. The style references and image requirements still apply.

Create a whimsical companion inspired by the creature, not a realistic animal made cute. Simplify biological anatomy and surface detail. Tactile craftsmanship should support appealing forms, not dominate them with realistic skin, fur, or anatomical detail.

## Creative priority

**Lovable first → belongs in Loftio → distinctive as an individual.** Invent one appealing, coherent character with a recognizable silhouette and personality. The signature detail should feel integral to the character, not pasted onto an existing template. Personality should inform the body, pose, face, energy and details, not only a smile.

Design creature-appropriate anatomy, proportions, eyes, mouth, materials, and posture together. Do not reuse a single default oval-eye/blush/open-mouth face for all characters; do not distort the face merely to be unusual. Big eyes, small eyes, no limbs, tiny feet, asymmetric forms and simple expressions are all acceptable when they enhance the design. Anatomy may be abstract rather than biologically realistic.

## World & craftsmanship

Match the supplied Loftio visual references in **warm charm, polished softly dimensional rendering, tactile material craftsmanship, legible shapes and inviting lighting**. Materials are chosen to fit the creature: plush, wool, felt, fabric, ceramic, jelly, stone, crystal, and other suitable surfaces. Not every resident must be plush, dressed, symmetrical, or heavily decorated. Design should remain readable at small on-screen sizes.

Use the **original-six sheet as a world/style reference** and the **exploratory sheet as a range-of-possibilities reference**. Do not reproduce their specific faces, body recipes, silhouettes, motifs, costumes or named characters. Do not interpret the references as a set of rigid parts to assemble.

## Image and pose requirements

- Output **one** complete **default idle** resident, not a concept comparison or activity scene.
- Near-front or gentle three-quarter view; face clearly visible; gaze slightly upward toward viewer when anatomically appropriate.
- Compact relaxed/resting silhouette suitable for gentle bobbing or idle motion; limbs optional.
- No held objects, tools or books, even if personality suggests an activity.
- Exactly one character; no companions, text, labels, decorative floating symbols, or scenery.
- Square composition, full body visible, comfortable margins, around 80% canvas height.
- **Genuine transparent alpha background**, no floor, backdrop or cast shadow. Do not render a checkerboard pattern.

## Final instruction

Create a delightful, original Loftio resident that someone would want as their own companion. Favor emotional appeal and cohesive individuality over mechanical novelty. **Generate exactly one character image.**
`;
