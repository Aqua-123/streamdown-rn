import React, { Profiler, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Streamdown } from 'streamdown-rn';
import { DEFAULT_SAMPLE, HARNESS_SAMPLES } from './harness-samples';
import { initialPlaybackState, playbackReducer, progressPercent } from './harness-state';

const PALETTES = {
  light: {
    canvas: '#f4f4f5',
    surface: '#ffffff',
    surfaceRaised: '#fafafa',
    border: '#e4e4e7',
    borderStrong: '#d4d4d8',
    text: '#18181b',
    muted: '#71717a',
    faint: '#a1a1aa',
    accent: '#18181b',
    accentText: '#ffffff',
    tint: '#f1f1f3',
    success: '#16a34a',
    warning: '#f59e0b',
    track: '#e4e4e7',
  },
  dark: {
    canvas: '#09090b',
    surface: '#18181b',
    surfaceRaised: '#202023',
    border: '#2f2f33',
    borderStrong: '#3f3f46',
    text: '#fafafa',
    muted: '#a1a1aa',
    faint: '#71717a',
    accent: '#fafafa',
    accentText: '#18181b',
    tint: '#27272a',
    success: '#4ade80',
    warning: '#fbbf24',
    track: '#3f3f46',
  },
};

function Panel({ children, palette, style }) {
  return (
    <View style={{ backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 22, borderCurve: 'continuous', padding: 16, ...style }}>
      {children}
    </View>
  );
}

function SectionTitle({ title, detail, palette }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }}>{title}</Text>
      {detail ? <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{detail}</Text> : null}
    </View>
  );
}

function ActionButton({ label, onPress, palette, primary = false, disabled = false, testID }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 44,
        flexGrow: 1,
        flexBasis: 72,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 13,
        borderRadius: 13,
        borderCurve: 'continuous',
        borderWidth: primary ? 0 : 1,
        borderColor: palette.border,
        backgroundColor: primary ? palette.accent : palette.surfaceRaised,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: primary ? palette.accentText : palette.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Segment({ options, value, onChange, palette, label }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: palette.tint, padding: 3, borderRadius: 12, borderCurve: 'continuous' }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              borderRadius: 9,
              borderCurve: 'continuous',
              backgroundColor: selected ? palette.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: selected ? palette.text : palette.muted, fontSize: 12, fontWeight: selected ? '700' : '600' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({ label, detail, value, onValueChange, palette, testID }) {
  return (
    <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '600' }}>{label}</Text>
        {detail ? <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 16 }}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        testID={testID}
        value={value}
        trackColor={{ false: palette.track, true: palette.success }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function Metric({ label, value, palette }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '40%', minWidth: 110 }}>
      <Text style={{ color: palette.text, fontSize: 17, fontWeight: '750', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

export function HarnessApp({ allPlugins, metrics, capabilities }) {
  const { width } = useWindowDimensions();
  const [theme, setTheme] = useState('light');
  const [direction, setDirection] = useState('ltr');
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE.id);
  const [streamingMode, setStreamingMode] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [isComplete, setIsComplete] = useState(true);
  const [intervalMs, setIntervalMs] = useState(40);
  const [chunkSize, setChunkSize] = useState(12);
  const [showSource, setShowSource] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pluginState, setPluginState] = useState({ code: true, math: true, mermaid: true, cjk: true, renderers: true });
  const [playback, dispatch] = useReducer(playbackReducer, initialPlaybackState);
  const lastCommitMs = useRef(0);
  const commitCount = useRef(0);
  const palette = PALETTES[theme];
  const sample = HARNESS_SAMPLES.find((item) => item.id === sampleId) || DEFAULT_SAMPLE;
  const total = sample.markdown.length;
  const percent = streamingMode ? progressPercent(playback.cursor, total) : 100;
  const compact = width < 430;

  useEffect(() => {
    if (playback.status !== 'running') return undefined;
    const timer = setTimeout(() => dispatch({ type: 'tick', total, chunkSize }), intervalMs);
    return () => clearTimeout(timer);
  }, [chunkSize, intervalMs, playback.cursor, playback.status, total]);

  useEffect(() => {
    if (playback.status === 'complete') setIsComplete(true);
  }, [playback.status]);

  const enabledPlugins = useMemo(() => Object.fromEntries(
    Object.entries(allPlugins).filter(([key]) => pluginState[key] !== false),
  ), [allPlugins, pluginState]);

  const markdown = streamingMode ? sample.markdown.slice(0, playback.cursor) : sample.markdown;
  const status = !streamingMode ? 'Static preview' : playback.status === 'running' ? 'Streaming' : playback.status === 'complete' ? 'Complete' : playback.status === 'paused' ? 'Paused' : 'Ready to stream';
  const statusColor = playback.status === 'running' ? palette.success : playback.status === 'complete' || !streamingMode ? palette.text : palette.warning;

  const chooseSample = (nextId) => {
    setSampleId(nextId);
    setStreamingMode(false);
    setIsComplete(true);
    dispatch({ type: 'reset' });
  };
  const start = () => {
    setStreamingMode(true);
    setIsComplete(false);
    dispatch({ type: 'start', total });
    AccessibilityInfo.announceForAccessibility('Streaming started');
  };
  const pause = () => {
    dispatch({ type: 'pause', total });
    AccessibilityInfo.announceForAccessibility('Streaming paused');
  };
  const reset = () => {
    setStreamingMode(true);
    setIsComplete(false);
    dispatch({ type: 'reset' });
  };
  const step = () => {
    setStreamingMode(true);
    setIsComplete(false);
    dispatch({ type: 'step', total, chunkSize });
  };
  const finish = () => {
    setStreamingMode(true);
    setIsComplete(true);
    dispatch({ type: 'finish', total });
    AccessibilityInfo.announceForAccessibility('Stream complete');
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }} testID="streamdown-lab">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={palette.canvas} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: compact ? 14 : 20, paddingTop: 10, paddingBottom: 48 }}
      >
        <View style={{ paddingHorizontal: 4, paddingTop: 10, paddingBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' }}>Interactive harness</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, minHeight: 34, borderRadius: 99, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
              <Text accessibilityLiveRegion="polite" style={{ color: palette.text, fontSize: 11, fontWeight: '700' }}>{status}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: compact ? 32 : 36, lineHeight: compact ? 38 : 42, fontWeight: '800', letterSpacing: -1.2, marginTop: 8 }}>Streamdown Lab</Text>
          <Text style={{ color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 600 }}>Exercise native Markdown components, streaming transitions, plugin fallbacks, themes, and performance from one focused surface.</Text>
        </View>

        <Modal animationType="slide" transparent visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} statusBarTranslucent>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close controls" onPress={() => setSheetOpen(false)} style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' }} />
            <View style={{ maxHeight: '90%', backgroundColor: palette.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', overflow: 'hidden' }}>
              <View style={{ width: 38, height: 5, borderRadius: 99, backgroundColor: palette.borderStrong, alignSelf: 'center', marginTop: 9 }} />
              <View style={{ minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <View>
                  <Text style={{ color: palette.text, fontSize: 17, fontWeight: '750' }}>Harness controls</Text>
                  <Text style={{ color: palette.muted, fontSize: 11, marginTop: 2 }}>Playback, rendering, plugins, and appearance</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close controls" onPress={() => setSheetOpen(false)} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.tint, opacity: pressed ? 0.65 : 1 })}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M18 6 6 18M6 6l12 12" stroke={palette.text} strokeWidth={2} strokeLinecap="round" /></Svg>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 42 }}>
        <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', marginHorizontal: 4, marginBottom: 9 }}>Sample content</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingBottom: 16 }}>
          {HARNESS_SAMPLES.map((item) => {
            const selected = item.id === sample.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.id}
                onPress={() => chooseSample(item.id)}
                testID={`sample-${item.id}`}
                style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 99, borderWidth: 1, borderColor: selected ? palette.accent : palette.border, backgroundColor: selected ? palette.accent : palette.surface, opacity: pressed ? 0.72 : 1 })}
              >
                <Text style={{ color: selected ? palette.accentText : palette.text, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Panel palette={palette} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.muted, fontSize: 10, lineHeight: 15, letterSpacing: 0.7, fontWeight: '800', textTransform: 'uppercase' }}>{sample.eyebrow}</Text>
              <Text style={{ color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '750', marginTop: 1 }}>{sample.label}</Text>
              <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{sample.description}</Text>
            </View>
            <Text style={{ color: palette.faint, fontSize: 11, fontVariant: ['tabular-nums'] }}>{total.toLocaleString()} chars</Text>
          </View>

          <View style={{ height: 6, backgroundColor: palette.track, borderRadius: 99, overflow: 'hidden', marginTop: 16 }}>
            <View style={{ width: `${percent}%`, height: '100%', backgroundColor: palette.success, borderRadius: 99 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 13 }}>
            <Metric label="Progress" value={`${percent}%`} palette={palette} />
            <Metric label="Rendered" value={(streamingMode ? playback.cursor : total).toLocaleString()} palette={palette} />
            <Metric label="Commits" value={commitCount.current.toLocaleString()} palette={palette} />
            <Metric label="Last render" value={`${lastCommitMs.current.toFixed(1)}ms`} palette={palette} />
          </View>
        </Panel>

        <Panel palette={palette} style={{ marginBottom: 12 }}>
          <SectionTitle title="Playback" detail="Drive the same append lifecycle used by an LLM token stream." palette={palette} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ActionButton label="Reset" onPress={reset} palette={palette} testID="playback-reset" />
            <ActionButton label="Step" onPress={step} palette={palette} testID="playback-step" />
            <ActionButton label={playback.status === 'running' ? 'Pause' : 'Start'} onPress={playback.status === 'running' ? pause : start} palette={palette} primary testID="playback-toggle" />
            <ActionButton label="Finish" onPress={finish} palette={palette} disabled={playback.status === 'complete' && streamingMode} testID="playback-finish" />
          </View>
          <View style={{ flexDirection: compact ? 'column' : 'row', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.muted, fontSize: 11, marginBottom: 7 }}>Append interval</Text>
              <Segment label="Append interval" options={[{ label: 'Fast 16ms', value: 16 }, { label: 'Natural 40ms', value: 40 }, { label: 'Slow 120ms', value: 120 }]} value={intervalMs} onChange={setIntervalMs} palette={palette} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.muted, fontSize: 11, marginBottom: 7 }}>Chunk size</Text>
              <Segment label="Chunk size" options={[{ label: '4 chars', value: 4 }, { label: '12 chars', value: 12 }, { label: '32 chars', value: 32 }]} value={chunkSize} onChange={setChunkSize} palette={palette} />
            </View>
          </View>
        </Panel>

        <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: 'stretch', gap: 12, marginBottom: 12 }}>
          <Panel palette={palette} style={{ flex: 1 }}>
            <SectionTitle title="Render state" detail="Control Streamdown props independently." palette={palette} />
            <ToggleRow label="Streaming mode" detail="mode = streaming" value={streamingMode} onValueChange={(value) => { setStreamingMode(value); setIsComplete(!value); if (!value) dispatch({ type: 'pause', total }); }} palette={palette} testID="toggle-streaming" />
            <ToggleRow label="Animate tokens" detail="isAnimating" value={animate} onValueChange={setAnimate} palette={palette} testID="toggle-animate" />
            <ToggleRow label="Mark complete" detail="isComplete" value={isComplete} onValueChange={setIsComplete} palette={palette} testID="toggle-complete" />
          </Panel>
          <Panel palette={palette} style={{ flex: 1 }}>
            <SectionTitle title="Appearance" detail="Validate adaptive color and direction." palette={palette} />
            <Text style={{ color: palette.muted, fontSize: 11, marginBottom: 7 }}>Theme</Text>
            <Segment label="Theme" options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} value={theme} onChange={setTheme} palette={palette} />
            <Text style={{ color: palette.muted, fontSize: 11, marginTop: 14, marginBottom: 7 }}>Text direction</Text>
            <Segment label="Text direction" options={[{ label: 'Left to right', value: 'ltr' }, { label: 'Right to left', value: 'rtl' }]} value={direction} onChange={setDirection} palette={palette} />
          </Panel>
        </View>

        <Panel palette={palette} style={{ marginBottom: 12 }}>
          <SectionTitle title="Plugin matrix" detail="Disable a renderer to inspect its native fallback behavior." palette={palette} />
          <View style={{ flexDirection: compact ? 'column' : 'row', columnGap: 24 }}>
            <View style={{ flex: 1 }}>
              <ToggleRow label="Code highlighting" value={pluginState.code} onValueChange={(value) => setPluginState((state) => ({ ...state, code: value }))} palette={palette} />
              <ToggleRow label="Math renderer" value={pluginState.math} onValueChange={(value) => setPluginState((state) => ({ ...state, math: value }))} palette={palette} />
            </View>
            <View style={{ flex: 1 }}>
              <ToggleRow label="Mermaid diagrams" value={pluginState.mermaid} onValueChange={(value) => setPluginState((state) => ({ ...state, mermaid: value }))} palette={palette} />
              <ToggleRow label="CJK segmentation" value={pluginState.cjk} onValueChange={(value) => setPluginState((state) => ({ ...state, cjk: value }))} palette={palette} />
              <ToggleRow label="Vega-Lite charts" value={pluginState.renderers} onValueChange={(value) => setPluginState((state) => ({ ...state, renderers: value }))} palette={palette} />
            </View>
          </View>
        </Panel>

        <Panel palette={palette} style={{ marginBottom: 12 }}>
          <SectionTitle title="Markdown source" detail="Inspect the exact partial document currently sent to Streamdown." palette={palette} />
          <ActionButton label={showSource ? 'Hide source' : 'View source'} onPress={() => setShowSource((value) => !value)} palette={palette} />
          {showSource ? (
            <ScrollView horizontal style={{ maxHeight: 240, marginTop: 12, borderRadius: 12, backgroundColor: palette.tint }} contentContainerStyle={{ padding: 14 }}>
              <Text selectable style={{ color: palette.muted, fontSize: 11, lineHeight: 17, fontFamily: 'Menlo' }}>{markdown || 'Waiting for the first chunk…'}</Text>
            </ScrollView>
          ) : null}
        </Panel>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Panel palette={palette} style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: palette.border, borderBottomWidth: 1 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Native preview</Text>
              <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }}>{streamingMode ? `${playback.cursor.toLocaleString()} of ${total.toLocaleString()} characters` : 'Full static document'}</Text>
            </View>
          </View>
          <View style={{ padding: compact ? 16 : 22, minHeight: 220, backgroundColor: theme === 'dark' ? '#111113' : '#ffffff' }} testID="markdown-preview">
            {markdown ? (
              <Profiler id="streamdown-harness" onRender={(_id, _phase, duration) => { lastCommitMs.current = duration; commitCount.current += 1; }}>
                <Streamdown
                  mode={streamingMode ? 'streaming' : 'static'}
                  theme={theme}
                  dir={direction}
                  isAnimating={animate}
                  isComplete={isComplete}
                  instrumentation={metrics}
                  plugins={enabledPlugins}
                  capabilities={capabilities}
                >{markdown}</Streamdown>
              </Profiler>
            ) : (
              <View style={{ minHeight: 170, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: palette.faint, fontSize: 13 }}>Press Start or Step to append the first chunk.</Text>
              </View>
            )}
          </View>
        </Panel>

        <Text style={{ color: palette.faint, textAlign: 'center', fontSize: 10, lineHeight: 16 }}>Streamdown RN · Expo 56 · React Native 0.85</Text>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open harness controls"
        onPress={() => setSheetOpen(true)}
        testID="open-harness-controls"
        style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, borderWidth: 1, borderColor: palette.borderStrong, boxShadow: '0 8px 22px rgba(0,0,0,0.24)', opacity: pressed ? 0.72 : 1 })}
      >
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
          <Path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6" stroke={palette.accentText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}
