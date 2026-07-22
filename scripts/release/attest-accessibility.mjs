#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.realpathSync(process.cwd());
const resultsRoot = fs.realpathSync(path.join(root, 'tests/device/results'));
const confinedFile = (relative, maxBytes) => {
  if (!/^tests\/device\/results\/[A-Za-z0-9._-]+$/.test(relative ?? '')) throw new Error(`invalid device evidence path: ${relative}`);
  const target = path.resolve(root, relative);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > maxBytes
    || path.dirname(target) !== resultsRoot || fs.realpathSync(target) !== target) throw new Error(`unsafe device evidence file: ${relative}`);
  return target;
};
const evidencePath = 'tests/device/evidence.json';
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const environment = process.env.STREAMDOWN_EVIDENCE_ENVIRONMENT;
const source = { commit: process.env.STREAMDOWN_RELEASE_COMMIT, packageSha256: process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256 };
const workflow = {
  provider: 'github-actions', protectedEnvironment: environment, repository: process.env.GITHUB_REPOSITORY,
  workflowRef: process.env.GITHUB_WORKFLOW_REF, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  job: process.env.GITHUB_JOB, sha: process.env.GITHUB_SHA,
};
const evidenceArtifact = {
  name: process.env.STREAMDOWN_EVIDENCE_ARTIFACT_NAME, id: process.env.STREAMDOWN_EVIDENCE_ARTIFACT_ID,
  digest: process.env.STREAMDOWN_EVIDENCE_ARTIFACT_DIGEST, sourceRunId: process.env.STREAMDOWN_EVIDENCE_SOURCE_RUN_ID,
  sourceRunAttempt: process.env.STREAMDOWN_EVIDENCE_SOURCE_RUN_ATTEMPT,
};
if (environment !== 'release-evidence-review' || evidenceArtifact.name !== 'release-evidence-unreviewed'
  || !/^[1-9][0-9]*$/.test(evidenceArtifact.id ?? '') || !/^[a-f0-9]{64}$/.test(evidenceArtifact.digest ?? '')
  || evidenceArtifact.sourceRunId !== workflow.runId || evidenceArtifact.sourceRunAttempt !== workflow.runAttempt
  || !/^[a-f0-9]{40}$/.test(source.commit ?? '') || !/^[a-f0-9]{64}$/.test(source.packageSha256 ?? '')
  || Object.values(workflow).some((value) => !value)) throw new Error('protected review workflow and immutable input artifact metadata are required');
if (workflow.job !== 'visual-review' || workflow.workflowRef !== `${workflow.repository}/.github/workflows/release-evidence.yml@refs/heads/main`) throw new Error('accessibility attestation must run in the protected release evidence review job on main');
if (workflow.sha !== source.commit || evidence.source?.commit !== source.commit || evidence.source?.packageSha256 !== source.packageSha256) throw new Error('review source does not match prepared evidence');

let attested = 0;
for (const coverage of evidence.coverage ?? []) {
  if (!coverage.id?.startsWith('manual:')) continue;
  if (coverage.artifacts?.length !== 1) throw new Error(`manual coverage must have exactly one result: ${coverage.id}`);
  const resultPath = coverage.artifacts[0];
  const resultTarget = confinedFile(resultPath, 10 * 1024 * 1024);
  const resultBytes = fs.readFileSync(resultTarget);
  const result = JSON.parse(resultBytes);
  if (result.evidenceType !== 'manual-accessibility' || result.status !== 'passed' || result.coverageId !== coverage.id
    || result.source?.commit !== source.commit || result.source?.packageSha256 !== source.packageSha256
    || !Array.isArray(result.retainedArtifacts) || result.retainedArtifacts.length === 0) throw new Error(`manual accessibility result is invalid: ${coverage.id}`);
  const retainedArtifacts = result.retainedArtifacts.map(({ path, sha256: expected }) => {
    const digest = sha256(fs.readFileSync(confinedFile(path, 100 * 1024 * 1024)));
    if (digest !== expected) throw new Error(`retained artifact hash mismatch: ${path}`);
    return { path, sha256: digest };
  });
  const attestationPath = `${resultPath}.attestation.json`;
  const attestationTarget = path.resolve(root, attestationPath);
  if (path.dirname(attestationTarget) !== resultsRoot || (fs.existsSync(attestationTarget) && (!fs.lstatSync(attestationTarget).isFile() || fs.lstatSync(attestationTarget).isSymbolicLink()))) throw new Error(`unsafe attestation output: ${attestationPath}`);
  fs.writeFileSync(attestationTarget, `${JSON.stringify({
    schemaVersion: 1, producer: 'streamdown-accessibility-attestation/v1', coverageId: result.coverageId, source,
    decision: 'environment-approved', reviewedAt: new Date().toISOString(), approvalIdentity: 'not-exposed-by-github-environments',
    result: { path: resultPath, sha256: sha256(resultBytes) }, retainedArtifacts,
    evidenceArtifact, workflow,
  }, null, 2)}\n`);
  coverage.attestation = attestationPath;
  evidence.artifactSha256[attestationPath] = sha256(fs.readFileSync(attestationTarget));
  attested += 1;
}
if (attested === 0) throw new Error('no manual accessibility results were available to attest');
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
