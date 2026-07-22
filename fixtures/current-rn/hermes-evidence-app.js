import React, { Profiler, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { Streamdown } from 'streamdown-rn';
import {
  beginHermesAppend, completeHermesEvidence, emitHermesBundleReceipt, emitHermesEvent,
  endHermesAppend, hermesHeapBytes, hermesNowNs, readHermesEvidenceConfig,
  runHermesJsFrameLoop, startHermesEvidence, stopHermesEvidence,
} from '@streamdown-rn/hermes-evidence';
import { BENCHMARK_CORPUS_SHA256, buildBenchmarkCorpus } from './benchmarkCorpus';

const CORPUS = buildBenchmarkCorpus();
const validHash = (value, size) => new RegExp(`^[a-f0-9]{${size}}$`).test(value ?? '');
function validConfig(config) {
  return config?.schemaVersion === 1 && typeof config.runId === 'string'
    && validHash(config.source?.commit, 40) && validHash(config.source?.packageSha256, 64)
    && config.corpus?.sha256 === BENCHMARK_CORPUS_SHA256 && config.corpus.bytes === 10_240
    && config.corpus.chunkSize === 32 && Number.isSafeInteger(config.warmups)
    && Number.isSafeInteger(config.samples) && config.samples > 0
    && ['core', 'optional'].every((scope) => Number.isSafeInteger(config.bundles?.[scope]?.bytes)
      && validHash(config.bundles?.[scope]?.sha256, 64)
      && Number.isSafeInteger(config.bundles?.[scope]?.optionalMarkerCount));
}

export function HermesEvidenceFixture({ evidenceUrl, metrics, plugins }) {
  const config = useMemo(() => readHermesEvidenceConfig(evidenceUrl), [evidenceUrl]);
  const [phase, setPhase] = useState('idle');
  const [length, setLength] = useState(0);
  const pending = useRef(null);
  const firstStart = useRef(0);
  const optionalStart = useRef(0);
  const firstRendered = useRef(false);
  const optionalRendered = useRef(false);

  useEffect(() => {
    if (!validConfig(config) || !globalThis.HermesInternal) return undefined;
    startHermesEvidence();
    const stopFrames = runHermesJsFrameLoop();
    firstStart.current = hermesNowNs();
    emitHermesEvent({ type: 'heap', scope: 'core', phase: 'start', bytes: hermesHeapBytes() });
    setPhase('core'); setLength(config.corpus.chunkSize);
    return () => { stopFrames(); stopHermesEvidence(); };
  }, [config]);

  useEffect(() => {
    if (phase !== 'core' || length >= CORPUS.length || pending.current) return undefined;
    const timer = setTimeout(() => {
      const appendId = `append-${length + config.corpus.chunkSize}`;
      const before = metrics.snapshot();
      const startNs = hermesNowNs();
      pending.current = { appendId, startNs, stableRenders: before.stableRenders, stableParses: before.stableParses };
      beginHermesAppend(appendId);
      setLength((value) => Math.min(value + config.corpus.chunkSize, CORPUS.length));
    }, 16);
    return () => clearTimeout(timer);
  }, [config, length, metrics, phase]);

  useLayoutEffect(() => {
    if (phase !== 'core' || !pending.current) return;
    const sample = pending.current;
    pending.current = null;
    const durationNs = endHermesAppend(sample.appendId);
    if (!Number.isSafeInteger(durationNs) || durationNs < 0) return;
    const after = metrics.snapshot();
    const stableRerenders = Math.max(0, (after.stableRenders - sample.stableRenders) - (after.stableParses - sample.stableParses));
    emitHermesEvent({ type: 'append', appendId: sample.appendId, startNs: 0, commitNs: durationNs, stableRerenders });
  }, [length, metrics, phase]);

  useEffect(() => {
    if (phase !== 'core' || length < CORPUS.length) return;
    emitHermesEvent({ type: 'heap', scope: 'core', phase: 'end', bytes: hermesHeapBytes() });
    optionalStart.current = hermesNowNs();
    emitHermesEvent({ type: 'heap', scope: 'optional', phase: 'start', bytes: hermesHeapBytes() });
    setPhase('optional');
  }, [length, phase]);

  useEffect(() => {
    if (phase !== 'optional' || !optionalRendered.current) return undefined;
    const timer = setTimeout(() => {
      const snapshot = metrics.snapshot();
      const parserSamples = snapshot.parserDurationNs.slice(config.warmups, config.warmups + config.samples);
      if (parserSamples.length !== config.samples) return;
      for (const durationNs of parserSamples) emitHermesEvent({ type: 'parser', durationNs });
      emitHermesEvent({ type: 'heap', scope: 'optional', phase: 'end', bytes: hermesHeapBytes() });
      emitHermesEvent({ type: 'cache', entries: snapshot.cacheEntries });
      for (const scope of ['core', 'optional']) emitHermesEvent({ type: 'bundle', scope, bytes: config.bundles[scope].bytes, optionalMarkerCount: config.bundles[scope].optionalMarkerCount });
      emitHermesBundleReceipt(config.bundles);
      stopHermesEvidence();
      setPhase('done');
      completeHermesEvidence({ runId: config.runId, source: config.source, corpus: config.corpus });
    }, 2_000);
    return () => clearTimeout(timer);
  }, [config, metrics, phase]);

  if (!validConfig(config) || !globalThis.HermesInternal) return <Text testID="hermes-evidence-rejected">Invalid Release-Hermes evidence request</Text>;
  if (phase === 'idle') return <Text>Preparing Release-Hermes evidence</Text>;
  if (phase === 'done') return <Text testID="hermes-evidence-complete">Release-Hermes evidence complete</Text>;
  const scope = phase === 'optional' ? 'optional' : 'core';
  const markdown = phase === 'optional' ? CORPUS : CORPUS.slice(0, length);
  return <SafeAreaView style={{ flex: 1 }}><View style={{ flex: 1 }}>
    <Profiler id={`hermes-${scope}`} onRender={(_id, _renderPhase, durationMs) => {
      emitHermesEvent({ type: 'commit', scope, durationNs: Math.max(0, Math.round(durationMs * 1_000_000)) });
      const now = hermesNowNs();
      if (scope === 'core' && !firstRendered.current) {
        firstRendered.current = true;
        emitHermesEvent({ type: 'first-render', startNs: firstStart.current, endNs: now });
        emitHermesEvent({ type: 'startup', scope: 'core', startNs: firstStart.current, endNs: now });
      }
      if (scope === 'optional' && !optionalRendered.current) {
        optionalRendered.current = true;
        emitHermesEvent({ type: 'startup', scope: 'optional', startNs: optionalStart.current, endNs: now });
      }
    }}>
      <Streamdown mode={scope === 'core' ? 'streaming' : 'static'} isAnimating={scope === 'core'} isComplete={scope === 'optional' || length >= CORPUS.length} instrumentation={metrics} plugins={scope === 'optional' ? plugins : undefined}>{markdown}</Streamdown>
    </Profiler>
  </View></SafeAreaView>;
}
