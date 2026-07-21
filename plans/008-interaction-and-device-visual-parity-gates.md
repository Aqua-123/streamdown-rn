# Plan 008: Govern real component interactions on iOS and Android

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, commit the implementation in the
> isolated worktree. Do not push, merge, or update `plans/README.md`; the
> reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat f4c271249725911268d880d21228bf93d624c759..HEAD -- fixtures/current-rn/App.js tests/device/contract.test.ts tests/device/maestro tests/visual docs/visual-testing.md docs/compatibility.md docs/release.md`
> If any in-scope file changed, compare the current-state excerpts below with
> the live code. STOP if behavior or labels no longer match.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plans 003 through 007 (DONE)
- **Category**: tests
- **Planned at**: commit `f4c271249725911268d880d21228bf93d624c759`, 2026-07-21
- **Execution**: BLOCKED on 2026-07-21 — fresh packed iOS and Android Release
  builds now pass, but the iOS matrix stopped twice at case 8 because Maestro
  `assertVisible` cannot see the intentionally hidden `Streaming response`
  live-region label. This is a plan expectation mismatch, not a renderer build
  failure. Partial scoped work remains uncommitted in
  `/tmp/streamdown-rn-plan-008-N9lvoK`; seven partial iOS PNG writes are not
  reviewed evidence and must be replaced by the next complete update run.

## Why this matters

The existing device suite can remain green after table, code, or Mermaid UI
changes because it proves generic fixture headings rather than the component
surface or the state produced by an action. Its generic `fullscreen` case does
not open a table or diagram, and its Mermaid coverage omits state and sequence
diagrams. This plan makes the reviewed baselines prove the production controls
that Plans 003-007 changed, without duplicating `Button` or `Dropdown`
implementation behavior in fixture-only code.

## Current state

- `tests/visual/matrix.json` defines 24 cases. Cases have visual axes but no
  component-specific semantic labels or action to perform.
- `tests/visual/capture.mjs` accepts a case when Android contains
  `Fixture: <scenario>` or iOS contains two fixture strings. The iOS Maestro
  flow taps the fixed point `68%,56%`, so it is not a stable component action.
- `fixtures/current-rn/App.js` already supplies real clipboard, file, and share
  capabilities to `Streamdown`. It already has `code`, `mermaid`,
  `mermaid-state`, `mermaid-sequence`, and `interaction-disabled` source
  scenarios. Its `fullscreen` case renders a standalone `FullscreenModal`
  containing `Fullscreen content`; that is not table or Mermaid evidence.
- Production component labels are stable public accessibility strings:
  - table trigger/menu: `Download table`, `Download table as CSV`,
    `Download table as Markdown`;
  - shared fullscreen trigger/overlays: `View fullscreen`, `Table fullscreen`,
    `Diagram fullscreen`, `Exit fullscreen`;
  - Mermaid trigger/menu: `Download diagram`, `Download diagram as SVG`,
    `Download diagram as MMD`;
  - code: `Download file`, `Copy Code`.
- `src/components/ui/__tests__/primitives.test.tsx` already owns shared
  `Button`/`Dropdown` expanded state, selection, dismissal, focus restoration,
  collision placement, async success, and async failure behavior. Device cases
  should prove consumer labels and layout, not reimplement this contract.
- `tests/visual/baselines/{ios,android}.manifest.json` bind the old unchanged
  matrix to the `codex-2026-07-20-safe-area` review. Source behavior changed in
  Plans 003-007 without a matrix change, so all visual baselines must be
  regenerated from a newly packed Release-Hermes fixture.

Match these repository conventions:

- Keep the matrix declarative; `capture.mjs` owns platform orchestration.
- Deep-link each case to a clean scenario before interacting.
- Baseline updates remain all-or-nothing after a matrix change and manifests
  retain SHA-256 hashes for the matrix and every PNG.
- Use production accessibility labels for interaction. Never use coordinates,
  fixture-only buttons, or direct state injection to open a consumer surface.
- Generated `tests/visual/actual/` and `tests/visual/artifacts/` stay ignored.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install --frozen-lockfile` | exit 0 |
| Focused contract | `bun run test:device-contract --silent` | all device tests pass |
| Primitive regression | `bun run test --silent --runTestsByPath src/components/ui/__tests__/primitives.test.tsx src/controls/__tests__/native-controls.test.tsx src/plugins/__tests__/mermaid.test.tsx` | all selected suites pass |
| Typecheck | `bun run type-check` | exit 0, no errors |
| Documentation | `bun run docs:verify` | exit 0 |
| Full tests | `bun run test --silent` | all suites and tests pass |
| Visual capture | `bun run test:visual` with the environment described in Step 5 | every case is semantically asserted and captured |

## Scope

**In scope** (the only tracked files you may modify):

- `fixtures/current-rn/App.js`
- `tests/device/contract.test.ts`
- `tests/device/maestro/semantic.yaml`
- `tests/device/maestro/interaction.yaml` (create if the two-flow shape below is used)
- `tests/visual/capture.mjs`
- `tests/visual/matrix.json`
- `tests/visual/README.md`
- `tests/visual/baselines/README.md`
- `tests/visual/baselines/*.png`
- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`
- `docs/visual-testing.md`
- `docs/compatibility.md`
- `docs/release.md`

**Out of scope**:

- Everything under `src/`; this plan tests completed behavior and must not fix
  renderers, controls, themes, primitives, or capabilities.
- `fixtures/current-rn/harness-app.js`; the automated deep-link fixture is the
  governed surface.
- New npm dependencies or committed native `ios/`/`android/` projects.
- Selecting a download item that launches a system share sheet. Unit tests
  already prove payloads; the visual gate proves the production dropdown.
- True tablet device-class coverage. `layout: wide` exercises the content-width
  branch within the pinned phone devices; it must not be documented as iPad or
  Android-tablet evidence.
- Physical-device screen-reader certification or browser-to-native pixel
  equivalence.

## Git workflow

- Work in an isolated worktree on branch `codex/008-device-visual-gates`, based
  on the exact planned commit.
- Use one focused commit with the existing conventional style, for example:
  `test(visual): govern native component interactions`.
- Do not push, merge, or modify the operator's primary checkout.

## Steps

### Step 1: Make component states deterministic without fake controls

In `fixtures/current-rn/App.js`:

1. Add a table-only scenario with enough columns/long text to expose container
   width and horizontal overflow on a narrow phone. The existing `controls`
   source may remain for general coverage.
2. Add a code-long-line scenario that uses a supported language and a line too
   wide for the narrow container.
3. Continue using the existing `mermaid`, `mermaid-state`, and
   `mermaid-sequence` scenarios.
4. Do not add local `Pressable`, `Button`, menu, or modal controls. Menu and
   fullscreen states must be reached by tapping the `Streamdown` production
   control label.
5. Remove the generic fixture-only `FullscreenModal` import/render if no matrix
   case uses it after Step 2.

The fixture heading may remain for diagnostics, but it cannot be an expected
semantic label for a new component-specific case.

**Verify**:
`rg -n "table-long|code-long|mermaid-state|mermaid-sequence" fixtures/current-rn/App.js`
must find all four scenarios, and
`rg -n "Fullscreen fixture|Fullscreen content" fixtures/current-rn/App.js`
must return no matches.

### Step 2: Declare semantic and interaction expectations in the matrix

Upgrade `tests/visual/matrix.json` to schema version 2. Every case must have an
`expectedLabels` array containing exactly two non-empty component/state labels.
An interaction case additionally has one `actionLabel`.

Preserve the useful core/image/math/loading/error cases, but replace generic
control/fullscreen evidence and add the smallest set that covers:

- table inline narrow overflow: expected labels identify table controls;
- table download menu open: action `Download table`, then expect
  `Download table as CSV` and `Download table as Markdown`;
- real table fullscreen: action `View fullscreen`, then expect
  `Table fullscreen` and `Exit fullscreen`;
- supported code in light and dark themes, plus one long-line narrow case and
  unknown-language fallback; expected labels identify `Download file` and
  `Copy Code` where capabilities are enabled;
- interaction-disabled streaming state: expected labels must identify two
  visible production controls (for example `Download table` and
  `View fullscreen`) while the existing focused component tests prove their
  `accessibilityState.disabled` contract. Do not use the visually hidden
  `Streaming response` live-region label with Maestro `assertVisible`;
- Mermaid flowchart in light and dark themes, state diagram, sequence diagram,
  loading/error, download menu open, and real diagram fullscreen;
- Mermaid download menu: action `Download diagram`, then expect
  `Download diagram as SVG` and `Download diagram as MMD`;
- Mermaid fullscreen: action `View fullscreen`, then expect
  `Diagram fullscreen` and `Exit fullscreen`.

Across the complete matrix retain both themes, LTR/RTL, narrow/wide content
layouts, and font scales 1/1.3/2 on both platforms. IDs must be unique. Do not
claim that `wide` is a tablet. Do not add pan/zoom device controls: the fixture
does not provide a gesture capability, and Plan 007 already owns provider
contract tests.

**Verify**:
`bun run test:device-contract --silent`
must fail only for the not-yet-updated capture contract before Step 3, then pass
after Step 4.

### Step 3: Drive real labels and assert the resulting surface

In `tests/visual/capture.mjs`:

1. Validate schema version 2 before device work: unique IDs; exactly two
   `expectedLabels`; optional non-empty `actionLabel`; valid visual axes.
2. Continue restarting/deep-linking the app for every case.
3. Replace the fixed-coordinate Maestro action. Keep `semantic.yaml` as an
   assert-only flow and add `interaction.yaml` containing exactly one
   label-based `tapOn: "${ACTION_LABEL}"` followed by the two expected-label
   assertions. Select the flow based on whether `actionLabel` exists.
4. Use Maestro for iOS semantic assertions on every case and for action cases
   on both platforms. Android static cases may continue using UIAutomator.
5. After an Android action, dump the hierarchy and require both
   `expectedLabels`; for all Android cases, hierarchy failure must occur before
   screenshot capture.
6. For iOS, the selected Maestro flow must assert both labels before
   `simctl io ... screenshot`.
7. Never fall back to fixture headings, substring-derived scenario labels,
   coordinates, sleeps as proof, or screenshot-only success. Bounded polling
   after deep-link launch is allowed.
8. Keep the existing full-matrix manifest and partial-update safety rules.

Use environment variables rather than writing generated per-case YAML. Quote
labels safely as individual `-e NAME=value` arguments to `spawnSync`.

**Verify**:

- `rg -n "point:" tests/device/maestro tests/visual/capture.mjs` returns no
  matches.
- `rg -n "Fixture:|Fixture state:" tests/device/maestro tests/visual/capture.mjs`
  returns no matches.
- `bun run test:device-contract --silent` passes.

### Step 4: Strengthen the executable contract

Extend `tests/device/contract.test.ts`, following the existing matrix tests, to
assert all of the following:

- schema version 2, unique IDs, and valid `expectedLabels`/`actionLabel` shape;
- exact presence of the table menu/fullscreen, paired-theme code and Mermaid,
  long-code/table, Mermaid state/sequence/menu/fullscreen, and
  capability-disabled cases named in Step 2;
- interaction cases use the exact production action and result labels listed in
  Step 2;
- both themes, directions, layouts, and 1/1.3/2 font-scale axes remain covered;
- capture/flows contain label-based Maestro interaction and no fixed point;
- no new case uses `Fixture:` or `Fixture state:` as semantic proof;
- the interaction-disabled scenario has no `actionLabel`, uses visible
  production control labels, and remains paired with focused tests that assert
  disabled accessibility state.

Do not test pixel files in Jest; manifests and capture comparison own that.

**Verify**:
`bun run test:device-contract --silent` and the focused primitive regression
command both pass.

### Step 5: Build the exact packed Release fixture and recapture both platforms

Run all work in a uniquely named temporary directory created with `mktemp -d`.
You may delete only that executor-created directory and executor-created build
outputs. Do not reuse a previously installed app as evidence.

1. Confirm at least 8 GiB free, Java 17, Xcode/simctl, Android SDK/emulator/adb,
   and Maestro. If Maestro is absent, install it under the temporary directory
   using its official installer with a temporary tool home; do not modify repo
   manifests or rely on a global install. STOP if any required tool cannot run.
2. Run `npm run build`, `npm pack --json --pack-destination <temp>`, copy
   `fixtures/current-rn` to `<temp>/consumer`, add the generated tarball as the
   consumer's `streamdown-rn` file dependency, and run
   `npm install --ignore-scripts --no-package-lock` in the consumer. This is the
   same packed-consumer shape as `tests/package/verify-optional-renderers.mjs`.
3. Prebuild and compile the current Expo 56 fixture as Release/Hermes for the
   booted iOS simulator and the `Pixel_8_2` Android 34 arm64 AVD. Use
   `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 EXCLUDED_ARCHS=x86_64` for iOS and
   `-PreactNativeArchitectures=arm64-v8a --no-daemon` for Android. Install the
   newly produced `.app`/APK and verify bundle/package ID
   `ai.darkresearch.streamdownrn.expo56`.
4. Set `PATH` so `capture.mjs` can find the same Maestro binary. For each
   platform run the complete matrix with:

   ```text
   REVIEWED_VISUAL_BASELINE_UPDATE=1
   BASELINE_REVIEW_ID=codex-2026-07-21-plan-008
   VISUAL_RUNTIME=<exact OS/device/runtime string>
   VISUAL_PLATFORM=ios|android
   VISUAL_DEVICE_ID=<simulator UDID|adb serial>
   VISUAL_APP_SCHEME=streamdown-rn-expo56
   VISUAL_APP_ID=ai.darkresearch.streamdownrn.expo56
   bun run test:visual
   ```

5. Run each platform a second time without
   `REVIEWED_VISUAL_BASELINE_UPDATE`; every case must compare within the pinned
   0.25% budget.
6. Generate one iOS and one Android contact sheet from the new PNGs in an
   ignored/temp evidence path. Record dimensions beneath each case ID. Inspect
   both complete sheets and full-resolution menu/fullscreen/long-overflow
   images. Reject clipping, status-bar overlap, stale menus, wrong theme,
   missing diagrams, or fake/generic fullscreen content before committing.
7. Clean only the temporary consumer/native build directory after the second
   comparisons. Leave ignored actual/diff evidence available to the reviewer.

**Verify**:

- both update runs exit 0 and both clean comparison runs exit 0;
- both manifests have review ID `codex-2026-07-21-plan-008`, the current matrix
  hash, exact runtime/device fields, and one hash per matrix case;
- `find tests/visual/baselines -name '*.png' | wc -l` equals twice the matrix
  case count;
- `git status --short` contains only files allowed by Scope (ignored evidence
  does not count).

### Step 6: Update the visual evidence documentation truthfully

Update `tests/visual/README.md`, `tests/visual/baselines/README.md`,
`docs/visual-testing.md`, `docs/compatibility.md`, and `docs/release.md` with:

- the new per-platform case count and review ID;
- exact simulator/emulator/runtime strings from the manifests;
- the fact that semantic labels and action-result surfaces are asserted before
  capture;
- the governed table/code/Mermaid cases;
- the clean comparison result ranges from the second runs;
- the explicit limitation that narrow/wide are content-layout branches on
  pinned phone simulators, not tablet-device evidence;
- unchanged physical-device and manual VoiceOver/TalkBack limitations.

Do not claim browser pixel parity, tablet coverage, or share-sheet/download
completion from these screenshots.

**Verify**: `bun run docs:verify` passes, and
`rg -n "24 reviewed|24 states|24-case|safe-area" tests/visual docs/visual-testing.md docs/compatibility.md docs/release.md`
returns no stale evidence claims.

### Step 7: Run final gates and commit

Run, in order:

1. `bun run type-check`
2. `bun run test:device-contract --silent`
3. the focused primitive regression command
4. `bun run test --silent`
5. `bun run docs:verify`
6. both full visual comparisons once more against the installed packed Release
   fixture, without baseline-update variables

Audit the full diff and commit only the in-scope files.

**Verify**: every command exits 0; the full Jest suite is green; both visual
comparisons remain within budget; `git diff --check HEAD^..HEAD` is clean.

## Test plan

- Extend `tests/device/contract.test.ts`; model its structure on the existing
  `defines each visual axis and requires semantic evidence` test.
- Test matrix schema/uniqueness, exact action/result labels, required consumer
  states, axis preservation, capability-disabled exclusions, and absence of
  coordinate/heading-only proof.
- Re-run existing primitive, table control, and Mermaid component tests. They
  remain the behavioral contract for dismissal, focus, payloads, and capability
  results.
- Use full Release-device capture plus a clean second comparison as the only
  acceptance path for baseline PNGs.

## Done criteria

- [ ] No tracked files outside Scope changed.
- [ ] Matrix schema 2 has unique IDs, exactly two component/state labels per
  case, and label-driven actions for table/Mermaid menus and real fullscreen.
- [ ] No Maestro flow or capture helper uses fixed coordinates or fixture
  headings as semantic proof.
- [ ] Table menu/fullscreen, code theme/overflow/fallback, Mermaid
  theme/state/sequence/menu/fullscreen, and capability-disabled states have
  governed iOS and Android screenshots.
- [ ] All PNGs and both manifests were regenerated from the current packed Expo
  56 Release-Hermes fixture under review ID `codex-2026-07-21-plan-008`.
- [ ] A second capture on each platform compares cleanly within 0.25%.
- [ ] The reviewer can inspect complete contact sheets plus full-resolution
  interaction and overflow evidence.
- [ ] Device contract, focused component tests, typecheck, full Jest, and docs
  verification all pass.
- [ ] Documentation reports exact evidence and does not claim tablet, physical
  device, screen-reader, browser-pixel, or completed share-sheet proof.
- [ ] One focused commit exists on `codex/008-device-visual-gates`; it is not
  pushed or merged.

## STOP conditions

Stop and report rather than weakening the gate if:

- the drift check finds an in-scope behavior/label mismatch;
- production table/Mermaid menu or fullscreen cannot be reached by its public
  accessibility label on either platform;
- a case needs a fixture-only control, coordinate tap, arbitrary state
  injection, or renderer change under `src/`;
- the packed current fixture cannot build/install/launch in Release-Hermes on
  either pinned platform;
- a Maestro `assertVisible` expectation targets an intentionally hidden live
  region instead of a visible production surface;
- fewer than 8 GiB are free before native builds, or a required simulator,
  emulator, Java/Xcode/Android tool, Maestro, or network install is unavailable;
- baseline captures differ beyond 0.25% on the immediate second run after one
  reasonable deterministic timing correction;
- a required change falls outside Scope;
- any verification fails twice after a reasonable in-scope correction.

## Maintenance notes

- Adding or changing a matrix case invalidates both manifests by design and
  requires a complete, reviewed, two-platform recapture.
- Keep component action/result labels in the matrix aligned with public
  translations; the contract test should make label changes explicit.
- Tablet device-class coverage should be a separate plan with pinned tablet
  simulators and manifest dimensions, not a reinterpretation of `layout: wide`.
- Review interaction baselines at full resolution. Contact sheets are an index,
  not sufficient evidence for small labels, clipping, or status-bar overlap.
