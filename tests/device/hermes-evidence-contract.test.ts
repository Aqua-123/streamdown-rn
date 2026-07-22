import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BENCHMARK_CORPUS_SHA256 as currentSha, buildBenchmarkCorpus as currentCorpus } from '../../fixtures/current-rn/benchmarkCorpus';
import { BENCHMARK_CORPUS_SHA256 as expo54Sha, buildBenchmarkCorpus as expo54Corpus } from '../../fixtures/expo54/benchmarkCorpus';

const root = path.resolve(__dirname, '../..');
const protocol = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/protocol.json'), 'utf8')) as { expandedBytes: number; corpusSha256: string };
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('physical Hermes evidence fixture', () => {
  it('renders the exact pinned protocol corpus in both hosts', () => {
    for (const [sha, corpus] of [[currentSha, currentCorpus()], [expo54Sha, expo54Corpus()]] as const) {
      expect(Buffer.byteLength(corpus)).toBe(protocol.expandedBytes);
      expect(sha).toBe(protocol.corpusSha256);
      expect(digest(corpus)).toBe(protocol.corpusSha256);
    }
  });

  it('initializes native tracing synchronously before scheduling frame callbacks', () => {
    const android = fs.readFileSync(path.join(root, 'fixtures/hermes-evidence/android/src/main/java/ai/futurix/streamdownhermesevidence/StreamdownHermesEvidenceModule.kt'), 'utf8');
    const ios = fs.readFileSync(path.join(root, 'fixtures/hermes-evidence/ios/StreamdownHermesEvidenceModule.swift'), 'utf8');
    expect(android).toContain('Function("startSession") { startSession() }');
    expect(android).toMatch(/@Synchronized\s+private fun startSession\(\)[\s\S]*?stopSession\(\)[\s\S]*?running = true[\s\S]*?main\.post \{ startFramesIfRunning\(\) \}/);
    expect(android).toMatch(/@Synchronized\s+private fun startFramesIfRunning\(\)[\s\S]*?if \(!running\) return[\s\S]*?postFrameCallback\(this\)/);
    expect(ios).toContain('Function("startSession") { self.startSession() }');
    expect(ios).toMatch(/private func startSession\(\)[\s\S]*?stopSession\(\)[\s\S]*?running = true[\s\S]*?DispatchQueue\.main\.async[\s\S]*?guard self\.running, self\.displayLink == nil else \{ return \}[\s\S]*?self\.displayLink = link/);
    expect(ios).toMatch(/private func stopSession\(\)[\s\S]*?running = false[\s\S]*?displayLink = nil[\s\S]*?lock\.unlock\(\)[\s\S]*?link\?\.invalidate\(\)/);
    expect(android).not.toContain('Function("startSession") { main.post');
    expect(ios).not.toContain('Function("startSession") { DispatchQueue.main.async');
  });
});
