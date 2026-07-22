import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { extractHermesTrace } from './extract-hermes-trace.mjs';
import { deriveHermesMetricsFromFiles, loadHarnessEvents, loadTraceExport, sha256Evidence } from './hermes-metrics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/protocol.json'), 'utf8'));
const PREFIXES = {
  event: 'STREAMDOWN_HERMES_EVENT ', bundle: 'STREAMDOWN_HERMES_BUNDLE ', complete: 'STREAMDOWN_HERMES_COMPLETE ',
};
const FIXTURES = {
  'current-rn': { androidPackage: 'ai.darkresearch.streamdownrn.expo56', iosBundle: 'ai.darkresearch.streamdownrn.expo56', host: 'packed Expo 56 fixture' },
  expo54: { androidPackage: 'ai.darkresearch.streamdownrn.expo54', iosBundle: 'ai.darkresearch.streamdownrn.expo54', host: 'packed Expo 54 fixture' },
};
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_LOG_BYTES = 16 * 1024 * 1024;
const CAPTURE_SECONDS = 60;
const OPTIONAL_BUNDLE_MARKERS = ['streamdown-rn/code', 'streamdown-rn/math', 'streamdown-rn/mermaid', 'streamdown-rn/renderers'];

function fail(message) { throw new Error(message); }
function sha256File(file) {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, bytesRead));
  } finally { fs.closeSync(descriptor); }
  return digest.digest('hex');
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) fail(`${label}: unexpected shape`);
}
function encoded(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function countOptionalMarkers(file) {
  const source = fs.readFileSync(file, 'utf8');
  return OPTIONAL_BUNDLE_MARKERS.reduce((total, marker) => total + source.split(marker).length - 1, 0);
}
function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || argv[index + 1] === undefined) fail(`invalid argument: ${key ?? ''}`);
    if (values[key.slice(2)] !== undefined) fail(`duplicate argument: ${key}`);
    values[key.slice(2)] = argv[index + 1];
  }
  return values;
}
function assertRegularFile(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 256 * 1024 * 1024) fail(`${label} must be a nonempty regular file at most 256 MiB`);
  return stat;
}
function safeOutput(output) {
  fs.mkdirSync(path.join(root, 'benchmarks/results'), { recursive: true });
  const evidenceRoot = fs.realpathSync(path.join(root, 'benchmarks/results'));
  const resolved = path.resolve(output);
  const relative = path.relative(evidenceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('output must be inside benchmarks/results');
  fs.mkdirSync(resolved, { recursive: true });
  const canonical = fs.realpathSync(resolved);
  const canonicalRelative = path.relative(evidenceRoot, canonical);
  if (canonicalRelative.startsWith('..') || path.isAbsolute(canonicalRelative) || fs.lstatSync(resolved).isSymbolicLink()) fail('output must not escape benchmarks/results through a symlink');
  if (fs.readdirSync(resolved).length) fail('output directory must be empty');
  return resolved;
}
function linesWith(log, prefix) {
  const values = [];
  for (const line of log.split(/\r?\n/)) {
    const start = line.indexOf(prefix);
    if (start < 0) continue;
    try { values.push(JSON.parse(line.slice(start + prefix.length))); }
    catch { fail(`invalid ${prefix.trim()} JSON marker`); }
  }
  return values;
}

export function parseHarnessLog(log, expected) {
  if (Buffer.byteLength(log) > MAX_LOG_BYTES) fail('device log exceeds 16 MiB');
  const events = linesWith(log, PREFIXES.event);
  const bundles = linesWith(log, PREFIXES.bundle);
  const complete = linesWith(log, PREFIXES.complete);
  if (!events.length) fail('device log has no primitive Hermes events');
  if (bundles.length !== 1) fail('device log must contain exactly one bundle receipt');
  if (complete.length !== 1) fail('device log must contain exactly one completion marker');
  if (!isDeepStrictEqual(bundles[0], expected.bundles)) fail('device bundle receipt does not match retained bundle inputs');
  if (!isDeepStrictEqual(complete[0], expected.identity)) fail('device completion marker does not match the requested candidate and corpus');
  return { events, bundleReceipt: bundles[0] };
}

function command(command, args) { return Object.freeze({ command, args: Object.freeze(args) }); }
export function buildCapturePlan(options, configuration, rawTrace, listOutput) {
  const fixture = FIXTURES[options.fixture];
  const encodedConfiguration = encoded(configuration);
  if (options.platform === 'android') {
    const adb = (...args) => command('adb', ['-s', options.device, ...args]);
    return {
      inspect: [adb('shell', 'getprop', 'ro.product.model'), adb('shell', 'getprop', 'ro.build.version.release'), adb('shell', 'getprop', 'ro.kernel.qemu')],
      prepare: [adb('logcat', '-c'), adb('shell', 'am', 'force-stop', fixture.androidPackage)],
      capture: adb('shell', 'perfetto', '-o', '/data/local/tmp/streamdown-rn.perfetto-trace', '-t', `${CAPTURE_SECONDS}s`, '--app', fixture.androidPackage, 'sched', 'freq', 'idle', 'am', 'wm', 'gfx', 'view', 'binder_driver', 'hal', 'dalvik', 'input', 'res', 'memory'),
      log: adb('logcat', '-v', 'raw'),
      launch: adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `streamdown-rn-expo${options.fixture === 'expo54' ? '54' : '56'}://benchmark?scenario=benchmark&hermesEvidence=${encodedConfiguration}`, fixture.androidPackage),
      collect: [adb('pull', '/data/local/tmp/streamdown-rn.perfetto-trace', rawTrace)],
      cleanup: [adb('shell', 'rm', '/data/local/tmp/streamdown-rn.perfetto-trace'), adb('shell', 'am', 'force-stop', fixture.androidPackage)],
    };
  }
  return {
    inspect: [command('xcrun', ['devicectl', 'list', 'devices', '--json-output', listOutput])],
    prepare: [],
    launch: command('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', options.device, '--terminate-existing', '--console', fixture.iosBundle]),
    capture: command('xcrun', ['xctrace', 'record', '--template', 'Time Profiler', '--device', options.device, '--output', rawTrace, '--time-limit', `${CAPTURE_SECONDS}s`, '--attach', fixture.iosBundle]),
    trigger: command('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', options.device, '--payload-url', `streamdown-rn-expo${options.fixture === 'expo54' ? '54' : '56'}://benchmark?scenario=benchmark&hermesEvidence=${encodedConfiguration}`, fixture.iosBundle]),
    collect: [], cleanup: [],
  };
}

class Executor {
  run(spec) {
    if (!['adb', 'xcrun'].includes(spec.command)) fail(`command is not allowlisted: ${spec.command}`);
    const result = spawnSync(spec.command, spec.args, { encoding: 'utf8', maxBuffer: MAX_LOG_BYTES, timeout: 60_000 });
    if (result.error) throw result.error;
    if (result.status !== 0) fail(`${spec.command} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
    return result.stdout;
  }
  start(spec) {
    if (!['adb', 'xcrun'].includes(spec.command)) fail(`command is not allowlisted: ${spec.command}`);
    const child = spawn(spec.command, spec.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [], errors = [];
    let bytes = 0;
    const take = (target) => (chunk) => { bytes += chunk.length; if (bytes > MAX_LOG_BYTES) child.kill('SIGKILL'); else target.push(chunk); };
    child.stdout.on('data', take(chunks)); child.stderr.on('data', take(errors));
    const completion = new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
    return {
      stop: () => child.kill('SIGINT'),
      snapshot: () => `${Buffer.concat(chunks).toString()}\n${Buffer.concat(errors).toString()}`,
      wait: async () => {
        const { code, signal } = await completion;
        if (code !== 0 && signal !== 'SIGINT') fail(`${spec.command} failed (${code ?? signal}): ${Buffer.concat(errors).toString().trim()}`);
        return { stdout: Buffer.concat(chunks).toString(), stderr: Buffer.concat(errors).toString() };
      },
    };
  }
}
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitForCompletion(process, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (linesWith(process.snapshot(), PREFIXES.complete).length) return;
    await delay(250);
  }
  fail('physical fixture did not emit a completion marker before the capture deadline');
}

function findDeviceRecord(value, device) {
  if (!value || typeof value !== 'object') return null;
  if (Object.values(value).some((entry) => entry === device)) return value;
  for (const entry of Object.values(value)) {
    const found = findDeviceRecord(entry, device);
    if (found) return found;
  }
  return null;
}
function inspectHardware(options, plan, executor, listOutput) {
  if (options.platform === 'android') {
    const [device, osVersion, emulator] = plan.inspect.map((spec) => executor.run(spec).trim());
    if (!/^Pixel 8$/i.test(device) || !/^14(?:\.|$)/.test(osVersion) || emulator === '1') fail('Android capture requires a physical Pixel 8 on Android 14');
    return { device, osVersion };
  }
  executor.run(plan.inspect[0]);
  const record = findDeviceRecord(JSON.parse(fs.readFileSync(listOutput, 'utf8')), options.device);
  const flattened = JSON.stringify(record ?? {});
  if (!record || !/iPhone 15/i.test(flattened) || !/(connected|available|paired)/i.test(flattened) || /simulator/i.test(flattened)) fail('iOS capture requires a connected physical iPhone 15');
  const device = flattened.match(/iPhone 15[^"}]*/i)?.[0] ?? 'iPhone 15 hardware';
  const osVersion = flattened.match(/iOS[ /-]*[0-9.]+/i)?.[0] ?? flattened.match(/"operatingSystemVersion":"([^"]+)"/)?.[1];
  if (!osVersion) fail('could not determine physical iPhone OS version');
  return { device, osVersion };
}

function validateOptions(options) {
  const keys = ['platform', 'device', 'fixture', 'role', 'pair-id', 'commit', 'package-sha256', 'core-bundle', 'optional-bundle', 'output'];
  for (const key of keys) if (!options[key]) fail(`missing --${key}`);
  if (!isDeepStrictEqual(Object.keys(options).sort(), keys.sort())) fail('unknown capture argument');
  if (!['android', 'ios'].includes(options.platform) || !FIXTURES[options.fixture] || !['baseline', 'candidate'].includes(options.role)) fail('invalid platform, fixture, or role');
  if (!SAFE_ID.test(options.device) || !SAFE_ID.test(options['pair-id'])) fail('device and pair IDs must use safe characters');
  if (!HEX40.test(options.commit) || !HEX64.test(options['package-sha256'])) fail('commit or package SHA-256 has invalid shape');
  assertRegularFile(options['core-bundle'], 'core bundle'); assertRegularFile(options['optional-bundle'], 'optional bundle');
}

export async function captureHermes(options, executor = new Executor(), traceExtractor = extractHermesTrace) {
  validateOptions(options);
  const output = safeOutput(options.output);
  const runId = `${options['pair-id']}-${options.role}`;
  const suffix = options.platform === 'android' ? '.perfetto-trace' : '.trace';
  const rawTrace = path.join(output, `${runId}${suffix}`);
  const logFile = path.join(output, `${runId}.log`);
  const eventsFile = path.join(output, `${runId}.events.jsonl`);
  const exportFile = path.join(output, `${runId}.trace-export.json`);
  const coreBundle = path.join(output, `${runId}.core.bundle`);
  const optionalBundle = path.join(output, `${runId}.optional.bundle`);
  fs.copyFileSync(options['core-bundle'], coreBundle, fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(options['optional-bundle'], optionalBundle, fs.constants.COPYFILE_EXCL);
  const bundles = {
    core: { bytes: fs.statSync(coreBundle).size, sha256: sha256File(coreBundle), optionalMarkerCount: countOptionalMarkers(coreBundle) },
    optional: { bytes: fs.statSync(optionalBundle).size, sha256: sha256File(optionalBundle), optionalMarkerCount: countOptionalMarkers(optionalBundle) },
  };
  const source = { commit: options.commit, packageSha256: options['package-sha256'] };
  const corpus = { sha256: protocol.corpusSha256, bytes: protocol.expandedBytes, chunkSize: protocol.chunkSize };
  const identity = { runId, source, corpus };
  const configuration = { schemaVersion: 1, runId, source, corpus, bundles, warmups: protocol.warmups, samples: protocol.samples };
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-hermes-capture-'));
  const listOutput = path.join(temporary, 'devices.json');
  const plan = buildCapturePlan(options, configuration, rawTrace, listOutput);
  const processes = [];
  let hardware;
  try {
    hardware = inspectHardware(options, plan, executor, listOutput);
    for (const spec of plan.prepare) executor.run(spec);
    let rawLog;
    if (options.platform === 'android') {
      const capture = executor.start(plan.capture);
      const log = executor.start(plan.log);
      processes.push(capture, log);
      await delay(750);
      executor.run(plan.launch);
      await waitForCompletion(log);
      await delay(500);
      capture.stop(); log.stop();
      await capture.wait();
      rawLog = (await log.wait()).stdout;
      executor.run(plan.collect[0]);
    } else {
      const launch = executor.start(plan.launch);
      processes.push(launch);
      await delay(750);
      const capture = executor.start(plan.capture);
      processes.push(capture);
      await delay(1_500);
      executor.run(plan.trigger);
      await waitForCompletion(launch);
      await delay(500);
      capture.stop();
      await capture.wait();
      launch.stop();
      const launched = await launch.wait();
      rawLog = `${launched.stdout}\n${launched.stderr}`;
    }
    assertRegularFile(rawTrace, 'raw platform trace');
    const parsed = parseHarnessLog(rawLog, { identity, bundles });
    for (const scope of ['core', 'optional']) {
      const event = parsed.events.filter((entry) => entry.type === 'bundle' && entry.scope === scope);
      if (event.length !== 1 || event[0].bytes !== bundles[scope].bytes || event[0].optionalMarkerCount !== bundles[scope].optionalMarkerCount) fail(`${scope} bundle event does not match the retained bundle file`);
    }
    fs.writeFileSync(eventsFile, `${parsed.events.map((event) => JSON.stringify(event)).join('\n')}\n`, { flag: 'wx' });
    const traceExport = traceExtractor(rawTrace, options.platform);
    fs.writeFileSync(exportFile, `${JSON.stringify(traceExport, null, 2)}\n`, { flag: 'wx' });
    const metrics = deriveHermesMetricsFromFiles(eventsFile, exportFile, rawTrace, options.platform);
    const environment = { platform: options.platform, engine: 'Hermes', buildType: 'release', host: FIXTURES[options.fixture].host, osVersion: hardware.osVersion, device: hardware.device };
    const artifacts = [rawTrace, eventsFile, exportFile, coreBundle, optionalBundle];
    const artifactHashes = Object.fromEntries(artifacts.map((file) => [path.relative(root, file), sha256Evidence(file)]));
    const timestamp = new Date().toISOString();
    const receipt = { schemaVersion: 1, generator: 'streamdown-rn-hermes-harness/v1', runId, timestamp, source, environment, corpus, artifacts: artifactHashes, metrics };
    fs.writeFileSync(logFile, `${rawLog.trimEnd()}\nSTREAMDOWN_HERMES_MEASUREMENT_V1 ${JSON.stringify(receipt)}\n`, { flag: 'wx' });
    const evidence = [logFile, ...artifacts].map((file) => path.relative(root, file));
    const evidenceSha256 = Object.fromEntries(evidence.map((entry) => [entry, sha256Evidence(path.join(root, entry))]));
    const result = { schemaVersion: 1, timestamp, status: options.role === 'candidate' ? 'pass' : 'characterization', runId, source, environment, corpus, metrics, evidence, evidenceSha256 };
    validateProducedResult(result, eventsFile, exportFile, rawTrace, options.platform);
    const resultFile = path.join(output, `${runId}.json`);
    fs.writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    return { resultFile, result, plan };
  } finally {
    for (const process of processes) process.stop();
    await Promise.allSettled(processes.map((process) => process.wait()));
    for (const spec of plan.cleanup) { try { executor.run(spec); } catch {} }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export function validateProducedResult(result, eventsFile, exportFile, rawTrace, platform) {
  const derived = deriveHermesMetricsFromFiles(eventsFile, exportFile, rawTrace, platform);
  if (!isDeepStrictEqual(result.metrics, derived)) fail('produced result does not match primitive event and trace evidence');
  return true;
}

async function selfTest() {
  const options = { platform: 'android', device: 'pixel', fixture: 'current-rn', role: 'candidate', 'pair-id': 'android-test', commit: 'a'.repeat(40), 'package-sha256': 'b'.repeat(64), 'core-bundle': '/tmp/core', 'optional-bundle': '/tmp/optional', output: path.join(root, 'benchmarks/results/test') };
  const config = { runId: 'android-test-candidate' };
  const plan = buildCapturePlan(options, config, '/tmp/raw', '/tmp/devices');
  if (plan.capture.command !== 'adb' || !plan.capture.args.includes('perfetto') || !plan.capture.args.includes('--app')
    || !plan.launch.args.some((arg) => arg.includes('hermesEvidence='))) fail('Android command construction self-test failed');
  const ios = buildCapturePlan({ ...options, platform: 'ios', device: 'iphone' }, config, '/tmp/raw.trace', '/tmp/devices');
  if (ios.capture.command !== 'xcrun' || !ios.capture.args.includes('xctrace') || !ios.trigger.args.includes('--payload-url')) fail('iOS command construction self-test failed');
  let rejected = false;
  try { parseHarnessLog(`${PREFIXES.event}{"type":"cache","entries":1}`, { identity: {}, bundles: {} }); } catch { rejected = true; }
  if (!rejected) fail('missing completion marker self-test failed');

  const captureRoot = fs.mkdtempSync(path.join(root, 'benchmarks/results/.capture-fake-'));
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-hermes-source-'));
  try {
    const core = path.join(sourceRoot, 'core.bundle');
    const optional = path.join(sourceRoot, 'optional.bundle');
    fs.writeFileSync(core, 'core bundle'); fs.writeFileSync(optional, 'optional bundle');
    let configuration;
    const fixtureLog = () => {
      if (!configuration) return '';
      const events = [
        { type: 'parser', durationNs: 1_000_000 },
        { type: 'append', appendId: '1', startNs: 0, commitNs: 1_000_000, stableRerenders: 0 },
        { type: 'commit', scope: 'core', durationNs: 1_000_000 }, { type: 'commit', scope: 'optional', durationNs: 2_000_000 },
        { type: 'heap', scope: 'core', phase: 'start', bytes: 1_000_000 }, { type: 'heap', scope: 'core', phase: 'end', bytes: 2_000_000 },
        { type: 'heap', scope: 'optional', phase: 'start', bytes: 1_000_000 }, { type: 'heap', scope: 'optional', phase: 'end', bytes: 2_000_000 },
        { type: 'cache', entries: 1 }, { type: 'first-render', startNs: 0, endNs: 1_000_000 },
        { type: 'bundle', scope: 'core', bytes: configuration.bundles.core.bytes, optionalMarkerCount: configuration.bundles.core.optionalMarkerCount },
        { type: 'bundle', scope: 'optional', bytes: configuration.bundles.optional.bytes, optionalMarkerCount: configuration.bundles.optional.optionalMarkerCount },
        { type: 'startup', scope: 'core', startNs: 0, endNs: 1_000_000 }, { type: 'startup', scope: 'optional', startNs: 0, endNs: 2_000_000 },
      ];
      return `${events.map((event) => PREFIXES.event + JSON.stringify(event)).join('\n')}\n${PREFIXES.bundle}${JSON.stringify(configuration.bundles)}\n${PREFIXES.complete}${JSON.stringify({ runId: configuration.runId, source: configuration.source, corpus: configuration.corpus })}\n`;
    };
    const fake = {
      run(spec) {
        const joined = spec.args.join(' ');
        if (joined.includes('ro.product.model')) return 'Pixel 8\n';
        if (joined.includes('ro.build.version.release')) return '14\n';
        if (joined.includes('ro.kernel.qemu')) return '0\n';
        if (joined.includes('am start')) {
          const url = spec.args.find((arg) => arg.includes('hermesEvidence='));
          const value = new URL(url).searchParams.get('hermesEvidence');
          configuration = JSON.parse(Buffer.from(value, 'base64url').toString());
          return 'Status: ok\n';
        }
        if (joined.includes(' pull ')) { fs.writeFileSync(spec.args.at(-1), 'physical perfetto trace'); return 'pulled\n'; }
        return '';
      },
      start(spec) {
        const log = spec.args.includes('logcat');
        return { wait: async () => ({ stdout: log ? fixtureLog() : '', stderr: '' }), snapshot: () => log ? fixtureLog() : '', stop() {} };
      },
    };
    const captured = await captureHermes({ ...options, device: 'pixel8', 'core-bundle': core, 'optional-bundle': optional, output: captureRoot }, fake, (raw) => ({
      schemaVersion: 1, generator: 'streamdown-rn-trace-export/v1', sourceTraceSha256: sha256Evidence(raw), platform: 'android',
      appends: [{ appendId: '1', startNs: 0, commitNs: 1_000_000 }],
      frames: { js: [{ durationNs: 16_000_000, budgetNs: 16_666_667 }], ui: [{ durationNs: 16_000_000, budgetNs: 16_666_667 }] },
    }));
    const eventFile = path.join(captureRoot, `${captured.result.runId}.events.jsonl`);
    const trace = path.join(captureRoot, `${captured.result.runId}.perfetto-trace`);
    const traceExport = path.join(captureRoot, `${captured.result.runId}.trace-export.json`);
    const forged = { ...captured.result, metrics: { ...captured.result.metrics, parserMs: captured.result.metrics.parserMs + 1 } };
    rejected = false; try { validateProducedResult(forged, eventFile, traceExport, trace, 'android'); } catch { rejected = true; }
    if (!rejected) fail('result tamper self-test failed');
  } finally {
    fs.rmSync(captureRoot, { recursive: true, force: true });
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }

  const directory = fs.mkdtempSync(path.join(root, 'benchmarks/results/.capture-self-test-'));
  try {
    const raw = path.join(directory, 'raw.trace');
    const events = path.join(directory, 'events.jsonl');
    const exported = path.join(directory, 'export.json');
    fs.writeFileSync(raw, 'physical trace bytes');
    fs.writeFileSync(events, '{"type":"cache","entries":1}\n');
    fs.writeFileSync(exported, JSON.stringify({ schemaVersion: 1, generator: 'streamdown-rn-trace-export/v1', sourceTraceSha256: sha256Evidence(raw), platform: 'ios', appends: [{ appendId: '1', startNs: 0, commitNs: 1 }], frames: { js: [{ durationNs: 1, budgetNs: 2 }], ui: [{ durationNs: 1, budgetNs: 2 }] } }));
    loadHarnessEvents(events); loadTraceExport(exported, raw, 'ios');
    fs.appendFileSync(events, '{}\n');
    rejected = false; try { loadHarnessEvents(events); } catch { rejected = true; }
    if (!rejected) fail('event tamper self-test failed');
    fs.writeFileSync(events, '{"type":"cache","entries":1}\n');
    fs.appendFileSync(raw, 'tamper');
    rejected = false; try { loadTraceExport(exported, raw, 'ios'); } catch { rejected = true; }
    if (!rejected) fail('trace tamper self-test failed');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  console.log('Hermes physical capture producer self-test passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const operation = process.argv.includes('--self-test') ? selfTest() : captureHermes(parseArgs(process.argv.slice(2)));
  operation.then((result) => { if (result?.resultFile) console.log(`Hermes evidence captured: ${result.resultFile}`); }).catch((error) => {
    console.error(`Hermes evidence capture blocked: ${error.message}`); process.exitCode = 1;
  });
}
