const {
  advanceCursor,
  initialPlaybackState,
  playbackReducer,
  progressPercent,
}: {
  advanceCursor: (cursor: number, total: number, chunkSize: number) => number;
  initialPlaybackState: { cursor: number; status: string };
  playbackReducer: (state: { cursor: number; status: string }, action: Record<string, unknown>) => { cursor: number; status: string };
  progressPercent: (cursor: number, total: number) => number;
} = require('../../fixtures/current-rn/harness-state');

const { HARNESS_SAMPLES }: { HARNESS_SAMPLES: Array<{ id: string; markdown: string }> } = require('../../fixtures/current-rn/harness-samples');
const {
  mermaidHeightFromSvg,
  parseVegaLiteBars,
}: {
  mermaidHeightFromSvg: (svg: string, width: number) => number;
  parseVegaLiteBars: (code: string) => { bars: Array<{ label: string; value: number }>; xTitle: string; yTitle: string };
} = require('../../fixtures/current-rn/fixture-renderers');

describe('interactive harness playback', () => {
  it('supports start, tick, pause, step, finish, and reset transitions', () => {
    let state = playbackReducer(initialPlaybackState, { type: 'start', total: 10 });
    expect(state).toEqual({ cursor: 0, status: 'running' });

    state = playbackReducer(state, { type: 'tick', total: 10, chunkSize: 4 });
    expect(state).toEqual({ cursor: 4, status: 'running' });

    state = playbackReducer(state, { type: 'pause', total: 10 });
    expect(state).toEqual({ cursor: 4, status: 'paused' });

    state = playbackReducer(state, { type: 'step', total: 10, chunkSize: 4 });
    expect(state).toEqual({ cursor: 8, status: 'paused' });

    state = playbackReducer(state, { type: 'finish', total: 10 });
    expect(state).toEqual({ cursor: 10, status: 'complete' });
    expect(playbackReducer(state, { type: 'reset' })).toEqual(initialPlaybackState);
  });

  it('clamps cursor and progress at document boundaries', () => {
    expect(advanceCursor(8, 10, 8)).toBe(10);
    expect(advanceCursor(-4, 10, 0)).toBe(1);
    expect(progressPercent(5, 10)).toBe(50);
    expect(progressPercent(12, 10)).toBe(100);
    expect(progressPercent(0, 0)).toBe(100);
  });

  it('ships a unique component catalog with real math and Mermaid fixtures', () => {
    const ids = HARNESS_SAMPLES.map(({ id }) => id);
    const showcase = HARNESS_SAMPLES.find(({ id }) => id === 'overview')?.markdown ?? '';
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['overview', 'tables', 'code', 'math', 'mermaid', 'languages', 'incomplete', 'performance']));
    expect(showcase).toContain('```typescript');
    expect(showcase).toContain('`inline code`');
    expect(showcase).not.toContain('\\`');
    expect(showcase).toContain('/api/users/${id}');
    expect(showcase).toContain('\\begin{bmatrix}');
    expect(HARNESS_SAMPLES.find(({ id }) => id === 'math')?.markdown).toContain('\\frac');
    expect(HARNESS_SAMPLES.find(({ id }) => id === 'mermaid')?.markdown).toContain('```mermaid');
  });

  it('sizes Mermaid by its viewBox and converts the showcase Vega-Lite spec to native bars', () => {
    expect(mermaidHeightFromSvg('<svg viewBox="0 0 600 300"></svg>', 320)).toBe(180);
    expect(mermaidHeightFromSvg('<svg viewBox="0 0 300 600"></svg>', 320)).toBe(520);
    const showcase = HARNESS_SAMPLES.find(({ id }) => id === 'overview')?.markdown ?? '';
    const vega = showcase.match(/```vega-lite\n([\s\S]*?)\n```/)?.[1] ?? '';
    const chart = parseVegaLiteBars(vega);
    expect(chart.yTitle).toBe('Revenue ($k)');
    expect(chart.bars.map(({ label }) => label)).toEqual(['Apr', 'Feb', 'Jan', 'Jun', 'Mar', 'May']);
    expect(chart.bars.find(({ label }) => label === 'Apr')?.value).toBe(91);
  });
});
