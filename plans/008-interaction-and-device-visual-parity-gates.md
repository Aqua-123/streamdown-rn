# Interaction and device visual parity gates

## Status

- Priority: P1
- Effort: Medium
- Risk: Low
- Depends on: Plans 001 through 007

## Problem

The current visual suite proves that fixture sections exist, but it does not govern the interactions and component states that are failing: open table menus, real table fullscreen, code blocks in paired themes, Mermaid state/sequence diagrams, diagram fullscreen, capability-disabled actions, or narrow-device overflow. Baselines can therefore remain green while core controls are visibly incomplete.

## Evidence

- Existing visual captures primarily locate fixture headings instead of asserting the rendered component surface and action state.
- The Mermaid matrix covers a basic flowchart but not state, sequence, theme changes, or fullscreen.
- Generic fullscreen coverage renders text rather than the table and Mermaid surfaces that depend on it.
- The current full Jest run has 119 passing suites and 3 failing suites; 5 failures identify download-format and pan/zoom-contract gaps that are not represented by governed device screenshots.
- Live Streamdown inspection establishes behavioral reference states: a floating vertical table download menu, separate code actions, centered diagram surfaces, and real fullscreen overlays.

## Scope

- `tests/visual/matrix.json`
- Visual capture and comparison helpers
- Maestro/device interaction flows
- `fixtures/current-rn/App.js`
- Visual testing documentation and evidence conventions
- No renderer implementation changes

## Implementation plan

1. Define a parity matrix by component, theme, viewport, and state. At minimum include:
   - table inline, download menu open, long-content overflow, and fullscreen;
   - code light/dark, long line, unknown language, and capability-disabled actions;
   - Mermaid flowchart, state, sequence, loading/error, and fullscreen;
   - table and Mermaid menu/modal dismissal;
   - phone portrait and tablet-width layouts on iOS and Android.
2. Add stable fixture routes or scenario identifiers for each state. Avoid timing-dependent interaction setup where a deterministic fixture state can represent the same surface.
3. Make capture scripts target component-specific accessibility labels/test IDs and assert that the expected control/menu/modal exists before taking a screenshot. Do not treat a fixture heading as proof of the component.
   Assert shared primitive behavior once: `Button` disabled/pressed semantics and `Dropdown` expanded state, menu items, outside/system dismissal, focus restoration, collision placement, async success close, and async failure retention. Consumer flows should then assert only their labels, choices, payloads, and layout.
4. Capture interaction sequences as before/action/after evidence for copy, download, disclosure dismissal, fullscreen open/close, zoom, and fallback/error states.
5. Govern behavioral parity separately from visual resemblance:
   - behavior assertions cover actions, focus/dismissal, and capability outcomes;
   - screenshots cover hierarchy, spacing, clipping, theme, and responsive layout.
6. Compare against the live Streamdown playground at the same content examples, but document intentional native adaptations such as touch targets, safe areas, and in-flow pan/zoom controls.
7. Update baselines only after the related focused tests pass and a reviewer has inspected the new images. Store the scenario name, platform, viewport, theme, and commit with each evidence set.
8. Add a regression checklist to the visual-testing documentation so future table/code/Mermaid changes must update the matrix intentionally.

## Verification

- Run the visual matrix linter/schema check.
- Run all component-specific capture flows twice and confirm stable output.
- Review iOS and Android evidence for clipping, overlap, touch-target visibility, stale menus, and incorrect themes.
- Run focused interaction tests before accepting screenshots.
- Run `bun run type-check` and the full Jest suite; baseline updates cannot mask functional failures.

## Done when

- Every named failure class has a governed functional assertion and device screenshot state.
- Captures locate and verify the actual component surface.
- Both major native platforms and both themes are represented where behavior can diverge.
- Baseline changes are reviewable, attributable, and blocked by failed functional checks.

## Out of scope

- Automating subjective pixel-perfect comparison between DOM and React Native.
- Physical-device-only accessibility certification.
- Fixing renderer behavior inside the visual-governance plan.
- Reimplementing `Button`/`Dropdown` behavior in fixture or capture helpers; tests must drive the public primitives used by production consumers.
