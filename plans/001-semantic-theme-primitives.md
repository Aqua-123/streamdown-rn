# Plan 001: Introduce the OKLCH-derived semantic theme primitives

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer says they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ccf15eb..HEAD -- src/core/types.ts src/themes/index.ts src/index.ts src/__tests__/public-api.test.tsx docs/api.md docs/migration.md .changeset`
> If an in-scope file changed, compare the current-state excerpts below with
> live code. A semantic mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ccf15eb`, 2026-07-22

## Why this matters

The public theme currently collapses surfaces, de-emphasized text, borders,
links, and component chrome into `muted`, `accent`, and `codeBackground`.
That cannot express the maintainer-selected shadcn primitives and forces
unrelated renderers to change together. This plan adds the supplied semantic
palette once, keeps existing custom themes working, and gives later renderer
work a single resolved source of truth.

The OKLCH values supplied by the maintainer are canonical design values.
Native styles must use the precomputed sRGB values in this plan; do not add a
runtime converter and do not pass `oklch(...)` strings to React Native.

## Current state

- `src/core/types.ts:209-250` defines `ThemeColors` with only background,
  foreground, muted, accent, code, border, link, and syntax roles.
- `src/themes/index.ts:18-56` hard-codes the old slate palettes.
- `src/themes/index.ts:104-108` returns custom `ThemeConfig` objects unchanged.
- `src/StreamdownRN.tsx:110` already resolves the theme once with `getTheme`;
  keep that single normalization boundary.
- `src/index.ts` exports UI primitives but not the built-in themes or theme
  types. Public export assertions live in `src/__tests__/public-api.test.tsx`.

Current contract excerpt (`src/core/types.ts:209`):

```ts
export interface ThemeColors {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  codeBackground: string;
  codeForeground: string;
  border: string;
  link: string;
  // syntax fields...
}
```

Current normalization excerpt (`src/themes/index.ts:104`):

```ts
export function getTheme(theme: 'dark' | 'light' | ThemeConfig): ThemeConfig {
  if (typeof theme === 'object') return theme;
  return theme === 'light' ? lightTheme : darkTheme;
}
```

## Target primitive contract

Add a public `ThemePrimitives` interface with these camelCase fields:

`background`, `foreground`, `card`, `cardForeground`, `popover`,
`popoverForeground`, `primary`, `primaryForeground`, `secondary`,
`secondaryForeground`, `muted`, `mutedForeground`, `accent`,
`accentForeground`, `destructive`, `border`, `input`, `ring`, `chart1` through
`chart5`, `sidebar`, `sidebarForeground`, `sidebarPrimary`,
`sidebarPrimaryForeground`, `sidebarAccent`, `sidebarAccentForeground`,
`sidebarBorder`, `sidebarRing`, and numeric `radius`.

Use these exact native values, precomputed from the supplied OKLCH palette:

| Primitive | Light | Dark |
|-----------|-------|------|
| background | `#ffffff` | `#0a0a0a` |
| foreground | `#0a0a0a` | `#fafafa` |
| card / popover | `#ffffff` | `#171717` |
| cardForeground / popoverForeground | `#0a0a0a` | `#fafafa` |
| primary | `#171717` | `#e5e5e5` |
| primaryForeground | `#fafafa` | `#171717` |
| secondary / muted / accent | `#f5f5f5` | `#262626` |
| secondaryForeground / accentForeground | `#171717` | `#fafafa` |
| mutedForeground | `#737373` | `#a1a1a1` |
| destructive | `#e7000b` | `#ff6467` |
| border / sidebarBorder | `#e5e5e5` | `rgba(255, 255, 255, 0.1)` |
| input | `#e5e5e5` | `rgba(255, 255, 255, 0.15)` |
| ring / sidebarRing | `#a1a1a1` | `#737373` |
| chart1 | `#d4d4d4` | `#d4d4d4` |
| chart2 | `#737373` | `#737373` |
| chart3 | `#525252` | `#525252` |
| chart4 | `#404040` | `#404040` |
| chart5 | `#262626` | `#262626` |
| sidebar | `#fafafa` | `#171717` |
| sidebarForeground | `#0a0a0a` | `#fafafa` |
| sidebarPrimary | `#171717` | `#1447e6` |
| sidebarPrimaryForeground | `#fafafa` | `#fafafa` |
| sidebarAccent | `#f5f5f5` | `#262626` |
| sidebarAccentForeground | `#171717` | `#fafafa` |
| radius | `10` | `10` |

`10` native points corresponds to the supplied `0.625rem` base radius.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `bun run test --silent --runTestsByPath src/themes/__tests__/theme-primitives.test.ts src/__tests__/public-api.test.tsx` | both suites pass |
| Typecheck | `bun run type-check` | exit 0, no errors |
| Docs | `bun run docs:verify` | exit 0 |
| Changeset | `bun run changeset:verify` | exit 0 |
| Full tests | `bun run test --silent` | all suites pass |

## Scope

**In scope**:

- `src/core/types.ts`
- `src/themes/index.ts`
- `src/themes/__tests__/theme-primitives.test.ts` (create)
- `src/index.ts`
- `src/__tests__/public-api.test.tsx`
- `docs/api.md`
- `docs/migration.md`
- `.changeset/semantic-theme-primitives.md` (create)
- `plans/README.md` (status only)

**Out of scope**:

- Renderer/component color migration; Plan 002 owns it.
- Fixture and visual baseline changes; Plan 003 owns them.
- Syntax token colors and Shiki themes; keep the existing palettes.
- A CSS parser, OKLCH converter, or new dependency.
- Removing legacy `ThemeColors` fields or breaking existing custom themes.

## Git workflow

- Branch: `codex/001-semantic-theme-primitives`
- Use conventional commits; final subject: `feat(theme): add semantic color primitives`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add the public semantic primitive type

In `src/core/types.ts`, add `ThemePrimitives` with the exact fields above.
Add `primitives?: Partial<ThemePrimitives>` to `ThemeConfig`. Keep it optional
so existing custom theme objects remain source-compatible. Do not change the
meaning of legacy `ThemeColors.muted`: it remains the old de-emphasized text
field until consumers migrate through the resolver.

Export `ThemeConfig`, `ThemeColors`, and `ThemePrimitives` from `src/index.ts`.

**Verify**:
`bun run type-check` → exit 0.

### Step 2: Define built-in palettes and one compatibility resolver

In `src/themes/index.ts`:

1. Define full light and dark `ThemePrimitives` constants using the exact
   native values in the table.
2. Attach the full primitive object to `lightTheme` and `darkTheme`.
3. Add `resolveThemePrimitives(theme: ThemeConfig): ThemePrimitives`.
4. For a custom theme, merge any supplied primitive overrides over a complete
   legacy fallback derived once as follows:
   - background/foreground from their legacy names;
   - card, popover, and sidebar from `codeBackground`;
   - their foregrounds from `codeForeground`;
   - muted background from `codeBackground` and muted foreground from legacy
     `muted`;
   - primary and link-facing roles from legacy `accent`/`link`;
   - border/input/ring/sidebarBorder from legacy `border`;
   - radius `10`;
   - charts from the closest existing syntax/muted values.
5. Make `getTheme` return a normalized object containing the resolved full
   `primitives` object. Do not mutate a caller-owned theme object.

Keep `lightTheme` and `darkTheme` referentially stable exports.

**Verify**:
`bun run test --silent --runTestsByPath src/themes/__tests__/theme-primitives.test.ts` → the new suite passes.

### Step 3: Lock compatibility and exact values with tests

Create `src/themes/__tests__/theme-primitives.test.ts`, following the direct
object assertions used elsewhere in the repo. Cover:

- every built-in primitive exactly matches the table;
- dark translucent border and input values remain rgba strings;
- `getTheme('light')` and `getTheme('dark')` return complete primitives;
- a frozen legacy custom `ThemeConfig` without `primitives` is not mutated and
  receives complete fallbacks;
- a partial custom primitive override replaces only the requested role;
- `radius` is numeric and equals 10.

Extend `src/__tests__/public-api.test.tsx` to prove the two themes and resolver
are importable from the package root.

**Verify**:
`bun run test --silent --runTestsByPath src/themes/__tests__/theme-primitives.test.ts src/__tests__/public-api.test.tsx` → both suites pass.

### Step 4: Document native usage and migration

Add a compact theme section to `docs/api.md` with a custom primitive override
example. Explain that built-ins are derived from the documented OKLCH palette
but expose native-safe strings and numeric radius values.

In `docs/migration.md`, document that existing `colors` custom themes continue
to work through compatibility fallbacks and that new customization should use
`primitives`. Do not promise literal `oklch()` support on native.

Add a minor changeset for `streamdown-rn`.

**Verify**:
`bun run docs:verify && bun run changeset:verify` → both exit 0.

### Step 5: Run final gates

Run:

```sh
bun run type-check
bun run test --silent
git diff --check
git status --short
```

Expected: checks pass; status contains only the in-scope files plus the plan
status update. Existing untracked `benchmarks/results/` is unrelated and must
remain untouched.

## Test plan

- New exact palette and compatibility tests in
  `src/themes/__tests__/theme-primitives.test.ts`.
- Public export assertion in `src/__tests__/public-api.test.tsx`.
- Full Jest run protects existing custom theme behavior.

## Done criteria

- [ ] All supplied primitive names exist in `ThemePrimitives`.
- [ ] Built-in themes contain the exact native values above.
- [ ] Legacy custom themes still resolve without changing their source shape.
- [ ] Package-root theme exports are tested.
- [ ] Typecheck, focused tests, full tests, docs, and changeset checks pass.
- [ ] No runtime dependency was added.
- [ ] No file outside scope was modified.

## STOP conditions

Stop and report if:

- Supporting semantic primitives requires removing or redefining a legacy
  `ThemeColors` field.
- React Native types reject one of the listed native color strings.
- Package-root theme exports create a circular dependency.
- Verification fails twice after a reasonable correction.
- An out-of-scope renderer must change to keep typecheck green.

## Maintenance notes

- Treat `ThemePrimitives` as the portable design contract and `ThemeColors` as
  the compatibility/syntax layer until a future major version removes it.
- Reviewers should check that every fallback is deterministic and that caller
  objects are not mutated.
- Plan 002 must consume only resolved primitives, not optional raw overrides.
