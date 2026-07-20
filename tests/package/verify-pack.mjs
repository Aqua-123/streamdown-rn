import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-rn-pack-'));

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} exited with ${result.status ?? 1}`);
  }
  return result.stdout.trim();
};

const bundleText = (directory) => {
  const chunks = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else chunks.push(fs.readFileSync(target).toString('utf8'));
    }
  };
  visit(directory);
  return chunks.join('\n');
};

try {
  run('npm', ['run', 'build']);
  const pack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp]))[0];
  assert(!pack.files.some(({ path: file }) => file.startsWith('src/') || file.includes('__tests__')));

  const tarball = path.join(temp, pack.filename);
  const consumer = path.join(temp, 'consumer');
  fs.cpSync(path.join(root, 'fixtures/expo54'), consumer, { recursive: true });
  const consumerManifestPath = path.join(consumer, 'package.json');
  const consumerManifest = JSON.parse(fs.readFileSync(consumerManifestPath, 'utf8'));
  consumerManifest.dependencies['streamdown-rn'] = `file:${tarball}`;
  fs.writeFileSync(consumerManifestPath, `${JSON.stringify(consumerManifest, null, 2)}\n`);
  run('npm', ['install', '--ignore-scripts', '--no-package-lock', '--omit=peer'], { cwd: consumer });

  const resolve = "console.log(import.meta.resolve('streamdown-rn'))";
  const defaultEntry = run('node', ['--input-type=module', '--eval', resolve], { cwd: consumer });
  const nativeEntry = run('node', ['--conditions=react-native', '--input-type=module', '--eval', resolve], { cwd: consumer });
  assert.match(defaultEntry, /streamdown-rn\/dist\/index\.js$/);
  assert.match(nativeEntry, /streamdown-rn\/dist\/index\.js$/);

  const installedPackage = path.join(consumer, 'node_modules/streamdown-rn');
  run(
    path.join(root, 'node_modules/.bin/jest'),
    [
      '--config',
      path.join(root, 'jest.config.cjs'),
      '--runInBand',
      '--runTestsByPath',
      path.join(root, 'tests/package/exports.test.ts'),
      '--testMatch',
      '**/tests/package/exports.test.ts',
    ],
    { env: { ...process.env, PACKED_PACKAGE_PATH: installedPackage } }
  );
  const coreBundle = path.join(consumer, 'dist-core');
  run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', coreBundle], { cwd: consumer });
  const coreText = bundleText(coreBundle);
  assert(!coreText.includes('maxCacheUnits'));
  assert(!coreText.includes('custom-renderers'));
  assert(!coreText.includes('remark-math'));
  assert(!coreText.includes('Offline WebView adapter'));

  fs.writeFileSync(path.join(consumer, 'App.js'), `import React from 'react';
import { Text } from 'react-native';
import { Streamdown } from 'streamdown-rn';
import { createCodePlugin } from 'streamdown-rn/code';
import { cjk } from 'streamdown-rn/cjk';
import { createRendererPlugin } from 'streamdown-rn/renderers';
import { createMathPlugin } from 'streamdown-rn/math';
import { createMermaidPlugin } from 'streamdown-rn/mermaid';
import { createOfflineWebViewAdapter } from 'streamdown-rn/mermaid/webview';
const webview = createOfflineWebViewAdapter({
  assets: { mermaidJs: 'bundled' },
  transport: { render: async ({ id }) => JSON.stringify({ id, type: 'rendered', surfaceId: id }), release() {}, dispose() {} },
  renderSurface: () => null,
});
const plugins = { code: createCodePlugin(), cjk, renderers: createRendererPlugin([]), math: createMathPlugin(), mermaid: createMermaidPlugin() };
export default function App() { return <><Streamdown mode="static" plugins={plugins}>{'# packed plugin fixture'}</Streamdown><Text>{String(Boolean(webview.mathController))}</Text></>; }
`);
  const pluginBundle = path.join(consumer, 'dist-plugins');
  run('npx', ['expo', 'export', '--platform', 'ios', '--clear', '--output-dir', pluginBundle], { cwd: consumer });
  const pluginText = bundleText(pluginBundle);
  assert(pluginText.includes('maxCacheUnits'));
  assert(pluginText.includes('custom-renderers'));
  assert(pluginText.includes('singleDollarTextMath'));
  assert(pluginText.includes("default-src 'none'"));
  process.stdout.write(`Verified ${pack.filename} (${pack.files.length} files) in Expo 54 fixture.\n`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
