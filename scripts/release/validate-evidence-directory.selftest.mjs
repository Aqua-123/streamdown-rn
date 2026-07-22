import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateEvidenceDirectory } from './validate-evidence-directory.mjs';

const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-evidence-'));
const root = path.join(parent, 'capture');
for (const directory of ['benchmarks/results', 'tests/device/results', 'tests/visual/baselines']) {
  fs.mkdirSync(path.join(root, directory), { recursive: true });
}
fs.writeFileSync(path.join(root, 'tests/device/evidence.json'), '{}');
fs.writeFileSync(path.join(root, 'benchmarks/results/result.json'), '{}');

const rejects = (options, pattern) => assert.throws(() => validateEvidenceDirectory(root, options), pattern);
try {
  assert.equal(validateEvidenceDirectory(root, { allowedPrefix: parent }).files, 2);
  rejects({ maxFiles: 1 }, /files/);
  rejects({ maxTotalBytes: 3 }, /aggregate/);
  rejects({ maxFileBytes: 1 }, /file exceeds/);
  rejects({ maxJsonBytes: 1 }, /JSON exceeds/);
  fs.symlinkSync(path.join(root, 'tests/device/evidence.json'), path.join(root, 'tests/device/results/link.json'));
  rejects({}, /symlinks/);
  fs.rmSync(path.join(root, 'tests/device/results/link.json'));
  assert.throws(() => validateEvidenceDirectory(root, { allowedPrefix: path.join(parent, 'elsewhere') }), /ENOENT|below/);
  console.log('Evidence directory validator self-test passed.');
} finally {
  fs.rmSync(parent, { recursive: true, force: true });
}
