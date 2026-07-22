export const DEVICE_SCENARIO_PHASES = Object.freeze({
  'packed-core-and-all-subpath-launch': ['subpaths-resolved', 'core-rendered'],
  'static-mixed-corpus': ['headings-lists-tables', 'code-math-mermaid', 'cjk-rtl-text'],
  'streaming-32-character-chunks': ['chunk-32', 'chunk-64', 'stream-complete'],
  'link-approved-denied-failed': ['link-approved', 'link-denied', 'link-failed'],
  'clipboard-share-file-success-cancel-fail': ['clipboard-success', 'share-cancelled', 'file-failed'],
  'image-loading-error-retry': ['image-loading', 'image-error', 'image-retry'],
  'scroll-fullscreen-focus-restore': ['scroll-rendered', 'fullscreen-opened', 'focus-restored'],
  'pan-zoom-reduced-motion': ['pan-zoom-rendered', 'zoom-bounded', 'reduced-motion-rendered'],
  'code-supported-unsupported-incomplete': ['code-supported', 'code-unsupported', 'code-incomplete'],
  'math-native-and-fallback': ['math-native', 'math-fallback'],
  'mermaid-native-webview-fallback-retry': ['mermaid-native', 'mermaid-webview-fallback', 'mermaid-retry'],
  'rtl-cjk-font-scale-theme-layout': ['rtl-cjk', 'font-scale', 'dark-wide-layout'],
});

export const RELEASE_SOURCE = Object.freeze({
  commit: process.env.EXPO_PUBLIC_STREAMDOWN_RELEASE_COMMIT || '',
  packageSha256: process.env.EXPO_PUBLIC_STREAMDOWN_RELEASE_PACKAGE_SHA256 || '',
});

const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CAPTURE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function parseDeviceEvidenceRequest(url, { host, platform, source = RELEASE_SOURCE, scenarios }) {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.hostname !== 'evidence') return null;
  const scenario = parsed.searchParams.get('scenario') || '';
  const coverageId = parsed.searchParams.get('coverageId') || '';
  const requestedPlatform = parsed.searchParams.get('platform') || '';
  const commit = parsed.searchParams.get('commit') || '';
  const packageSha256 = parsed.searchParams.get('packageSha256') || '';
  const captureId = parsed.searchParams.get('captureId') || '';
  if (!scenarios.includes(scenario) || requestedPlatform !== platform || coverageId !== `${host}:${platform}:${scenario}`) return null;
  if (!COMMIT.test(commit) || !SHA256.test(packageSha256) || !CAPTURE_ID.test(captureId) || commit !== source.commit || packageSha256 !== source.packageSha256) return null;
  return Object.freeze({ coverageId, captureId, host, platform, scenario, source: Object.freeze({ commit, packageSha256 }) });
}

export function createDeviceEvidenceReporter(request, runtime, log = console.log) {
  const phases = DEVICE_SCENARIO_PHASES[request?.scenario];
  const validRuntime = Boolean(request && phases && runtime?.release === true && runtime?.hermes === true && runtime?.appState === 'foreground');
  let cursor = 0;
  let emitted = false;
  return {
    observe(phase) {
      if (!validRuntime || emitted || phases[cursor] !== phase) return false;
      cursor += 1;
      if (cursor !== phases.length) return true;
      emitted = true;
      const source = request.source;
      log('STREAMDOWN_DEVICE_RUNTIME', JSON.stringify({ coverageId: request.coverageId, captureId: request.captureId, platform: request.platform, buildType: 'release', engine: 'hermes', appState: 'foreground', source }));
      log('STREAMDOWN_DEVICE_SCENARIO', JSON.stringify({ coverageId: request.coverageId, captureId: request.captureId, scenario: request.scenario, status: 'passed', signal: deviceScenarioSignal(request.scenario), source }));
      return true;
    },
    complete: () => emitted,
  };
}

export function deviceScenarioSignal(scenario) {
  return {
    'packed-core-and-all-subpath-launch': 'package-subpaths-launched',
    'static-mixed-corpus': 'mixed-corpus-rendered',
    'streaming-32-character-chunks': 'streaming-output-stable',
    'link-approved-denied-failed': 'link-outcomes-observed',
    'clipboard-share-file-success-cancel-fail': 'native-action-outcomes-observed',
    'image-loading-error-retry': 'image-state-transitions-observed',
    'scroll-fullscreen-focus-restore': 'fullscreen-focus-restored',
    'pan-zoom-reduced-motion': 'pan-zoom-reduced-motion-observed',
    'code-supported-unsupported-incomplete': 'code-renderer-states-observed',
    'math-native-and-fallback': 'math-renderer-states-observed',
    'mermaid-native-webview-fallback-retry': 'mermaid-renderer-states-observed',
    'rtl-cjk-font-scale-theme-layout': 'international-layout-observed',
  }[scenario] || '';
}

export function createDeviceEvidenceCapabilities() {
  return {
    links: {
      approve: (url) => ({ status: url.includes('/denied') ? 'denied' : 'success' }),
      open: (url) => ({ status: url.includes('/failed') ? 'failed' : 'success' }),
    },
    clipboard: { writeText: () => ({ status: 'success' }) },
    share: { shareText: () => ({ status: 'cancelled' }) },
    files: { save: () => ({ status: 'failed' }) },
    gestures: { renderPanZoom: ({ children }) => children },
    focus: { restore: () => ({ status: 'success' }) },
  };
}
