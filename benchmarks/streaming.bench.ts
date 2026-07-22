import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';
import { INITIAL_REGISTRY } from '../src/core/types';
import { appendContent, processNewContent } from '../src/core/splitter';
import { loadCorpus, protocol } from './common';

const corpus = loadCorpus();
process.env.NODE_ENV = 'production';
const longBlockSizes = [64, 128, 256, 512].map((kib) => kib * 1024);
const longBlockMs = longBlockSizes.map((bytes) => {
  const started = performance.now();
  processNewContent(INITIAL_REGISTRY, 'a'.repeat(bytes));
  return performance.now() - started;
});
const longBlockMaxStepRatio = Math.max(
  ...longBlockMs.slice(1).map((elapsed, index) => elapsed / Math.max(longBlockMs[index], 0.01))
);
const longBlockGuard = longBlockMs.at(-1)! < 500 && longBlockMaxStepRatio < 8;
const incrementalSources = {
  paragraph: (bytes: number) => 'a'.repeat(bytes),
  stablePrefix: (bytes: number) => `head\n\n${'a'.repeat(bytes)}`,
  lineDense: (bytes: number) => 'a\n'.repeat(Math.ceil(bytes / 2)).slice(0, bytes),
  code: (bytes: number) => `\`\`\`ts\n${'a'.repeat(bytes)}`,
  component: (bytes: number) => `[{c:"Card",p:{"value":"${'a'.repeat(bytes)}`,
};
const incrementalLongBlockMs = Object.fromEntries(Object.entries(incrementalSources).map(([kind, makeSource]) => {
  const timings = longBlockSizes.map((bytes) => {
    const source = makeSource(bytes);
    let best = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < 3; attempt++) {
      let registry = INITIAL_REGISTRY;
      const started = performance.now();
      for (let offset = 0; offset < source.length; offset += 32) {
        registry = appendContent(registry, source.slice(offset, offset + 32));
      }
      best = Math.min(best, performance.now() - started);
    }
    return best;
  });
  return [kind, timings];
}));
export const passesIncrementalGrowthGuard = (timings: number[]) => {
  const ratios = timings.slice(1).map((elapsed, index) => elapsed / Math.max(timings[index], 0.01));
  return timings.at(-1)! < 250 && Math.max(...ratios) < 3.25;
};
if (passesIncrementalGrowthGuard([1, 4, 16, 64])) throw new Error('Quadratic growth guard self-check failed');
const incrementalLongBlockGuard = Object.values(incrementalLongBlockMs).every(passesIncrementalGrowthGuard);
const manyBlockCounts = [1024, 2048, 4096, 8192];
const manyBlockMs = manyBlockCounts.map((count) => {
  const source = Array.from({ length: count }, (_, index) => `# H${index}\n\n`).join('');
  let best = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = performance.now();
    processNewContent(INITIAL_REGISTRY, source);
    best = Math.min(best, performance.now() - started);
  }
  return best;
});
const manyBlockGuard = passesIncrementalGrowthGuard(manyBlockMs);
const samples: number[] = [];
let stableBlocks = 0;
for (let run = 0; run < protocol.warmups + protocol.samples; run++) {
  let registry = INITIAL_REGISTRY;
  let accumulated = '';
  const runSamples: number[] = [];
  for (let offset = 0; offset < corpus.text.length; offset += protocol.chunkSize) {
    accumulated += corpus.text.slice(offset, offset + protocol.chunkSize);
    const started = performance.now();
    registry = processNewContent(registry, accumulated, true, corpus.text.slice(offset, offset + protocol.chunkSize));
    runSamples.push(performance.now() - started);
  }
  stableBlocks = registry.blocks.length;
  if (run >= protocol.warmups) samples.push(...runSamples);
}
samples.sort((a, b) => a - b);
const percentile = (fraction: number) => samples[Math.ceil(samples.length * fraction) - 1] ?? 0;
process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  runId: randomUUID(),
  timestamp: new Date().toISOString(),
  status: longBlockGuard && incrementalLongBlockGuard && manyBlockGuard ? 'characterization' : 'failed',
  environment: { platform: 'node', engine: `node-${process.version}`, buildType: 'host', host: hostname() },
  corpus: { sha256: corpus.sha256, bytes: corpus.bytes, chunkSize: protocol.chunkSize },
  metrics: {
    splitterP50Ms: percentile(0.5),
    splitterP95Ms: percentile(0.95),
    splitterMaxMs: samples[samples.length - 1] ?? 0,
    stableBlocks,
    longBlockWholeAppendMs: Object.fromEntries(longBlockSizes.map((bytes, index) => [bytes, longBlockMs[index]])),
    longBlockMaxStepRatio,
    incrementalLongBlockMs: Object.fromEntries(Object.entries(incrementalLongBlockMs).map(([kind, timings]) => [kind, Object.fromEntries(longBlockSizes.map((bytes, index) => [bytes, timings[index]]))])),
    manyBlockWholeAppendMs: Object.fromEntries(manyBlockCounts.map((count, index) => [count, manyBlockMs[index]])),
  },
  evidence: ['Host splitter characterization only; React commit/frame/heap metrics require release Hermes.'],
  blockers: [],
})}\n`);
if (!longBlockGuard || !incrementalLongBlockGuard || !manyBlockGuard) process.exitCode = 1;
