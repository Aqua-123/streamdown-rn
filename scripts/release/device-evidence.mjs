const SCENARIO_SIGNALS = {
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
};
const HOST_APPS = {
  expo54: { scheme: 'streamdown-rn-expo54', appId: 'ai.darkresearch.streamdownrn.expo54', process: 'streamdown-rn-expo54-fixture' },
  expo56: { scheme: 'streamdown-rn-expo56', appId: 'ai.darkresearch.streamdownrn.expo56', process: 'streamdown-rn-expo56-fixture' },
};
const CAPTURE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const parseMarker = (text, marker) => text.split(/\r?\n/)
  .map((line) => {
    const start = line.indexOf(`${marker} `);
    if (start < 0) return null;
    try { return JSON.parse(line.slice(start + marker.length + 1)); } catch { return null; }
  })
  .filter(Boolean);

export const requiredDeviceAssertions = (scenario) => SCENARIO_SIGNALS[scenario]
  ? ['release-hermes-launched', SCENARIO_SIGNALS[scenario]]
  : [];

export function deviceEvidenceUrl({ host, platform, scenario, coverageId, source, captureId }) {
  const app = HOST_APPS[host];
  if (!app || !['android', 'ios'].includes(platform) || !source) return null;
  if (!CAPTURE_ID.test(captureId ?? '')) return null;
  const query = new URLSearchParams({ coverageId, scenario, platform, captureId, commit: source.commit, packageSha256: source.packageSha256 });
  return `${app.scheme}://evidence?${query}`;
}

export function validDeviceLaunchCommand(context, argv) {
  const app = HOST_APPS[context.host];
  const url = deviceEvidenceUrl(context);
  if (!app || !url || !Array.isArray(argv)) return false;
  const expected = context.platform === 'android'
    ? ['adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, `${app.appId}/.MainActivity`]
    : ['xcrun', 'simctl', 'openurl', 'booted', url];
  return JSON.stringify(argv) === JSON.stringify(expected);
}

export function validDeviceCaptureCommand(platform, argv, host) {
  if (!Array.isArray(argv)) return false;
  if (platform === 'android') return JSON.stringify(argv) === JSON.stringify(['adb', 'logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I']);
  const process = HOST_APPS[host]?.process;
  return platform === 'ios' && Boolean(process)
    && JSON.stringify(argv) === JSON.stringify(['xcrun', 'simctl', 'spawn', 'booted', 'log', 'show', '--style', 'compact', '--last', '5m', '--predicate', `process == "${process}"`]);
}

export function deriveDeviceAssertions({ coverageId, platform, scenario, buildType, engine, source, captureId }, rawText, artifactSha256) {
  const required = requiredDeviceAssertions(scenario);
  if (required.length === 0 || !Array.isArray(artifactSha256) || artifactSha256.length === 0) return null;
  const runtime = parseMarker(rawText, 'STREAMDOWN_DEVICE_RUNTIME').find((value) =>
    value.coverageId === coverageId && value.platform === platform && value.buildType === buildType
    && value.engine === engine && value.appState === 'foreground'
    && value.captureId === captureId
    && value.source?.commit === source?.commit && value.source?.packageSha256 === source?.packageSha256);
  const scenarioResult = parseMarker(rawText, 'STREAMDOWN_DEVICE_SCENARIO').find((value) =>
    value.coverageId === coverageId && value.scenario === scenario && value.status === 'passed'
    && value.signal === SCENARIO_SIGNALS[scenario]
    && value.captureId === captureId
    && value.source?.commit === source?.commit && value.source?.packageSha256 === source?.packageSha256);
  if (!runtime || !scenarioResult) return null;
  return [
    { id: 'release-hermes-launched', status: 'passed', observation: { kind: 'device-runtime-marker', value: `${platform}:${engine}:${buildType}:foreground` }, artifactSha256 },
    { id: SCENARIO_SIGNALS[scenario], status: 'passed', observation: { kind: 'scenario-runtime-marker', value: scenarioResult.signal }, artifactSha256 },
  ];
}
