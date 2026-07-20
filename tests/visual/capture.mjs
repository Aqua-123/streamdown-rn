import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { comparePng } from './compare.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
const runtime = process.env.VISUAL_RUNTIME;
if (update) {
  assert(process.env.BASELINE_REVIEW_ID, 'BASELINE_REVIEW_ID is required for baseline updates');
  assert(runtime, 'VISUAL_RUNTIME is required for baseline updates');
}
const baselineManifestPath = path.join(root, 'tests/visual/baselines', `${platform}.manifest.json`);
const baselineManifest = !update && fs.existsSync(baselineManifestPath)
  ? JSON.parse(fs.readFileSync(baselineManifestPath, 'utf8'))
  : undefined;
if (!update) {
  assert(baselineManifest, `Missing reviewed baseline manifest ${baselineManifestPath}`);
  assert.equal(baselineManifest.matrixSha256, matrixSha256, 'Visual matrix changed without a reviewed baseline update');
}
const artifactHashes = {};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function wait(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function androidHierarchy(device, entry) {
  const hierarchyPath = '/sdcard/streamdown-rn-visual.xml';
  const expected = entry.scenario === 'fullscreen'
    ? ['Fullscreen fixture', 'Exit fullscreen']
    : [`Fixture: ${entry.scenario}`];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    run('adb', ['-s', device, 'shell', 'uiautomator', 'dump', hierarchyPath]);
    const xml = run('adb', ['-s', device, 'exec-out', 'cat', hierarchyPath]);
    if (expected.every((value) => xml.includes(value))) return xml;
    wait(500);
  }
  throw new Error(`Accessibility hierarchy missing ${expected.join(' and ')} for ${entry.id}`);
}

for (const entry of config.cases) {
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
  wait(500);
  const actual = path.join(root, 'tests/visual/actual', `${platform}-${entry.id}.png`);
  fs.mkdirSync(path.dirname(actual), { recursive: true });
  if (platform === 'android') {
    androidHierarchy(device, entry);
    fs.writeFileSync(actual, run('adb', ['-s', device, 'exec-out', 'screencap', '-p'], { encoding: null }));
  } else {
    assert(spawnSync('maestro', ['--version']).status === 0, 'maestro is required for iOS semantic assertions');
    assert(appId, 'VISUAL_APP_ID is required for iOS semantic assertions');
    run('maestro', ['test', '-e', `APP_ID=${appId}`, '-e', `EXPECTED_SCENARIO=${entry.scenario}`, path.join(root, 'tests/device/maestro/semantic.yaml')]);
    run('xcrun', ['simctl', 'io', device, 'screenshot', actual]);
  }
  const baseline = path.join(root, 'tests/visual/baselines', `${platform}-${entry.id}.png`);
  if (update) {
    fs.copyFileSync(actual, baseline);
    artifactHashes[path.basename(baseline)] = createHash('sha256').update(fs.readFileSync(baseline)).digest('hex');
    continue;
  }
  assert(fs.existsSync(baseline), `Missing reviewed baseline ${baseline}`);
  assert.equal(createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'), baselineManifest.artifacts[path.basename(baseline)], `Baseline hash mismatch for ${baseline}`);
  const ratio = comparePng(actual, baseline, path.join(root, 'tests/visual/artifacts', `${platform}-${entry.id}.png`), config);
  process.stdout.write(`${platform}-${entry.id}: ${(ratio * 100).toFixed(3)}%\n`);
}
if (update) {
  fs.writeFileSync(baselineManifestPath, `${JSON.stringify({
    schemaVersion: 1,
    reviewId: process.env.BASELINE_REVIEW_ID,
    capturedAt: new Date().toISOString(),
    platform,
    device,
    runtime,
    matrixSha256,
    artifacts: artifactHashes,
  }, null, 2)}\n`);
}
