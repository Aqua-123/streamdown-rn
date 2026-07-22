import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSingleHostSvg, assertSvgPeerManifest } from './svg-peer-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-rn-pack-'));
const keepTemp = process.env.STREAMDOWN_KEEP_PACK_FIXTURE === '1';
const fixtures = [
  { id: 'expo54', name: 'Expo 54 / RN 0.81', directory: 'fixtures/expo54' },
  { id: 'expo56', name: 'Expo 56 / RN 0.85', directory: 'fixtures/current-rn' },
].filter(({ id }) => !process.env.PACK_FIXTURE || process.env.PACK_FIXTURE === id);
assert(fixtures.length, `Unknown PACK_FIXTURE ${process.env.PACK_FIXTURE}`);

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
  const packedManifest = JSON.parse(run('tar', ['-xOf', tarball, 'package/package.json']));
  assertSvgPeerManifest(packedManifest);
  const incompatibleSvg = path.join(temp, 'react-native-svg-incompatible');
  fs.mkdirSync(incompatibleSvg);
  fs.writeFileSync(path.join(incompatibleSvg, 'package.json'), `${JSON.stringify({ name: 'react-native-svg', version: '15.12.0' })}\n`);
  const conflictConsumer = path.join(temp, 'peer-conflict');
  fs.cpSync(path.join(root, 'fixtures/expo54'), conflictConsumer, { recursive: true });
  const conflictManifestPath = path.join(conflictConsumer, 'package.json');
  const conflictManifest = JSON.parse(fs.readFileSync(conflictManifestPath, 'utf8'));
  conflictManifest.dependencies['streamdown-rn'] = `file:${tarball}`;
  conflictManifest.dependencies['react-native-svg'] = `file:${incompatibleSvg}`;
  fs.writeFileSync(conflictManifestPath, `${JSON.stringify(conflictManifest, null, 2)}\n`);
  const conflict = spawnSync('npm', ['install', '--ignore-scripts', '--no-package-lock', '--strict-peer-deps'], {
    cwd: conflictConsumer,
    encoding: 'utf8',
  });
  assert.notEqual(conflict.status, 0);
  assert.match(`${conflict.stdout}\n${conflict.stderr}`, /ERESOLVE[\s\S]*react-native-svg/);
  for (const [fixtureIndex, fixture] of fixtures.entries()) {
    const consumer = path.join(temp, `consumer-${fixtureIndex}`);
    fs.cpSync(path.join(root, fixture.directory), consumer, { recursive: true });
    const matrixEntry = fs.readFileSync(path.join(consumer, 'App.js'));
    const consumerManifestPath = path.join(consumer, 'package.json');
    const consumerManifest = JSON.parse(fs.readFileSync(consumerManifestPath, 'utf8'));
    consumerManifest.dependencies['streamdown-rn'] = `file:${tarball}`;
    fs.writeFileSync(consumerManifestPath, `${JSON.stringify(consumerManifest, null, 2)}\n`);
    run('npm', ['install', '--ignore-scripts', '--no-package-lock', '--omit=peer'], { cwd: consumer });
    assertSingleHostSvg(consumer, run);

    const resolve = "console.log(import.meta.resolve('streamdown-rn'))";
    const defaultEntry = run('node', ['--input-type=module', '--eval', resolve], { cwd: consumer });
    const nativeEntry = run('node', ['--conditions=react-native', '--input-type=module', '--eval', resolve], { cwd: consumer });
    assert.match(defaultEntry, /streamdown-rn\/dist\/index\.js$/);
    assert.match(nativeEntry, /streamdown-rn\/dist\/index\.js$/);
    const resolveUi = "console.log(import.meta.resolve('streamdown-rn/ui'))";
    const defaultUiEntry = run('node', ['--input-type=module', '--eval', resolveUi], { cwd: consumer });
    const nativeUiEntry = run('node', ['--conditions=react-native', '--input-type=module', '--eval', resolveUi], { cwd: consumer });
    assert.match(defaultUiEntry, /streamdown-rn\/dist\/components\/ui\/index\.js$/);
    assert.match(nativeUiEntry, /streamdown-rn\/dist\/components\/ui\/index\.js$/);

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
    const uiConsumer = path.join(consumer, 'ui-consumer.ts');
    fs.writeFileSync(uiConsumer, `import {
  ActionButton, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger,
  FullscreenModal, NativeLink, PanZoomSurface,
  type ActionButtonProps, type ButtonProps, type ButtonState, type ButtonVariant,
  type DropdownItemProps, type DropdownOpenReason, type DropdownPopupProps,
  type DropdownRootProps, type DropdownTriggerProps, type FullscreenModalProps,
  type NativeLinkProps, type PanZoomSurfaceProps,
} from 'streamdown-rn/ui';
import {
  NATIVE_ELEMENT_NAMES,
  type NativeElementName,
  type NativeSlotProps,
  type NativeSlots,
  type StreamdownProps,
} from 'streamdown-rn';
const components = [ActionButton, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface];
type Contracts = ActionButtonProps | ButtonProps | DropdownItemProps | DropdownPopupProps | DropdownRootProps | DropdownTriggerProps | FullscreenModalProps | NativeLinkProps | PanZoomSurfaceProps;
const variant: ButtonVariant = 'ghost';
const state: ButtonState = { pressed: false, focused: false, hovered: false, disabled: false };
const callbackButton: ButtonProps = { children: (value: ButtonState) => value.pressed ? 'Pressed' : 'Idle', style: (value: ButtonState) => ({ opacity: value.disabled ? 0.5 : 1 }) };
const reason: DropdownOpenReason = 'trigger';
const slots: NativeSlots = {
  p: ({ renderDefault }: NativeSlotProps<'p'>) => renderDefault({ style: { opacity: 0.8 }, children: 'packed' }),
  img: ({ renderDefault }: NativeSlotProps<'img'>) => renderDefault({ style: { padding: 2 } }),
};
const element: NativeElementName = NATIVE_ELEMENT_NAMES[0];
const streamdownProps: StreamdownProps = { slots };
// @ts-expect-error Standard slot names are exact.
const invalidSlots: NativeSlots = { paragraf: () => null };
void components; void (null as Contracts | null); void variant; void state; void callbackButton; void reason;
void element; void streamdownProps; void invalidSlots;
`);
    run(
      path.join(root, 'node_modules/.bin/tsc'),
      [uiConsumer, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', '--module', 'Node16', '--moduleResolution', 'Node16'],
      { cwd: consumer }
    );
    fs.writeFileSync(path.join(consumer, 'App.js'), `import React from 'react';
import { Streamdown } from 'streamdown-rn';
export default function App() { return <Streamdown mode="static">{'# packed core fixture'}</Streamdown>; }
`);
    let coreText = '';
    for (const platform of ['ios', 'android']) {
      const coreBundle = path.join(consumer, `dist-core-${platform}`);
      run('npx', ['expo', 'export', '--platform', platform, '--output-dir', coreBundle], { cwd: consumer });
      coreText += bundleText(coreBundle);
    }
    assert(!coreText.includes('maxCacheUnits'));
    assert(!coreText.includes('custom-renderers'));
    assert(!coreText.includes('remark-math'));
    assert(!coreText.includes('Offline WebView adapter'));

    fs.writeFileSync(path.join(consumer, 'App.js'), `import React from 'react';
import { View } from 'react-native';
import { ActionButton, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface } from 'streamdown-rn/ui';
const exports = [ActionButton, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface];
export default function App() { return <View accessibilityLabel={'ui-' + exports.length} />; }
`);
    let uiText = '';
    for (const platform of ['ios', 'android']) {
      const uiBundle = path.join(consumer, `dist-ui-${platform}`);
      run('npx', ['expo', 'export', '--platform', platform, '--clear', '--output-dir', uiBundle], { cwd: consumer });
      uiText += bundleText(uiBundle);
    }
    assert(!uiText.includes('maxCacheUnits'));
    assert(!uiText.includes('custom-renderers'));
    assert(!uiText.includes('singleDollarTextMath'));
    assert(!uiText.includes('remark-math'));
    assert(!uiText.includes('No Mermaid adapter supports'));
    assert(!uiText.includes('Offline WebView adapter'));

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
    let pluginText = '';
    for (const platform of ['ios', 'android']) {
      const pluginBundle = path.join(consumer, `dist-plugins-${platform}`);
      run('npx', ['expo', 'export', '--platform', platform, '--clear', '--output-dir', pluginBundle], { cwd: consumer });
      pluginText += bundleText(pluginBundle);
    }
    assert(pluginText.includes('maxCacheUnits'));
    assert(pluginText.includes('custom-renderers'));
    assert(pluginText.includes('singleDollarTextMath'));
    assert(pluginText.includes("default-src 'none'"));
    fs.writeFileSync(path.join(consumer, 'App.js'), matrixEntry);
    for (const platform of ['ios', 'android']) {
      run('npx', ['expo', 'export', '--platform', platform, '--clear', '--output-dir', path.join(consumer, `dist-matrix-${platform}`)], { cwd: consumer });
    }
    process.stdout.write(`Verified ${pack.filename} (${pack.files.length} files) in ${fixture.name}.\n`);
    if (keepTemp) process.stdout.write(`Packed fixture: ${consumer}\n`);
    else fs.rmSync(consumer, { recursive: true, force: true });
  }
} finally {
  if (!keepTemp) fs.rmSync(temp, { recursive: true, force: true });
}
