import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';
import { INITIAL_REGISTRY } from '../src/core/types';
import { processNewContent } from '../src/core/splitter';
import { loadCorpus, protocol } from './common';

const corpus = loadCorpus();
process.env.NODE_ENV = 'production';
const longBlockSizes = [8, 16, 32, 64].map((kib) => kib * 1024);
const longBlockMs = longBlockSizes.map((bytes) => {
  const started = performance.now();
  processNewContent(INITIAL_REGISTRY, 'a'.repeat(bytes));
  return performance.now() - started;
});
const longBlockMaxStepRatio = Math.max(
  ...longBlockMs.slice(1).map((elapsed, index) => elapsed / Math.max(longBlockMs[index], 0.01))
);
const longBlockGuard = longBlockMs.at(-1)! < 500 && longBlockMaxStepRatio < 8;
const samples: number[] = [];
let stableBlocks = 0;
for (let run = 0; run < protocol.warmups + protocol.samples; run++) {
  let registry = INITIAL_REGISTRY;
  let accumulated = '';
  const runSamples: number[] = [];
  for (let offset = 0; offset < corpus.text.length; offset += protocol.chunkSize) {
    accumulated += corpus.text.slice(offset, offset + protocol.chunkSize);
    const started = performance.now();
    registry = processNewContent(registry, accumulated);
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
  status: longBlockGuard ? 'characterization' : 'failed',
  environment: { platform: 'node', engine: `node-${process.version}`, buildType: 'host', host: hostname() },
  corpus: { sha256: corpus.sha256, bytes: corpus.bytes, chunkSize: protocol.chunkSize },
  metrics: {
    splitterP50Ms: percentile(0.5),
    splitterP95Ms: percentile(0.95),
    splitterMaxMs: samples[samples.length - 1] ?? 0,
    stableBlocks,
    longBlockWholeAppendMs: Object.fromEntries(longBlockSizes.map((bytes, index) => [bytes, longBlockMs[index]])),
    longBlockMaxStepRatio,
  },
  evidence: ['Host splitter characterization only; React commit/frame/heap metrics require release Hermes.'],
  blockers: [],
})}\n`);
if (!longBlockGuard) process.exitCode = 1;
