# Plan 003: Replace table format lines with a native disclosure menu

> **Executor instructions**: Migrate the table's copy and download choices to
> the existing `src/components/ui/Dropdown.tsx` primitive. Do not build another
> disclosure surface or add a menu dependency. Update `plans/README.md` when
> done.
>
> **Drift check (run first)**:
> `git diff --stat 50828ac..HEAD -- src/components/ui src/controls/TableControls.tsx src/controls/ActionButton.tsx src/controls/__tests__ tests/parity/ports/streamdown/table-dropdowns.native.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-capability-truthful-native-actions.md`
- **Category**: bug, accessibility
- **Planned at**: commit `50828ac`, 2026-07-21

## Why this matters

Table formats currently enter normal layout as wide 44-point action rows, so
they read visually as line options and can push the table down. The web oracle
uses a compact, bordered floating menu anchored under its trigger. React Native
needs the same hierarchy with native dismissal and focus semantics.

## Current state

- `src/controls/TableControls.tsx:38-52` renders a trigger toolbar followed by
  an in-flow `View` with `minWidth: 180` and generic `ActionButton` children.
- The trigger has no `accessibilityState.expanded` and the choices have no
  labelled menu/group container.
- Closing fullscreen does not clear fullscreen-scoped menu state
  (`TableControls.tsx:58-68`).
- The live playground download menu is a floating two-item surface (`CSV`,
  `Markdown`) aligned beneath the download icon.
- Reuse serialization and capability calls; this plan changes presentation,
  not payloads.
- `src/components/ui/Dropdown.tsx` already supplies the floating `Modal`,
  viewport collision handling, trigger expanded state, outside/system
  dismissal, focus restoration, and async item error lifecycle. This plan is a
  consumer migration, not a second primitive implementation.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Unit | `bun run test --runInBand src/controls/__tests__/native-controls.test.tsx tests/parity/ports/streamdown/table-dropdowns.native.tsx` | pass |
| Typecheck | `bun run type-check` | pass |
| Device contract | `bun run test:device-contract --silent` | pass |

## Scope

**In scope**:

- `src/controls/TableControls.tsx`
- focused unit/parity tests
- fixture scenario additions needed to open each menu
- one `.changeset/*.md`

**Out of scope**:

- table cell sizing/styling
- serialization formats
- general-purpose application menu/navigation framework
- adding a menu dependency
- modifying `src/components/ui/Button.tsx` or `Dropdown.tsx`; if the shared
  contract is insufficient, STOP and report the missing primitive behavior

## Git workflow

- Branch: `codex/003-native-table-menu`
- Commit style: `fix(table): render native format menus`
- Do not push unless instructed.

## Steps

### Step 1: Characterize disclosure behavior

Add tests for closed/open state, mutual exclusion between copy and download,
outside/back dismissal, selection dismissal, fullscreen close/reopen cleanup,
and disabled streaming state. Assert trigger `expanded` state and a labelled
choice container.

**Verify**: new tests fail against current in-flow implementation.

### Step 2: Replace both in-flow lists with the shared Dropdown

Use `Dropdown.Root`, `Dropdown.Trigger`, `Dropdown.Popup`, and `Dropdown.Item`
for both copy and download. Keep only one root open at a time using the table's
existing menu state. Pass theme colors and labels through the primitive's
public props. Keep serialization and capability calls in `TableControls`.

**Verify**: unit tests pass; there is no in-flow format list in the rendered
table tree.

### Step 3: Verify inherited disclosure accessibility

Assert the expanded trigger, labelled menu/items, system dismissal, and focus
restoration already supplied by `Dropdown`. Add consumer assertions only; do
not duplicate primitive lifecycle logic in `TableControls`.

**Verify**: device contract sees the expanded trigger and choices; system back
closes the menu.

## Test plan

- copy menu: Markdown, CSV, TSV in that order.
- download menu: CSV, Markdown in that order.
- only one menu open at a time.
- selection invokes exactly one adapter call and closes.
- failed selection stays understandable and retryable.
- inline and fullscreen menus do not leak state into each other.
- narrow viewport clamps the menu on-screen.

## Done criteria

- [ ] Format choices appear in a floating vertical surface, not document flow.
- [ ] Trigger state, dismissal, focus, and 44-point targets are covered.
- [ ] Payload calls remain unchanged.
- [ ] Focused tests, device contract, and typecheck pass.
- [ ] No new dependency added.

## STOP conditions

- Anchor measurement is unavailable on a supported RN version.
- The shared `Dropdown` primitive is absent or cannot express controlled mutual
  exclusion between the two table menus.
- A menu role/prop is unsupported by RN 0.81; use a labelled native group and
  document the adaptation instead of inventing web props.
- The implementation starts becoming a general popover framework.

## Maintenance notes

The fullscreen plan reuses this `Dropdown` consumer. Review primitive
positioning after any safe-area or modal changes; keep fixes in the primitive
only when they apply to every consumer.
