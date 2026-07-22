import React, { Profiler, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Linking, PixelRatio, Platform, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { FullscreenModal, Streamdown, createStreamingInstrumentation } from 'streamdown-rn';
import { Button } from 'streamdown-rn/ui';
import { createCodePlugin } from 'streamdown-rn/code';
import { cjk } from 'streamdown-rn/cjk';
import { createMathPlugin } from 'streamdown-rn/math';
import { createBeautifulMermaidAdapter, createMermaidPlugin } from 'streamdown-rn/mermaid';
import { createOfflineWebViewAdapter } from 'streamdown-rn/mermaid/webview';
import { createRendererPlugin } from 'streamdown-rn/renderers';
import { RaTeXView } from 'ratex-react-native';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { SvgXml } from 'react-native-svg';
import { buildBenchmarkCorpus } from './benchmarkCorpus';
import { HermesEvidenceFixture } from './hermes-evidence-app';
import {
  DEVICE_SCENARIO_PHASES,
  createDeviceEvidenceReporter,
  parseDeviceEvidenceRequest,
} from './device-evidence';

const DEVICE_HOST = 'expo54';
const DEVICE_SCENARIOS = [
  'packed-core-and-all-subpath-launch', 'static-mixed-corpus', 'streaming-32-character-chunks',
  'image-loading-error-retry', 'code-supported-unsupported-incomplete', 'math-native-and-fallback',
  'rtl-cjk-font-scale-theme-layout',
];
const ALL_SUBPATHS_RESOLVED = [Streamdown, Button, createCodePlugin, cjk, createMathPlugin, createMermaidPlugin, createOfflineWebViewAdapter, createRendererPlugin].every(Boolean);

const STATIC = `# Streamdown RN\n\n- [x] native semantics\n- [ ] streaming\n\n| Metric | Value |\n|---|---:|\n| parity | 100% |\n\n\`\`\`js\nconst hello = 'world';\n\`\`\`\n\nInline math $x^2$ and block math:\n\n$$\\sum_{i=1}^{n}i$$\n\n中文**强调**，مرحبا بالعالم\n\n\`\`\`mermaid\nflowchart LR\nA-->B\n\`\`\`\n`;
const STREAM = `${STATIC}\n## Incomplete\n\n[link](https://example.com`;
const BENCHMARK = buildBenchmarkCorpus();
const code = createCodePlugin({ provider: { languages: ['js', 'typescript'], aliases: { ts: 'typescript' }, highlight: ({ code: source }) => ({ tokens: source.split('\n').map((line) => [{ content: line, color: '#2563eb' }]) }) } });
const math = createMathPlugin({ singleDollarTextMath: true, adapter: { render: ({ source, display, errorColor }) => React.createElement(RaTeXView, { latex: source, displayMode: display, fontSize: display ? 22 : 16, color: errorColor }) } });
const mermaid = createMermaidPlugin({ adapter: createBeautifulMermaidAdapter({
  render: ({ source }) => ({ svg: renderMermaidSVG(source) }),
  renderSvg: (svg) => React.createElement(SvgXml, { xml: svg, width: '100%', height: 200 }),
}) });
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
  const [config, setConfig] = useState({ scenario: 'static', theme: 'light', direction: 'ltr', layout: 'narrow' });
  useEffect(() => {
    const apply = (url) => {
      const params = new URL(url).searchParams;
      setConfig({ scenario: params.get('scenario') || 'static', theme: params.get('theme') || 'light', direction: params.get('direction') || 'ltr', layout: params.get('layout') || 'narrow', checkpoint: params.get('checkpoint') || '', evidenceUrl: url });
    };
    Linking.getInitialURL().then((url) => url && apply(url));
    const subscription = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => subscription.remove();
  }, []);
  return config;
}

export default function App() {
  const config = useConfig();
  const { scenario, theme, direction, layout, checkpoint } = config;
  const streaming = scenario === 'streaming';
  const benchmarking = scenario === 'benchmark';
  const incompleteCode = scenario === 'code-incomplete';
  const interactionDisabled = scenario === 'interaction-disabled';
  const streamMode = streaming || benchmarking || incompleteCode || interactionDisabled;
  const source = benchmarking ? BENCHMARK : STREAM;
  const [length, setLength] = useState(32);
  const metrics = useMemo(() => createStreamingInstrumentation(), []);
  const evidenceRequest = useMemo(() => parseDeviceEvidenceRequest(config.evidenceUrl, { host: DEVICE_HOST, platform: Platform.OS, scenarios: DEVICE_SCENARIOS }), [config.evidenceUrl]);
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
  if (config.evidenceUrl?.includes('hermesEvidence=')) return <HermesEvidenceFixture evidenceUrl={config.evidenceUrl} metrics={metrics} plugins={PLUGINS} />;
  if (config.evidenceUrl?.includes('://evidence')) {
    return evidenceRequest ? <DeviceEvidenceFixture request={evidenceRequest} metrics={metrics} /> : <Text testID="device-evidence-rejected">Invalid device evidence request</Text>;
  }
  const markdown = streaming || benchmarking ? source.slice(0, length) : SCENARIOS[scenario] || STATIC;
  const scenarioPlugins = SCENARIO_PLUGINS[scenario] || PLUGINS;
  const backgroundColor = theme === 'dark' ? '#111827' : '#ffffff';
  const foregroundColor = theme === 'dark' ? '#e5e7eb' : '#111827';
  return (
    <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight || 24, backgroundColor }} testID="fixture-root">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      <ScrollView contentContainerStyle={{ padding: 16, width: layout === 'wide' ? 720 : 360, maxWidth: '100%', alignSelf: 'center' }}>
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
          >{markdown}</Streamdown>
        </Profiler>
      </ScrollView>
      <FullscreenModal visible={scenario === 'fullscreen'} label="Fullscreen fixture" closeLabel="Exit fullscreen" capabilities={{}} onClose={() => {}} color={foregroundColor} backgroundColor={backgroundColor}>
        <Text style={{ color: foregroundColor }}>Fullscreen content</Text>
      </FullscreenModal>
    </SafeAreaView>
  );
}

function evidenceRenderConfig(scenario, phase) {
  if (scenario === 'streaming-32-character-chunks') return { scenario: 'streaming', checkpoint: phase === 'chunk-32' ? '32' : phase === 'chunk-64' ? '64' : 'complete' };
  if (scenario.startsWith('streaming-')) {
    const complete = phase.endsWith('complete');
    return {
      scenario: 'streaming', checkpoint: complete ? 'complete' : '64',
      animated: phase.startsWith('unanimated-') ? false : phase.startsWith('slide-')
        ? { animation: 'slideUp', duration: 320, easing: 'ease-out', sep: 'word', stagger: 14 }
        : { animation: 'fadeIn', duration: 280, easing: 'ease-out', sep: phase.startsWith('fade-char') ? 'char' : 'word', stagger: 12 },
      reducedMotion: phase.startsWith('reduced-motion-'),
    };
  }
  const rendered = {
    'image-loading': 'image-loading', 'image-error': 'image-error', 'image-retry': 'image-retry',
    'code-supported': 'code', 'code-unsupported': 'code-unsupported', 'code-incomplete': 'code-incomplete',
    'math-native': 'math', 'math-fallback': 'math-fallback',
  }[phase] || 'static';
  return {
    scenario: rendered, checkpoint: '', direction: phase === 'rtl-cjk' ? 'rtl' : 'ltr',
    theme: phase === 'dark-wide-layout' ? 'dark' : 'light', layout: phase === 'dark-wide-layout' ? 'wide' : 'narrow',
  };
}

function useObservedEvidencePlugins(phase, onObserved) {
  return useMemo(() => {
    const defer = () => Promise.resolve().then(() => onObserved(phase));
    if (phase.startsWith('code-') && phase !== 'code-incomplete') {
      return { ...PLUGINS, code: { ...code, highlight(input, callback) {
        const result = code.highlight(input, (next) => { defer(); callback?.(next); });
        if (result && (phase === 'code-supported' || !code.supportsLanguage(input.language))) defer();
        return result;
      } } };
    }
    if (phase.startsWith('math-')) {
      const base = phase === 'math-native' ? math : mathFallback;
      return { ...PLUGINS, math: { ...base, render(request) {
        const result = base.render(request);
        if ((phase === 'math-native' && result) || (phase === 'math-fallback' && result === null)) defer();
        return result;
      } } };
    }
    return undefined;
  }, [onObserved, phase]);
}

function DeviceEvidenceFixture(props) {
  const [foregroundSeen, setForegroundSeen] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') setForegroundSeen(true); });
    return () => subscription.remove();
  }, []);
  return foregroundSeen ? <ActiveDeviceEvidenceFixture {...props} /> : <Text>Waiting for foreground Release runtime</Text>;
}

function ActiveDeviceEvidenceFixture({ request, metrics }) {
  const phases = DEVICE_SCENARIO_PHASES[request.scenario];
  const [cursor, setCursor] = useState(0);
  const capabilities = useMemo(() => ({}), []);
  const reporter = useMemo(() => createDeviceEvidenceReporter(request, {
    release: !__DEV__, hermes: Boolean(globalThis.HermesInternal), appState: 'foreground',
  }), [request]);
  const phase = phases[Math.min(cursor, phases.length - 1)];
  const advance = useCallback((observed) => {
    if (observed !== phase || !reporter.observe(observed)) return;
    setCursor((value) => Math.min(value + 1, phases.length));
  }, [phase, phases.length, reporter]);
  const evidenceConfig = evidenceRenderConfig(request.scenario, phase);
  const observedPlugins = useObservedEvidencePlugins(phase, advance);
  const onCommit = useCallback(({ markdown, scenario: renderedScenario, isComplete }) => {
    if (phase.startsWith('image-')) return;
    if (phase === 'subpaths-resolved') return ALL_SUBPATHS_RESOLVED && advance(phase);
    if (phase === 'headings-lists-tables') return /^# Streamdown RN/m.test(markdown) && markdown.includes('| Metric | Value |') && advance(phase);
    if (phase === 'code-math-mermaid') return markdown.includes('```js') && markdown.includes('$$') && markdown.includes('```mermaid') && advance(phase);
    if (phase === 'cjk-rtl-text') return markdown.includes('中文') && markdown.includes('مرحبا') && advance(phase);
    if (phase === 'chunk-32') return markdown.length === 32 && advance(phase);
    if (phase === 'chunk-64') return markdown.length === 64 && advance(phase);
    if (phase === 'stream-complete') return isComplete && markdown === STREAM && advance(phase);
    if (phase === 'code-incomplete') return !isComplete && markdown.includes('const incomplete') && advance(phase);
    if (phase.startsWith('code-') || phase.startsWith('math-')) return;
    if (phase === 'font-scale' && PixelRatio.getFontScale() < 1.3) return;
    if (renderedScenario === evidenceConfig.scenario) advance(phase);
  }, [advance, evidenceConfig.scenario, phase]);
  const image = phase.startsWith('image-') ? <EvidenceImage phase={phase} onPassed={() => advance(phase)} /> : null;
  return <View style={{ flex: 1 }}>
    <AutomatedEvidenceFixture config={evidenceConfig} metrics={metrics} capabilities={capabilities} pluginsOverride={observedPlugins} onEvidenceCommit={onCommit} />
    {image ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, padding: 16, backgroundColor: '#ffffff' }}>{image}</View> : null}
  </View>;
}

function EvidenceImage({ phase, onPassed }) {
  const [retryStarted, setRetryStarted] = useState(false);
  if (phase === 'image-retry' && !retryStarted) {
    return <Button accessibilityLabel="Retry failed image" onPress={() => setRetryStarted(true)}>Retry failed image</Button>;
  }
  const uri = phase === 'image-loading' ? 'https://10.255.255.1/streamdown-loading.png' : `https://127.0.0.1:1/${phase}.png`;
  return <Image accessibilityLabel={phase} source={{ uri }} style={{ width: 80, height: 80 }} onLoadStart={() => { if (phase === 'image-loading' || (phase === 'image-retry' && retryStarted)) onPassed(); }} onError={() => { if (phase === 'image-error') onPassed(); }} />;
}

function AutomatedEvidenceFixture({ config, metrics, capabilities, pluginsOverride, onEvidenceCommit }) {
  const { scenario, theme = 'light', direction = 'ltr', layout = 'narrow', checkpoint, animated, reducedMotion } = config;
  const streaming = scenario === 'streaming';
  const incompleteCode = scenario === 'code-incomplete';
  const source = STREAM;
  const requested = checkpoint === 'complete' ? source.length : Number.parseInt(checkpoint, 10);
  const length = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), source.length) : source.length;
  const markdown = streaming ? source.slice(0, length) : SCENARIOS[scenario] || STATIC;
  const scenarioPlugins = SCENARIO_PLUGINS[scenario] || PLUGINS;
  const backgroundColor = theme === 'dark' ? '#111827' : '#ffffff';
  const foregroundColor = theme === 'dark' ? '#e5e7eb' : '#111827';
  const isComplete = incompleteCode ? false : (!streaming || length >= source.length);
  return (
    <SafeAreaView style={{ flex: 1, paddingTop: StatusBar.currentHeight || 24, backgroundColor }} testID="fixture-root">
      <ScrollView contentContainerStyle={{ padding: 16, width: layout === 'wide' ? 720 : 360, maxWidth: '100%', alignSelf: 'center' }}>
        <Text style={{ color: foregroundColor }}>Device evidence: {scenario}</Text>
        <Profiler id="streamdown-evidence" onRender={() => onEvidenceCommit({ markdown, scenario, isComplete })}>
          <Streamdown mode={streaming || incompleteCode ? 'streaming' : 'static'} theme={theme} dir={direction} animated={animated} reducedMotion={reducedMotion} isAnimating={Boolean(animated && !isComplete)} isComplete={isComplete} instrumentation={metrics} plugins={pluginsOverride ?? scenarioPlugins} capabilities={capabilities}>{markdown}</Streamdown>
        </Profiler>
      </ScrollView>
    </SafeAreaView>
  );
}
