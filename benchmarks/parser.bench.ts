import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';
import { parseSemanticDocument } from '../src/core/parser';
import { loadCorpus, protocol } from './common';

const corpus = loadCorpus();
const samples: number[] = [];
for (let index = 0; index < protocol.warmups + protocol.samples; index++) {
  const started = performance.now();
  parseSemanticDocument(corpus.text);
  const duration = performance.now() - started;
  if (index >= protocol.warmups) samples.push(duration);
}
samples.sort((a, b) => a - b);
const percentile = (fraction: number) => samples[Math.ceil(samples.length * fraction) - 1] ?? 0;
process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  runId: randomUUID(),
  timestamp: new Date().toISOString(),
  status: 'characterization',
  environment: { platform: 'node', engine: `node-${process.version}`, buildType: 'host', host: hostname() },
  corpus: { sha256: corpus.sha256, bytes: corpus.bytes, chunkSize: protocol.chunkSize },
  metrics: { parserP50Ms: percentile(0.5), parserP95Ms: percentile(0.95), parserMaxMs: samples[samples.length - 1] ?? 0 },
  evidence: ['Host characterization only; does not satisfy release-Hermes gates.'],
  blockers: [],
})}\n`);
