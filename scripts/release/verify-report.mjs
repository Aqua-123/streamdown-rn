import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReleaseReport } from './report.mjs';

const manifest = JSON.parse(fs.readFileSync('parity/manifest.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('parity/upstream.json', 'utf8'));
const report = createReleaseReport();
assert.equal(report.upstream.commit, inventory.upstream.commit);
assert.equal(report.upstream.cases, inventory.caseCount);
assert.equal(report.parity.implemented + report.parity.planned, manifest.entries.length);
assert.equal(Object.values(report.parity.byClassification).reduce((sum, count) => sum + count, 0), manifest.entries.length);
assert.equal(report.parity.nativeAdaptations, manifest.entries.filter((entry) => entry.classification === 'adapted').length);
assert.equal(Object.values(report.parity.knownDivergences).reduce((sum, count) => sum + count, 0), manifest.entries.filter((entry) => entry.classification === 'browser-only' || entry.classification === 'known-upstream-bug').length);
assert.equal(report.benchmarks.deltas[0].status, 'blocked');
assert.match(report.benchmarks.deltas[0].reason, /physical Release-Hermes candidate/i);
assert.deepEqual(report.visuals.required, ['tests/visual/baselines/ios.manifest.json', 'tests/visual/baselines/android.manifest.json']);
assert.equal(report.visuals.status, report.visuals.available.length === 2 ? 'available' : 'blocked');
assert.equal(report.releaseReady, report.parity.planned === 0 && report.blockers.length === 0 && report.visuals.status === 'available');
console.log('Release report matches the pinned ledger and evidence schemas.');
