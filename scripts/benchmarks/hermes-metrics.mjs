import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIB = 1024 * 1024;
const TRACE_GENERATOR = 'streamdown-rn-trace-export/v1';
const EVENT_KEYS = {
  parser: ['type', 'durationNs'],
  append: ['type', 'appendId', 'startNs', 'commitNs', 'stableRerenders'],
  commit: ['type', 'scope', 'durationNs'],
  heap: ['type', 'scope', 'phase', 'bytes'],
  cache: ['type', 'entries'],
  'first-render': ['type', 'startNs', 'endNs'],
  bundle: ['type', 'scope', 'bytes', 'optionalMarkerCount'],
  startup: ['type', 'scope', 'startNs', 'endNs'],
};

function fail(message) { throw new Error(message); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    fail(`${label}: unexpected shape`);
  }
}
function finite(value, label, integer = false) {
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) fail(`${label}: expected a non-negative ${integer ? 'safe integer' : 'number'}`);
  return value;
}
function percentile(values, fraction) {
  if (!values.length) fail('metric source contains no samples');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
function milliseconds(nanoseconds) { return Number((nanoseconds / 1_000_000).toFixed(6)); }
function percent(numerator, denominator) { return Number((numerator * 100 / denominator).toFixed(6)); }

export function sha256Evidence(target) {
  const digest = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let files = 0;
  let totalBytes = 0;
  const visit = (current, relative = '') => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(`symlink evidence is not allowed: ${current}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) visit(path.join(current, name), path.join(relative, name));
      return;
    }
    if (!stat.isFile() || stat.size === 0) fail(`empty or non-file evidence: ${current}`);
    if (++files > 10_000 || stat.size > 2 * 1024 * MIB || (totalBytes += stat.size) > 4 * 1024 * MIB) fail(`evidence bundle is too large: ${target}`);
    digest.update(relative.replaceAll(path.sep, '/'));
    digest.update('\0');
    const descriptor = fs.openSync(current, 'r');
    try {
      let bytesRead;
      while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, bytesRead));
    } finally { fs.closeSync(descriptor); }
    digest.update('\0');
  };
  visit(target);
  if (!files) fail(`empty evidence bundle: ${target}`);
  return digest.digest('hex');
}

export function loadHarnessEvents(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 16 * MIB) fail('harness event stream must be a nonempty regular file at most 16 MiB');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!lines.length) fail('harness event stream is empty');
  return lines.map((line, index) => {
    let event;
    try { event = JSON.parse(line); } catch { fail(`harness event ${index + 1}: invalid JSON`); }
    const keys = EVENT_KEYS[event?.type];
    if (!keys) fail(`harness event ${index + 1}: unknown type`);
    exactKeys(event, keys, `harness event ${index + 1}`);
    switch (event.type) {
      case 'parser': case 'commit': finite(event.durationNs, `${event.type} durationNs`, true); break;
      case 'append':
        if (typeof event.appendId !== 'string' || !event.appendId) fail('appendId must be a nonempty string');
        finite(event.startNs, 'append startNs', true); finite(event.commitNs, 'append commitNs', true);
        finite(event.stableRerenders, 'append stableRerenders', true);
        if (event.commitNs < event.startNs) fail(`${event.appendId}: append commit precedes start`);
        break;
      case 'heap':
        if (!['core', 'optional'].includes(event.scope) || !['start', 'end'].includes(event.phase)) fail('heap scope or phase is invalid');
        finite(event.bytes, 'heap bytes', true); break;
      case 'cache': finite(event.entries, 'cache entries', true); break;
      case 'first-render': case 'startup':
        if (event.type === 'startup' && !['core', 'optional'].includes(event.scope)) fail('startup scope is invalid');
        finite(event.startNs, `${event.type} startNs`, true); finite(event.endNs, `${event.type} endNs`, true);
        if (event.endNs < event.startNs) fail(`${event.type} end precedes start`);
        break;
      case 'bundle':
        if (!['core', 'optional'].includes(event.scope)) fail('bundle scope is invalid');
        finite(event.bytes, 'bundle bytes', true); finite(event.optionalMarkerCount, 'optional marker count', true); break;
    }
    if (event.type === 'commit' && !['core', 'optional'].includes(event.scope)) fail('commit scope is invalid');
    return event;
  });
}

export function loadTraceExport(file, rawTrace, platform) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 16 * MIB) fail('trace export must be a nonempty regular file at most 16 MiB');
  const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
  exactKeys(trace, ['schemaVersion', 'generator', 'sourceTraceSha256', 'platform', 'appends', 'frames'], 'trace export');
  if (trace.schemaVersion !== 1 || trace.generator !== TRACE_GENERATOR || trace.platform !== platform) fail('trace export identity mismatch');
  if (trace.sourceTraceSha256 !== sha256Evidence(rawTrace)) fail('trace export is not bound to the retained raw trace');
  if (!Array.isArray(trace.appends) || !trace.appends.length) fail('trace export contains no append intervals');
  const ids = new Set();
  for (const [index, append] of trace.appends.entries()) {
    exactKeys(append, ['appendId', 'startNs', 'commitNs'], `trace append ${index + 1}`);
    if (typeof append.appendId !== 'string' || !append.appendId || ids.has(append.appendId)) fail('trace append IDs must be unique nonempty strings');
    ids.add(append.appendId);
    finite(append.startNs, 'trace append startNs', true); finite(append.commitNs, 'trace append commitNs', true);
    if (append.commitNs < append.startNs) fail(`${append.appendId}: trace commit precedes start`);
  }
  exactKeys(trace.frames, ['js', 'ui'], 'trace frames');
  for (const thread of ['js', 'ui']) {
    if (!Array.isArray(trace.frames[thread]) || !trace.frames[thread].length) fail(`trace export contains no ${thread} frames`);
    for (const [index, frame] of trace.frames[thread].entries()) {
      exactKeys(frame, ['durationNs', 'budgetNs'], `${thread} frame ${index + 1}`);
      finite(frame.durationNs, `${thread} frame durationNs`, true); finite(frame.budgetNs, `${thread} frame budgetNs`, true);
      if (frame.budgetNs === 0) fail(`${thread} frame budget must be positive`);
    }
  }
  return trace;
}

function one(events, type, scope) {
  const matches = events.filter((event) => event.type === type && (scope === undefined || event.scope === scope));
  if (matches.length !== 1) fail(`${scope ? `${scope} ` : ''}${type}: exactly one event is required`);
  return matches[0];
}
export function deriveHermesMetrics(events, trace) {
  const select = (type, scope) => events.filter((event) => event.type === type && (scope === undefined || event.scope === scope));
  const appends = select('append');
  if (!appends.length) fail('harness event stream contains no appends');
  if (new Set(appends.map((event) => event.appendId)).size !== appends.length) fail('harness append IDs must be unique');
  const traceById = new Map(trace.appends.map((event) => [event.appendId, event]));
  if (traceById.size !== appends.length) fail('harness and trace append counts differ');
  const harnessDurations = appends.map((event) => event.commitNs - event.startNs);
  const traceDurations = appends.map((event) => {
    const matched = traceById.get(event.appendId);
    if (!matched) fail(`${event.appendId}: missing from trace export`);
    const duration = matched.commitNs - matched.startNs;
    if (Math.abs(duration - (event.commitNs - event.startNs)) > 250_000) fail(`${event.appendId}: harness and trace duration differ by more than 0.25 ms`);
    return duration;
  });
  for (const fraction of [0.5, 0.95]) {
    if (Math.abs(percentile(harnessDurations, fraction) - percentile(traceDurations, fraction)) > 250_000) fail(`harness and trace append p${fraction * 100} differ`);
  }
  const framePercent = (thread) => percent(trace.frames[thread].filter((frame) => frame.durationNs > frame.budgetNs).length, trace.frames[thread].length);
  const heapGrowth = (scope) => {
    const start = select('heap', scope).filter((event) => event.phase === 'start');
    const end = select('heap', scope).filter((event) => event.phase === 'end');
    if (start.length !== 1 || end.length !== 1) fail(`${scope} heap: one start and one end event are required`);
    return Number((Math.max(0, end[0].bytes - start[0].bytes) / MIB).toFixed(6));
  };
  const durationMs = (type, scope) => {
    const samples = select(type, scope);
    if (!samples.length) fail(`${scope ? `${scope} ` : ''}${type}: samples are required`);
    return milliseconds(percentile(samples.map((event) => event.endNs - event.startNs), 0.95));
  };
  const coreBundle = one(events, 'bundle', 'core');
  const optionalBundle = one(events, 'bundle', 'optional');
  const commits = select('commit');
  const optionalCommits = select('commit', 'optional');
  if (!commits.length || !optionalCommits.length) fail('core and optional commit samples are required');
  const cache = select('cache');
  if (!cache.length) fail('cache samples are required');
  return {
    parserMs: milliseconds(percentile(select('parser').map((event) => event.durationNs), 0.95)),
    reactCommits: commits.length,
    stableRerendersPerAppend: Math.max(...appends.map((event) => event.stableRerenders)),
    appendToCommitP50Ms: milliseconds(percentile(traceDurations, 0.5)),
    appendToCommitP95Ms: milliseconds(percentile(traceDurations, 0.95)),
    jsDroppedFramePercent: framePercent('js'),
    uiDroppedFramePercent: framePercent('ui'),
    heapGrowthMiB: heapGrowth('core'),
    cacheEntries: Math.max(...cache.map((event) => event.entries)),
    firstRenderMs: durationMs('first-render'),
    coreBundleBytes: coreBundle.bytes,
    startupMs: durationMs('startup', 'core'),
    coreBundleOptionalMarkerCount: coreBundle.optionalMarkerCount,
    optionalBundleBytes: optionalBundle.bytes,
    optionalStartupMs: durationMs('startup', 'optional'),
    optionalHeapGrowthMiB: heapGrowth('optional'),
    optionalLongestCommitMs: milliseconds(Math.max(...optionalCommits.map((event) => event.durationNs))),
  };
}

export function deriveHermesMetricsFromFiles(eventsFile, traceExportFile, rawTraceFile, platform) {
  return deriveHermesMetrics(loadHarnessEvents(eventsFile), loadTraceExport(traceExportFile, rawTraceFile, platform));
}

export const BASELINE_SEED = Object.freeze({
  package: 'streamdown-native', version: '0.1.0', repository: 'Aqua-123/streamdown-rn',
  lineageStatus: 'owner-confirmed',
  npmIntegrity: 'sha512-IHVRL/Ex+DiXguzYkwh9CqCFvM6FilXsKBDsIGzBNDRiiUpDruM2dINK36k8DDV5yff3uO7UPnFy0SMWjMLgBw==',
  packageSha256: '9d153cf298ada8c39acbf95518057d140a713f013bafd6ce0bca50e5d0d922e8',
  gitHead: 'da17fbefd58a510c38b58090db4a93527c51aee7',
});

export function loadApprovedBaseline(file = path.join(root, 'benchmarks/baselines/approved.json')) {
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  exactKeys(ledger, ['schemaVersion', 'records'], 'approved baseline ledger');
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.records) || ledger.records.length !== 1) {
    fail('approved baseline ledger must contain exactly one confirmed prior release');
  }
  const keys = ['package', 'version', 'repository', 'lineageStatus', 'npmIntegrity', 'packageSha256', 'gitHead'];
  const seed = ledger.records[0];
  exactKeys(seed, keys, 'approved baseline seed');
  if (!isDeepStrictEqual(seed, BASELINE_SEED)) fail('approved baseline does not match streamdown-native@0.1.0');
  return seed;
}
