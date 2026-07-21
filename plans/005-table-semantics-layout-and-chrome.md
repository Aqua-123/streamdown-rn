# Table semantics, layout, and chrome

## Status

- Priority: P1
- Effort: Medium
- Risk: Medium
- Depends on: `003-native-table-disclosure-menu.md`, `004-shared-fullscreen-layout.md`

## Problem

Native tables currently calculate every cell independently, ignore GFM column alignment, and expose header cells through the same semantic override path as body cells. The resulting columns can drift between rows, header semantics are incomplete, and the visual hierarchy does not match Streamdown's outer panel, header surface, separators, and consistently aligned columns.

## Evidence

- `src/renderers/ASTRenderer.tsx` renders each row as an independent flex row and gives every cell `minWidth: 120` with `flexGrow: 1`; widths are not shared by column.
- The renderer detects the first row for styling but maps table cells through the `td` semantic component path, so `th` overrides and security policy are not applied contextually.
- Parsed table alignment metadata is not applied to header or body content.
- `src/themes/index.ts` and `src/controls/TableControls.tsx` split table chrome across unrelated styles, producing duplicated borders/padding instead of a clear outer and inner hierarchy.
- Table actions now share `Button` and format choices share `Dropdown`; chrome changes must style those consumers through their existing props rather than replace either primitive.
- Existing component tests prove text rendering and actions, but do not prove aligned columns, `th` overrides, or a real fullscreen table.

## Scope

- `src/renderers/ASTRenderer.tsx`
- `src/core/security/treePolicy.ts`
- `src/themes/index.ts`
- `src/controls/TableControls.tsx`
- Table parser, renderer, security, and component tests
- Native fixture table scenarios
- Package changeset

## Implementation plan

1. Add characterization tests for:
   - one shared width per logical column across every row;
   - `left`, `center`, and `right` GFM alignment;
   - contextual `th` versus `td` semantic component overrides;
   - security policy behavior for both header and body cells.
2. Preserve header/body context while traversing table rows. Resolve the semantic component and security rule as `th` for header cells and `td` for body cells without changing non-table node behavior.
3. Derive one deterministic width per column before rendering rows. Use the maximum normalized textual-content estimate for that column, clamped to documented minimum and maximum widths, and reuse the result in header and body cells.
   - Keep the estimator isolated so a future measured-text implementation can replace it.
   - Document that complex scripts and embedded custom nodes may be approximate; do not claim pixel-perfect intrinsic web layout.
4. Apply parsed column alignment to both cell container and text alignment, with a stable default when alignment is absent.
5. Consolidate chrome into theme-driven layers:
   - outer action/container panel;
   - horizontally scrollable table surface;
   - distinct header surface;
   - consistent row and column separators;
   - body typography and padding that remain legible at narrow widths.
6. Keep action hit targets at least 44 points by retaining the shared `Button` primitive. Pass theme-driven colors/styles to `Button` and `Dropdown`; do not add direct `Pressable` controls, local menu containers, or duplicate dismissal state.
7. Add focused fixture cases for uneven content widths, alignment markers, long cells, and custom `th`/`td` renderers.
8. Add a changeset describing the semantic fix and table appearance correction.

## Verification

- Run the focused parser, native renderer, security, and table-control suites.
- Run `bun run type-check`.
- Run the full Jest suite and distinguish pre-existing failures from regressions.
- In the fixture, verify the same column edges in every row at phone and tablet widths, in inline and fullscreen modes.
- Verify both themes and increased text size without clipped headers or inaccessible actions.

## Done when

- Header cells use `th` semantics and body cells use `td` semantics.
- Every logical column has a shared width and honors GFM alignment.
- Inline and fullscreen tables share the same theme-driven chrome.
- Focused tests cover semantics, layout, alignment, and overflow.

## Out of scope

- Table download-menu disclosure mechanics, owned by plan 003.
- Generic fullscreen scrolling and dismissal, owned by plan 004.
- Changes to `src/components/ui/Button.tsx` or `Dropdown.tsx`; STOP and report if the desired table chrome cannot be expressed through their public props.
- Spreadsheet features such as sorting, resizing, and frozen columns.
