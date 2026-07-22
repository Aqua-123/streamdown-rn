import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseReport } from './report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const report = createReleaseReport();
const blockers = [...report.blockers];
if (report.parity.status !== 'complete') blockers.push(`${report.parity.planned} pinned parity cases remain planned`);
if (report.benchmarks.releaseEvidence !== 'available') blockers.push(`release-Hermes evidence unavailable: ${report.benchmarks.deltas[0].reason ?? 'verification did not pass'}`);
if (report.visuals.integrity !== 'valid') blockers.push(...report.visuals.errors.map((error) => `visual evidence integrity: ${error}`));
for (const platform of report.visuals.platforms) {
  if (platform.missing.length) blockers.push(`${platform.platform} visual evidence missing: ${platform.missing.join(', ')}`);
}
const changesets = fs.existsSync(path.join(root, '.changeset'))
  ? fs.readdirSync(path.join(root, '.changeset')).filter((name) => name.endsWith('.md') && name !== 'README.md') : [];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
if (!changesets.length && !changelog.includes(`## ${pkg.version}`)) blockers.push('no pending changeset or changelog entry for the package version exists');
if (report.compatibility.status !== 'pass' && report.blockers.length === 0) blockers.push('manual/device compatibility evidence has not passed');
if (blockers.length) {
  console.error(`Publish blocked:\n- ${[...new Set(blockers)].join('\n- ')}`);
  process.exit(1);
}
console.log('Manual/device, visual, performance, parity, and changeset release gates passed.');
