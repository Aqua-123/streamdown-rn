import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSingleHostSvg, assertSvgPeerManifest } from './svg-peer-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-rn-real-renderers-'));
const keepTemp = process.env.STREAMDOWN_KEEP_OPTIONAL_FIXTURE === '1';
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} exited with ${result.status ?? 1}`);
  }
  return result.stdout.trim();
};

try {
  run('npm', ['run', 'build']);
  const pack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp]))[0];
  assertSvgPeerManifest(JSON.parse(run('tar', ['-xOf', path.join(temp, pack.filename), 'package/package.json'])));
  const consumer = path.join(temp, 'consumer');
  fs.cpSync(path.join(root, 'fixtures/current-rn'), consumer, { recursive: true });
  const manifestPath = path.join(consumer, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest.dependencies, {
    'streamdown-rn': `file:${path.join(temp, pack.filename)}`,
    shiki: '4.3.1',
    '@shikijs/langs': '4.3.1',
    '@shikijs/themes': '4.3.1',
    'ratex-react-native': '0.1.13',
    'beautiful-mermaid': '1.1.3',
    'react-native-svg': '15.15.5',
    'react-native-webview': '14.0.1'
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(consumer, 'App.js'), `import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, Text } from 'react-native';
import { Streamdown } from 'streamdown-rn';
import { createCodePlugin } from 'streamdown-rn/code';
import { createMathPlugin } from 'streamdown-rn/math';
import { createBeautifulMermaidAdapter, createMermaidPlugin } from 'streamdown-rn/mermaid';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import typescript from '@shikijs/langs/typescript';
import githubLight from '@shikijs/themes/github-light';
import githubDark from '@shikijs/themes/github-dark';
import { RaTeXView } from 'ratex-react-native';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { SvgXml } from 'react-native-svg';
import WebView from 'react-native-webview';

const highlighter = createHighlighterCore({ themes: [githubLight, githubDark], langs: [typescript], engine: createJavaScriptRegexEngine() });
const markdown = '# Real optional providers\\n\\n\`\`\`typescript\\nconst real = true;\\n\`\`\`\\n\\n$$x^2$$\\n\\n\`\`\`mermaid\\nflowchart LR\\nA --> B\\n\`\`\`\\n\\n\`\`\`mermaid\\ngantt\\ntitle Full fidelity probe\\ndateFormat YYYY-MM-DD\\nsection Runtime\\nLoaded: 2026-07-20, 1d\\n\`\`\`';

export default function App() {
  const [ready, setReady] = useState({ shiki: false, ratex: false, beautiful: false, webview: false });
  const mark = (key) => setReady((current) => current[key] ? current : { ...current, [key]: true });
  const MathProbe = useMemo(() => function MathProbe({ source, display, errorColor }) {
    useEffect(() => mark('ratex'), []);
    return <RaTeXView latex={source} displayMode={display} color={errorColor} />;
  }, []);
  const SvgProbe = useMemo(() => function SvgProbe({ svg }) {
    useEffect(() => mark('beautiful'), []);
    return <SvgXml xml={svg} width="100%" height={160} />;
  }, []);
  const WebViewProbe = useMemo(() => function WebViewProbe() {
    return <WebView testID="webview-provider" style={{ height: 96 }} javaScriptEnabled={false} allowFileAccess={false} originWhitelist={['about:blank']} onLoadEnd={() => mark('webview')} source={{ html: '<!doctype html><meta name="viewport" content="width=device-width"><pre>Offline full-fidelity adapter rendered</pre>', baseUrl: 'about:blank' }} />;
  }, []);
  const plugins = useMemo(() => {
    const code = createCodePlugin({ provider: { languages: ['typescript'], highlight: async ({ code: source }) => {
      const instance = await highlighter;
      const result = instance.codeToTokens(source, { lang: 'typescript', theme: 'github-light' });
      mark('shiki');
      return { bg: result.bg, fg: result.fg, tokens: result.tokens.map((line) => line.map(({ content, color }) => ({ content, color }))) };
    } } });
    const math = createMathPlugin({ adapter: { render: (request) => <MathProbe {...request} /> } });
    const beautiful = createBeautifulMermaidAdapter({
      render: ({ source }) => ({ svg: renderMermaidSVG(source) }),
      renderSvg: (svg) => <SvgProbe svg={svg} />,
    });
    const webview = { families: ['*'], render: () => ({ kind: 'native', content: <WebViewProbe /> }) };
    return { code, math, mermaid: createMermaidPlugin({ adapter: beautiful, fullFidelityAdapter: webview }) };
  }, [MathProbe, SvgProbe, WebViewProbe]);
  const allReady = Object.values(ready).every(Boolean);
  return <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight || 24, backgroundColor: '#fff' }}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header">Optional provider Release runtime</Text>
      {Object.entries(ready).map(([key, value]) => <Text key={key} accessibilityLabel={'Provider ' + key + ': ' + (value ? 'ready' : 'pending')}>Provider {key}: {value ? 'ready' : 'pending'}</Text>)}
      <Text accessibilityLabel={allReady ? 'All optional providers ready' : 'Optional providers pending'} accessibilityState={{ busy: !allReady }}>{allReady ? 'All optional providers ready' : 'Optional providers pending'}</Text>
      <Streamdown mode="static" plugins={plugins}>{markdown}</Streamdown>
    </ScrollView>
  </SafeAreaView>;
}
`);
  run('npm', ['install', '--ignore-scripts', '--no-package-lock'], { cwd: consumer });
  assertSingleHostSvg(consumer, run);
  for (const platform of ['ios', 'android']) {
    run('npx', ['expo', 'export', '--platform', platform, '--clear', '--output-dir', path.join(consumer, `dist-${platform}`)], { cwd: consumer });
    assert(fs.existsSync(path.join(consumer, `dist-${platform}`, 'metadata.json')));
  }
  process.stdout.write('Bundled real Shiki JavaScript engine, RaTeX, beautiful-mermaid/react-native-svg, and react-native-webview adapters for Expo 56 on iOS and Android. Runtime rendering is not asserted by this gate.\n');
  if (keepTemp) process.stdout.write(`Optional renderer fixture: ${consumer}\n`);
} finally {
  if (!keepTemp) fs.rmSync(temp, { recursive: true, force: true });
}
