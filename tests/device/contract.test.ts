import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
    for (const host of matrix.hosts as Array<{ fixture: string; expo: string; reactNative: string; react: string }>) {
      const fixture = read(`${host.fixture}/package.json`);
      expect(fixture.dependencies).toMatchObject({
        expo: host.expo,
        react: host.react,
        'react-native': host.reactNative,
      });
    }
  });

  it('covers every required interaction and rich-content family', () => {
    const declared = new Set(matrix.scenarios as string[]);
    const covered = new Set((matrix.hosts as Array<{ scenarios: string[] }>).flatMap((host) => host.scenarios));
    expect(covered).toEqual(declared);
    for (const host of matrix.hosts as Array<{ id: string; scenarios: string[] }>) {
      expect(host.scenarios.length).toBeGreaterThan(0);
      expect(host.scenarios.every((scenario) => declared.has(scenario))).toBe(true);
    }
    expect(matrix.hosts.find((host: { id: string }) => host.id === 'expo54').scenarios).not.toEqual(
      expect.arrayContaining(['link-approved-denied-failed', 'clipboard-share-file-success-cancel-fail'])
    );
    for (const phrase of ['packed-core', 'streaming', 'link-', 'clipboard-', 'image-', 'fullscreen', 'pan-zoom', 'code-', 'math-', 'mermaid-', 'rtl-cjk']) {
      expect([...covered].some((scenario) => scenario.includes(phrase))).toBe(true);
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
      'mermaid', 'mermaid-sequence', 'mermaid-state', 'mermaid-loading', 'mermaid-error', 'mermaid-retry', 'mermaid-webview-fallback',
      'harness',
    ]) {
      expect(cases.some((entry) => entry.scenario === scenario)).toBe(true);
    }
    expect(cases.filter((entry) => entry.scenario === 'streaming').map((entry) => entry.checkpoint)).toEqual(expect.arrayContaining(['128', 'complete']));
    expect(fs.readFileSync(path.resolve('tests/visual/capture.mjs'), 'utf8')).toMatch(/Accessibility hierarchy|maestro is required/);
  });

  it('keeps the fixture chrome on exported themes and inside safe areas', () => {
    const fixture = fs.readFileSync(path.resolve('fixtures/current-rn/App.js'), 'utf8');
    const harness = fs.readFileSync(path.resolve('fixtures/current-rn/harness-app.js'), 'utf8');
    for (const source of [fixture, harness]) {
      expect(source).toMatch(/darkTheme, lightTheme/);
      expect(source).toMatch(/<SafeAreaView/);
      expect(source).toMatch(/theme=\{selectedTheme\}/);
    }
    expect(harness).not.toMatch(/const PALETTES|#111113/);
    expect(harness).toMatch(/paddingBottom: (?:9[89]|[1-9]\d{2,})/);
  });

  it('wires token animation separately from active streaming state', () => {
    const fixture = fs.readFileSync(path.resolve('fixtures/current-rn/App.js'), 'utf8');
    const harness = fs.readFileSync(path.resolve('fixtures/current-rn/harness-app.js'), 'utf8');
    expect(fixture).toMatch(/animated=\{animated \?\? \(streaming \|\| benchmarking\)\}/);
    expect(harness).toMatch(/animated=\{animate\}/);
    expect(harness).toMatch(/isAnimating=\{streamingMode && playback\.status === 'running'\}/);
  });

  it('fails the visual readiness self-check when required semantics are unavailable', () => {
    const result = spawnSync(process.execPath, ['tests/visual/capture.mjs', '--self-test'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('semantic readiness self-test passed');
  });

  it('cannot claim completion while declared evidence is blocked', () => {
    if (evidence.status === 'pass') {
      expect(evidence.blockers).toEqual([]);
      expect(evidence.results.filter((result: { scope: string }) => result.scope === 'Release simulator launch')).toHaveLength(matrix.hosts.length);
    } else {
      expect(evidence.status).toBe('blocked');
      expect(evidence.blockers.length).toBeGreaterThan(0);
    }
  });

  it('records native Release evidence for every host and platform', () => {
    for (const host of matrix.hosts as Array<{ id: string; fixture: string }>) {
      for (const platform of matrix.platforms as string[]) {
        const result = read(`tests/device/results/${host.id}-${platform}-release.json`);
        expect(result).toMatchObject({
          schemaVersion: 1,
          fixture: host.id === 'expo56' ? 'current-rn' : host.id,
          platform,
          configuration: 'Release',
          result: 'passed',
          screenshot: { reviewedBaseline: false },
        });
        expect(result.commands.build).toBeTruthy();
        expect(result.commands.install).toBeTruthy();
        expect(result.commands.launch).toBeTruthy();
        expect(result.launch.fatalJavaScriptExceptionObserved).toBe(false);
        expect(result.launch.processCrashObserved).toBe(false);
      }
    }
  });

  it('records real optional-provider Release correctness on both platforms', () => {
    for (const platform of matrix.platforms as string[]) {
      const result = read(`tests/device/results/expo56-optional-renderers-${platform}-release.json`);
      expect(result).toMatchObject({
        fixture: 'current-rn-optional-renderers',
        platform,
        configuration: 'Release',
        engine: 'Hermes',
        architecture: 'new',
        result: 'passed',
        screenshot: { humanReviewed: true },
      });
      expect(result.runtimeAssertions.join('\n')).toMatch(/Shiki|shiki/);
      expect(result.runtimeAssertions.join('\n')).toMatch(/RaTeX|ratex/);
      expect(result.runtimeAssertions.join('\n')).toMatch(/beautiful/);
      expect(result.runtimeAssertions.join('\n')).toMatch(/WebView|webview/);
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
