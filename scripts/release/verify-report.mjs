import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReleaseReport, isReleaseReady } from './report.mjs';

const manifest = JSON.parse(fs.readFileSync('parity/manifest.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('parity/upstream.json', 'utf8'));
const report = createReleaseReport();
assert.equal(report.upstream.commit, inventory.upstream.commit);
assert.equal(report.upstream.cases, inventory.caseCount);
assert.equal(report.parity.implemented + report.parity.planned, manifest.entries.length);
assert.equal(Object.values(report.parity.byClassification).reduce((sum, count) => sum + count, 0), manifest.entries.length);
assert.equal(report.parity.nativeAdaptations, manifest.entries.filter((entry) => entry.classification === 'adapted').length);
assert.equal(Object.values(report.parity.knownDivergences).reduce((sum, count) => sum + count, 0), manifest.entries.filter((entry) => entry.classification === 'browser-only' || entry.classification === 'known-upstream-bug').length);
assert.deepEqual(report.visuals.required, ['tests/visual/baselines/ios.manifest.json', 'tests/visual/baselines/android.manifest.json']);
assert.equal(report.visuals.status, report.visuals.integrity === 'valid' && report.visuals.completeness === 'complete' ? 'available' : 'blocked');
assert.equal(report.benchmarks.releaseEvidence, report.benchmarks.deltas[0].status === 'pass' ? 'available' : 'blocked');
assert.equal(report.releaseReady, isReleaseReady(report));
const ready = {
  parity: { status: 'complete' }, compatibility: { status: 'pass' }, blockers: [],
  benchmarks: { releaseEvidence: 'available' }, visuals: { status: 'available' },
};
assert.equal(isReleaseReady(ready), true);
for (const blocked of [
  { benchmarks: { releaseEvidence: 'blocked' } },
  { visuals: { status: 'blocked' } },
  { compatibility: { status: 'blocked' } },
  { parity: { status: 'incomplete' } },
  { blockers: ['manual evidence missing'] },
]) assert.equal(isReleaseReady({ ...ready, ...blocked }), false);
console.log('Release report matches the pinned ledger and evidence schemas.');
