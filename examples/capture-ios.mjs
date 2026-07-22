import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'examples/ios');
const scheme = 'streamdown-rn-expo56';
const appId = 'ai.aqua.streamdownrn.expo56';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: options.stdio ?? 'pipe' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result.stdout;
};
const cases = [
  ['01-core-markdown-light', { scenario: 'static', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['02-code-highlighting', { scenario: 'code', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['03-native-math', { scenario: 'math', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['04-mermaid-flowchart', { scenario: 'mermaid', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['05-mermaid-sequence', { scenario: 'mermaid-sequence', theme: 'dark', direction: 'ltr', layout: 'narrow' }],
  ['06-vega-lite-chart', { scenario: 'vega', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['07-streaming-checkpoint', { scenario: 'streaming', theme: 'light', direction: 'ltr', layout: 'narrow', checkpoint: '64' }],
  ['08-native-fallbacks', { scenario: 'fallbacks', theme: 'light', direction: 'ltr', layout: 'narrow' }],
  ['09-harness', { scenario: 'harness', theme: 'light', direction: 'ltr', layout: 'narrow' }],
];
const urlFor = (config) => `${scheme}://fixture?${new URLSearchParams(config)}`;

if (process.argv.includes('--self-test')) {
  assert.equal(new Set(cases.map(([name]) => name)).size, cases.length);
  assert.match(urlFor(cases[0][1]), /^streamdown-rn-expo56:\/\/fixture\?/);
  process.stdout.write('examples iOS capture self-test passed\n');
  process.exit(0);
}

if (!process.argv.includes('--skip-build')) run('bun', ['run', 'sample:ios'], { stdio: 'inherit' });
const devices = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']));
const device = Object.entries(devices.devices)
  .flatMap(([runtime, entries]) => entries.map((entry) => ({ ...entry, runtime })))
  .find(({ state }) => state === 'Booted');
assert(device, 'A booted iOS Simulator is required');
fs.mkdirSync(output, { recursive: true });
run('xcrun', ['simctl', 'launch', device.udid, appId]);

for (const [name, config] of cases) {
  run('xcrun', ['simctl', 'openurl', device.udid, urlFor(config)]);
  await wait(config.scenario.startsWith('mermaid') ? 2500 : 1400);
  run('xcrun', ['simctl', 'io', device.udid, 'screenshot', '--type=png', path.join(output, `${name}.png`)]);
}

fs.writeFileSync(path.join(output, 'capture.json'), `${JSON.stringify({
  capturedAt: new Date().toISOString(),
  command: process.argv.includes('--skip-build') ? 'node examples/capture-ios.mjs --skip-build' : 'bun run examples:ios',
  device: { name: device.name, udid: device.udid, runtime: device.runtime },
  app: { id: appId, scheme, build: 'Expo 56 Release, packed local package' },
  screenshots: cases.map(([name, config]) => ({ file: `${name}.png`, config })),
  video: { file: 'streamdown-feature-tour.mov', source: 'user-supplied manual iOS screen recording' },
}, null, 2)}\n`);
process.stdout.write(`Wrote iOS screenshots to ${output}\n`);
