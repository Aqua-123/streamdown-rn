import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./attest-accessibility.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-accessibility-attest-'));
const source = { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) };
const rawPath = 'tests/device/results/manual.log';
const resultPath = 'tests/device/results/manual.json';
const evidencePath = path.join(root, 'tests/device/evidence.json');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const env = {
  ...process.env, STREAMDOWN_RELEASE_COMMIT: source.commit, STREAMDOWN_RELEASE_PACKAGE_SHA256: source.packageSha256,
  STREAMDOWN_EVIDENCE_ENVIRONMENT: 'release-evidence-review', STREAMDOWN_EVIDENCE_ARTIFACT_NAME: 'release-evidence-unreviewed',
  STREAMDOWN_EVIDENCE_ARTIFACT_ID: '7', STREAMDOWN_EVIDENCE_ARTIFACT_DIGEST: 'c'.repeat(64),
  STREAMDOWN_EVIDENCE_SOURCE_RUN_ID: '42', STREAMDOWN_EVIDENCE_SOURCE_RUN_ATTEMPT: '3',
  GITHUB_REPOSITORY: 'owner/repo', GITHUB_WORKFLOW_REF: 'owner/repo/.github/workflows/release-evidence.yml@refs/heads/main',
  GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '3', GITHUB_JOB: 'visual-review', GITHUB_SHA: source.commit,
};

try {
  fs.mkdirSync(path.join(root, 'tests/device/results'), { recursive: true });
  fs.writeFileSync(path.join(root, rawPath), 'manual accessibility evidence');
  const rawSha256 = hash(fs.readFileSync(path.join(root, rawPath)));
  const result = { schemaVersion: 1, coverageId: 'manual:ios:voiceover-check', status: 'passed', evidenceType: 'manual-accessibility', source, retainedArtifacts: [{ path: rawPath, sha256: rawSha256 }] };
  fs.writeFileSync(path.join(root, resultPath), JSON.stringify(result));
  const evidence = { status: 'pass', source, coverage: [{ id: result.coverageId, status: 'passed', artifacts: [resultPath] }], artifactSha256: { [resultPath]: hash(fs.readFileSync(path.join(root, resultPath))) } };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence));
  const success = spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' });
  assert.equal(success.status, 0, success.stderr);
  const attestation = JSON.parse(fs.readFileSync(path.join(root, `${resultPath}.attestation.json`)));
  assert.equal(Object.hasOwn(attestation, 'reviewer'), false);
  assert.equal(Object.hasOwn(attestation.workflow, 'actor'), false);

  result.retainedArtifacts[0].path = '../outside';
  fs.writeFileSync(path.join(root, resultPath), JSON.stringify(result));
  fs.writeFileSync(evidencePath, JSON.stringify(evidence));
  const traversal = spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(traversal.status, 0);
  assert.match(traversal.stderr, /invalid device evidence path/);

  result.retainedArtifacts[0].path = rawPath;
  fs.writeFileSync(path.join(root, resultPath), JSON.stringify(result));
  fs.writeFileSync(evidencePath, JSON.stringify(evidence));
  fs.unlinkSync(path.join(root, rawPath));
  fs.symlinkSync(path.join(root, resultPath), path.join(root, rawPath));
  const symlink = spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(symlink.status, 0);
  assert.match(symlink.stderr, /unsafe device evidence file/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('Accessibility attestation rejects traversal and symlink evidence.');
