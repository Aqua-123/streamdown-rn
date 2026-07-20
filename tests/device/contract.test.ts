import fs from 'node:fs';
import path from 'node:path';
import { buildBenchmarkCorpus as minimumCorpus } from '../../fixtures/expo54/benchmarkCorpus';
import { buildBenchmarkCorpus as currentCorpus } from '../../fixtures/current-rn/benchmarkCorpus';
import { createHash } from 'node:crypto';

const read = (file: string) => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));

describe('device proof contract', () => {
  const matrix = read('tests/device/matrix.json');
  const evidence = read('tests/device/evidence.json');
  const visuals = read('tests/visual/matrix.json');

  it('pins the minimum and current stable Expo hosts', () => {
    expect(matrix.hosts).toEqual([
      expect.objectContaining({ id: 'expo54', expo: '54.0.36', reactNative: '0.81.5' }),
      expect.objectContaining({ id: 'expo56', expo: '56.0.16', reactNative: '0.85.3' }),
    ]);
    expect(matrix).toMatchObject({ platforms: ['ios', 'android'], buildType: 'release', engine: 'hermes', architecture: 'new' });
  });

  it('covers every required interaction and rich-content family', () => {
    for (const phrase of ['packed-core', 'streaming', 'link-', 'clipboard-', 'image-', 'fullscreen', 'pan-zoom', 'code-', 'math-', 'mermaid-', 'rtl-cjk']) {
      expect(matrix.scenarios.some((scenario: string) => scenario.includes(phrase))).toBe(true);
    }
  });

  it('defines each visual axis and requires semantic evidence', () => {
    const cases = visuals.cases as Array<Record<string, string | number>>;
    expect(new Set(cases.map((entry) => entry.theme))).toEqual(new Set(['light', 'dark']));
    expect(new Set(cases.map((entry) => entry.direction))).toEqual(new Set(['ltr', 'rtl']));
    expect(new Set(cases.map((entry) => entry.layout))).toEqual(new Set(['narrow', 'wide']));
    expect(new Set(cases.map((entry) => entry.fontScale))).toEqual(new Set([1, 1.3, 2]));
    for (const scenario of [
      'static', 'streaming', 'controls', 'interaction-disabled', 'fallbacks', 'fullscreen',
      'image-loading', 'image-error', 'image-retry',
      'code', 'code-loading', 'code-unsupported', 'code-incomplete',
      'math', 'math-loading', 'math-error', 'math-fallback',
      'mermaid', 'mermaid-loading', 'mermaid-error', 'mermaid-retry', 'mermaid-webview-fallback',
    ]) {
      expect(cases.some((entry) => entry.scenario === scenario)).toBe(true);
    }
    expect(cases.filter((entry) => entry.scenario === 'streaming').map((entry) => entry.checkpoint)).toEqual(expect.arrayContaining(['128', 'complete']));
    expect(fs.readFileSync(path.resolve('tests/visual/capture.mjs'), 'utf8')).toMatch(/Accessibility hierarchy|maestro is required/);
  });

  it('cannot claim completion while declared evidence is blocked', () => {
    if (evidence.status === 'pass') {
      expect(evidence.blockers).toEqual([]);
      expect(evidence.results).toHaveLength(matrix.hosts.length * matrix.platforms.length);
    } else {
      expect(evidence.status).toBe('blocked');
      expect(evidence.blockers.length).toBeGreaterThan(0);
    }
  });

  it('uses one exact 10 KiB corpus in both packed fixtures', () => {
    const protocol = read('benchmarks/protocol.json');
    const minimum = minimumCorpus(protocol.expandedBytes);
    expect(currentCorpus(protocol.expandedBytes)).toBe(minimum);
    expect(Buffer.byteLength(minimum)).toBe(protocol.expandedBytes);
    expect(createHash('sha256').update(minimum).digest('hex')).toBe(protocol.corpusSha256);
  });
});
