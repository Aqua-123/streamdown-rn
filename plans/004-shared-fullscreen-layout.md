# Plan 004: Repair shared fullscreen layout and lifecycle

> **Executor instructions**: Fix the shared modal once, then adapt table and
> Mermaid callers. Do not create separate fullscreen implementations. Update
> `plans/README.md` on completion.
>
> **Drift check (run first)**:
> `git diff --stat d235aa4..HEAD -- src/components/ui src/controls/FullscreenModal.tsx src/controls/TableControls.tsx src/plugins/mermaid/MermaidBlock.tsx tests/parity/ports/streamdown/*fullscreen* tests/parity/ports/streamdown/scroll-lock.test.test.ts fixtures/current-rn/App.js docs/accessibility.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-native-table-disclosure-menu.md`
- **Category**: bug, accessibility
- **Planned at**: commit `d235aa4`, 2026-07-21

## Why this matters

The shared modal wraps all content in a horizontal-only scroller. Tall tables
cannot scroll vertically, and Mermaid receives no full-viewport centered canvas
on which to relayout. Focus restoration also runs before native dismissal has
completed. These are shared-root causes for both reported fullscreen failures.

## Current state

- `src/controls/FullscreenModal.tsx:21-46` uses `SafeAreaView`, a label, close
  button, then `<ScrollView horizontal>` for every child.
- `src/controls/TableControls.tsx:84-95` now preserves the plan-003 dropdowns,
  copy feedback, and fullscreen-menu cleanup, but still places the table's own
  horizontal surface inside the modal's generic horizontal scroller.
- `src/plugins/mermaid/MermaidBlock.tsx:96-109` removes the inline diagram and
  inserts the same rendered surface into that generic scroller.
- `FullscreenModal.tsx:18-20` calls focus restoration immediately after
  requesting close; it does not coordinate with modal dismissal.
- `FullscreenModal` is publicly exported and `fixtures/current-rn/App.js`
  consumes it without a layout prop, so the new mode API needs a backward-
  compatible default.
- The live oracle uses two modes: table = full-width two-axis document;
  Mermaid = centered full-viewport canvas with pan/zoom controls.

Existing test limitation: `tests/visual/matrix.json:12` opens a generic text
fixture, not a real table or diagram.

Control convention: close and action controls use the shared
`src/components/ui/Button.tsx`/`ActionButton` stack. Table format disclosure
continues to use `Dropdown`; fullscreen code must not add direct `Pressable`
controls or fork dropdown state/dismissal behavior.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fullscreen tests | `bun run test --silent -- tests/parity/ports/streamdown/table-fullscreen.test.test.ts tests/parity/ports/streamdown/mermaid-fullscreen.test.test.ts tests/parity/ports/streamdown/scroll-lock.test.test.ts` | 3 suites pass |
| Controls | `bun run test --silent -- src/controls/__tests__/native-controls.test.tsx src/plugins/__tests__/mermaid.test.tsx` | 2 suites pass |
| Typecheck | `bun run type-check` | pass |
| Device contract | `bun run test:device-contract --silent` | pass |
| Changeset | `bun run changeset:verify` | pass |

## Scope

**In scope**:

- `src/controls/FullscreenModal.tsx`
- `src/controls/TableControls.tsx`
- `src/plugins/mermaid/MermaidBlock.tsx`
- `tests/parity/ports/streamdown/table-fullscreen.native.tsx`
- `tests/parity/ports/streamdown/mermaid-fullscreen.test.test.ts`
- `tests/parity/ports/streamdown/scroll-lock.test.test.ts`
- directly affected focused control tests only
- `fixtures/current-rn/App.js` only if needed to make the existing fullscreen
  scenario exercise a real document/canvas mode
- `docs/accessibility.md` if lifecycle behavior changes
- one `.changeset/*.md`

**Out of scope**:

- table column algorithms
- Mermaid parser/provider theming
- changing download/copy payloads
- adding safe-area-context to core merely to silence a deprecation warning
- changing the shared `Button` or `Dropdown` primitive contracts
- changing `PanZoomSurface`; its in-flow toolbar and gesture fallback remain
  owned by Plan 007

## Git workflow

- Branch: `codex/004-shared-fullscreen-layout`
- Commit style: `fix(controls): repair fullscreen content layout`
- Do not push unless instructed.

## Steps

### Step 1: Replace the hard-coded horizontal scroller with explicit content modes

Keep one shared modal shell (safe area, close action, modal semantics). Add a
`contentMode?: 'horizontal' | 'document' | 'canvas'` prop that supports:

- horizontal mode: the current public behavior, used as the default for
  backward compatibility;
- document mode: vertical viewport whose child may provide horizontal scroll;
- canvas mode: a flexing, centered viewport that gives Mermaid full width and
  height and does not wrap it in a competing ScrollView.

Default exported-component behavior must remain documented and backward
compatible where possible.

Render the close action with the existing `Button` primitive. Do not create a
fullscreen-only button wrapper.

**Verify**: a tall/wide table test can reach both axes; a Mermaid test receives
a flexing canvas container.

### Step 2: Adapt table fullscreen

Use document mode. Keep the action strip inside the vertical viewport and let
the existing rendered table retain horizontal scrolling. Preserve the already-
landed fullscreen-scoped menu cleanup and plan-003 `Dropdown` behavior; do not
reimplement either.

**Verify**: add a table with enough rows and columns to overflow both axes;
close/reopen after opening a menu and assert the menu is closed.

### Step 3: Adapt Mermaid fullscreen

Use canvas mode. Give the diagram wrapper `flex: 1` and full available width,
center it, permit the provider surface to receive a new full-screen layout, and
keep pan/zoom controls reachable within the canvas. Do not render a zero-size
placeholder during the transition and do not fix the separate Plan-007 toolbar
placement issue here.

**Verify**: a focused test asserts the full-size centered canvas styles and
delivers a non-zero `onLayout` event to provider content; source fallback
remains selectable if rendering failed. Plan 008 owns captured simulator/device
visual evidence, so do not add a second screenshot harness here.

### Step 4: Restore focus after dismissal

Separate close request from focus restoration. Remove the early `!visible`
return so the native `Modal` can observe the true-to-false transition. Use
`Modal.onDismiss` for the native completion path and a post-render Android
fallback (for example `InteractionManager.runAfterInteractions`) because
Android does not reliably emit `onDismiss`; guard both paths with one pending
restore ref so focus is restored exactly once. Preserve close-button, system-
back, and accessibility-escape requests, and never restore synchronously from
the close handler.

**Verify**: lifecycle test proves restoration happens once after the visible
modal leaves the tree, not synchronously before it.

## Test plan

- table: vertical and horizontal scrolling, action strip, menu reset.
- Mermaid: centered non-zero canvas, pan/zoom interaction, error fallback.
- close button, system back, accessibility escape.
- focus restoration exactly once after dismissal.
- safe-area padding on iOS and Android.

## Done criteria

- [ ] Tall table rows and wide columns are reachable.
- [ ] Mermaid occupies a centered full-screen canvas and relayouts.
- [ ] No nested generic horizontal scroller wraps Mermaid.
- [ ] Focus restoration is post-dismiss and single-shot.
- [ ] Focused tests and typecheck pass.
- [ ] Device-contract and changeset checks pass; no dependency is added.

## STOP conditions

- A supported RN version lacks the modal lifecycle callback used by the plan.
- Fixing canvas size requires changing the public Mermaid adapter contract;
  stop and hand that requirement to Plan 007.
- The work appears to require a second modal, dropdown, or button primitive;
  report the missing shared primitive behavior instead.
- Nested gestures make table scrolling impossible on one platform after two
  focused attempts; report the exact platform behavior.

## Maintenance notes

Any new fullscreen content must choose document or canvas mode explicitly.
Review safe areas and focus on both platforms when changing the modal shell.
