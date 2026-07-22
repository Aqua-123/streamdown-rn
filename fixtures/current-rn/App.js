import React, { Profiler, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, AppState, Image, Linking, PixelRatio, Platform, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { FullscreenModal, Streamdown, createStreamingInstrumentation, darkTheme, lightTheme } from 'streamdown-native';
import { ActionButton, Button, NativeLink, PanZoomSurface } from 'streamdown-native/ui';
import { createCodePlugin } from 'streamdown-native/code';
import { cjk } from 'streamdown-native/cjk';
import { createMathPlugin } from 'streamdown-native/math';
import { createBeautifulMermaidAdapter, createMermaidPlugin } from 'streamdown-native/mermaid';
import { createOfflineWebViewAdapter } from 'streamdown-native/mermaid/webview';
import { createRendererPlugin } from 'streamdown-native/renderers';
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
import { HermesEvidenceFixture } from './hermes-evidence-app';
import {
  DEVICE_SCENARIO_PHASES,
  createDeviceEvidenceCapabilities,
  createDeviceEvidenceReporter,
  parseDeviceEvidenceRequest,
} from './device-evidence';

const DEVICE_HOST = 'expo56';
const DEVICE_SCENARIOS = [
  'packed-core-and-all-subpath-launch', 'static-mixed-corpus', 'streaming-32-character-chunks',
  'link-approved-denied-failed', 'clipboard-share-file-success-cancel-fail', 'image-loading-error-retry',
  'scroll-fullscreen-focus-restore', 'pan-zoom-reduced-motion', 'code-supported-unsupported-incomplete',
  'math-native-and-fallback', 'mermaid-native-webview-fallback-retry', 'rtl-cjk-font-scale-theme-layout',
];
const ALL_SUBPATHS_RESOLVED = [Streamdown, Button, createCodePlugin, cjk, createMathPlugin, createMermaidPlugin, createOfflineWebViewAdapter, createRendererPlugin].every(Boolean);

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
  links: '[Approved](https://evidence.invalid/approved) [Denied](https://evidence.invalid/denied) [Failed](https://evidence.invalid/failed)',
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
      setConfig({ scenario: params.get('scenario') || 'harness', theme: params.get('theme') || 'light', direction: params.get('direction') || 'ltr', layout: params.get('layout') || 'narrow', checkpoint: params.get('checkpoint') || '', evidenceUrl: url });
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
  const evidenceRequest = useMemo(() => parseDeviceEvidenceRequest(config.evidenceUrl, { host: DEVICE_HOST, platform: Platform.OS, scenarios: DEVICE_SCENARIOS }), [config.evidenceUrl]);
  if (config.evidenceUrl?.includes('hermesEvidence=')) return <HermesEvidenceFixture evidenceUrl={config.evidenceUrl} metrics={metrics} plugins={PLUGINS} />;
  if (config.evidenceUrl?.includes('://evidence')) {
    return evidenceRequest ? <DeviceEvidenceFixture request={evidenceRequest} metrics={metrics} /> : <Text testID="device-evidence-rejected">Invalid device evidence request</Text>;
  }
  if (config.scenario === 'harness') return <HarnessApp initialTheme={config.theme} allPlugins={PLUGINS} metrics={metrics} capabilities={capabilities} />;
  return <AutomatedFixture config={config} metrics={metrics} capabilities={capabilities} />;
}

const ACTION_PHASE_STATUS = {
  'link-approved': 'success', 'link-denied': 'denied', 'link-failed': 'failed',
  'clipboard-success': 'success', 'share-cancelled': 'cancelled', 'file-failed': 'failed',
};

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
    'mermaid-native': 'mermaid', 'mermaid-webview-fallback': 'mermaid-webview-fallback', 'mermaid-retry': 'mermaid-retry',
    'fullscreen-opened': 'fullscreen', 'pan-zoom-rendered': 'mermaid', 'zoom-bounded': 'mermaid', 'reduced-motion-rendered': 'streaming',
  }[phase] || (scenario.startsWith('link-') ? 'links' : 'static');
  return {
    scenario: rendered,
    checkpoint: '',
    direction: phase === 'rtl-cjk' ? 'rtl' : 'ltr',
    theme: phase === 'dark-wide-layout' ? 'dark' : 'light',
    layout: phase === 'dark-wide-layout' ? 'wide' : 'narrow',
    reducedMotion: phase === 'reduced-motion-rendered',
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
    if (phase.startsWith('mermaid-')) {
      const base = phase === 'mermaid-native' ? mermaid : phase === 'mermaid-webview-fallback' ? mermaidWebViewFallback : mermaidError;
      let attempts = 0;
      return { ...PLUGINS, mermaid: { ...base, async render(source, theme) {
        attempts += 1;
        try {
          const result = await base.render(source, theme);
          if (phase === 'mermaid-native' && result?.content) defer();
          return result;
        } catch (error) {
          if (phase === 'mermaid-webview-fallback' || (phase === 'mermaid-retry' && attempts >= 2)) defer();
          throw error;
        }
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
  const [focusRestored, setFocusRestored] = useState(false);
  const [panScale, setPanScale] = useState(null);
  const phase = phases[Math.min(cursor, phases.length - 1)];
  const nativeCapabilities = useMemo(() => createFixtureCapabilities(), []);
  const negativeCapabilities = useMemo(() => createDeviceEvidenceCapabilities(), []);
  const capabilities = useMemo(() => ({
    ...nativeCapabilities,
    links: phase === 'link-failed' ? negativeCapabilities.links : {
      approve: () => new Promise((resolve) => Alert.alert('Open evidence link?', 'Exercise the native approval transition.', [
        { text: 'Deny', style: 'cancel', onPress: () => resolve({ status: 'denied' }) },
        { text: 'Open', onPress: () => resolve({ status: 'success' }) },
      ], { cancelable: false })),
      open: async (url) => {
        try { await Linking.openURL(url); return { status: 'success' }; } catch (error) { return { status: 'failed', error }; }
      },
    },
    share: negativeCapabilities.share,
    files: negativeCapabilities.files,
    focus: { restore: () => setFocusRestored(true) },
    gestures: { renderPanZoom: ({ children, scale }) => <PanZoomObservation scale={scale} onSeen={setPanScale}>{children}</PanZoomObservation> },
  }), [nativeCapabilities, negativeCapabilities, phase]);
  const reporter = useMemo(() => createDeviceEvidenceReporter(request, {
    release: !__DEV__, hermes: Boolean(globalThis.HermesInternal), appState: 'foreground',
  }), [request]);
  const advance = useCallback((observed) => {
    if (observed !== phase || !reporter.observe(observed)) return;
    setCursor((value) => Math.min(value + 1, phases.length));
  }, [phase, phases.length, reporter]);

  useEffect(() => {
    if (phase === 'focus-restored' && focusRestored) advance(phase);
    if (phase === 'pan-zoom-rendered' && panScale === 3) advance(phase);
    if (phase === 'zoom-bounded' && panScale === 3) advance(phase);
  }, [advance, focusRestored, panScale, phase]);

  const config = evidenceRenderConfig(request.scenario, phase);
  const observedPlugins = useObservedEvidencePlugins(phase, advance);
  const onCommit = useCallback(({ markdown, scenario, isComplete }) => {
    if (ACTION_PHASE_STATUS[phase] || phase.startsWith('image-') || phase === 'fullscreen-opened' || phase === 'focus-restored' || phase === 'pan-zoom-rendered' || phase === 'zoom-bounded') return;
    if (phase === 'subpaths-resolved') return ALL_SUBPATHS_RESOLVED && advance(phase);
    if (phase === 'headings-lists-tables') return /^# Streamdown RN/m.test(markdown) && markdown.includes('| Metric | Value |') && advance(phase);
    if (phase === 'code-math-mermaid') return markdown.includes('```js') && markdown.includes('$$') && markdown.includes('```mermaid') && advance(phase);
    if (phase === 'cjk-rtl-text') return markdown.includes('中文') && markdown.includes('مرحبا') && advance(phase);
    if (phase === 'chunk-32') return markdown.length === 32 && advance(phase);
    if (phase === 'chunk-64') return markdown.length === 64 && advance(phase);
    if (phase === 'stream-complete') return isComplete && markdown === STREAM && advance(phase);
    if (phase === 'code-incomplete') return !isComplete && markdown.includes('const incomplete') && advance(phase);
    if (phase.startsWith('code-') || phase.startsWith('math-') || phase.startsWith('mermaid-')) return;
    if (phase === 'font-scale' && PixelRatio.getFontScale() < 1.3) return;
    if (scenario === config.scenario) advance(phase);
  }, [advance, config.scenario, phase]);

  const action = ACTION_PHASE_STATUS[phase];
  const content = action ? <EvidenceAction phase={phase} capabilities={capabilities} expected={action} onPassed={() => advance(phase)} />
    : phase.startsWith('image-') ? <EvidenceImage phase={phase} onPassed={() => advance(phase)} />
      : phase === 'fullscreen-opened' || phase === 'focus-restored' ? <EvidenceFullscreen phase={phase} capabilities={capabilities} onClose={() => advance('fullscreen-opened')} />
        : phase === 'pan-zoom-rendered' || phase === 'zoom-bounded' ? <PanZoomSurface capabilities={capabilities} initialScale={99}><Text>Pan and zoom evidence</Text></PanZoomSurface>
          : null;
  return <View style={{ flex: 1 }}>
    <AutomatedFixture config={config} metrics={metrics} capabilities={capabilities} pluginsOverride={observedPlugins} onEvidenceCommit={onCommit} />
    {content ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, padding: 16, backgroundColor: '#ffffff' }}>{content}</View> : null}
  </View>;
}

function PanZoomObservation({ children, scale, onSeen }) {
  useEffect(() => onSeen(scale), [onSeen, scale]);
  return children;
}

function EvidenceAction({ phase, capabilities, expected, onPassed }) {
  const onResult = (result) => { if (result.status === expected) onPassed(); };
  if (phase.startsWith('link-')) {
    const outcome = phase.slice(5);
    const url = outcome === 'failed' ? 'https://evidence.invalid/failed' : 'https://example.com/';
    return <NativeLink url={url} capabilities={capabilities} onResult={onResult}><Text>Exercise {phase}</Text></NativeLink>;
  }
  const action = phase === 'clipboard-success' ? () => capabilities.clipboard.writeText('streamdown evidence')
    : phase === 'share-cancelled' ? () => capabilities.share.shareText('streamdown evidence')
      : () => capabilities.files.save({ basename: 'evidence', extension: 'txt', mimeType: 'text/plain', content: 'evidence' });
  return <ActionButton label={`Exercise ${phase}`} icon="Run" onAction={action} onResult={onResult} />;
}

function EvidenceImage({ phase, onPassed }) {
  const [retryStarted, setRetryStarted] = useState(false);
  if (phase === 'image-retry' && !retryStarted) {
    return <ActionButton label="Retry failed image" icon="Retry" onAction={() => { setRetryStarted(true); return { status: 'success' }; }} />;
  }
  const uri = phase === 'image-loading' ? 'https://10.255.255.1/streamdown-loading.png' : `https://127.0.0.1:1/${phase}.png`;
  return <Image accessibilityLabel={phase} source={{ uri }} style={{ width: 80, height: 80 }} onLoadStart={() => { if (phase === 'image-loading' || (phase === 'image-retry' && retryStarted)) onPassed(); }} onError={() => { if (phase === 'image-error') onPassed(); }} />;
}

function EvidenceFullscreen({ phase, capabilities, onClose }) {
  return <FullscreenModal visible={phase === 'fullscreen-opened'} label="Device evidence fullscreen" closeLabel="Close and restore focus" capabilities={capabilities} restoreTarget="device-evidence-opener" onClose={onClose}><Text>Close this modal to prove focus restoration.</Text></FullscreenModal>;
}

function AutomatedFixture({ config, metrics, capabilities, pluginsOverride, onEvidenceCommit }) {
  const { scenario, theme, direction, layout, checkpoint, animated, reducedMotion } = config;
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
  const selectedTheme = theme === 'dark' ? darkTheme : lightTheme;
  const { background: backgroundColor, foreground: foregroundColor } = selectedTheme.primitives;
  return (
    <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0, backgroundColor }} testID="fixture-root">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingTop: 24, width: layout === 'wide' ? 720 : 360, maxWidth: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: foregroundColor }}>Fixture: {scenario}</Text>
        <Text style={{ color: foregroundColor }}>Fixture state: {scenario}</Text>
        <Profiler id="streamdown" onRender={(_id, phase, duration) => { console.log('STREAMDOWN_BENCHMARK', JSON.stringify({ type: 'react-commit', phase, durationMs: duration })); onEvidenceCommit?.({ markdown, scenario, isComplete: incompleteCode ? false : ((!streaming && !benchmarking) || length >= source.length) }); }}>
          <Streamdown
            mode={streamMode ? 'streaming' : 'static'}
            theme={selectedTheme}
            dir={direction}
            animated={animated ?? (streaming || benchmarking)}
            reducedMotion={reducedMotion}
            isAnimating={(streaming || benchmarking) && !checkpoint}
            isComplete={incompleteCode ? false : ((!streaming && !benchmarking) || length >= source.length)}
            instrumentation={metrics}
            plugins={pluginsOverride ?? scenarioPlugins}
            capabilities={capabilities}
          >{markdown}</Streamdown>
        </Profiler>
      </ScrollView>
      <FullscreenModal visible={scenario === 'fullscreen'} label="Fullscreen fixture" closeLabel="Exit fullscreen" capabilities={capabilities} onClose={() => {}} color={foregroundColor} backgroundColor={backgroundColor}>
        <Text style={{ color: foregroundColor }}>Fullscreen content</Text>
      </FullscreenModal>
    </SafeAreaView>
  );
}
