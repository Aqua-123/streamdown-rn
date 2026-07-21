import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/protocol.json'), 'utf8'));
const REQUIRED_METRICS = [
  'parserMs', 'reactCommits', 'stableRerendersPerAppend', 'appendToCommitP50Ms',
  'appendToCommitP95Ms', 'jsDroppedFramePercent', 'uiDroppedFramePercent',
  'heapGrowthMiB', 'cacheEntries', 'firstRenderMs', 'coreBundleBytes', 'startupMs',
  'coreBundleOptionalMarkerCount', 'optionalBundleBytes', 'optionalStartupMs',
  'optionalHeapGrowthMiB', 'optionalLongestCommitMs',
];
const REGRESSION_METRICS = REQUIRED_METRICS.filter((name) => ![
  'stableRerendersPerAppend', 'cacheEntries', 'coreBundleOptionalMarkerCount',
].includes(name));

function fail(message) { throw new Error(message); }
function finiteMetrics(result) {
  for (const name of REQUIRED_METRICS) {
    if (!Number.isFinite(result.metrics?.[name]) || result.metrics[name] < 0) fail(`${result.runId}: invalid ${name}`);
  }
}
function evidenceExists(result) {
  const entries = result.evidence ?? [];
  const traceSuffix = result.environment.platform === 'android' ? '.perfetto-trace' : '.trace';
  if (!entries.some((entry) => entry.endsWith(traceSuffix)) || !entries.some((entry) => entry.endsWith('.log'))) {
    fail(`${result.runId}: raw ${traceSuffix} and .log evidence are required`);
  }
  for (const entry of entries) {
    const target = path.resolve(root, entry);
    if (!fs.existsSync(target) || fs.statSync(target).size === 0) fail(`${result.runId}: missing evidence ${entry}`);
  }
}
function sameEnvironment(baseline, candidate) {
  for (const key of ['platform', 'engine', 'buildType', 'host', 'osVersion', 'device']) {
    if (baseline.environment?.[key] !== candidate.environment?.[key]) fail(`${candidate.runId}: ${key} differs from baseline`);
  }
  if (candidate.environment.buildType !== 'release' || !/hermes/i.test(candidate.environment.engine)) fail(`${candidate.runId}: release Hermes required`);
  for (const key of ['sha256', 'bytes', 'chunkSize']) {
    if (baseline.corpus?.[key] !== candidate.corpus?.[key]) fail(`${candidate.runId}: corpus ${key} differs from baseline`);
  }
  if (candidate.corpus.sha256 !== protocol.corpusSha256 || candidate.corpus.bytes !== protocol.expandedBytes || candidate.corpus.chunkSize !== protocol.chunkSize) {
    fail(`${candidate.runId}: corpus does not match protocol`);
  }
}

export function verifyHermesResults(results, verifyEvidence = true) {
  if (new Set(results.map((result) => result.runId)).size !== results.length) fail('Duplicate Hermes runId');
  const byRunId = new Map(results.map((result) => [result.runId, result]));
  const candidates = results.filter((result) => result.runId?.endsWith('-candidate'));
  if (!candidates.length) fail('No physical Release-Hermes candidate results found');
  const platforms = new Set();
  for (const candidate of candidates) {
    const baseline = byRunId.get(candidate.runId.replace(/-candidate$/, '-baseline'));
    if (!baseline) fail(`${candidate.runId}: matching baseline is required`);
    for (const result of [baseline, candidate]) {
      if (result.schemaVersion !== 1 || Number.isNaN(Date.parse(result.timestamp))) fail(`${result.runId}: schemaVersion 1 and timestamp are required`);
      if (!['characterization', 'pass'].includes(result.status)) fail(`${result.runId}: invalid result status`);
      if (/simulator|emulator|virtual/i.test(result.environment?.device ?? '')) fail(`${result.runId}: physical hardware required`);
    }
    finiteMetrics(baseline); finiteMetrics(candidate); sameEnvironment(baseline, candidate);
    if (verifyEvidence) { evidenceExists(baseline); evidenceExists(candidate); }
    const budget = protocol.budgets;
    if (candidate.metrics.stableRerendersPerAppend !== budget.stableRerendersPerAppend) fail(`${candidate.runId}: stable rerenders exceeded`);
    if (candidate.metrics.cacheEntries > budget.stableRootCacheEntries) fail(`${candidate.runId}: cache ceiling exceeded`);
    if (candidate.metrics.jsDroppedFramePercent > budget.droppedFramePercent || candidate.metrics.uiDroppedFramePercent > budget.droppedFramePercent) fail(`${candidate.runId}: dropped-frame budget exceeded`);
    if (candidate.metrics.heapGrowthMiB > budget.heapGrowthMiB || candidate.metrics.optionalHeapGrowthMiB > budget.heapGrowthMiB) fail(`${candidate.runId}: heap budget exceeded`);
    if (candidate.metrics.firstRenderMs > budget.firstRenderMs) fail(`${candidate.runId}: first-render budget exceeded`);
    if (candidate.metrics.coreBundleOptionalMarkerCount !== budget.coreBundleOptionalMarkerCount) fail(`${candidate.runId}: optional code entered the core bundle`);
    if (candidate.environment.platform === 'android' && candidate.metrics.appendToCommitP95Ms > budget.androidP95AppendToCommitMs) fail(`${candidate.runId}: Android p95 exceeded one frame`);
    if (candidate.environment.platform === 'android' && (!/Pixel 8/i.test(candidate.environment.device) || !/Android 14/i.test(candidate.environment.osVersion))) fail(`${candidate.runId}: Pixel 8 hardware on Android 14 is required`);
    const multiplier = 1 + budget.sameDeviceMaxRegressionPercent / 100;
    for (const name of REGRESSION_METRICS) {
      if (candidate.metrics[name] > baseline.metrics[name] * multiplier) fail(`${candidate.runId}: ${name} regressed more than ${budget.sameDeviceMaxRegressionPercent}%`);
    }
    platforms.add(candidate.environment.platform);
  }
  for (const platform of ['android', 'ios']) if (!platforms.has(platform)) fail(`Missing ${platform} physical result pair`);
  return { status: 'pass', pairs: candidates.length, platforms: [...platforms].sort() };
}

function selfTest() {
  const metrics = Object.fromEntries(REQUIRED_METRICS.map((name) => [name, name.endsWith('Bytes') ? 1_000_000 : 10]));
  Object.assign(metrics, { stableRerendersPerAppend: 0, cacheEntries: 128, coreBundleOptionalMarkerCount: 0, jsDroppedFramePercent: 0.5, uiDroppedFramePercent: 0.5, heapGrowthMiB: 8, optionalHeapGrowthMiB: 8 });
  const corpus = { sha256: protocol.corpusSha256, bytes: protocol.expandedBytes, chunkSize: protocol.chunkSize };
  const results = ['android', 'ios'].flatMap((platform) => ['baseline', 'candidate'].map((role) => ({
    schemaVersion: 1, timestamp: new Date().toISOString(), status: 'characterization', runId: `${platform}-${role}`,
    environment: { platform, engine: 'Hermes', buildType: 'release', host: 'packed fixture', osVersion: platform === 'android' ? 'Android 14' : 'iOS test', device: platform === 'android' ? 'Pixel 8 hardware' : 'iPhone hardware' }, corpus, metrics: { ...metrics }, evidence: [],
  })));
  if (verifyHermesResults(results, false).status !== 'pass') fail('self-test did not pass valid pairs');
  results.find((result) => result.runId === 'android-candidate').metrics.appendToCommitP95Ms = 20;
  try { verifyHermesResults(results, false); } catch { return; }
  fail('self-test accepted an over-budget Android p95');
}

export function loadHermesResults(directory = process.env.STREAMDOWN_HERMES_RESULTS_DIR ?? path.join(root, 'benchmarks/results')) {
  const target = path.resolve(directory);
  return fs.existsSync(target)
    ? fs.readdirSync(target).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(path.join(target, name), 'utf8')))
    : [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    console.log('Hermes evidence verifier self-test passed.');
  } else {
    try { console.log(JSON.stringify(verifyHermesResults(loadHermesResults()), null, 2)); }
    catch (error) { console.error(`Hermes performance blocked: ${error.message}`); process.exit(1); }
  }
}
