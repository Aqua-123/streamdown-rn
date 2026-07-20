import React, { Profiler, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Linking, SafeAreaView, ScrollView, Text } from 'react-native';
import { FullscreenModal, Streamdown, createStreamingInstrumentation } from 'streamdown-rn';
import { createCodePlugin } from 'streamdown-rn/code';
import { cjk } from 'streamdown-rn/cjk';
import { createMathPlugin } from 'streamdown-rn/math';
import { createMermaidPlugin } from 'streamdown-rn/mermaid';
import { buildBenchmarkCorpus } from './benchmarkCorpus';

const STATIC = `# Streamdown RN\n\n- [x] native semantics\n- [ ] streaming\n\n| Metric | Value |\n|---|---:|\n| parity | 100% |\n\n\`\`\`js\nconst hello = 'world';\n\`\`\`\n\nInline math $x^2$ and block math:\n\n$$\\sum_{i=1}^{n}i$$\n\n中文**强调**，مرحبا بالعالم\n\n\`\`\`mermaid\nflowchart LR\nA-->B\n\`\`\`\n`;
const STREAM = `${STATIC}\n## Incomplete\n\n[link](https://example.com`;
const BENCHMARK = buildBenchmarkCorpus();
const code = createCodePlugin({ provider: { languages: ['js', 'typescript'], aliases: { ts: 'typescript' }, highlight: ({ code: source }) => ({ tokens: source.split('\n').map((line) => [{ content: line, color: '#2563eb' }]) }) } });
const math = createMathPlugin({ adapter: { render: ({ source, display }) => React.createElement(Text, { accessibilityLabel: `${display ? 'Block' : 'Inline'} math: ${source}` }, source) } });
const mermaid = createMermaidPlugin({ adapter: { families: ['flowchart'], render: ({ source }) => ({ kind: 'native', content: React.createElement(Text, { accessibilityLabel: 'Native flowchart' }, source) }) } });
const PLUGINS = { code, cjk, math, mermaid };
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
  'image-loading': '![Image loading](https://10.255.255.1/streamdown-loading.png)',
  'image-error': '![Image error](invalid-scheme://streamdown/error.png)',
  'image-retry': '![Image retry](invalid-scheme://streamdown/retry.png)',
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
  const [config, setConfig] = useState({ scenario: 'static', theme: 'light', direction: 'ltr', layout: 'narrow' });
  useEffect(() => {
    const apply = (url) => {
      const params = new URL(url).searchParams;
      setConfig({ scenario: params.get('scenario') || 'static', theme: params.get('theme') || 'light', direction: params.get('direction') || 'ltr', layout: params.get('layout') || 'narrow', checkpoint: params.get('checkpoint') || '' });
    };
    Linking.getInitialURL().then((url) => url && apply(url));
    const subscription = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => subscription.remove();
  }, []);
  return config;
}

export default function App() {
  const { scenario, theme, direction, layout, checkpoint } = useConfig();
  const streaming = scenario === 'streaming';
  const benchmarking = scenario === 'benchmark';
  const incompleteCode = scenario === 'code-incomplete';
  const interactionDisabled = scenario === 'interaction-disabled';
  const streamMode = streaming || benchmarking || incompleteCode || interactionDisabled;
  const source = benchmarking ? BENCHMARK : STREAM;
  const [length, setLength] = useState(32);
  const metrics = useMemo(() => createStreamingInstrumentation(), []);
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
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' }} testID="fixture-root">
      <ScrollView contentContainerStyle={{ padding: 16, width: layout === 'wide' ? 720 : 360, maxWidth: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header">Fixture: {scenario}</Text>
        <Text>Fixture state: {scenario}</Text>
        <Profiler id="streamdown" onRender={(_id, phase, duration) => console.log('STREAMDOWN_BENCHMARK', JSON.stringify({ type: 'react-commit', phase, durationMs: duration }))}>
          <Streamdown
            mode={streamMode ? 'streaming' : 'static'}
            theme={theme}
            dir={direction}
            isAnimating={(streaming || benchmarking) && !checkpoint}
            isComplete={incompleteCode ? false : ((!streaming && !benchmarking) || length >= source.length)}
            instrumentation={metrics}
            plugins={scenarioPlugins}
          >{markdown}</Streamdown>
        </Profiler>
      </ScrollView>
      <FullscreenModal visible={scenario === 'fullscreen'} label="Fullscreen fixture" closeLabel="Exit fullscreen" capabilities={{}} onClose={() => {}}>
        <Text>Fullscreen content</Text>
      </FullscreenModal>
    </SafeAreaView>
  );
}
