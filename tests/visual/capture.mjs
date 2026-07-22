import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { comparePng } from './compare.mjs';
import { assertCompleteBaselineManifest, matrixSha256ForCases, requiredVisualSemantics } from './verify-integrity.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '../..');
function assertSemantics(output, entry) {
  const missing = requiredVisualSemantics(entry).filter((value) => !output.includes(value));
  if (missing.length) throw new Error(`Semantic readiness missing ${missing.join(', ')} for ${entry.id}`);
}

if (process.argv.includes('--self-test')) {
  assert.deepEqual(requiredVisualSemantics({ scenario: 'harness' }), ['Streamdown Feature Showcase', 'Open harness controls']);
  assert.throws(
    () => assertSemantics('Fixture: controls Fixture state: controls one', { id: 'controls-test', scenario: 'controls' }),
    /Semantic readiness missing two, Copy table for controls-test/,
  );
  const matrixBytes = Buffer.from('{\n  "cases": [\n    { "id": "one" },\n    { "id": "two" }\n  ]\n}\n');
  const hash = createHash('sha256').update(matrixBytes).digest('hex');
  const complete = {
    matrixSha256: hash,
    artifacts: { 'ios-one.png': hash, 'ios-two.png': hash },
    receipts: { 'ios-one.png': {}, 'ios-two.png': {} },
  };
  const incomplete = { matrixSha256: hash, artifacts: { 'ios-one.png': hash } };
  let wrote = false;
  assert.throws(() => {
    assertCompleteBaselineManifest(incomplete, 'ios', matrixBytes, ['one', 'two']);
    wrote = true;
  }, /complete current visual matrix/);
  assert.equal(wrote, false);
  assertCompleteBaselineManifest(complete, 'ios', matrixBytes, ['one', 'two']);
  wrote = true;
  assert.equal(wrote, true);
  const missingPlatform = spawnSync(process.execPath, [scriptPath], { env: process.env, encoding: 'utf8' });
  assert.notEqual(missingPlatform.status, 0);
  assert.match(missingPlatform.stderr, /VISUAL_PLATFORM must be ios or android/);
  const unboundUpdate = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      VISUAL_PLATFORM: 'ios',
      VISUAL_DEVICE_ID: 'fixture-device',
      VISUAL_APP_SCHEME: 'fixture',
      VISUAL_RUNTIME: 'fixture-runtime',
      REVIEWED_VISUAL_BASELINE_UPDATE: '1',
      STREAMDOWN_RELEASE_COMMIT: '',
      STREAMDOWN_RELEASE_PACKAGE_SHA256: '',
    },
    encoding: 'utf8',
  });
  assert.notEqual(unboundUpdate.status, 0);
  assert.match(unboundUpdate.stderr, /STREAMDOWN_RELEASE_COMMIT is required for baseline updates/);
  process.stdout.write('semantic readiness self-test passed\n');
  process.exit(0);
}

const matrixPath = path.join(root, 'tests/visual/matrix.json');
const matrixBytes = fs.readFileSync(matrixPath);
const config = JSON.parse(matrixBytes.toString('utf8'));
const matrixSha256 = createHash('sha256').update(matrixBytes).digest('hex');
const platform = process.env.VISUAL_PLATFORM;
assert(platform === 'ios' || platform === 'android', 'VISUAL_PLATFORM must be ios or android');
const device = process.env.VISUAL_DEVICE_ID;
assert(device, 'VISUAL_DEVICE_ID is required');
const scheme = process.env.VISUAL_APP_SCHEME;
assert(scheme, 'VISUAL_APP_SCHEME is required');
const appId = process.env.VISUAL_APP_ID;
const update = process.env.REVIEWED_VISUAL_BASELINE_UPDATE === '1';
const requestedCaseId = process.env.VISUAL_CASE_ID;
const runtime = process.env.VISUAL_RUNTIME;
if (update) {
  assert(runtime, 'VISUAL_RUNTIME is required for baseline updates');
  assert(/^[a-f0-9]{40}$/.test(process.env.STREAMDOWN_RELEASE_COMMIT ?? ''), 'STREAMDOWN_RELEASE_COMMIT is required for baseline updates');
  assert(/^[a-f0-9]{64}$/.test(process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256 ?? ''), 'STREAMDOWN_RELEASE_PACKAGE_SHA256 is required for baseline updates');
}
const baselineManifestPath = path.join(root, 'tests/visual/baselines', `${platform}.manifest.json`);
const baselineManifest = fs.existsSync(baselineManifestPath)
  ? JSON.parse(fs.readFileSync(baselineManifestPath, 'utf8'))
  : undefined;
const reviewedCaseIds = Object.keys(baselineManifest?.artifacts ?? {}).map((name) => name.slice(`${platform}-`.length, -'.png'.length));
const reviewedMatrixSha256 = matrixSha256ForCases(matrixBytes, reviewedCaseIds);
if (!update) {
  assert(baselineManifest, `Missing reviewed baseline manifest ${baselineManifestPath}`);
}
if (requestedCaseId) {
  assert(config.cases.some(({ id }) => id === requestedCaseId), `Unknown VISUAL_CASE_ID ${requestedCaseId}`);
  if (update) {
    assert(baselineManifest, 'A reviewed manifest is required for a partial baseline update');
    assertCompleteBaselineManifest(baselineManifest, platform, matrixBytes, config.cases.map(({ id }) => id));
  }
}
const selectedCases = requestedCaseId ? config.cases.filter(({ id }) => id === requestedCaseId) : config.cases;
const artifactHashes = update && requestedCaseId ? { ...baselineManifest.artifacts } : {};
const artifactReceipts = update && requestedCaseId ? { ...baselineManifest.receipts } : {};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function wait(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function androidHierarchy(device, entry) {
  const hierarchyPath = '/sdcard/streamdown-rn-visual.xml';
  let xml = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    run('adb', ['-s', device, 'shell', 'uiautomator', 'dump', hierarchyPath]);
    xml = run('adb', ['-s', device, 'exec-out', 'cat', hierarchyPath]);
    try {
      assertSemantics(xml, entry);
      return xml;
    } catch (error) {
      if (attempt === 19) throw error;
    }
    wait(500);
  }
  throw new Error(`Accessibility hierarchy unavailable for ${entry.id}`);
}

function maestroSemantics(device, appId, entry) {
  for (const expected of requiredVisualSemantics(entry)) {
    try {
      run('maestro', ['test', '--platform', 'ios', '--udid', device, '--no-reinstall-driver', '-e', `APP_ID=${appId}`, '-e', `EXPECTED=${expected}`, path.join(root, 'tests/device/maestro/semantic.yaml')]);
    } catch (error) {
      throw new Error(`Semantic readiness missing ${expected} for ${entry.id}: ${error.message}`);
    }
  }
}

for (const entry of selectedCases) {
  const query = new URLSearchParams({ scenario: entry.scenario, theme: entry.theme, direction: entry.direction, layout: entry.layout, ...(entry.checkpoint ? { checkpoint: entry.checkpoint } : {}) }).toString();
  const url = `${scheme}://fixture?${query}`;
  if (platform === 'android') {
    run('adb', ['-s', device, 'shell', 'settings', 'put', 'system', 'font_scale', String(entry.fontScale)]);
    wait(500);
    assert(appId, 'VISUAL_APP_ID is required for deterministic Android restarts');
    run('adb', ['-s', device, 'shell', 'am', 'force-stop', appId]);
    // adb reconstructs a remote shell command, so quote query separators for that shell.
    run('adb', ['-s', device, 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`, `${appId}/.MainActivity`]);
  } else {
    const size = entry.fontScale >= 2 ? 'accessibility-medium' : entry.fontScale > 1 ? 'extra-large' : 'medium';
    run('xcrun', ['simctl', 'ui', device, 'content_size', size]);
    run('xcrun', ['simctl', 'ui', device, 'appearance', entry.theme]);
    run('xcrun', ['simctl', 'openurl', device, url]);
  }
  const actual = path.join(root, 'tests/visual/actual', `${platform}-${entry.id}.png`);
  fs.mkdirSync(path.dirname(actual), { recursive: true });
  if (entry.scenario === 'harness') {
    assert(spawnSync('maestro', ['--version']).status === 0, 'maestro is required for harness interaction assertions');
    assert(appId, 'VISUAL_APP_ID is required for harness interaction assertions');
    run('maestro', ['test', '--platform', platform, '--udid', device, '--no-reinstall-driver', '-e', `APP_ID=${appId}`, path.join(root, 'tests/device/maestro/harness.yaml')]);
  }
  if (platform === 'android') {
    androidHierarchy(device, entry);
    wait(250);
    fs.writeFileSync(actual, run('adb', ['-s', device, 'exec-out', 'screencap', '-p'], { encoding: null }));
  } else {
    assert(spawnSync('maestro', ['--version']).status === 0, 'maestro is required for iOS semantic assertions');
    assert(appId, 'VISUAL_APP_ID is required for iOS semantic assertions');
    maestroSemantics(device, appId, entry);
    wait(250);
    run('xcrun', ['simctl', 'io', device, 'screenshot', actual]);
  }
  const baseline = path.join(root, 'tests/visual/baselines', `${platform}-${entry.id}.png`);
  if (!update) assert.equal(baselineManifest.matrixSha256, reviewedMatrixSha256, 'Visual matrix changed without a reviewed baseline update');
  if (update) {
    fs.copyFileSync(actual, baseline);
    const name = path.basename(baseline);
    const bytes = fs.readFileSync(baseline);
    const artifactSha256 = createHash('sha256').update(bytes).digest('hex');
    artifactHashes[name] = artifactSha256;
    artifactReceipts[name] = {
      schemaVersion: 1,
      producer: 'tests/visual/capture.mjs',
      scenario: entry.id,
      platform,
      matrixSha256,
      source: {
        commit: process.env.STREAMDOWN_RELEASE_COMMIT,
        packageSha256: process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256,
      },
      artifact: { sha256: artifactSha256, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
      capture: { tool: platform === 'ios' ? 'simctl-screenshot' : 'adb-screencap', exitCode: 0 },
      semanticAssertions: requiredVisualSemantics(entry).map((expected, index) => ({
        id: `semantic-${index + 1}`,
        expected,
        probe: platform === 'ios' ? 'maestro' : 'uiautomator',
        exitCode: 0,
      })),
    };
    continue;
  }
  assert(fs.existsSync(baseline), `Missing reviewed baseline ${baseline}`);
  assert.equal(createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'), baselineManifest.artifacts[path.basename(baseline)], `Baseline hash mismatch for ${baseline}`);
  const ratio = comparePng(actual, baseline, path.join(root, 'tests/visual/artifacts', `${platform}-${entry.id}.png`), config);
  process.stdout.write(`${platform}-${entry.id}: ${(ratio * 100).toFixed(3)}%\n`);
}
if (update) {
  assert.equal(Object.keys(artifactHashes).length, config.cases.length, 'Reviewed manifest must cover every visual case');
  fs.writeFileSync(baselineManifestPath, `${JSON.stringify({
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    platform,
    device,
    runtime,
    source: {
      commit: process.env.STREAMDOWN_RELEASE_COMMIT,
      packageSha256: process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256,
    },
    matrixSha256,
    artifacts: artifactHashes,
    receipts: artifactReceipts,
  }, null, 2)}\n`);
  fs.rmSync(path.join(root, 'tests/visual/baselines/release-review-attestation.json'), { force: true });
}
