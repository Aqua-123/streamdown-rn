# Mermaid state, pan/zoom, and theme parity

## Status

- Priority: P1
- Effort: Large
- Risk: Medium
- Depends on: `001-truthful-mermaid-downloads.md`, `004-shared-fullscreen-layout.md`

## Problem

Mermaid support is strongest for the basic flowchart happy path. State and sequence diagrams, leading metadata/comments, theme switching, native pan behavior, and small-screen control placement are not governed end to end. The current fallback can advertise zoom without providing pan, while its absolute vertical toolbar overlaps content and contradicts the existing native layout test.

## Evidence

- `src/plugins/mermaid/index.ts` identifies a diagram family primarily from the first token, so leading comments or metadata can prevent correct state/sequence classification.
- Mermaid SVG normalization uses hard-coded light-oriented colors rather than the active theme.
- The adapter request does not carry active theme context, making correct re-rendering on a theme switch impossible to guarantee.
- `src/controls/PanZoomSurface.tsx` supplies only scale transforms when the gesture provider is unavailable; zoomed content cannot be panned.
- The pan/zoom controls are absolutely positioned in a bottom-left vertical strip with fixed light colors and can cover diagram content.
- Mermaid downloads already consume the shared `Dropdown`, and action controls share `Button`; this plan must preserve those primitive boundaries while changing layout and theme.
- The full test run currently fails the pan/zoom placement expectation, and visual fixtures govern a basic flowchart but not state, sequence, or fullscreen states.

## Scope

- `src/plugins/mermaid/index.ts`
- `src/plugins/mermaid/MermaidBlock.tsx`
- `src/controls/PanZoomSurface.tsx`
- Mermaid adapter request/result types
- Mermaid plugin, pan/zoom, and native renderer tests
- Current RN Mermaid fixture adapter and scenarios
- Package documentation and changeset

## Implementation plan

1. Add characterization fixtures and tests for:
   - `stateDiagram-v2` transitions and labels;
   - sequence diagrams with long participants/messages;
   - leading Mermaid comments/directives;
   - source changes while rendering;
   - light/dark theme switches;
   - inline and fullscreen canvas behavior.
2. Normalize only syntax-safe leading whitespace, comments, and supported directives before family detection. Preserve the original source sent to the renderer and downloaded by plan 001.
3. Extend the Mermaid render request with active theme context and include it in render identity/cache decisions. Update the fixture adapter to choose a matching Mermaid theme.
4. Replace fixed SVG normalization colors with resolved theme tokens or renderer-authored variables. Keep sanitization intact and add tests proving disallowed markup remains removed.
5. Make renderer results revision-safe: clear or visibly mark obsolete output when source/theme changes, and accept a completion only when it matches the active request identity.
6. Redesign the native control surface as an in-flow horizontal toolbar below the canvas, with 44-point targets and theme-driven colors. Render zoom/reset actions with the shared `Button` primitive and leave the existing download `Dropdown` lifecycle intact. Do not add direct `Pressable` controls or a Mermaid-specific menu.
7. Define honest gesture capability behavior:
   - with the gesture provider, support bounded zoom and two-axis pan;
   - without it, use a two-axis scrollable fallback at a fixed readable scale or hide zoom controls that cannot be completed;
   - never show a control whose resulting state cannot be navigated.
8. Use the shared fullscreen canvas mode from plan 004 so diagrams center at fit scale, pan in both axes when zoomed, and remain dismissible.
9. Document adapter theme expectations, optional gesture-provider behavior, and native differences from browser Mermaid rendering.
10. Add a changeset for family detection, theme behavior, and pan/zoom controls.

## Verification

- Run focused Mermaid, sanitizer, pan/zoom, and renderer suites.
- Confirm the existing pan/zoom placement failure is replaced by an intentional in-flow contract test.
- Run `bun run type-check` and the full Jest suite.
- Inspect flowchart, state, and sequence diagrams in both themes, inline and fullscreen, at phone and tablet widths.
- Verify provider-present and provider-absent paths separately.

## Done when

- State and sequence diagrams render from valid sources including leading comments/directives.
- Theme changes produce matching diagrams without stale output.
- Controls do not overlap diagram content.
- Every visible zoom state remains navigable by pan or scrolling.
- Fullscreen uses the shared centered canvas behavior.

## Out of scope

- Mermaid download formats, owned by plan 001.
- Shared `Button`/`Dropdown` lifecycle or API changes; STOP and report a missing primitive capability instead of forking either component.
- Replacing the consumer-provided Mermaid renderer with a bundled browser runtime.
- Pixel-identical SVG output across web and native renderers.
