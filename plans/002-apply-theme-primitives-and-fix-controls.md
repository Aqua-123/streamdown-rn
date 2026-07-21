# Plan 002: Apply semantic primitives to blocks and shared controls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command before continuing. Stop on any condition listed below;
> do not invent a parallel theme path. Update `plans/README.md` when complete
> unless the reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat ccf15eb..HEAD -- src/themes/index.ts src/renderers/ASTRenderer.tsx src/plugins/mermaid src/components/ui src/controls src/plugins/__tests__ src/renderers/__tests__`
> Plan 001 is expected drift. Confirm its semantic primitive contract exists;
> any other mismatch with the excerpts below is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-semantic-theme-primitives.md`
- **Category**: bug
- **Planned at**: commit `ccf15eb`, 2026-07-22

## Why this matters

The black Mermaid download icon is caused by a shared `Button` primitive that
colors text but not element children. Separately, tables, code blocks, Mermaid,
dropdowns, and zoom controls still consume legacy colors and hard-coded radii.
Fixing the shared primitive once and migrating consumers to Plan 001's resolved
roles removes the visible bug and restores the intended background/sidebar,
muted-foreground, border, focus-ring, popover, and radius hierarchy.

## Current state

- `src/components/ui/Button.tsx:42-44` applies `foregroundColor` only when it
  creates a `Text` node.
- `src/controls/ActionButton.tsx:49-51` and
  `src/controls/TableControls.tsx:20-22` separately clone icon elements to add
  color. These are symptom-level workarounds.
- `src/plugins/mermaid/MermaidBlock.tsx:95-97` passes the download SVG directly
  to `Dropdown.Trigger`, so it stays at its default/current color.
- `src/themes/index.ts:202-273` hard-codes radius 4/12 and uses
  `codeBackground` for inline code, code shells, and table headers.
- `src/plugins/mermaid/index.ts:43-51` maps secondary, muted, faint, and line
  variables to one legacy `muted` value.
- Pinned web Streamdown uses `bg-sidebar` wrappers, `bg-background` bodies,
  `text-muted-foreground` controls, `bg-popover`/background menus, and
  theme-controlled borders/radii. Preserve that hierarchy.

Bug excerpt (`src/components/ui/Button.tsx:42`):

```tsx
{typeof children === 'string' || typeof children === 'number'
  ? <Text style={[styles.text, { color: foregroundColor }, textStyle]}>{children}</Text>
  : children}
```

Mermaid role collapse (`src/plugins/mermaid/index.ts:43`):

```ts
'--_text-sec': colors.muted,
'--_text-muted': colors.muted,
'--_text-faint': colors.muted,
'--_line': colors.muted,
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Primitive tests | `bun run test --silent --runTestsByPath src/components/ui/__tests__/primitives.test.tsx` | pass |
| Renderer/control tests | `bun run test --silent --runTestsByPath src/controls/__tests__/native-controls.test.tsx src/controls/__tests__/translations-icons-panzoom.test.tsx src/renderers/__tests__/table-layout.test.tsx src/plugins/__tests__/mermaid.test.tsx` | all pass |
| Typecheck | `bun run type-check` | exit 0 |
| Device contract | `bun run test:device-contract --silent` | all pass |
| Changeset | `bun run changeset:verify` | exit 0 |
| Full tests | `bun run test --silent` | all pass |

## Scope

**In scope**:

- `src/themes/index.ts`
- `src/renderers/ASTRenderer.tsx`
- `src/plugins/mermaid/index.ts`
- `src/plugins/mermaid/MermaidBlock.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Dropdown.tsx`
- `src/components/ui/__tests__/primitives.test.tsx`
- `src/controls/ActionButton.tsx`
- `src/controls/TableControls.tsx`
- `src/controls/PanZoomSurface.tsx`
- `src/controls/__tests__/native-controls.test.tsx`
- `src/controls/__tests__/translations-icons-panzoom.test.tsx`
- `src/renderers/__tests__/table-layout.test.tsx`
- `src/plugins/__tests__/mermaid.test.tsx`
- `.changeset/semantic-theme-consumers.md` (create)
- `plans/README.md` (status only)

**Out of scope**:

- Fixture/harness palettes, safe areas, or baseline images; Plan 003 owns them.
- Changing the supplied primitive values.
- Changing Shiki syntax token colors or adding a highlighter.
- Redesigning dropdown positioning, modal lifecycle, or pan/zoom gestures.
- Adding another icon wrapper/helper; color must be fixed in shared `Button`.

## Git workflow

- Branch: `codex/002-apply-theme-primitives`
- Conventional commit: `fix(theme): apply semantic primitives to native blocks`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Fix foreground propagation at the shared Button root

In `Button.tsx`, when `foregroundColor` is present and `children` is a valid
React element, clone it with `{ color: foregroundColor }`. Preserve strings,
numbers, fragments, and non-elements. This is the same existing behavior in
`ActionButton`, moved to the common route used by Dropdown triggers.

After the shared behavior is tested, delete the duplicate color-cloning code
from `ActionButton.tsx` and `TableControls.tsx`; pass raw icons to `Button` or
`Dropdown.Trigger`.

Add a primitive test with `react-native-svg` proving a `currentColor` SVG child
receives the requested dark foreground. Add a Mermaid control assertion proving
download, copy, and fullscreen receive the same muted foreground.

**Verify**:
`bun run test --silent --runTestsByPath src/components/ui/__tests__/primitives.test.tsx src/controls/__tests__/native-controls.test.tsx src/plugins/__tests__/mermaid.test.tsx` → all pass.

### Step 2: Add themeable radius and focus treatment to shared controls

Extend `ButtonProps` with optional numeric `radius` and `focusRingColor`.
Track `onFocus`/`onBlur` inside `Button` while still calling consumer handlers.
Reserve a transparent border in the base style so showing the ring does not
move layout; when focused, use `focusRingColor`. Default to existing geometry
when these props are absent so third-party primitive use remains compatible.

Pass the resolved `ring` and base `radius` through library-owned buttons.
Add equivalent radius inputs to `Dropdown.Popup`; do not add a context or new
provider solely for these two values.

Use radius relationships derived from the single base value:

- inline code: `max(0, radius - 6)` → 4 for the built-in palette;
- inner table/code/Mermaid surfaces: `max(0, radius - 4)` → 6;
- table/dropdown/control wrappers: `max(0, radius - 2)` → 8;
- code/Mermaid outer wrappers: `radius + 2` → 12.

Place the tiny radius helpers in `src/themes/index.ts` beside style generation;
do not create a new module.

**Verify**:
`bun run test --silent --runTestsByPath src/components/ui/__tests__/primitives.test.tsx src/controls/__tests__/translations-icons-panzoom.test.tsx` → pass, including focused/unfocused border assertions.

### Step 3: Migrate block surfaces by semantic role

At existing style-generation/render boundaries, read the fully resolved
`theme.primitives` established by Plan 001. Apply:

- document/body: `background` and `foreground`;
- links: `primary`;
- inline code and table headers: `muted` plus foreground;
- code/table/Mermaid outer wrappers: `sidebar`, `sidebarForeground`, and
  `sidebarBorder`;
- inner table/code/Mermaid bodies: `background` and `border`;
- control icons and labels: `mutedForeground`;
- dropdown popup: `popover`, `popoverForeground`, `border`;
- focused controls: `ring`;
- pan/zoom toolbar: `popover`, `border`, `mutedForeground`.

Do not remove the wrapper/body layering. Do not substitute card for sidebar
just because both happen to be close in the built-in palette.

Update focused table/control tests to assert semantic values, not merely the
presence of a `style` prop.

**Verify**:
`bun run test --silent --runTestsByPath src/controls/__tests__/native-controls.test.tsx src/renderers/__tests__/table-layout.test.tsx src/controls/__tests__/translations-icons-panzoom.test.tsx` → pass.

### Step 4: Restore Mermaid visual hierarchy

In `normalizeBeautifulMermaidSvg`, map roles distinctly:

- `--bg` → `background`
- `--fg`, `--_text` → `foreground`
- `--_text-sec` → `mutedForeground`
- `--_text-muted`, `--_line` → `chart2`
- `--_text-faint` → `chart3`
- `--_arrow` → `ring`
- `--_node-fill` → `card`
- `--_node-stroke`, `--_inner-stroke` → `border`
- `--_group-fill` → `background`
- `--_group-hdr` → `muted`
- `--_key-badge` → `border`

This uses the maintainer-supplied chart primitives rather than inventing more
diagram-only tokens. Expand the existing normalization test so one SVG contains
every variable and proves they do not collapse to one value in dark mode.

**Verify**:
`bun run test --silent --runTestsByPath src/plugins/__tests__/mermaid.test.tsx` → pass.

### Step 5: Add release metadata and run final gates

Add a minor changeset describing semantic component theming and the Mermaid
download icon correction. Run:

```sh
bun run type-check
bun run test:device-contract --silent
bun run test --silent
bun run changeset:verify
git diff --check
git status --short
```

Expected: all checks pass and only in-scope files plus the plan status change
are modified. Leave `benchmarks/results/` untouched.

## Test plan

- Shared SVG-child color and focus tests in `primitives.test.tsx`.
- Mermaid action-strip color regression and all-variable palette mapping in
  `mermaid.test.tsx`.
- Dark semantic table/code/control assertions in existing focused suites.
- Full Jest and device-contract runs for cross-consumer regression coverage.

## Done criteria

- [ ] Mermaid download, copy, and fullscreen icons use one muted foreground.
- [ ] Duplicate icon-cloning helpers are removed from control consumers.
- [ ] Library blocks consume resolved semantic roles as specified.
- [ ] Mermaid secondary, muted, faint, and connector roles stay distinct.
- [ ] Focus rings and radii come from the theme contract.
- [ ] Focused, device-contract, full, typecheck, and changeset gates pass.
- [ ] No new dependency or parallel theme provider exists.
- [ ] No file outside scope was modified.

## STOP conditions

Stop and report if:

- Plan 001 is incomplete or `theme.primitives` is not fully resolved.
- Coloring valid element children breaks a documented custom icon contract.
- A cross-platform focus indication requires a new native dependency.
- The role migration requires changing the supplied palette values.
- Verification fails twice after a reasonable correction.

## Maintenance notes

- `Button` is the single icon-color and focus boundary; future consumers must
  not reintroduce local `cloneElement` workarounds.
- Reviewers should compare semantic roles, not literal colors, in consumer
  code. Literal built-in values belong only in the theme definitions/tests.
- Plan 003 owns screenshots; do not accept visual baselines in this plan.
