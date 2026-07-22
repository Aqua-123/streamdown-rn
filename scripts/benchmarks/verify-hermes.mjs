import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { BASELINE_SEED, deriveHermesMetricsFromFiles, loadApprovedBaseline, loadTraceExport, sha256Evidence } from './hermes-metrics.mjs';
import { extractHermesTrace } from './extract-hermes-trace.mjs';

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
const MAX_RESULT_FILES = 32;
const MAX_RESULT_JSON_BYTES = 1024 * 1024;
const MAX_MEASUREMENT_LOG_BYTES = 16 * 1024 * 1024;
const RECEIPT_PREFIX = 'STREAMDOWN_HERMES_MEASUREMENT_V1 ';
const RECEIPT_GENERATOR = 'streamdown-rn-hermes-harness/v1';

function fail(message) { throw new Error(message); }
function digestEvidence(target) {
  const digest = crypto.createHash('sha256');
  let files = 0;
  let totalBytes = 0;
  const updateFile = (file) => {
    const descriptor = fs.openSync(file, 'r');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    try {
      let bytesRead;
      while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, bytesRead));
    } finally {
      fs.closeSync(descriptor);
    }
  };
  const visit = (current, relative = '') => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(`symlink evidence is not allowed: ${current}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) visit(path.join(current, name), path.join(relative, name));
      return;
    }
    if (!stat.isFile() || stat.size === 0) fail(`empty or non-file evidence: ${current}`);
    if (stat.size > 2 * 1024 * 1024 * 1024 || (totalBytes += stat.size) > 4 * 1024 * 1024 * 1024) fail(`evidence bundle is too large: ${target}`);
    files++;
    digest.update(relative.replaceAll(path.sep, '/'));
    digest.update('\0');
    updateFile(current);
    digest.update('\0');
  };
  visit(target);
  if (files === 0) fail(`empty evidence bundle: ${target}`);
  return digest.digest('hex');
}
function finiteMetrics(result) {
  for (const name of REQUIRED_METRICS) {
    if (!Number.isFinite(result.metrics?.[name]) || result.metrics[name] < 0) fail(`${result.runId}: invalid ${name}`);
  }
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    fail(`${label}: unexpected receipt shape`);
  }
}
function verifyMeasurementReceipt(result, logTarget, artifactDigests) {
  const stat = fs.lstatSync(logTarget);
  if (stat.size > MAX_MEASUREMENT_LOG_BYTES) fail(`${result.runId}: measurement log is too large`);
  const receiptLines = fs.readFileSync(logTarget, 'utf8').split(/\r?\n/).filter((line) => line.startsWith(RECEIPT_PREFIX));
  if (receiptLines.length !== 1) fail(`${result.runId}: exactly one canonical measurement receipt is required`);
  let receipt;
  try { receipt = JSON.parse(receiptLines[0].slice(RECEIPT_PREFIX.length)); }
  catch { fail(`${result.runId}: invalid canonical measurement receipt JSON`); }
  exactKeys(receipt, ['schemaVersion', 'generator', 'runId', 'timestamp', 'source', 'environment', 'corpus', 'artifacts', 'metrics'], result.runId);
  if (receipt.schemaVersion !== 1 || receipt.generator !== RECEIPT_GENERATOR || receipt.runId !== result.runId || receipt.timestamp !== result.timestamp) {
    fail(`${result.runId}: measurement receipt identity mismatch`);
  }
  for (const [name, expected] of [['source', result.source], ['environment', result.environment], ['corpus', result.corpus]]) {
    if (!isDeepStrictEqual(receipt[name], expected)) fail(`${result.runId}: receipt ${name} mismatch`);
  }
  exactKeys(receipt.metrics, REQUIRED_METRICS, `${result.runId} metrics`);
  finiteMetrics({ ...result, metrics: receipt.metrics });
  if (!isDeepStrictEqual(receipt.metrics, result.metrics)) fail(`${result.runId}: reported metrics do not match the machine receipt`);
  exactKeys(receipt.artifacts, [...artifactDigests.keys()], `${result.runId} artifacts`);
  for (const [entry, digest] of artifactDigests) {
    if (receipt.artifacts[entry] !== digest) fail(`${result.runId}: receipt artifact hash mismatch for ${entry}`);
  }
}
function evidenceExists(result, seenEvidence, seenDigests, evidenceRoot, traceExtractor = extractHermesTrace) {
  const entries = result.evidence ?? [];
  const traceSuffix = result.environment.platform === 'android' ? '.perfetto-trace' : '.trace';
  const logs = entries.filter((entry) => entry.endsWith('.log'));
  const traces = entries.filter((entry) => entry.endsWith(traceSuffix));
  const eventStreams = entries.filter((entry) => entry.endsWith('.events.jsonl'));
  const traceExports = entries.filter((entry) => entry.endsWith('.trace-export.json'));
  if (traces.length !== 1 || logs.length !== 1 || eventStreams.length !== 1 || traceExports.length !== 1) {
    fail(`${result.runId}: exactly one raw ${traceSuffix}, .log, .events.jsonl, and .trace-export.json are required`);
  }
  if (new Set(entries).size !== entries.length) fail(`${result.runId}: duplicate evidence path`);
  const artifactDigests = new Map();
  const targets = new Map();
  let logTarget;
  for (const entry of entries) {
    const target = path.resolve(root, entry);
    const allowedRoot = fs.realpathSync(evidenceRoot);
    const relative = path.relative(allowedRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`${result.runId}: evidence escapes results directory: ${entry}`);
    if (!fs.existsSync(target)) fail(`${result.runId}: missing evidence ${entry}`);
    const canonical = fs.realpathSync(target);
    if (path.relative(allowedRoot, canonical).startsWith('..')) fail(`${result.runId}: evidence escapes results directory: ${entry}`);
    if (seenEvidence.has(canonical)) fail(`${result.runId}: evidence path reused by another run: ${entry}`);
    seenEvidence.add(canonical);
    const expected = result.evidenceSha256?.[entry];
    const actual = digestEvidence(target);
    if (!expected || expected !== actual) fail(`${result.runId}: evidence hash mismatch for ${entry}`);
    if (seenDigests.has(actual)) fail(`${result.runId}: evidence content reused by another run: ${entry}`);
    seenDigests.add(actual);
    if (entry.endsWith('.log')) logTarget = target;
    else artifactDigests.set(entry, actual);
    targets.set(entry, target);
  }
  verifyMeasurementReceipt(result, logTarget, artifactDigests);
  const retainedTraceExport = loadTraceExport(targets.get(traceExports[0]), targets.get(traces[0]), result.environment.platform);
  const reproducedTraceExport = traceExtractor(targets.get(traces[0]), result.environment.platform);
  if (!isDeepStrictEqual(reproducedTraceExport, retainedTraceExport)) fail(`${result.runId}: retained trace export does not match a fresh platform-trace extraction`);
  const derived = deriveHermesMetricsFromFiles(
    targets.get(eventStreams[0]), targets.get(traceExports[0]), targets.get(traces[0]), result.environment.platform,
  );
  if (!isDeepStrictEqual(derived, result.metrics)) fail(`${result.runId}: reported metrics do not match retained primitive evidence`);
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

export function verifyHermesResults(results, verifyEvidence = true, expectedSource, expectedBaselineSource, evidenceRoot = path.join(root, 'benchmarks/results'), approvedBaseline) {
  const approved = approvedBaseline ?? loadApprovedBaseline();
  const ledgerBaselineSource = { commit: approved.gitHead, packageSha256: approved.packageSha256 };
  if (expectedBaselineSource && !isDeepStrictEqual(expectedBaselineSource, ledgerBaselineSource)) fail('requested baseline is not in the immutable approved ledger');
  expectedBaselineSource = ledgerBaselineSource;
  if (new Set(results.map((result) => result.runId)).size !== results.length) fail('Duplicate Hermes runId');
  const byRunId = new Map(results.map((result) => [result.runId, result]));
  const candidates = results.filter((result) => result.runId?.endsWith('-candidate'));
  if (!candidates.length) fail('No physical Release-Hermes candidate results found');
  const platforms = new Set();
  const seenEvidence = new Set();
  const seenDigests = new Set();
  for (const candidate of candidates) {
    const baseline = byRunId.get(candidate.runId.replace(/-candidate$/, '-baseline'));
    if (!baseline) fail(`${candidate.runId}: matching baseline is required`);
    for (const result of [baseline, candidate]) {
      if (result.schemaVersion !== 1 || Number.isNaN(Date.parse(result.timestamp))) fail(`${result.runId}: schemaVersion 1 and timestamp are required`);
      if (!['characterization', 'pass'].includes(result.status)) fail(`${result.runId}: invalid result status`);
      if (/simulator|emulator|virtual/i.test(result.environment?.device ?? '')) fail(`${result.runId}: physical hardware required`);
      if (!/^[a-f0-9]{40}$/.test(result.source?.commit ?? '') || !/^[a-f0-9]{64}$/.test(result.source?.packageSha256 ?? '')) fail(`${result.runId}: source commit and package SHA-256 are required`);
    }
    if (candidate.status !== 'pass') fail(`${candidate.runId}: candidate status must be pass`);
    if (!expectedSource || !expectedBaselineSource) fail(`${candidate.runId}: expected release and baseline source identities are required`);
    if (expectedBaselineSource.commit === expectedSource.commit || expectedBaselineSource.packageSha256 === expectedSource.packageSha256) fail(`${candidate.runId}: baseline must be a distinct approved package`);
    if (baseline.source.commit !== expectedBaselineSource.commit || baseline.source.packageSha256 !== expectedBaselineSource.packageSha256) fail(`${baseline.runId}: evidence does not match the approved baseline`);
    if (candidate.source.commit !== expectedSource.commit || candidate.source.packageSha256 !== expectedSource.packageSha256) fail(`${candidate.runId}: evidence does not match the publish candidate`);
    for (const result of [baseline, candidate]) {
      const ageDays = (Date.now() - Date.parse(result.timestamp)) / 86_400_000;
      if (ageDays < 0 || ageDays > protocol.maxEvidenceAgeDays) fail(`${result.runId}: evidence is outside the ${protocol.maxEvidenceAgeDays}-day freshness window`);
    }
    finiteMetrics(baseline); finiteMetrics(candidate); sameEnvironment(baseline, candidate);
    if (verifyEvidence) { evidenceExists(baseline, seenEvidence, seenDigests, evidenceRoot); evidenceExists(candidate, seenEvidence, seenDigests, evidenceRoot); }
    const budget = protocol.budgets;
    if (candidate.metrics.stableRerendersPerAppend !== budget.stableRerendersPerAppend) fail(`${candidate.runId}: stable rerenders exceeded`);
    if (candidate.metrics.cacheEntries > budget.stableRootCacheEntries) fail(`${candidate.runId}: cache ceiling exceeded`);
    if (candidate.metrics.jsDroppedFramePercent > budget.droppedFramePercent || candidate.metrics.uiDroppedFramePercent > budget.droppedFramePercent) fail(`${candidate.runId}: dropped-frame budget exceeded`);
    if (candidate.metrics.heapGrowthMiB > budget.heapGrowthMiB || candidate.metrics.optionalHeapGrowthMiB > budget.heapGrowthMiB) fail(`${candidate.runId}: heap budget exceeded`);
    if (candidate.metrics.firstRenderMs > budget.firstRenderMs) fail(`${candidate.runId}: first-render budget exceeded`);
    if (candidate.metrics.coreBundleOptionalMarkerCount !== budget.coreBundleOptionalMarkerCount) fail(`${candidate.runId}: optional code entered the core bundle`);
    if (candidate.environment.platform === 'android' && candidate.metrics.appendToCommitP95Ms > budget.androidP95AppendToCommitMs) fail(`${candidate.runId}: Android p95 exceeded one frame`);
    if (candidate.environment.platform === 'android' && (!/Pixel 8/i.test(candidate.environment.device) || !/Android 14/i.test(candidate.environment.osVersion))) fail(`${candidate.runId}: Pixel 8 hardware on Android 14 is required`);
    if (candidate.environment.platform === 'ios' && !/iPhone 15/i.test(candidate.environment.device)) fail(`${candidate.runId}: iPhone 15 hardware is required`);
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
  const source = { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) };
  const approved = { ...BASELINE_SEED, lineageStatus: 'owner-confirmed' };
  const baselineSource = { commit: approved.gitHead, packageSha256: approved.packageSha256 };
  const results = ['android', 'ios'].flatMap((platform) => ['baseline', 'candidate'].map((role) => ({
    schemaVersion: 1, timestamp: new Date().toISOString(), status: role === 'candidate' ? 'pass' : 'characterization', runId: `${platform}-${role}`,
    source: role === 'baseline' ? baselineSource : source, environment: { platform, engine: 'Hermes', buildType: 'release', host: 'packed fixture', osVersion: platform === 'android' ? 'Android 14' : 'iOS test', device: platform === 'android' ? 'Pixel 8 hardware' : 'iPhone 15 hardware' }, corpus, metrics: { ...metrics }, evidence: [], evidenceSha256: {},
  })));
  const verifyFixture = () => verifyHermesResults(results, false, source, baselineSource, undefined, approved);
  if (verifyFixture().status !== 'pass') fail('self-test did not pass valid pairs');
  results.find((result) => result.runId === 'android-candidate').status = 'characterization';
  let characterizationRejected = false;
  try { verifyFixture(); } catch { characterizationRejected = true; }
  if (!characterizationRejected) fail('self-test accepted a characterization candidate');
  results.find((result) => result.runId === 'android-candidate').status = 'pass';
  results.find((result) => result.runId === 'android-baseline').source = source;
  try { verifyFixture(); } catch {
    results.find((result) => result.runId === 'android-baseline').source = baselineSource;
  }
  if (results.find((result) => result.runId === 'android-baseline').source !== baselineSource) fail('self-test accepted a mismatched baseline source');
  results.find((result) => result.runId === 'android-candidate').metrics.appendToCommitP95Ms = 20;
  let rejected = false;
  try { verifyFixture(); } catch { rejected = true; }
  if (!rejected) fail('self-test accepted an over-budget Android p95');
  results.find((result) => result.runId === 'android-candidate').metrics.appendToCommitP95Ms = metrics.appendToCommitP95Ms;
  const baseline = results.find((result) => result.runId === 'android-baseline');
  const freshTimestamp = baseline.timestamp;
  baseline.timestamp = new Date(Date.now() - (protocol.maxEvidenceAgeDays + 1) * 86_400_000).toISOString();
  rejected = false;
  try { verifyFixture(); } catch { rejected = true; }
  if (!rejected) fail('self-test accepted a stale baseline');
  baseline.timestamp = freshTimestamp;

  const ledgerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-baseline-ledger-'));
  try {
    const ledger = path.join(ledgerRoot, 'approved.json');
    fs.writeFileSync(ledger, JSON.stringify({ schemaVersion: 1, records: [BASELINE_SEED] }));
    let pendingRejected = false;
    try { loadApprovedBaseline(ledger); } catch (error) { pendingRejected = /owner confirmation is required/.test(error.message); }
    if (!pendingRejected) fail('self-test accepted an unconfirmed npm baseline lineage');
    fs.writeFileSync(ledger, JSON.stringify({ schemaVersion: 1, records: [BASELINE_SEED, approved] }));
    if (!isDeepStrictEqual(loadApprovedBaseline(ledger), approved)) fail('self-test rejected an append-only owner confirmation');
    fs.writeFileSync(ledger, JSON.stringify({ schemaVersion: 1, records: [{ ...BASELINE_SEED, gitHead: '0'.repeat(40) }, approved] }));
    let rewrittenRejected = false;
    try { loadApprovedBaseline(ledger); } catch { rewrittenRejected = true; }
    if (!rewrittenRejected) fail('self-test accepted a rewritten baseline seed');
  } finally { fs.rmSync(ledgerRoot, { recursive: true, force: true }); }

  const fixtureRoot = fs.mkdtempSync(path.join(root, 'benchmarks/results/.hermes-self-test-'));
  try {
    const relativeRoot = path.relative(root, fixtureRoot);
    const log = path.join(fixtureRoot, 'run.log');
    const trace = path.join(fixtureRoot, 'run.trace');
    const eventFile = path.join(fixtureRoot, 'run.events.jsonl');
    const traceExportFile = path.join(fixtureRoot, 'run.trace-export.json');
    fs.mkdirSync(trace);
    fs.writeFileSync(path.join(trace, 'trace.bin'), 'trace');
    const events = [
      { type: 'parser', durationNs: 10_000_000 },
      { type: 'append', appendId: '1', startNs: 0, commitNs: 10_000_000, stableRerenders: 0 },
      { type: 'append', appendId: '2', startNs: 20_000_000, commitNs: 30_000_000, stableRerenders: 0 },
      { type: 'commit', scope: 'core', durationNs: 2_000_000 },
      { type: 'commit', scope: 'optional', durationNs: 3_000_000 },
      { type: 'heap', scope: 'core', phase: 'start', bytes: 1_000_000 },
      { type: 'heap', scope: 'core', phase: 'end', bytes: 2_000_000 },
      { type: 'heap', scope: 'optional', phase: 'start', bytes: 2_000_000 },
      { type: 'heap', scope: 'optional', phase: 'end', bytes: 3_000_000 },
      { type: 'cache', entries: 10 },
      { type: 'first-render', startNs: 0, endNs: 10_000_000 },
      { type: 'bundle', scope: 'core', bytes: 1_000_000, optionalMarkerCount: 0 },
      { type: 'bundle', scope: 'optional', bytes: 1_000_000, optionalMarkerCount: 0 },
      { type: 'startup', scope: 'core', startNs: 0, endNs: 10_000_000 },
      { type: 'startup', scope: 'optional', startNs: 0, endNs: 10_000_000 },
    ];
    fs.writeFileSync(eventFile, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    const traceExport = {
      schemaVersion: 1, generator: 'streamdown-rn-trace-export/v1', sourceTraceSha256: sha256Evidence(trace), platform: 'ios',
      appends: [{ appendId: '1', startNs: 0, commitNs: 10_000_000 }, { appendId: '2', startNs: 20_000_000, commitNs: 30_000_000 }],
      frames: { js: [{ durationNs: 10_000_000, budgetNs: 16_666_667 }], ui: [{ durationNs: 10_000_000, budgetNs: 16_666_667 }] },
    };
    const canonicalTraceExport = structuredClone(traceExport);
    const fixtureTraceExtractor = () => structuredClone(canonicalTraceExport);
    fs.writeFileSync(traceExportFile, JSON.stringify(traceExport));
    const derivedMetrics = deriveHermesMetricsFromFiles(eventFile, traceExportFile, trace, 'ios');
    const result = {
      schemaVersion: 1, runId: 'ios-evidence', timestamp: new Date().toISOString(), status: 'pass', source,
      environment: { platform: 'ios', engine: 'Hermes', buildType: 'release', host: 'packed fixture', osVersion: 'iOS test', device: 'iPhone 15 hardware' },
      corpus, metrics: derivedMetrics,
      evidence: [path.join(relativeRoot, 'run.log'), path.join(relativeRoot, 'run.trace'), path.join(relativeRoot, 'run.events.jsonl'), path.join(relativeRoot, 'run.trace-export.json')], evidenceSha256: {},
    };
    fs.writeFileSync(log, 'capture started\n');
    result.evidenceSha256[result.evidence[0]] = digestEvidence(log);
    for (const entry of result.evidence.slice(1)) result.evidenceSha256[entry] = digestEvidence(path.resolve(root, entry));
    const artifacts = Object.fromEntries(result.evidence.slice(1).map((entry) => [entry, result.evidenceSha256[entry]]));
    const receipt = {
      schemaVersion: 1, generator: RECEIPT_GENERATOR, runId: result.runId, timestamp: result.timestamp,
      source: result.source, environment: result.environment, corpus: result.corpus,
      artifacts, metrics: result.metrics,
    };
    fs.writeFileSync(log, `capture complete\n${RECEIPT_PREFIX}${JSON.stringify(receipt)}\n`);
    result.evidenceSha256[result.evidence[0]] = digestEvidence(log);
    evidenceExists(result, new Set(), new Set(), fixtureRoot, fixtureTraceExtractor);
    const forged = { ...result, metrics: { ...result.metrics, parserMs: result.metrics.parserMs + 1 } };
    const forgedReceipt = { ...receipt, metrics: forged.metrics };
    fs.writeFileSync(log, `${RECEIPT_PREFIX}${JSON.stringify(forgedReceipt)}\n`);
    forged.evidenceSha256 = { ...result.evidenceSha256, [result.evidence[0]]: digestEvidence(log) };
    let forgedRejected = false;
    try { evidenceExists(forged, new Set(), new Set(), fixtureRoot, fixtureTraceExtractor); } catch { forgedRejected = true; }
    if (!forgedRejected) fail('self-test accepted matching forged result and receipt metrics');
    fs.writeFileSync(log, `capture complete\n${RECEIPT_PREFIX}${JSON.stringify(receipt)}\n`);
    result.evidenceSha256[result.evidence[0]] = digestEvidence(log);
    traceExport.appends[0].commitNs += 1_000_000;
    fs.writeFileSync(traceExportFile, JSON.stringify(traceExport));
    const traceExportEntry = result.evidence.find((entry) => entry.endsWith('.trace-export.json'));
    result.evidenceSha256[traceExportEntry] = digestEvidence(traceExportFile);
    receipt.artifacts[traceExportEntry] = result.evidenceSha256[traceExportEntry];
    fs.writeFileSync(log, `${RECEIPT_PREFIX}${JSON.stringify(receipt)}\n`);
    result.evidenceSha256[result.evidence[0]] = digestEvidence(log);
    events.find((event) => event.type === 'append' && event.appendId === '1').commitNs += 1_000_000;
    fs.writeFileSync(eventFile, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    const eventEntry = result.evidence.find((entry) => entry.endsWith('.events.jsonl'));
    result.evidenceSha256[eventEntry] = digestEvidence(eventFile);
    receipt.artifacts[eventEntry] = result.evidenceSha256[eventEntry];
    const jointlyForged = { ...result, metrics: deriveHermesMetricsFromFiles(eventFile, traceExportFile, trace, 'ios') };
    receipt.metrics = jointlyForged.metrics;
    fs.writeFileSync(log, `${RECEIPT_PREFIX}${JSON.stringify(receipt)}\n`);
    jointlyForged.evidenceSha256 = { ...result.evidenceSha256, [result.evidence[0]]: digestEvidence(log) };
    let primitiveTamperRejected = false;
    try { evidenceExists(jointlyForged, new Set(), new Set(), fixtureRoot, fixtureTraceExtractor); } catch { primitiveTamperRejected = true; }
    if (!primitiveTamperRejected) fail('self-test accepted mutually agreeing result, receipt, events, and export that disagree with raw trace extraction');
    const escaped = { ...result, evidence: ['../outside.log'], evidenceSha256: { '../outside.log': '0'.repeat(64) } };
    let traversalRejected = false;
    try { evidenceExists(escaped, new Set(), new Set(), fixtureRoot, fixtureTraceExtractor); } catch { traversalRejected = true; }
    if (!traversalRejected) fail('self-test accepted path traversal');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  const expectLoadFailure = (setup, message) => {
    const directory = fs.mkdtempSync(path.join(root, 'benchmarks/results/.hermes-load-self-test-'));
    try {
      setup(directory);
      let failed = false;
      try { loadHermesResults(directory); } catch { failed = true; }
      if (!failed) fail(message);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
  expectLoadFailure((directory) => fs.writeFileSync(path.join(directory, 'empty.json'), ''), 'self-test accepted an empty result JSON');
  expectLoadFailure((directory) => {
    const target = path.join(directory, 'target');
    fs.writeFileSync(target, '{}');
    fs.symlinkSync(target, path.join(directory, 'linked.json'));
  }, 'self-test accepted a symlink result JSON');
  expectLoadFailure((directory) => {
    const file = path.join(directory, 'large.json');
    fs.writeFileSync(file, '');
    fs.truncateSync(file, MAX_RESULT_JSON_BYTES + 1);
  }, 'self-test accepted an oversized result JSON');
  expectLoadFailure((directory) => {
    for (let index = 0; index <= MAX_RESULT_FILES; index++) fs.writeFileSync(path.join(directory, `${index}.json`), '{}');
  }, 'self-test accepted too many result JSON files');
  const nestedResults = fs.mkdtempSync(path.join(root, 'benchmarks/results/.hermes-nested-self-test-'));
  try {
    fs.mkdirSync(path.join(nestedResults, 'android'));
    fs.writeFileSync(path.join(nestedResults, 'android', 'pair-candidate.json'), '{}');
    fs.writeFileSync(path.join(nestedResults, 'android', 'pair-candidate.trace-export.json'), '{');
    if (loadHermesResults(nestedResults).length !== 1) fail('self-test did not load nested producer results or excluded trace exports');
  } finally { fs.rmSync(nestedResults, { recursive: true, force: true }); }
}

export function loadHermesResults(directory = process.env.STREAMDOWN_HERMES_RESULTS_DIR ?? path.join(root, 'benchmarks/results')) {
  const target = path.resolve(directory);
  if (!fs.existsSync(target)) return [];
  const files = [];
  let entries = 0;
  const visit = (current) => {
    if (++entries > 10_000) fail('Hermes results tree contains too many entries');
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(`Hermes results must not contain symlinks: ${current}`);
    if (stat.isDirectory()) {
      if (current !== target && current.endsWith('.trace')) return;
      for (const name of fs.readdirSync(current).sort()) visit(path.join(current, name));
      return;
    }
    if (stat.isFile() && current.endsWith('.json') && !current.endsWith('.trace-export.json')) files.push(current);
  };
  visit(target);
  if (files.length > MAX_RESULT_FILES) fail(`Too many Hermes result files: ${files.length}`);
  return files.map((file) => {
    const name = path.relative(target, file);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`Hermes result must be a regular file: ${name}`);
    if (stat.size === 0 || stat.size > MAX_RESULT_JSON_BYTES) fail(`Hermes result JSON has invalid size: ${name}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    console.log('Hermes evidence verifier self-test passed.');
  } else {
    const commit = process.env.STREAMDOWN_RELEASE_COMMIT;
    const packageSha256 = process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256;
    const baselineCommit = process.env.STREAMDOWN_BASELINE_COMMIT;
    const baselinePackageSha256 = process.env.STREAMDOWN_BASELINE_PACKAGE_SHA256;
    const expectedSource = commit && packageSha256 ? { commit, packageSha256 } : undefined;
    const expectedBaselineSource = baselineCommit && baselinePackageSha256 ? { commit: baselineCommit, packageSha256: baselinePackageSha256 } : undefined;
    const evidenceRoot = process.env.STREAMDOWN_HERMES_RESULTS_DIR ?? path.join(root, 'benchmarks/results');
    try { console.log(JSON.stringify(verifyHermesResults(loadHermesResults(evidenceRoot), true, expectedSource, expectedBaselineSource, evidenceRoot), null, 2)); }
    catch (error) { console.error(`Hermes performance blocked: ${error.message}`); process.exit(1); }
  }
}
