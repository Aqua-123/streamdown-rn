# Plan 005: Align table semantics, columns, alignment, and chrome

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c1bb451..HEAD -- src/renderers/ASTRenderer.tsx src/core/security/treePolicy.ts src/themes/index.ts src/controls/TableControls.tsx src/renderers/__tests__ src/__tests__/security-policy.test.ts tests/parity/ports/streamdown/components.test.test.ts tests/parity/ports/streamdown/table-*.test.test.ts`
> If this prints any in-scope change, compare the current-state excerpts below
> with the live code. STOP on a mismatch instead of layering this plan over an
> unknown table implementation.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-native-table-disclosure-menu.md`,
  `plans/004-shared-fullscreen-layout.md`
- **Category**: bug, accessibility, UI
- **Planned at**: commit `c1bb451`, 2026-07-21

## Why this matters

Every native table row currently sizes its cells independently, so the same
logical column can have different edges in different rows. Parsed GFM
alignment is ignored, and header cells are exposed to component overrides and
security filtering as `td` instead of `th`. This plan fixes those shared
renderer and policy roots while preserving the table dropdown and fullscreen
implementations already landed in plans 003 and 004.

## Current state

- `src/renderers/ASTRenderer.tsx:150-180` maps every `tableCell` to `td` before
  selecting `components` overrides.
- `src/renderers/ASTRenderer.tsx:299-332` maps each row independently and gives
  every cell `{ minWidth: 120, flexGrow: 1 }`. The parsed table node's `align`
  array is unused.
- `src/core/security/treePolicy.ts:35-90` also maps every `tableCell` to `td`.
  `filterChildren` knows the parent and child index, but does not carry whether
  a `tableRow` is the first row of its table into the cell traversal.
- `src/themes/index.ts:252-269` contains an unused `table` wrapper style while
  `TableControls.tsx:80-97` is the actual owner of the outer panel. Header and
  body cell styles live in `getBlockStyles` and should remain the renderer's
  cell-style source.
- `TableControls` already owns the bordered outer surface and plan-003
  `Dropdown` actions. `ASTRenderer` already owns the rounded, horizontally
  scrollable inner surface. Preserve that two-layer hierarchy.
- The pinned web reference at
  `.reference/streamdown/packages/streamdown/lib/table/index.tsx` uses an outer
  bordered action panel and an inner rounded bordered table surface. Match that
  hierarchy with native styles; do not copy browser-only DOM or Tailwind code.
- Test conventions use Jest with `@testing-library/react-native`; model new
  renderer assertions on `src/renderers/__tests__/native-renderer.test.tsx`,
  semantic override assertions on
  `tests/parity/ports/streamdown/components.test.test.ts`, and policy assertions
  on `src/__tests__/security-policy.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Table renderer and semantics | `bun run test --silent -- src/renderers/__tests__/native-renderer.test.tsx src/renderers/__tests__/table-layout.test.tsx tests/parity/ports/streamdown/components.test.test.ts src/__tests__/security-policy.test.ts` | all listed suites pass |
| Table controls/fullscreen | `bun run test --silent -- src/controls/__tests__/native-controls.test.tsx tests/parity/ports/streamdown/table-dropdowns.test.test.ts tests/parity/ports/streamdown/table-fullscreen.test.test.ts` | all listed suites pass |
| Typecheck | `bun run type-check` | exit 0 |
| Device contract | `bun run test:device-contract --silent` | all device-contract suites pass |
| Changeset | `bun run changeset:verify` | exit 0 and the new changeset is counted |
| Full regression | `bun run test --silent` | no new failure; the existing out-of-scope `pan-zoom-interaction.test.test.ts` toolbar-style assertion may remain the sole failure |

## Scope

**In scope** — modify only these files:

- `src/renderers/ASTRenderer.tsx`
- `src/core/security/treePolicy.ts`
- `src/themes/index.ts`
- `src/controls/TableControls.tsx`
- `src/renderers/__tests__/native-renderer.test.tsx`
- `src/renderers/__tests__/table-layout.test.tsx` (create if clearer than
  extending the general renderer suite)
- `src/__tests__/security-policy.test.ts`
- `tests/parity/ports/streamdown/components.test.test.ts`
- directly affected existing `tests/parity/ports/streamdown/table-*.test.test.ts`
  or `src/controls/__tests__/native-controls.test.tsx` only
- one `.changeset/*.md`

**Out of scope** — do not touch:

- `src/components/ui/Button.tsx` or `src/components/ui/Dropdown.tsx`
- table copy/download formats, capability checks, menu state, dismissal, or
  focus behavior from plans 002-004
- `src/controls/FullscreenModal.tsx`
- `src/controls/PanZoomSurface.tsx`
- parser or remark configuration; remark-gfm already supplies `table.align`
- measured-text/native-layout feedback loops, column resizing, sorting, frozen
  columns, or spreadsheet interaction
- visual baseline infrastructure and device screenshots; plan 008 owns them
- new dependencies or public configuration for width constants

## Git workflow

- Create an isolated worktree from `c1bb451` on branch
  `codex/005-table-semantics-layout`.
- Match the existing conventional commit style, for example
  `fix(table): align native columns and semantics`.
- Commit the implementation in the isolated worktree. Do not push, merge, or
  modify the caller's branch.

## Steps

### Step 1: Characterize shared column widths and GFM alignment

Create `src/renderers/__tests__/table-layout.test.tsx` using direct MDAST table
nodes, `ASTRenderer`, `lightTheme`, and `StyleSheet.flatten` where necessary.
Cover a three-column table whose header/body values have deliberately uneven
lengths and `align: ['left', 'center', 'right']`.

Add the smallest local helpers in `ASTRenderer.tsx` needed to compute column
widths before rows are rendered:

- logical column count is the maximum cell count across all rows;
- normalize each cell's `textValue` by collapsing whitespace and trimming;
- estimate width from Unicode code-point count using a fixed 8-point character
  estimate plus the existing 32 points of horizontal cell padding;
- clamp every column to a minimum of 120 and maximum of 320 points;
- reuse the exact numeric `width` for a column in header and every body row;
  remove per-cell `flexGrow` so rows cannot independently redistribute space.

Keep constants and helpers private to `ASTRenderer.tsx`; do not add a public
column-sizing API. Missing `align` entries default to `left`. Map alignment to
both the cell container (`flex-start`, `center`, `flex-end`) and a full-width
child `Text` (`left`, `center`, `right`). Preserve bold header typography.

Add right-hand column separators except on the final logical column, while
retaining existing row separators. The test must assert equal widths for each
column across rows, distinct widths for deliberately short/long columns,
alignment on header and body cells, and the absence of a right border on the
last column.

**Verify**:
`bun run test --silent -- src/renderers/__tests__/native-renderer.test.tsx src/renderers/__tests__/table-layout.test.tsx`
→ both suites pass.

### Step 2: Route header and body cells through `th` and `td` overrides

Extend the existing override lookup in `ASTRenderer.tsx` with an optional
explicit semantic element name. In `renderTable`, pass `th` for cells in row
zero and `td` for cells in later rows. Do not change `semantic.type`; both
remain MDAST `tableCell` nodes, while the selected component key carries the
header/body distinction. `data.hName`, when explicitly present, must retain
precedence over the contextual fallback.

Update the table override parity case in
`tests/parity/ports/streamdown/components.test.test.ts` to register distinct
`th` and `td` components and prove each is invoked once for the one-column,
two-row table. Keep the existing table and row override assertions.

**Verify**:
`bun run test --silent -- tests/parity/ports/streamdown/components.test.test.ts`
→ suite passes and the table case distinguishes one header from one body cell.

### Step 3: Make security filtering distinguish table headers

Change the private traversal in `src/core/security/treePolicy.ts` so recursion
into a table's first `tableRow` carries `th` as the contextual element for its
cells, and later rows carry `td`. Keep the current `data.hName` precedence and
all non-table filtering behavior unchanged. Do not annotate or mutate the
input tree; `applySecurityPolicy` must remain clone-based.

Add policy tests using a parsed GFM table that prove:

- `disallowedElements: ['th']` removes header cells but preserves body cells;
- `disallowedElements: ['td']` removes body cells but preserves header cells;
- `allowedElements: ['table', 'tr', 'th', 'td']` preserves both rows/cell
  classes (text nodes remain permitted because they have no semantic name).

**Verify**:
`bun run test --silent -- src/__tests__/security-policy.test.ts`
→ suite passes with all three contextual table-policy cases.

### Step 4: Finish the native table chrome without changing controls

Keep `TableControls` as the sole owner of the outer panel and `ASTRenderer` as
the owner of the inner horizontal surface. Remove the unused
`getBlockStyles().table` entry from `src/themes/index.ts`; do not introduce a
second wrapper-style prop. In `TableControls`, keep the 8-point outer gap and
add only the missing 4-point gap/alignment to the existing action toolbar so
the shared 44-point buttons remain separated. Preserve the existing border,
radius, background, and padding props.

In `ASTRenderer`, preserve the rounded inner border/background, distinct
header surface, row separators, and new column separators from step 1. Add a
focused assertion that the outer panel and inner scroll surface remain two
separate bordered layers in both inline and fullscreen rendering. Do not
modify `Button`, `Dropdown`, menu positioning, or fullscreen lifecycle code.

**Verify**:
`bun run test --silent -- src/controls/__tests__/native-controls.test.tsx tests/parity/ports/streamdown/table-dropdowns.test.test.ts tests/parity/ports/streamdown/table-fullscreen.test.test.ts`
→ all three suites pass.

### Step 5: Document and verify the behavior

Add one patch changeset explaining that native tables now preserve contextual
header semantics, shared column widths, GFM alignment, and consistent chrome.
Do not add dependency or migration documentation: the public API is unchanged.

Run every command in "Commands you will need". The full suite may retain only
the named pre-existing PanZoom failure; any additional failure is a regression
and must be fixed within scope or reported as a STOP condition.

## Test plan

- New `table-layout.test.tsx`: uneven values, three alignment modes, identical
  width per column across rows, min/max clamps, row/column separators.
- Updated `components.test.test.ts`: distinct `components.th` and
  `components.td` selection without changing semantic node type.
- Updated `security-policy.test.ts`: `th`/`td` allowed/disallowed behavior.
- Existing control/dropdown/fullscreen suites: prove chrome changes did not
  fork shared primitives or modal/menu lifecycle.

## Done criteria

- [ ] Drift check is empty at executor start.
- [ ] Header overrides use `th`; body overrides use `td`.
- [ ] Security allow/disallow filtering distinguishes `th` and `td`.
- [ ] Each logical column uses one fixed numeric width from 120 through 320 in
  all rows and applies its parsed GFM alignment.
- [ ] Outer table panel, inner table surface, header surface, row separators,
  and column separators are covered by focused native assertions.
- [ ] No direct `Pressable`, new menu, or alternate fullscreen implementation
  is added.
- [ ] Focused suites, typecheck, device contract, and changeset verification
  pass.
- [ ] Full Jest has no new failure beyond the named Plan-007 PanZoom baseline.
- [ ] Only in-scope files and one changeset are changed.

## STOP conditions

Stop and report instead of improvising if:

- the drift check prints an in-scope change or current code no longer matches
  the excerpts above;
- `table.align` is absent from the MDAST node produced by the existing parser;
- contextual `th` filtering would require changing the public
  `SecurityPolicyOptions` contract or mutating parsed input nodes;
- table chrome requires modifying `Button`, `Dropdown`, or `FullscreenModal`;
- a measured-text dependency, native module, or public sizing option appears
  necessary;
- any focused verification fails twice after a reasonable in-scope fix.

## Maintenance notes

The width heuristic is deliberately bounded and text-only. It provides stable
native columns without a render/measure feedback loop; complex scripts and
embedded custom nodes remain approximate. Replace the private estimator only
if device evidence shows this bounded approach is insufficient. Plan 008 owns
phone/tablet, theme, large-text, inline, and fullscreen screenshots; do not add
parallel screenshot machinery here.
