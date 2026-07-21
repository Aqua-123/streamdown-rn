# Plan 001: Restore truthful Mermaid download actions

> **Executor instructions**: Follow every step and verification gate. Stop on
> any STOP condition; do not rewrite the parity tests to accept the current
> broken behavior. Update this plan's row in `plans/README.md` when complete.
>
> **Drift check (run first)**:
> `git diff --stat 0f5271e..HEAD -- src/plugins/mermaid/MermaidBlock.tsx src/plugins/mermaid/download.ts src/plugins/__tests__/mermaid.test.tsx tests/parity/ports/streamdown/mermaid-download.test.test.ts tests/parity/ports/streamdown/mermaid.test.test.ts`

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0f5271e`, 2026-07-21
- **Execution**: APPROVED at `50828ac` on `codex/001-truthful-mermaid-downloads`, 2026-07-21

## Why this matters

The only visible Mermaid download control announces MMD but saves SVG when an
SVG exists, and it never exposes an adapter-provided PNG. This is both a user
data-format bug and the current hosted-test blocker.

## Current state

- `src/plugins/mermaid/MermaidBlock.tsx:75` chooses the payload behind one
  misleading label:

  ```tsx
  <ActionButton
    label={translations.downloadDiagramAsMmd}
    onAction={() => capabilities.files?.save(
      mermaidFileRequest(source, result, result?.svg ? 'svg' : 'mmd')
    ) ?? { status: 'unavailable' }}
  />
  ```

- `src/plugins/mermaid/download.ts:7-20` already serializes `mmd`, `svg`, and
  `png` correctly. Reuse it; do not add another serializer.
- `tests/parity/ports/streamdown/mermaid-download.test.test.ts:23-68` and
  `tests/parity/ports/streamdown/mermaid.test.test.ts:107-116` already specify
  the required actions and payloads.
- The full Jest baseline has four failures caused by these missing actions.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `bun run test --runInBand tests/parity/ports/streamdown/mermaid-download.test.test.ts tests/parity/ports/streamdown/mermaid.test.test.ts` | both suites pass |
| Typecheck | `bun run type-check` | exit 0 |
| Full tests | `bun run test --silent` | no Mermaid download failures; any unrelated failure documented |

## Scope

**In scope**:

- `src/plugins/mermaid/MermaidBlock.tsx`
- `src/plugins/mermaid/download.ts` only if a proven serializer defect appears
- `src/plugins/__tests__/mermaid.test.tsx` for the stale-render regression test
- the two parity test files named above
- one new `.changeset/*.md`

**Out of scope**:

- changing the `NativeFileRequest` shape
- adding browser Blob/canvas logic
- Mermaid layout, theme, pan/zoom, or fullscreen changes
- deleting existing format tests

## Git workflow

- Branch: `codex/001-truthful-mermaid-downloads`
- Commit style: `fix(mermaid): restore native download formats`
- Do not push unless instructed.

## Steps

### Step 1: Render one action per available format

In `MermaidBlock`, always render the MMD action because source always exists.
Render SVG only when `result.svg` is non-empty and PNG only when
`result.png.byteLength > 0`. Each action must use its matching translation and
pass the literal matching format to `mermaidFileRequest`.

Keep the controls accessible and disabled during streaming. Let the toolbar
wrap on narrow screens; do not collapse different formats behind one false
label.

**Verify**: focused tests pass.

### Step 2: Keep source and rendered payloads revision-consistent

Add a test where source A renders, source B begins, and the old result remains
visible. A rendered-output action must never combine source B's filename/source
state with source A's SVG/PNG. Store the source alongside each successful
result, and disable or hide rendered-output actions when it does not match the
current source. MMD and copy may continue to use the current source.

**Verify**: add a delayed/failing rerender assertion under
`src/plugins/__tests__/mermaid.test.tsx`; it must fail before and pass after.

### Step 3: Record the patch release

Add a short patch changeset describing truthful MMD/SVG/PNG exports.

**Verify**: `bun run changeset:verify` exits 0.

## Test plan

- MMD exists before and after rendering and saves `.mmd` source.
- SVG appears only for a non-empty SVG and saves exact sanitized SVG.
- PNG appears only for non-empty bytes and saves exact bytes.
- all present actions disable during streaming.
- source B cannot download source A's rendered output.

## Done criteria

- [x] Both focused parity suites pass.
- [x] `bun run type-check` passes.
- [x] No MMD-labelled action can save SVG or PNG.
- [x] No output-format action is rendered without its payload.
- [x] Only in-scope files and the changeset changed.

## STOP conditions

- Tests on current HEAD no longer describe separate native format actions.
- A fix appears to require weakening SVG sanitization.
- A new binary encoder or browser API seems necessary.

## Maintenance notes

Any new `MermaidRenderResult` output format must add one serializer, one
truthful action label, and one exact-payload test together.
