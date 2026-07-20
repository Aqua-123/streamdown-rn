import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBenchmarkCorpus } from '../fixtures/expo54/benchmarkCorpus';

export interface BenchmarkProtocol {
  corpus: string;
  corpusSha256: string;
  expandedBytes: number;
  chunkSize: number;
  warmups: number;
  samples: number;
}

export const protocol = JSON.parse(readFileSync(resolve('benchmarks/protocol.json'), 'utf8')) as BenchmarkProtocol;

export function loadCorpus(): { text: string; bytes: number; sha256: string } {
  const text = buildBenchmarkCorpus(protocol.expandedBytes);
  const bytes = Buffer.byteLength(text);
  if (bytes !== protocol.expandedBytes) throw new Error(`Corpus expansion produced ${bytes} bytes, expected ${protocol.expandedBytes}`);
  const sha256 = createHash('sha256').update(text).digest('hex');
  if (sha256 !== protocol.corpusSha256) throw new Error(`Corpus hash ${sha256} does not match pinned ${protocol.corpusSha256}`);
  return { text, bytes, sha256 };
}
