# Plan 003: Align the native harness and dark visual gates

> **Executor instructions**: Follow this plan in order and run every gate.
> Device capture requires configured simulators/emulators; if unavailable,
> complete source/unit checks, mark the plan BLOCKED with the exact missing
> device prerequisite, and do not fabricate manifests or screenshots. Update
> `plans/README.md` unless the reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat ccf15eb..HEAD -- fixtures/current-rn/App.js fixtures/current-rn/harness-app.js tests/visual tests/device/maestro docs/visual-testing.md`
> Plan 001/002 changes outside these paths are expected. Any in-scope mismatch
> with the current-state facts below is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-semantic-theme-primitives.md`, `plans/002-apply-theme-primitives-and-fix-controls.md`
- **Category**: tests
- **Planned at**: commit `ccf15eb`, 2026-07-22

## Why this matters

The interactive harness currently surrounds Streamdown's slate theme with a
separate zinc palette, so correct components still look mismatched. Its plain
root lets scrolled content appear beneath the iOS status area, and its 58-point
settings button overlays content while the scroll view reserves only 48 points.
Existing visual gates do not cover the interactive harness, dark tables, or
state/sequence Mermaid diagrams and do not wait for diagram readiness.

This plan makes the fixture consume the same exported primitives as the
library, fixes safe-area geometry in fixture code only, and adds deterministic
visual evidence for the reported states.

## Current state

- `fixtures/current-rn/harness-app.js:19-52` defines a separate zinc palette;
  dark canvas/surface values are `#09090b`, `#18181b`, and `#202023`.
- `fixtures/current-rn/harness-app.js:382` hard-codes dark preview `#111113`.
- `fixtures/current-rn/App.js:138-145` uses hard-coded `#111827/#e5e7eb` around
  `<Streamdown theme={theme}>`.
- Both fixture roots use a plain `View` with
  `contentInsetAdjustmentBehavior="automatic"`; neither places the complete
  screen inside a safe-area shell.
- `fixtures/current-rn/harness-app.js:411` positions a 58-point settings button
  24 points above the bottom; the ScrollView reserves only 48 points.
- `fixtures/current-rn/App.js:68-87` already contains deterministic
  `mermaid-sequence` and `mermaid-state` scenarios. Reuse them.
- `tests/visual/matrix.json` contains one dark native Mermaid flowchart and no
  interactive harness case.
- `tests/visual/capture.mjs:51-95` waits for generic fixture labels, then a fixed
  500 ms; it does not wait for table/code/Mermaid semantics.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fixture contracts | `bun run test:device-contract --silent` | all pass |
| Typecheck | `bun run type-check` | exit 0 |
| Docs | `bun run docs:verify` | exit 0 |
| iOS focused capture | `VISUAL_PLATFORM=ios VISUAL_DEVICE_ID=<udid> VISUAL_APP_SCHEME=<scheme> VISUAL_APP_ID=<id> VISUAL_CASE_ID=<case> bun run test:visual` | selected case passes comparison |
| Android focused capture | `VISUAL_PLATFORM=android VISUAL_DEVICE_ID=<serial> VISUAL_APP_SCHEME=<scheme> VISUAL_APP_ID=<id> VISUAL_CASE_ID=<case> bun run test:visual` | selected case passes comparison |

Baseline update commands additionally require the repository's documented
`REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME`.
Never invent those values.

## Scope

**In scope**:

- `fixtures/current-rn/App.js`
- `fixtures/current-rn/harness-app.js`
- `tests/visual/matrix.json`
- `tests/visual/capture.mjs`
- `tests/visual/baselines/*.png` and platform manifests, only after real capture
- `tests/device/maestro/semantic.yaml`
- `tests/device/maestro/harness.yaml`
- focused tests under `tests/device/` when required
- `tests/visual/README.md`
- `docs/visual-testing.md`
- `plans/README.md` (status only)

**Out of scope**:

- Library renderer, theme, primitive, dropdown, or Mermaid source files.
- Changing the supplied semantic palette.
- Hiding the settings button instead of reserving space for it.
- Editing PNGs, hashes, or manifests without a real device capture.
- Claiming physical VoiceOver/TalkBack evidence from simulator screenshots.

## Git workflow

- Branch: `codex/003-harness-dark-visual-gates`
- Conventional commit: `test(visual): align dark harness and component gates`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Derive fixture chrome from exported theme primitives

Import `lightTheme` and `darkTheme` from the package root, as established by
Plan 001. Select one theme object per current `theme` setting and derive the
harness palette from its resolved primitives. Keep only harness-specific
semantic aliases such as `success`, `warning`, and track colors local.

At minimum map:

- canvas/preview → `background`
- panel surface → `card`
- raised/modal surface → `popover`
- text → `foreground`
- muted/faint → `mutedForeground` and `chart2`
- accent/accentText → `primary`/`primaryForeground`
- tint → `muted`
- borders → `border`/`input`

Pass the selected full theme object to `Streamdown`. Apply the same selection
to `AutomatedFixture`; remove its `#111827/#e5e7eb` host colors. Do not copy the
primitive values into a second fixture constant.

**Verify**:
`bun run type-check && bun run test:device-contract --silent` → both pass.

### Step 2: Put fixture content and floating controls inside safe areas

Use the existing React Native safe-area pattern already used by
`src/controls/FullscreenModal.tsx`; do not add a dependency. Wrap both automated
and interactive fixture screens so scroll content does not pass beneath the
status bar/notch.

For the interactive harness, reserve at least:

`58 button height + 24 bottom offset + 16 breathing room = 98 points`

in the ScrollView content container, in addition to safe-area handling. Keep
the button reachable and visually above the canvas. Apply equivalent right and
bottom safe-area-aware placement through the shell rather than device-name
conditionals.

Add/adjust a device contract test that proves the safe-area wrapper exists and
the content bottom padding is at least 98.

**Verify**:
`bun run test:device-contract --silent` → all pass.

### Step 3: Add deterministic semantic readiness to visual capture

Extend `capture.mjs` with a small scenario-to-required-semantics mapping:

- table/control scenario: table text plus its control toolbar action;
- code scenario: language label plus code text/control;
- Mermaid scenarios: accessible Mermaid image/surface plus a known diagram
  label or fixture state;
- harness: `Streamdown Lab` and `Open harness controls`.

Poll the existing Android hierarchy or Maestro assertions until those elements
exist. Remove reliance on the fixed 500 ms as the proof of renderer readiness;
a short stabilization delay after semantic readiness is acceptable. Keep the
existing timeout bounded and fail with the missing semantics in the message.

**Verify**:
Run the capture script with an invalid/unavailable expected semantic in a
focused development test or extracted pure mapping assertion; it must fail
instead of taking a premature screenshot. Then run
`bun run test:device-contract --silent` → pass.

### Step 4: Expand the focused dark matrix

Add narrow iOS/Android-capable cases for:

- dark table controls/content (`controls` is acceptable if its required table
  semantics are asserted);
- dark code at font scale 1.0 or 1.3, keeping the existing 2.0 case;
- dark Mermaid flowchart;
- dark `mermaid-sequence`;
- dark `mermaid-state`;
- dark interactive `harness` with the settings button closed.

Do not multiply direction/font/layout permutations for every new case; one
narrow LTR 1.0/1.3 regression case per reported surface is enough. Update the
matrix schema/hash workflow as the existing script requires.

Update `semantic.yaml`/`harness.yaml` only as needed for the scenario-specific
assertions. The harness flow must also open the controls sheet and prove it is
visible, then close it before the baseline screenshot if the matrix specifies
the closed state.

**Verify**:
Run each new case on at least one configured platform without baseline update;
expected before new reviewed baselines exist: a clear missing/stale-baseline
failure only after semantic readiness succeeds.

### Step 5: Capture and review both platforms

Using the packed Expo 56 Release-Hermes fixture and real configured simulator
and emulator:

1. Perform a complete reviewed baseline update for iOS and Android with an
   operator-provided review ID/runtime.
2. Inspect the new PNGs for: no black Mermaid download icon, consistent host
   and component backgrounds, visible border hierarchy, distinct Mermaid text
   hierarchy, no status-area overlap, and no settings-button obstruction.
3. Run a clean comparison on both platforms after the update.

Expected: every case is represented in each manifest and clean comparison is
within the existing `0.250%` different-pixel budget.

If either device is unavailable, do not update either manifest partially as a
substitute. Mark the plan BLOCKED with the exact missing device/runtime.

### Step 6: Make documentation match evidence

Update `tests/visual/README.md` and `docs/visual-testing.md` with the actual new
matrix count, scenarios, review ID, capture date, and comparison ranges. Do not
claim physical accessibility testing.

Run:

```sh
bun run type-check
bun run test:device-contract --silent
bun run docs:verify
git diff --check
git status --short
```

Expected: all checks pass; only in-scope files and real reviewed artifacts are
modified. Leave `benchmarks/results/` untouched.

## Test plan

- Device contract for safe-area shell and minimum FAB clearance.
- Scenario-specific capture readiness for table, code, Mermaid, and harness.
- Real dark visual cases for table, code, flowchart, sequence, state, and
  interactive harness on both iOS and Android.
- Clean post-update pixel comparison on both platforms.

## Done criteria

- [ ] Fixture chrome derives from exported theme primitives with no second
  hard-coded dark palette.
- [ ] Top content stays outside status/notch areas.
- [ ] Scroll content reserves at least 98 points for the floating settings
  button, excluding the safe-area inset.
- [ ] Captures wait for component-specific semantics.
- [ ] Dark table, code, flowchart, sequence, state, and harness cases exist.
- [ ] Both platform manifests come from real reviewed captures and cleanly
  compare within budget.
- [ ] Visual documentation states only evidence actually produced.
- [ ] No library source or unrelated benchmark artifacts were changed.

## STOP conditions

Stop and report if:

- Plans 001 or 002 are incomplete.
- Built-in themes/primitives are not exported from the package root.
- Safe-area correction requires a new dependency rather than the existing RN
  pattern.
- A simulator/emulator, packed fixture, Maestro, review ID, or runtime value
  required for real capture is unavailable.
- The only way to pass comparison is to loosen the pixel threshold.
- Verification fails twice after a reasonable correction.

## Maintenance notes

- Host chrome should always derive from the same selected theme passed to
  `Streamdown`; avoid parallel fixture palettes.
- Any future async renderer scenario must declare its semantic readiness before
  entering the visual matrix.
- Reviewers must inspect PNGs, not only manifest hashes.
