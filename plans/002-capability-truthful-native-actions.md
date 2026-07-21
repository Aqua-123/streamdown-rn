# Plan 002: Make copy and download controls capability-truthful and runnable

> **Executor instructions**: Read the capability contract and every caller
> before editing. Reuse `src/components/ui/Button.tsx` for press actions and
> `src/components/ui/Dropdown.tsx` only for multi-choice actions. Preserve core
> bundle isolation. Update `plans/README.md` on completion.
>
> **Drift check (run first)**:
> `git diff --stat ca2fc2f..HEAD -- src/components/ui src/platform src/controls src/plugins/mermaid/MermaidBlock.tsx fixtures/current-rn docs/api.md docs/plugins.md`

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-truthful-mermaid-downloads.md`
- **Category**: bug, dx
- **Planned at**: commit `ca2fc2f`, 2026-07-21

## Why this matters

Core renders copy and download controls by default, but default capabilities
contain neither clipboard nor file saving. The shipped device fixture also
passes no capabilities, so its visually approved buttons can only report
unavailable. A control should either have a runnable adapter or communicate
unavailability before the user presses it.

## Current state

- `src/platform/defaults.ts:12-41` supplies links, share, and announcements,
  but not clipboard or files.
- `src/controls/config.ts:15-20` enables every unspecified control without
  considering capability availability.
- `CodeControls.tsx` and `TableControls.tsx` render enabled copy/download
  controls without checking for `capabilities.clipboard` or
  `capabilities.files`; they discover a missing adapter only after a press.
- `src/plugins/mermaid/MermaidBlock.tsx` already hides its download trigger
  unless `capabilities.files` exists. Match this truthful behavior for code and
  table actions rather than introducing a second availability policy.
- `src/components/ui/Button.tsx` is the shared styled press primitive, and
  `src/controls/ActionButton.tsx` owns async capability feedback on top of it.
  Do not add direct `Pressable` controls or another action wrapper.
- `src/components/ui/Dropdown.tsx` owns controlled/uncontrolled disclosure,
  dismissal, collision positioning, focus restoration, and async item errors.
  Multi-format callers must consume it instead of reproducing those behaviors.
- `fixtures/current-rn/native-capabilities.js` and `App.js` already provide real
  Expo clipboard, temporary-file, and native share/save adapters. This plan
  must verify that path and must not replace it with mocks.
- `docs/api.md:14-22` uses no-op successful adapters, not a runnable host recipe.

Existing convention: the core package defines capability interfaces and the
host owns native dependencies. Keep that boundary.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Controls | `bun run test --runInBand src/controls/__tests__/native-controls.test.tsx src/controls/__tests__/capabilities.test.tsx` | pass |
| Package | `bun run pack:verify && bun run pack:verify-optional-renderers` | pass; core still isolated |
| Docs | `bun run docs:verify` | pass |
| Typecheck | `bun run type-check` | pass |

## Scope

**In scope**:

- `src/controls/CodeControls.tsx`
- `src/controls/TableControls.tsx`
- `src/plugins/mermaid/MermaidBlock.tsx`
- `src/platform/capabilities.ts` and `src/platform/defaults.ts` only if needed
- focused control tests
- `fixtures/current-rn/App.js`, `fixtures/current-rn/harness-app.js`,
  `fixtures/current-rn/native-capabilities.js`, `fixtures/current-rn/package.json`
- equivalent Expo 54 fixture files if the documented recipe supports them
- `docs/api.md`, `docs/plugins.md`, one `.changeset/*.md`

**Out of scope**:

- runtime dependencies on Expo Clipboard/FileSystem/Sharing in the core package
- pretending a save succeeded without writing or presenting native UI
- changing link approval/security behavior
- styling menus or fullscreen surfaces
- creating another button, menu, dropdown, or popover primitive

## Git workflow

- Branch: `codex/002-capability-truthful-actions`
- Commit style: `fix(controls): gate native actions by capability`
- Do not push unless instructed.

## Steps

### Step 1: Define availability once

Add the minimum shared check that maps action families to required capability:
clipboard for copy, files for download, share for share. Combine it with the
existing `controlEnabled` decision at each shared control boundary. Do not add
a provider registry or factory.

Render single actions through the existing `ActionButton`/`Button` stack. For
multi-format actions, gate the existing `Dropdown.Trigger`; do not place
capability behavior inside `Dropdown` itself because it is a generic UI
primitive.

Use the already-landed Mermaid policy: hide copy actions when clipboard is
absent and download actions when files are absent. Do this at `CodeControls`
and `TableControls`, where every corresponding consumer route converges. Keep
explicit `controls: false` behavior unchanged and do not add a registry.

Tests must lock the chosen behavior across code, table, and Mermaid.

**Verify**: focused controls tests pass, including absent/present adapters.

### Step 2: Make success and failure feedback durable

Table copy currently closes its menu and unmounts the `ActionButton` that owns
the `Copied` alert. Hoist result feedback to a stable control container or
announce before closing. Ensure code and Mermaid copy show the same success
state and thrown adapter errors remain accessible.

**Verify**: after a successful table copy, `Copied` remains observable for the
configured reset period even though the menu closes.

### Step 3: Verify the real Release-fixture capabilities

Confirm the committed Expo adapters actually write clipboard text and persist a
temporary file before opening the platform share/save surface, and that both
automated and harness `Streamdown` paths receive them. Change fixture files only
if a verification exposes a concrete defect. Keep dependencies fixture-only
and aligned with its Expo SDK.

If OS save UI cannot be automated, expose a deterministic fixture-only result
status in addition to manual verification; do not replace the real adapter with
a mock.

**Verify**: packed optional-renderer fixture bundles for iOS and Android.

### Step 4: Replace no-op documentation with runnable host code

Document the dependency-free core contract first, then a complete Expo example
with error mapping to `CapabilityResult`. State plainly that controls requiring
an absent provider are unavailable.

**Verify**: `bun run docs:verify` passes.

## Test plan

- adapter absent: copy/download triggers are absent across code, table, and
  Mermaid; unrelated controls remain visible.
- adapter success, denied, cancelled, thrown failure for copy and save.
- table success feedback survives menu unmount.
- the fixture provides clipboard/files and the packed app bundles.
- core entry remains free of Expo native modules.

## Done criteria

- [ ] No visible copy/download button lacks its required capability.
- [ ] Fixture buttons invoke real native providers.
- [ ] Docs contain a compiling real recipe, not success stubs.
- [ ] Focused tests, docs, pack verification, and typecheck pass.
- [ ] Core dependency list is unchanged.

## STOP conditions

- The only proposed solution adds Expo modules to core dependencies.
- `src/components/ui/Button.tsx` or `Dropdown.tsx` is absent from the executor's
  checkout; the prerequisite primitive change has not landed, so do not
  recreate it inside controls.
- Expo 54 and Expo 56 require incompatible code with no narrow adapter seam.
- A real file adapter needs permissions or destinations not described by the
  platform module; report the exact constraint instead of faking success.

## Maintenance notes

When a new control action is added, declare its required capability and test
the absent-provider state in the same change.
