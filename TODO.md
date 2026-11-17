# Plush Valley publication handoff

Recorded 2026-11-17. This feature branch backs up the deployed export; it is not landed on main.

## Delivered and verified

- Branch: `publish-plush-valley`, based on public main commit `21f5e7e`. Task-scoped export, build configuration and approved art/audio are saved here. The final wrap-up receipt identifies the backup commit and verified remote ref.
- Owner approved publication. Deployment `dpl_7hAsh7jpGV9gM2GXVpq17rd5zdy3` is READY at https://loftio.cylentlabs.com. Valley route: https://loftio.cylentlabs.com/play/valley/?view=play. A fresh wrap-up HEAD request returned HTTP 200.
- Previously run: `npm run build` passed; `npm test` passed 1,337/1,337. Live desktop/phone-sized menu, loading cover, error/retry and room-return journeys passed without page errors; audio stayed off. These are recorded prior checks, not fresh runs during wrap-up.
- A mobile simulation recorded 8.26 seconds cold load; this was a throttled desktop browser, not a physical phone.

## Preserve before the next export

- The older authoring branch would regress newer public changes. This publication retained the current main versions of `build/rumble-files.json`, `prototypes/loft-rumble/`, `src/song-wave.ts`, `tests/unit/arrival-reveal-model.test.ts` and the builder bundle. Reconcile the authoring repository first; never overwrite these with the old source export.
- Authoring integration branch: `t3/woodland-clearing-prototype`. Its full prototype wrap-up check is red: 104/139 pass, 35 failures. Runtime harness failures and older mechanical expectations need investigation; there is no land-ready review verdict.
- This is an experimental Look test, not owner acceptance of all world visuals or feel. Production dependency audit had zero findings; installation also reported four high development-dependency advisories, not remediated in this task.
- Wrap-up staged whitespace check flags an extra blank line at EOF in `prototypes/loft-world/src/play-constants.js`, left unchanged in this WIP backup. No main-landing gate or new reviewer was run.

## Next action

Keep both feature branches backed up. Resolve the authoring branch tests and integration, run the required reviews/gates, and obtain main-landing approval. Land the producer before regenerating and landing this export. A deployment from unchanged main can currently remove Valley. Wrap-up grants no main push or new deployment permission.

The worktree retains ignored dependencies, build output and local Vercel configuration. Do not publish credentials or delete the unfinished worktree. No disposable process was started during wrap-up.
