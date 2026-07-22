import fs from 'node:fs';
import path from 'node:path';

type Request = { coverageId: string; captureId: string; host: string; platform: string; scenario: string; source: { commit: string; packageSha256: string } };
type EvidenceModule = {
  DEVICE_SCENARIO_PHASES: Record<string, string[]>;
  createDeviceEvidenceReporter: (request: Request | null, runtime: Record<string, unknown>, log: (...values: string[]) => void) => { observe: (phase: string) => boolean; complete: () => boolean };
  parseDeviceEvidenceRequest: (url: string, options: Record<string, unknown>) => Request | null;
  createDeviceEvidenceCapabilities: () => Record<string, any>;
};

const matrix = JSON.parse(fs.readFileSync(path.resolve('tests/device/matrix.json'), 'utf8')) as { hosts: Array<{ id: string; fixture: string; scenarios: string[] }> };
const source = { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) };
const captureId = '12345678-1234-4123-8123-123456789abc';
const runtime = { release: true, hermes: true, appState: 'foreground' };

function fixtureModule(fixture: string): EvidenceModule {
  return require(path.resolve(fixture, 'device-evidence')) as EvidenceModule;
}

function requestUrl(host: string, platform: string, scenario: string, overrides: Record<string, string> = {}) {
  const values = { coverageId: `${host}:${platform}:${scenario}`, captureId, scenario, platform, commit: source.commit, packageSha256: source.packageSha256, ...overrides };
  return `streamdown-rn-${host}://evidence?${new URLSearchParams(values).toString()}`;
}

describe('Release-Hermes device evidence producer', () => {
  it.each(matrix.hosts)('defines an ordered producer plan for every $id matrix scenario', (host) => {
    const producer = fixtureModule(host.fixture);
    expect(Object.keys(producer.DEVICE_SCENARIO_PHASES).sort()).toEqual(expect.arrayContaining([...host.scenarios].sort()));
    for (const scenario of host.scenarios) {
      const phases = producer.DEVICE_SCENARIO_PHASES[scenario];
      expect(phases.length).toBeGreaterThan(1);
      expect(new Set(phases).size).toBe(phases.length);
    }
  });

  it('emits exact source- and capture-bound markers only after every scenario checkpoint', () => {
    for (const host of matrix.hosts) {
      for (const scenario of host.scenarios) {
        const producer = fixtureModule(host.fixture);
        const request = producer.parseDeviceEvidenceRequest(requestUrl(host.id, 'android', scenario), { host: host.id, platform: 'android', source, scenarios: host.scenarios });
        expect(request).not.toBeNull();
        const calls: string[][] = [];
        const reporter = producer.createDeviceEvidenceReporter(request, runtime, (...values) => calls.push(values));
        const phases = producer.DEVICE_SCENARIO_PHASES[scenario];
        phases.slice(0, -1).forEach((phase) => expect(reporter.observe(phase)).toBe(true));
        expect(calls).toEqual([]);
        expect(reporter.observe(phases[phases.length - 1])).toBe(true);
        expect(reporter.complete()).toBe(true);
        expect(calls).toHaveLength(2);
        for (const [marker, json] of calls) {
          expect(marker).toMatch(/^STREAMDOWN_DEVICE_(?:RUNTIME|SCENARIO)$/);
          expect(JSON.parse(json)).toMatchObject({ coverageId: request!.coverageId, captureId, source });
        }
      }
    }
  });

  it('rejects source, capture, coverage, platform, scenario, and route mismatches', () => {
    const host = matrix.hosts.find((entry) => entry.id === 'expo56')!;
    const producer = fixtureModule(host.fixture);
    const scenario = host.scenarios[0];
    const parse = (url: string) => producer.parseDeviceEvidenceRequest(url, { host: host.id, platform: 'android', source, scenarios: host.scenarios });
    expect(parse(requestUrl(host.id, 'android', scenario))).not.toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario, { commit: 'c'.repeat(40) }))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario, { packageSha256: 'd'.repeat(64) }))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario, { captureId: 'not-a-capture-id' }))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario, { coverageId: `expo54:android:${scenario}` }))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario, { platform: 'ios' }))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', 'not-declared'))).toBeNull();
    expect(parse(requestUrl(host.id, 'android', scenario).replace('://evidence', '://fixture'))).toBeNull();
  });

  it('does not emit for Debug/JSC/background runtimes or out-of-order observations', () => {
    const host = matrix.hosts.find((entry) => entry.id === 'expo56')!;
    const producer = fixtureModule(host.fixture);
    const scenario = host.scenarios[0];
    const request = producer.parseDeviceEvidenceRequest(requestUrl(host.id, 'ios', scenario), { host: host.id, platform: 'ios', source, scenarios: host.scenarios })!;
    for (const invalidRuntime of [
      { ...runtime, release: false }, { ...runtime, hermes: false }, { ...runtime, appState: 'background' },
    ]) {
      const log = jest.fn();
      const reporter = producer.createDeviceEvidenceReporter(request, invalidRuntime, log);
      producer.DEVICE_SCENARIO_PHASES[scenario].forEach((phase) => reporter.observe(phase));
      expect(log).not.toHaveBeenCalled();
    }
    const log = jest.fn();
    const reporter = producer.createDeviceEvidenceReporter(request, runtime, log);
    expect(reporter.observe(producer.DEVICE_SCENARIO_PHASES[scenario][1])).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('keeps the bundle identity and evidence route wired into both packed fixture apps', () => {
    for (const host of matrix.hosts) {
      const helper = fs.readFileSync(path.resolve(host.fixture, 'device-evidence.js'), 'utf8');
      const app = fs.readFileSync(path.resolve(host.fixture, 'App.js'), 'utf8');
      expect(helper).toContain('process.env.EXPO_PUBLIC_STREAMDOWN_RELEASE_COMMIT');
      expect(helper).toContain('process.env.EXPO_PUBLIC_STREAMDOWN_RELEASE_PACKAGE_SHA256');
      expect(app).toContain("parseDeviceEvidenceRequest(config.evidenceUrl");
      expect(app).toContain("AppState.currentState === 'active'");
      expect(app).toContain("appState: 'foreground'");
      expect(app).toContain('globalThis.HermesInternal');
      expect(app).toContain('PixelRatio.getFontScale() < 1.3');
    }
  });

  it('requires library UI/native callbacks for Expo 56 interaction checkpoints', () => {
    const app = fs.readFileSync(path.resolve('fixtures/current-rn/App.js'), 'utf8');
    expect(app).toMatch(/<NativeLink[\s\S]*onResult=\{onResult\}/);
    expect(app).toMatch(/<ActionButton[\s\S]*onResult=\{onResult\}/);
    expect(app).toContain("phase === 'focus-restored' && focusRestored");
    expect(app).toContain("phase === 'pan-zoom-rendered' && panScale === 3");
    expect(app).toContain('createFixtureCapabilities()');
    expect(app).toContain("phase === 'mermaid-retry' && attempts >= 2");
    expect(app).toContain('pluginsOverride={observedPlugins}');
    expect(app).toContain('Retry failed image');
    expect(app).not.toContain('runDeviceEvidenceAction');
  });
});
