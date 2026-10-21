# CLAUDE.md

## Project Overview

ORBITAL is an Apollo 11 flight game (Three.js + TypeScript, Vite). It is a
nine-chapter campaign (TLI → MCC → LOI → DOI → powered descent → ascent →
rendezvous → TEI → entry) with flight-director cues: CAPCOM says what is
next, the computer solves each burn as an editable node, and the player flies
it. Chapters are graded 0–3 ★. [`DESIGN.md`](DESIGN.md) is the product spec,
with Sean's decisions and the kill-list. The pre-v4 specs in `docs/archive/`
are reference only.

## Development

```sh
npm install
npm run dev     # Vite, http://localhost:5175
npm run check   # tsc --noEmit + vitest (includes the full-mission flight)
npm run build   # tsc + vite build (base './' for subpath hosting)
```

Hosted at seankennethdoherty.com/play/orbital-mechanics/. Never deploy or
republish without Sean's explicit approval.

## Architecture

The simulation uses SI meters **relative to the current primary** (Earth or
Moon). Rendering is Earth-centered at `RENDER_SCALE` (1e-6). Craft models are
true scale. Float64 object transforms keep them precise, and track vertices
stay primary-relative.

- `src/sim/` is pure model with no DOM.
  - `orbit.ts` is an immutable conic (elliptic or hyperbolic).
  - `coast.ts` is the single patched-conic propagator with exact events.
  - `simulation.ts` holds the CSM and LM. Coasting always rides the conic;
    RK4 runs only under thrust or in air.
  - `burn.ts` / `executor.ts` handle finite burns and the P40 executor.
  - `targeting.ts` holds the mission solvers; `lambert.ts` solves Lambert's
    problem.
  - `guidance.ts` holds the descent (P63, P64 to a landing site, P66),
    ascent, entry and docking laws.
  - `terrain.ts` is the boulder field at the landing site; a hazard under
    a footpad tips the LM over at contact.
  - `vehicles.ts` has stage data; `spacecraft.ts` is one craft.
- `src/game/` is the campaign.
  - `chapter.ts` holds the types.
  - `chapters/` holds the nine chapter definitions. `descent.ts` carries
    the landing drama: program alarms, high gate, the LPD, fuel calls.
  - `director.ts` runs a chapter's phases, AUTO, warp targets and grading.
  - `nominal.ts` builds the launch state and the AUTO chain of chapter
    starts.
  - `campaign.ts` holds progress in localStorage.
  - `voice.ts` maps each real Apollo 11 clip (`public/audio/apollo11/`) to
    its caption. Chapters `say()` them at their moments, and a test keeps
    the clips and captions in step. `scripts/mission-audio/` recuts them.
- `src/render/` holds `stage`, `camera` (horizon-frame chase; auto-framed
  map), `world` (per-frame placement), `trajectory`, `surface` (the
  low-altitude patch), `boulders` (the field and the LPD reticle), `ship`,
  `planet`, `moon`, `starfield` and `labels`.
  - `lines` is the only way to draw a line: analytically anti-aliased
    screen-space strokes. Widths are in CSS px, coverage is applied in
    linear light, and strokes combine by MAX. `LineBuffer` handles lines
    rewritten every frame without reallocating. Dense repeating detail
    (grids, craters, graticules) uses `fade: true` with a feature size
    per segment, so it fades out before it can shimmer below a few pixels.
    Stars are drawn the same way, as covered discs (`starfield`).
  - `depth` makes the log depth buffer work in meters, so edges resolve
    against the faces behind them at craft range.
- `src/ui/` holds `hud`, `navball`, `mapview` (labels and node drag),
  `overlay` (menu, debrief, abort), `audio` and `format`.
- `public/data/` holds `star_catalog.json` (HYG) and `ne_50m_coastline.json`.

Conventions:

- Craft +Z is the thrust axis (the LM's +Z is up), and the world is Y-up.
- Everything is equatorial and coplanar. Lunar orbits are clockwise, like
  Apollo's.
- Tests live next to the code (`*.test.ts`). Physics changes need a test
  showing that the prediction matches the flown result.

In dev, `window.__game` exposes `{sim, director, mode, rig, campaign, nominal,
start(i), command(cmd), update(dt), advance(steps, dt)}`. `advance` flies
without drawing each frame, which is useful when rAF is throttled or
rendering in software GL. `scripts/fly-mission.mjs` flies the whole mission
through it and saves screenshots.

## Style

Restrained clean vectors, like a mission-control display: thin, smooth
anti-aliased strokes (1–1.5 px) on near-black, and color only where it means something (green nominal track,
amber plan and cue, cyan target, red warning). No bloom, scanlines or CRT
shader. The HUD is monospace, uppercase, with tabular numerals. Keep modules
small and single-purpose.

<!-- REVIEW_CHARTER_START 2026-10-21 -->
## When you review (Sean, 2026-10-21)
Sean: "when sol is reviewing code, instead of just looking for bugs it also steps back from the problem and tries to find a more elegant first principles solution, and stands guard against code and test bloat, band aid hacks, and always tries to push the main agent towards a more elegant, solution." Then: "it should be able to take a step back look at the bigger picture, and call out if theres a more elegant long term solution, rather than just give a bunch of super rare and unlikely bug cases that need lots of bandaids to cover up. I want the robust, elegant long term shape, and the review agents job is to always look for that sort of thing." And: "the goal is robustness through elegance and simplicity."

**The goal is robustness through elegance and simplicity.** A review's main job is to find the robust long-term shape: the one where the code's structure matches the problem's, so whole classes of bugs cannot happen. Bug hunting serves that job; it does not replace it. This binds every review, audit, bug hunt and second opinion, whatever model runs it (GPT-6.1 Sol by default) and even when the prompt asks only for bugs. The one exception is a pass the prompt names blockers-only (a hotfix): report correctness only, and list any shape you noticed as the follow-up.

1. **Step back first.** Before you judge the diff, say in one sentence what the change is for (for an internal change, what it must keep working). Read the code it touches and search the repo for what already does the job. Sketch the simplest robust shape for the problem, then compare the diff with it. Lead the report with that shape: the long-term solution, what it deletes, and whether this change moves toward it or away from it. If the change already matches it, say so in one line.
2. **Then hunt bugs, and find their cause.** Report a bug that real use can reach: how it happens, severity, confidence, file:line. When several bugs share a cause, report the cause once, with the shape that makes them all impossible, not one guard per case. Edge cases are part of the work in high mix (Sean, 2026-10-21: "we are in the business of high mix, so edgecases are everything"; "an edgecase we dont handle means we need a better system overall that can handle not only that edgecase but all others"). Do not dismiss a failure that real use can reach because it is rare. Treat an unhandled case as evidence of a problem in the system's design. Report the shared cause once, with examples that show it, the simplest system that handles the whole class of failures with that cause, and what that system deletes or makes unnecessary. Show how it keeps the agreed behavior and existing contracts. Never ask for a band-aid; ask for the change that removes the cause. Handling only the reported example does not close the finding. In pass 1, report all identified classes together. Later passes follow "Settle, do not re-litigate": review the fixes and new evidence from those fixes; do not restart the review of the original change. Further examples of the same cause belong to the existing finding.

Look for these. Each is a finding when you can show needless complexity, a duplicated responsibility, a mechanism that covers an avoidable cause, or a hidden failure:
- **Band-aids:** a mechanism that handles a symptom while leaving its shared cause in place, or hides a failure. Inspect guards, retries, sleeps, raised timeouts, locks, flags, IDs, thresholds, special cases, fallbacks, wrappers, shims and helpers for this. None is a finding merely because it exists. Show the cause it leaves in place, the simpler system that removes that cause, and the specific code that system makes unnecessary. A rule that removes the cause for the whole affected class while preserving supported behavior is a fix.
- **Code bloat:** new code that does the same job under the same contract as existing code (name it, file:line); a new parameter or branch that bends a near-fit abstraction to a case it was not shaped for; a stored value that could be computed; a third variant of one rule with no shared home; a translation between two forms of one idea; a module that needs "and" to describe. Similar-looking code with different rules is not a copy: duplication is cheaper than the wrong abstraction.
- **Test bloat:** apply the repo's test rule (by default, a new test earns its place by holding a property that already broke). Flag a test that repeats another, asserts how the code works instead of what it does, or mocks the thing it tests, and a test that guards a state the types or schema could make impossible (say how).

Rules:
- **Show it.** A shape finding names the needless part, the better shape in one sentence, what it deletes, and how it delivers the agreed behavior and keeps the contracts that must stay (callers, stored data, restarts, error paths). Use words and names, never a patch. Cite existing code it reuses (file:line), if any. "Could be cleaner" is not a finding; taste with nothing to delete is at most one non-blocking line.
- **Blocking.** A finding blocks when the better shape removes the need for specific code this diff adds (name it): a band-aid, a same-job copy, a parameter that bends a near-fit abstraction. Moving, renaming or rewriting equivalent code is not removing it. The change is then rebuilt on the shape, as stacked PRs if the shape needs more than one. A better shape that deletes nothing this diff adds is the next PR (open the issue now), not a blocker. A shape you could not show delivers the agreed behavior is non-blocking. A correctness or safety failure that real use can reach in the agreed behavior this change must deliver or preserve blocks, even when its cause is in unchanged code. This includes edge cases, regardless of how often they occur. This correctness rule applies even when the fix deletes no code added by this diff. The fix must remove the shared cause for the whole affected class; handling only the reported example does not close the finding. An existing failure unrelated to that agreed behavior is the next PR (open the issue now), not a blocker for this change. Rank by impact.
- **Settle, do not re-litigate.** Pass 1 reports everything at once. Delta passes review the fix commits, new band-aids included (a guard around the symptom is a new finding), and close open findings. Rule once on an author's rebuttal: accept it, or state the disagreement in one line; the orchestrator decides and names it in its report. A settled finding stays settled unless the fix commits bring new evidence.
- **Plans and specs.** The shape job is most of the review: the sentence, what the design deletes, what already exists, the non-goals. Apply the blocking test to the code or mechanisms the plan proposes: a better shape that removes the need for them blocks the plan.
- **Verdict.** PASS needs both jobs done and no blocking finding left; do not invent an improvement to go with it. When a job could not be done (no repo access, no stated goal), the verdict is INCOMPLETE, with what was missing. A blockers-only pass may PASS on correctness alone. Whether a failed pass holds a merge is the repo's rule.

**The author's side.** Answer every finding: rebuild on the shape, fix the cause, rebut it with evidence, or open the issue for a next-PR shape. A fix that removes the cause is valid wherever it lands; one that guards the symptom is the band-aid. Give the reviewer the PR's sentence and repo access.
<!-- REVIEW_CHARTER_END -->
