import React, { Profiler, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Linking, ScrollView, StatusBar, Text, View } from 'react-native';
import { FullscreenModal, Streamdown, createStreamingInstrumentation } from 'streamdown-rn';
import { createCodePlugin } from 'streamdown-rn/code';
import { cjk } from 'streamdown-rn/cjk';
import { createMathPlugin } from 'streamdown-rn/math';
import { createBeautifulMermaidAdapter, createMermaidPlugin } from 'streamdown-rn/mermaid';
import { createRendererPlugin } from 'streamdown-rn/renderers';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import python from '@shikijs/langs/python';
import typescript from '@shikijs/langs/typescript';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { RaTeXView } from 'ratex-react-native';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { buildBenchmarkCorpus } from './benchmarkCorpus';
import { ResponsiveMermaidSvg, VegaLiteRenderer } from './fixture-renderers';
import { HarnessApp } from './harness-app';
import { createFixtureCapabilities } from './native-capabilities';

const STATIC = `# Streamdown RN\n\n- [x] native semantics\n- [ ] streaming\n\n| Metric | Value |\n|---|---:|\n| parity | 100% |\n\n\`\`\`js\nconst hello = 'world';\n\`\`\`\n\nInline math $x^2$ and block math:\n\n$$\\sum_{i=1}^{n}i$$\n\n中文**强调**，مرحبا بالعالم\n\n\`\`\`mermaid\nflowchart LR\nA-->B\n\`\`\`\n`;
const STREAM = `${STATIC}\n## Incomplete\n\n[link](https://example.com`;
const BENCHMARK = buildBenchmarkCorpus();
const highlighter = createHighlighterCore({ themes: [githubLight, githubDark], langs: [bash, css, javascript, json, python, typescript], engine: createJavaScriptRegexEngine({ forgiving: true }) });
const code = createCodePlugin({ provider: {
  languages: ['bash', 'css', 'javascript', 'json', 'python', 'typescript'],
  aliases: { js: 'javascript', jsx: 'javascript', py: 'python', sh: 'bash', shell: 'bash', ts: 'typescript', tsx: 'typescript' },
  highlight: async ({ code: source, language, colorScheme }) => {
    const instance = await highlighter;
    const result = instance.codeToTokens(source, { lang: language, theme: colorScheme === 'light' ? 'github-light' : 'github-dark' });
    return { bg: result.bg, fg: result.fg, tokens: result.tokens.map((line) => line.map(({ content, color, fontStyle }) => ({ content, color, fontStyle: fontStyle === 1 ? 'italic' : undefined }))) };
  },
} });
const math = createMathPlugin({ singleDollarTextMath: true, adapter: { render: ({ source, display, errorColor }) => React.createElement(RaTeXView, { latex: source, displayMode: display, fontSize: display ? 22 : 16, color: errorColor }) } });
const mermaid = createMermaidPlugin({ adapter: createBeautifulMermaidAdapter({
  render: ({ source, theme }) => ({ svg: renderMermaidSVG(source, { bg: theme?.colors.background ?? '#ffffff', fg: theme?.colors.foreground ?? '#27272a', line: theme?.colors.muted ?? '#3f3f46', accent: theme?.colors.accent ?? '#8b5cf6', muted: theme?.colors.muted ?? '#52525b', surface: theme?.colors.codeBackground ?? '#eeecff', border: theme?.colors.border ?? '#8b5cf6', font: theme?.fonts.mono ?? 'monospace', padding: 30, nodeSpacing: 28, layerSpacing: 44, transparent: true }) }),
  renderSvg: (svg) => React.createElement(ResponsiveMermaidSvg, { svg }),
}) });
const renderers = createRendererPlugin([{ language: ['vega-lite', 'vega'], component: VegaLiteRenderer }]);
const PLUGINS = { code, cjk, math, mermaid, renderers };
const codeLoading = createCodePlugin({ provider: { languages: ['js'], highlight: () => new Promise(() => {}) } });
const mathLoading = createMathPlugin({ adapter: { render: ({ source }) => React.createElement(Text, { accessibilityLabel: 'Loading math renderer', accessibilityState: { busy: true } }, `Loading math renderer: ${source}`) } });
const mathError = createMathPlugin({ adapter: { render: () => { throw new Error('Math renderer failed'); } } });
const mathFallback = createMathPlugin();
const mermaidLoading = createMermaidPlugin({ adapter: { families: ['flowchart'], render: () => new Promise(() => {}) } });
const mermaidError = createMermaidPlugin({ adapter: { families: ['flowchart'], render: async () => { throw new Error('Diagram renderer failed'); } } });
const mermaidWebViewFallback = createMermaidPlugin({ fullFidelityAdapter: { families: ['*'], render: async () => { throw new Error('Offline WebView bridge unavailable'); } } });
const SCENARIO_PLUGINS = {
  'code-loading': { ...PLUGINS, code: codeLoading },
  'math-loading': { ...PLUGINS, math: mathLoading },
  'math-error': { ...PLUGINS, math: mathError },
  'math-fallback': { ...PLUGINS, math: mathFallback },
  'mermaid-loading': { ...PLUGINS, mermaid: mermaidLoading },
  'mermaid-error': { ...PLUGINS, mermaid: mermaidError },
  'mermaid-retry': { ...PLUGINS, mermaid: mermaidError },
  'mermaid-webview-fallback': { ...PLUGINS, mermaid: mermaidWebViewFallback },
};
const SCENARIOS = {
  controls: '| A | B |\n|---|---|\n| one | two |\n\n```js\nconst controlled = true;\n```',
  fallbacks: '![blocked image](http://example.com/image.png)\n\n```mermaid\ngantt\ntitle Unsupported\n```',
  code: '```typescript showLineNumbers {2}\nconst one = 1;\nconst two = 2;\n```',
  math: '$$\\begin{matrix}1&2\\\\3&4\\end{matrix}$$',
  mermaid: '```mermaid\nflowchart LR\nA-->B\n```',
  'mermaid-sequence': '```mermaid\nsequenceDiagram\n    participant Client\n    participant Server\n    participant Database\n    Client->>Server: POST /api/data\n    Server->>Database: INSERT query\n    Database-->>Server: Success\n    Server-->>Client: 201 Created\n```',
  'mermaid-state': '```mermaid\nstateDiagram-v2\n    [*] --> Idle\n    Idle --> Loading: fetch()\n    Loading --> Success: 200 OK\n    Loading --> Error: 4xx/5xx\n    Error --> Loading: retry()\n    Success --> Idle: reset()\n```',
  vega: '```vega-lite\n{"data":{"values":[{"month":"Jan","revenue":28},{"month":"Feb","revenue":55},{"month":"Mar","revenue":43},{"month":"Apr","revenue":91},{"month":"May","revenue":81},{"month":"Jun","revenue":53}]},"encoding":{"x":{"field":"month"},"y":{"field":"revenue","title":"Revenue ($k)"}}}\n```',
  'image-loading': '![Image loading](https://10.255.255.1/streamdown-loading.png)',
  'image-error': '![Image error](https://127.0.0.1:1/streamdown-error.png)',
  'image-retry': '![Image retry](https://127.0.0.1:1/streamdown-retry.png)',
  'code-loading': '```js\nconst pending = true;\n```',
  'code-unsupported': '```brainfuck\n++>---<[.]\n```',
  'code-incomplete': '```typescript\nconst incomplete = true;',
  'math-loading': '$$\\int_0^1 x^2 dx$$',
  'math-error': '$$\\unsupported{math}$$',
  'math-fallback': 'Readable fallback: $\\frac{1}{2}$',
  'mermaid-loading': '```mermaid\nflowchart LR\nLoading-->Diagram\n```',
  'mermaid-error': '```mermaid\nflowchart LR\nError-->Fallback\n```',
  'mermaid-retry': '```mermaid\nflowchart LR\nRetry-->Diagram\n```',
  'mermaid-webview-fallback': '```mermaid\ngantt\ntitle WebView fallback\n```',
  'interaction-disabled': '| Disabled | Control |\n|---|---|\n| stream | state |\n\n```js\nconst disabled = true;\n```',
};

function useConfig() {
  const [config, setConfig] = useState({ scenario: 'harness', theme: 'light', direction: 'ltr', layout: 'narrow' });
  useEffect(() => {
    const apply = (url) => {
      const params = new URL(url).searchParams;
      setConfig({ scenario: params.get('scenario') || 'harness', theme: params.get('theme') || 'light', direction: params.get('direction') || 'ltr', layout: params.get('layout') || 'narrow', checkpoint: params.get('checkpoint') || '' });
    };
    Linking.getInitialURL().then((url) => url && apply(url));
    const subscription = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => subscription.remove();
  }, []);
  return config;
}

export default function App() {
  const config = useConfig();
  const metrics = useMemo(() => createStreamingInstrumentation(), []);
  const capabilities = useMemo(() => createFixtureCapabilities(), []);
  if (config.scenario === 'harness') return <HarnessApp allPlugins={PLUGINS} metrics={metrics} capabilities={capabilities} />;
  return <AutomatedFixture config={config} metrics={metrics} capabilities={capabilities} />;
}

function AutomatedFixture({ config, metrics, capabilities }) {
  const { scenario, theme, direction, layout, checkpoint } = config;
  const streaming = scenario === 'streaming';
  const benchmarking = scenario === 'benchmark';
  const incompleteCode = scenario === 'code-incomplete';
  const interactionDisabled = scenario === 'interaction-disabled';
  const streamMode = streaming || benchmarking || incompleteCode || interactionDisabled;
  const source = benchmarking ? BENCHMARK : STREAM;
  const [length, setLength] = useState(32);
  const started = React.useRef(performance.now());
  useEffect(() => {
    if ((!streaming && !benchmarking) || checkpoint || length >= source.length) return;
    const timer = setTimeout(() => { started.current = performance.now(); setLength((value) => Math.min(value + 32, source.length)); }, 16);
    return () => clearTimeout(timer);
  }, [benchmarking, checkpoint, length, source, streaming]);
  useEffect(() => {
    const requested = checkpoint === 'complete' ? source.length : Number.parseInt(checkpoint, 10);
    setLength(Number.isFinite(requested) ? Math.min(Math.max(requested, 0), source.length) : 32);
  }, [checkpoint, scenario, source]);
  useLayoutEffect(() => {
    if (!streaming && !benchmarking) return;
    if (length === 32) return;
    console.log('STREAMDOWN_BENCHMARK', JSON.stringify({ type: 'append-to-commit', durationMs: performance.now() - started.current, length, metrics: metrics.snapshot() }));
  }, [benchmarking, length, metrics, streaming]);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Streamdown fixture ${scenario} ready`);
    globalThis.__STREAMDOWN_RN_READY__ = { scenario, metrics: metrics.snapshot() };
  }, [metrics, scenario]);
  const markdown = streaming || benchmarking ? source.slice(0, length) : SCENARIOS[scenario] || STATIC;
  const scenarioPlugins = SCENARIO_PLUGINS[scenario] || PLUGINS;
  const backgroundColor = theme === 'dark' ? '#111827' : '#ffffff';
  const foregroundColor = theme === 'dark' ? '#e5e7eb' : '#111827';
  return (
    <View style={{ flex: 1, backgroundColor }} testID="fixture-root">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingTop: 24, width: layout === 'wide' ? 720 : 360, maxWidth: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: foregroundColor }}>Fixture: {scenario}</Text>
        <Text style={{ color: foregroundColor }}>Fixture state: {scenario}</Text>
        <Profiler id="streamdown" onRender={(_id, phase, duration) => console.log('STREAMDOWN_BENCHMARK', JSON.stringify({ type: 'react-commit', phase, durationMs: duration }))}>
          <Streamdown
            mode={streamMode ? 'streaming' : 'static'}
            theme={theme}
            dir={direction}
            isAnimating={(streaming || benchmarking) && !checkpoint}
            isComplete={incompleteCode ? false : ((!streaming && !benchmarking) || length >= source.length)}
            instrumentation={metrics}
            plugins={scenarioPlugins}
            capabilities={capabilities}
          >{markdown}</Streamdown>
        </Profiler>
      </ScrollView>
      <FullscreenModal visible={scenario === 'fullscreen'} label="Fullscreen fixture" closeLabel="Exit fullscreen" capabilities={capabilities} onClose={() => {}} color={foregroundColor} backgroundColor={backgroundColor}>
        <Text style={{ color: foregroundColor }}>Fullscreen content</Text>
      </FullscreenModal>
    </View>
  );
}
