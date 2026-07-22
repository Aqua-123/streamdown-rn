import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2];
assert(['android', 'ios'].includes(platform), 'Usage: node scripts/sample.mjs <android|ios> [--prepare-only]');

const sampleRoot = path.join(root, '.sample');
const app = path.join(sampleRoot, 'expo56');
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const output = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout;
};

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(sampleRoot, { recursive: true });
fs.cpSync(path.join(root, 'fixtures/current-rn'), app, { recursive: true });
const manifestPath = path.join(app, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete manifest.dependencies['@streamdown-rn/hermes-evidence'];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const appPath = path.join(app, 'App.js');
const source = fs.readFileSync(appPath, 'utf8')
  .replace("import { HermesEvidenceFixture } from './hermes-evidence-app';\n", '')
  .replace("  if (config.evidenceUrl?.includes('hermesEvidence=')) return <HermesEvidenceFixture evidenceUrl={config.evidenceUrl} metrics={metrics} plugins={PLUGINS} />;\n", '');
fs.writeFileSync(appPath, source);

run('npm', ['install', '--ignore-scripts'], app);
run('npm', ['run', 'build']);
const packed = JSON.parse(output('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', sampleRoot]))[0];
const installed = path.join(app, 'node_modules/streamdown-rn');
fs.rmSync(installed, { recursive: true, force: true });
fs.mkdirSync(installed, { recursive: true });
run('tar', ['-xzf', path.join(sampleRoot, packed.filename), '-C', installed, '--strip-components=1']);
fs.rmSync(path.join(sampleRoot, packed.filename));

console.log(`Prepared the packed streamdown-rn sample at ${app}`);
if (!process.argv.includes('--prepare-only')) {
  const release = platform === 'ios' ? ['--configuration', 'Release'] : ['--variant', 'release'];
  run('npx', ['expo', `run:${platform}`, ...release, '--no-bundler'], app);
  const appId = 'ai.darkresearch.streamdownrn.expo56';
  if (platform === 'ios') {
    // A fresh simulator install has no running process to terminate. simctl
    // reports that harmless state as exit code 3, so launch must not be skipped.
    spawnSync('xcrun', ['simctl', 'terminate', 'booted', appId], {
      cwd: app,
      stdio: 'ignore',
      env: process.env,
    });
    run('xcrun', ['simctl', 'launch', 'booted', appId], app);
  } else {
    run('adb', ['shell', 'am', 'force-stop', appId], app);
    run('adb', ['shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1'], app);
  }
}
