import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHermesResults, verifyHermesResults } from '../benchmarks/verify-hermes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const countBy = (values, key) => Object.fromEntries([...new Set(values.map((value) => value[key]))].sort().map((name) => [name, values.filter((value) => value[key] === name).length]));

export function createReleaseReport() {
  const pkg = read('package.json');
  const inventory = read('parity/upstream.json');
  const manifest = read('parity/manifest.json');
  const matrix = read('tests/device/matrix.json');
  const evidence = read('tests/device/evidence.json');
  const protocol = read('benchmarks/protocol.json');
  const visualManifests = ['ios', 'android'].map((platform) => `tests/visual/baselines/${platform}.manifest.json`);
  const availableVisualManifests = visualManifests.filter((relative) => fs.existsSync(path.join(root, relative)));
  const implemented = manifest.entries.filter((entry) => entry.status === 'implemented').length;
  const nativeAdaptations = manifest.entries.filter((entry) => entry.classification === 'adapted');
  const divergences = manifest.entries.filter((entry) => entry.classification === 'browser-only' || entry.classification === 'known-upstream-bug');
  const characterizations = evidence.results.flatMap((result) => (result.artifacts ?? []).map((artifact) => {
    const value = read(artifact);
    return value.streamingCharacterization ? { artifact, status: value.streamingCharacterization.status, metrics: value.streamingCharacterization.appendToLayoutMs } : null;
  })).filter(Boolean);
  let hermes;
  try { hermes = verifyHermesResults(loadHermesResults()); }
  catch (error) { hermes = { status: 'blocked', reason: error.message }; }
  return {
    schemaVersion: 1,
    package: { name: pkg.name, version: pkg.version },
    upstream: { repository: inventory.upstream.repository, commit: inventory.upstream.commit, cases: inventory.caseCount },
    parity: {
      status: implemented === manifest.entries.length ? 'complete' : 'incomplete',
      implemented, planned: manifest.entries.length - implemented,
      byClassification: countBy(manifest.entries, 'classification'),
      nativeAdaptations: nativeAdaptations.length,
      knownDivergences: countBy(divergences, 'classification'),
    },
    compatibility: { hosts: matrix.hosts, platforms: matrix.platforms, evidence: evidence.results },
    benchmarks: {
      protocol: { corpusSha256: protocol.corpusSha256, budgets: protocol.budgets },
      characterizations,
      deltas: [hermes],
      releaseEvidence: hermes.status === 'pass' ? 'available' : 'blocked',
    },
    visuals: { status: availableVisualManifests.length === visualManifests.length ? 'available' : 'blocked', required: visualManifests, available: availableVisualManifests },
    blockers: evidence.blockers,
    releaseReady: implemented === manifest.entries.length && evidence.status === 'pass' && evidence.blockers.length === 0 && availableVisualManifests.length === visualManifests.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = `${JSON.stringify(createReleaseReport(), null, 2)}\n`;
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex === -1) process.stdout.write(report);
  else {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error('--output requires a path');
    fs.writeFileSync(path.resolve(output), report);
  }
}
