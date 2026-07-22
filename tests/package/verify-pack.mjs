import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSingleHostSvg, assertSvgPeerManifest } from './svg-peer-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-native-pack-'));
const keepTemp = process.env.STREAMDOWN_KEEP_PACK_FIXTURE === '1';
const deviceMatrix = JSON.parse(fs.readFileSync(path.join(root, 'tests/device/matrix.json'), 'utf8'));
const fixtures = deviceMatrix.hosts.map(({ id, expo, reactNative, fixture }) => ({
  id,
  name: `Expo ${expo} / RN ${reactNative}`,
  directory: fixture,
})).filter(({ id }) => !process.env.PACK_FIXTURE || process.env.PACK_FIXTURE === id);
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

const satisfiesPinnedRange = (version, range) => {
  if (range === version) return true;
  const actual = version.split('.').map(Number);
  const minimum = range.startsWith('^') ? range.slice(1).split('.').map(Number) : [];
  if (actual.length !== 3 || minimum.length !== 3 || [...actual, ...minimum].some(Number.isNaN)) return false;
  if (actual[0] !== minimum[0]) return false;
  if (minimum[0] === 0 && actual[1] !== minimum[1]) return false;
  return actual[0] > minimum[0] || actual[1] > minimum[1] || (actual[1] === minimum[1] && actual[2] >= minimum[2]);
};

const assertLockedCandidateDependencies = (consumer, packedManifest) => {
  const lock = JSON.parse(fs.readFileSync(path.join(consumer, 'package-lock.json'), 'utf8'));
  for (const [name, range] of Object.entries(packedManifest.dependencies ?? {})) {
    const version = lock.packages?.[`node_modules/${name}`]?.version;
    assert(version && satisfiesPinnedRange(version, range), `${name}@${range} must be satisfied by the checked-in fixture lock`);
  }
};

const installCandidateFromNpm = (tarball, packedManifest) => {
  const consumer = path.join(temp, 'npm-install');
  const cache = path.join(temp, 'fresh-npm-cache');
  const fixtureLock = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/expo54/package-lock.json'), 'utf8'));
  const pinned = (name) => {
    const version = fixtureLock.packages[`node_modules/${name}`]?.version
      ?? Object.entries(fixtureLock.packages).find(([key]) => key.endsWith(`/node_modules/${name}`))?.[1]?.version;
    assert(version, `Missing ${name} from the checked-in fixture lock`);
    return version;
  };
  fs.mkdirSync(consumer);
  fs.mkdirSync(cache);
  assert.deepEqual(fs.readdirSync(cache), [], 'positive npm install must start with an empty cache');
  fs.writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: {
      react: pinned('react'),
      'react-native': pinned('react-native'),
      'react-native-svg': pinned('react-native-svg'),
      '@react-native/virtualized-lists': pinned('@react-native/virtualized-lists'),
      ...Object.fromEntries(Object.keys(packedManifest.dependencies ?? {}).map((name) => [name, pinned(name)])),
      'streamdown-native': `file:${tarball}`,
    },
  }, null, 2)}\n`);
  run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--strict-peer-deps', '--cache', cache], { cwd: consumer });
  run('npm', ['ci', '--ignore-scripts', '--strict-peer-deps', '--cache', cache], { cwd: consumer });
  assert(fs.existsSync(path.join(consumer, 'node_modules/streamdown-native/package.json')), 'npm must install the packed candidate');
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

const assertEsmWrapperRuntime = (consumer, installed, packedManifest, subpath) => {
  const entry = packedManifest.exports[subpath];
  const cjsPath = path.join(installed, entry.require.default);
  const wrapperPath = path.join(installed, entry.import.default);
  const cjs = fs.readFileSync(cjsPath, 'utf8');
  const names = [...new Set([
    ...[...cjs.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)].map((match) => match[1]),
    ...[...cjs.matchAll(/Object\.defineProperty\(exports,\s*["']([A-Za-z_$][\w$]*)["']/g)].map((match) => match[1]),
  ].filter((name) => !['default', '__esModule'].includes(name)))].sort();
  const hasDefault = /exports\.default\s*=|Object\.defineProperty\(exports,\s*["']default["']/.test(cjs);
  const directory = path.join(consumer, `esm-wrapper-${subpath === '.' ? 'root' : subpath.slice(2).replaceAll('/', '-')}`);
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'stub.mjs'), `${names.map((name) => `export const ${name} = Symbol.for(${JSON.stringify(name)});`).join('\n')}\n${hasDefault ? 'export default {};' : ''}\n`);
  const wrapper = fs.readFileSync(wrapperPath, 'utf8').replaceAll(/(['"])(?:\.\.\/)+[^'"]+\.js\1/g, "'./stub.mjs'");
  fs.writeFileSync(path.join(directory, 'wrapper.mjs'), wrapper);
  const actual = JSON.parse(run('node', ['--input-type=module', '--eval', `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(path.join(directory, 'wrapper.mjs'))})).sort()))`], { cwd: consumer }));
  assert.deepEqual(actual, [...names, ...(hasDefault ? ['default'] : [])].sort(), `${subpath} ESM wrapper exports must match CommonJS`);
};

try {
  const suppliedTarball = process.env.STREAMDOWN_RELEASE_TARBALL;
  let tarball;
  let pack;
  if (suppliedTarball) {
    tarball = path.resolve(root, suppliedTarball);
    assert(fs.existsSync(tarball), `Missing release tarball ${tarball}`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
    assert.equal(digest, process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256, 'Release tarball SHA-256 mismatch');
    const files = run('tar', ['-tf', tarball]).split('\n').filter(Boolean).map((file) => ({ path: file.replace(/^package\//, '') }));
    pack = { filename: path.basename(tarball), files };
  } else {
    const staleArtifact = path.join(root, 'dist', 'removed-source-artifact.js');
    fs.mkdirSync(path.dirname(staleArtifact), { recursive: true });
    fs.writeFileSync(staleArtifact, 'throw new Error("stale build output");\n');
    run('npm', ['run', 'build']);
    pack = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp]))[0];
    tarball = path.join(temp, pack.filename);
  }
  assert(!pack.files.some(({ path: file }) => file === 'dist/removed-source-artifact.js'), 'build must remove stale dist artifacts');
  assert(!pack.files.some(({ path: file }) => file.startsWith('android/build/') || file.startsWith('android/.cxx/')), 'native build outputs must not be published');
  const publishedSources = pack.files
    .map(({ path: file }) => file)
    .filter((file) => file.startsWith('src/'));
  assert.deepEqual(publishedSources, ['src/native/StreamdownTextNativeComponent.ts'], 'only the Codegen specification may ship from src');
  assert(!pack.files.some(({ path: file }) => file.includes('__tests__')));

  const packedManifest = JSON.parse(run('tar', ['-xOf', tarball, 'package/package.json']));
  assertSvgPeerManifest(packedManifest);
  assert.equal(packedManifest.codegenConfig.android.javaPackageName, 'ai.aqua.streamdown');
  assert(pack.files.some(({ path: file }) => file === 'android/src/main/java/ai/aqua/streamdown/StreamdownTextPackage.kt'));
  assert(!pack.files.some(({ path: file }) => file.includes('/darkresearch/')));
  assert.match(run('tar', ['-xOf', tarball, 'package/react-native.config.js']), /ai\.aqua\.streamdown\.StreamdownTextPackage/);
  installCandidateFromNpm(tarball, packedManifest);
  const incompatibleSvg = path.join(temp, 'react-native-svg-incompatible');
  fs.mkdirSync(incompatibleSvg);
  fs.writeFileSync(path.join(incompatibleSvg, 'package.json'), `${JSON.stringify({ name: 'react-native-svg', version: '15.12.0' })}\n`);
  fs.cpSync(path.join(root, 'fixtures/hermes-evidence'), path.join(temp, 'hermes-evidence'), { recursive: true });
  const conflictConsumer = path.join(temp, 'peer-conflict');
  fs.cpSync(path.join(root, 'fixtures/expo54'), conflictConsumer, { recursive: true });
  run('npm', ['ci', '--ignore-scripts'], { cwd: conflictConsumer });
  const conflictManifestPath = path.join(conflictConsumer, 'package.json');
  const conflictManifest = JSON.parse(fs.readFileSync(conflictManifestPath, 'utf8'));
  conflictManifest.dependencies['streamdown-native'] = `file:${tarball}`;
  conflictManifest.dependencies['react-native-svg'] = `file:${incompatibleSvg}`;
  fs.writeFileSync(conflictManifestPath, `${JSON.stringify(conflictManifest, null, 2)}\n`);
  const conflict = spawnSync('npm', ['install', '--ignore-scripts', '--no-package-lock', '--no-save', '--strict-peer-deps'], {
    cwd: conflictConsumer,
    encoding: 'utf8',
  });
  assert.notEqual(conflict.status, 0);
  assert.match(`${conflict.stdout}\n${conflict.stderr}`, /ERESOLVE[\s\S]*react-native-svg/);
  for (const [fixtureIndex, fixture] of fixtures.entries()) {
    const consumer = path.join(temp, `consumer-${fixtureIndex}`);
    fs.cpSync(path.join(root, fixture.directory), consumer, { recursive: true });
    run('npm', ['ci', '--ignore-scripts'], { cwd: consumer });
    const matrixEntry = fs.readFileSync(path.join(consumer, 'App.js'));
    const consumerManifestPath = path.join(consumer, 'package.json');
    const consumerManifest = JSON.parse(fs.readFileSync(consumerManifestPath, 'utf8'));
    consumerManifest.dependencies['streamdown-native'] = `file:${tarball}`;
    fs.writeFileSync(consumerManifestPath, `${JSON.stringify(consumerManifest, null, 2)}\n`);
    assertLockedCandidateDependencies(consumer, packedManifest);
    const installed = path.join(consumer, 'node_modules/streamdown-native');
    fs.rmSync(installed, { recursive: true, force: true });
    fs.mkdirSync(installed, { recursive: true });
    run('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1']);
    assertSingleHostSvg(consumer, run);

    const resolve = "console.log(import.meta.resolve('streamdown-native'))";
    const defaultEntry = run('node', ['--input-type=module', '--eval', resolve], { cwd: consumer });
    const nativeEntry = run('node', ['--conditions=react-native', '--input-type=module', '--eval', resolve], { cwd: consumer });
    assert.match(defaultEntry, /streamdown-native\/dist\/esm\/index\.js$/);
    assert.match(nativeEntry, /streamdown-native\/dist\/index\.js$/);
    const resolveUi = "console.log(import.meta.resolve('streamdown-native/ui'))";
    const defaultUiEntry = run('node', ['--input-type=module', '--eval', resolveUi], { cwd: consumer });
    const nativeUiEntry = run('node', ['--conditions=react-native', '--input-type=module', '--eval', resolveUi], { cwd: consumer });
    assert.match(defaultUiEntry, /streamdown-native\/dist\/esm\/components\/ui\/index\.js$/);
    assert.match(nativeUiEntry, /streamdown-native\/dist\/components\/ui\/index\.js$/);

    const installedPackage = path.join(consumer, 'node_modules/streamdown-native');
    const nativeViewConfig = fs.readFileSync(path.join(installedPackage, 'dist/native/StreamdownTextNativeComponent.js'), 'utf8');
    assert.match(nativeViewConfig, /NativeComponentRegistry\.get/);
    assert.match(nativeViewConfig, /uiViewClassName:\s*["']StreamdownText["']/);
    assert.doesNotMatch(nativeViewConfig, /codegenNativeComponent\)\(['"]StreamdownText/);
    for (const conditions of Object.values(packedManifest.exports)) {
      const importTarget = conditions.import?.default;
      assert.equal(typeof importTarget, 'string');
      run('node', ['--check', path.join(installedPackage, importTarget)]);
    }
    for (const subpath of ['./code', './cjk', './renderers', './math', './mermaid/webview']) {
      const specifier = `streamdown-native/${subpath.slice(2)}`;
      const esmKeys = JSON.parse(run('node', [
        '--input-type=module',
        '--eval',
        `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(specifier)})).sort()))`,
      ], { cwd: consumer }));
      const cjsTarget = path.join(installedPackage, packedManifest.exports[subpath].require.default);
      const cjsKeys = JSON.parse(run('node', [
        '--eval',
        `console.log(JSON.stringify(Object.keys(require(${JSON.stringify(cjsTarget)})).sort()))`,
      ], { cwd: consumer }));
      assert.deepEqual(esmKeys, cjsKeys, `${specifier} ESM exports must match CommonJS`);
    }
    for (const subpath of ['.', './ui', './mermaid']) {
      assertEsmWrapperRuntime(consumer, installedPackage, packedManifest, subpath);
    }
    for (const mapName of ['dist/index.js.map']) {
      const map = JSON.parse(fs.readFileSync(path.join(installedPackage, mapName), 'utf8'));
      assert(map.sourcesContent?.some((source) => typeof source === 'string' && source.length > 0), `${mapName} must embed its source`);
    }
    assert(!fs.existsSync(path.join(installedPackage, 'dist/index.d.ts.map')), 'unusable declaration maps must not be published');
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
  Action, ActionButton, ActionRoot, ActionStatus, ActionTrigger,
  Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger,
  FullscreenModal, NativeLink, PanZoomSurface, Toolbar, ToolbarButton, ToolbarRoot,
  type ActionButtonProps, type ActionRootProps, type ActionState, type ActionStatusProps, type ActionTriggerProps,
  type ButtonProps, type ButtonState, type ButtonVariant,
  type DropdownItemProps, type DropdownOpenReason, type DropdownPopupProps,
  type DropdownRootProps, type DropdownTriggerProps, type FullscreenModalProps,
  type NativeLinkProps, type PanZoomSurfaceProps, type ToolbarButtonProps,
  type ToolbarOrientation, type ToolbarRootProps, type ToolbarState,
} from 'streamdown-native/ui';
import {
  NATIVE_ELEMENT_NAMES, fetchImageFileRequest,
  type NativeImageDownloadCapability, type NativeImageDownloadResult,
  type NativeElementName,
  type NativeSlotProps,
  type NativeSlots,
  type StreamdownProps,
} from 'streamdown-native';
const components = [Action, ActionButton, ActionRoot, ActionStatus, ActionTrigger, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface, Toolbar, ToolbarButton, ToolbarRoot];
type Contracts = ActionButtonProps | ActionRootProps | ActionStatusProps | ActionTriggerProps | ButtonProps | DropdownItemProps | DropdownPopupProps | DropdownRootProps | DropdownTriggerProps | FullscreenModalProps | NativeLinkProps | PanZoomSurfaceProps | ToolbarButtonProps | ToolbarRootProps;
const variant: ButtonVariant = 'ghost';
const state: ButtonState = { pressed: false, focused: false, hovered: false, disabled: false };
const actionState: ActionState | null = null;
const toolbarState: ToolbarState = { disabled: false, orientation: 'horizontal' };
const orientation: ToolbarOrientation = 'vertical';
const callbackButton: ButtonProps = { children: (value: ButtonState) => value.pressed ? 'Pressed' : 'Idle', style: (value: ButtonState) => ({ opacity: value.disabled ? 0.5 : 1 }) };
const reason: DropdownOpenReason = 'trigger';
const slots: NativeSlots = {
  p: ({ renderDefault }: NativeSlotProps<'p'>) => renderDefault({ style: { opacity: 0.8 }, children: 'packed' }),
  img: ({ renderDefault }: NativeSlotProps<'img'>) => renderDefault({ style: { padding: 2 } }),
};
const element: NativeElementName = NATIVE_ELEMENT_NAMES[0];
const streamdownProps: StreamdownProps = { slots };
declare const imageDownloads: NativeImageDownloadCapability;
const imageResult: NativeImageDownloadResult | null = null;
if (false) void fetchImageFileRequest(imageDownloads, 'https://example.com/image.png');
// @ts-expect-error Standard slot names are exact.
const invalidSlots: NativeSlots = { paragraf: () => null };
void components; void (null as Contracts | null); void variant; void state; void actionState; void toolbarState; void orientation; void callbackButton; void reason;
void element; void streamdownProps; void invalidSlots; void imageResult;
`);
    run(
      path.join(root, 'node_modules/.bin/tsc'),
      [uiConsumer, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', '--module', 'Node16', '--moduleResolution', 'Node16'],
      { cwd: consumer }
    );
    const nodeNextConsumer = path.join(consumer, 'all-subpaths.mts');
    fs.writeFileSync(nodeNextConsumer, `import Streamdown, { type StreamdownProps } from 'streamdown-native';
import { Button, type ButtonProps } from 'streamdown-native/ui';
import { createCodePlugin, type CodeHighlighterPlugin } from 'streamdown-native/code';
import { cjk, type CjkPlugin } from 'streamdown-native/cjk';
import { createRendererPlugin, type RendererPlugin } from 'streamdown-native/renderers';
import { createMathPlugin, type MathPlugin } from 'streamdown-native/math';
import { createMermaidPlugin, type DiagramPlugin } from 'streamdown-native/mermaid';
import { createOfflineWebViewAdapter, type OfflineWebViewAdapterOptions } from 'streamdown-native/mermaid/webview';
type Contracts = StreamdownProps | ButtonProps | CodeHighlighterPlugin | CjkPlugin | RendererPlugin | MathPlugin | DiagramPlugin | OfflineWebViewAdapterOptions;
void [Streamdown, Button, createCodePlugin, cjk, createRendererPlugin, createMathPlugin, createMermaidPlugin, createOfflineWebViewAdapter];
void (null as Contracts | null);
`);
    run(
      path.join(root, 'node_modules/.bin/tsc'),
      [nodeNextConsumer, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', '--module', 'NodeNext', '--moduleResolution', 'NodeNext'],
      { cwd: consumer }
    );
    fs.writeFileSync(path.join(consumer, 'App.js'), `import React from 'react';
import Streamdown, { Streamdown as NamedStreamdown } from 'streamdown-native';
if (Streamdown !== NamedStreamdown) throw new Error('default export mismatch');
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
import { Action, ActionButton, ActionRoot, ActionStatus, ActionTrigger, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface, Toolbar, ToolbarButton, ToolbarRoot } from 'streamdown-native/ui';
const exports = [Action, ActionButton, ActionRoot, ActionStatus, ActionTrigger, Button, Dropdown, DropdownItem, DropdownPopup, DropdownRoot, DropdownTrigger, FullscreenModal, NativeLink, PanZoomSurface, Toolbar, ToolbarButton, ToolbarRoot];
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
import { Streamdown } from 'streamdown-native';
import { createCodePlugin } from 'streamdown-native/code';
import { cjk } from 'streamdown-native/cjk';
import { createRendererPlugin } from 'streamdown-native/renderers';
import { createMathPlugin } from 'streamdown-native/math';
import { createMermaidPlugin } from 'streamdown-native/mermaid';
import { createOfflineWebViewAdapter } from 'streamdown-native/mermaid/webview';
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
