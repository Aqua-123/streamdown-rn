import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  compatibilityMatrixSha256,
  compatibilityStatus,
  createReleaseReport,
  isReleaseReady,
  requiredCompatibilityAssertions,
  requiredCompatibilityCoverage,
} from './report.mjs';
import { deriveDeviceAssertions, deviceEvidenceUrl, validDeviceCaptureCommand, validDeviceLaunchCommand } from './device-evidence.mjs';

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
assert.equal(validDeviceCaptureCommand('android', ['/bin/printf', 'STREAMDOWN_DEVICE_RUNTIME']), false);
assert.equal(validDeviceCaptureCommand('android', ['adb', 'logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I'], 'expo54'), true);
assert.equal(validDeviceLaunchCommand({ host: 'expo54', platform: 'android', scenario: 'x', coverageId: 'expo54:android:x', source: { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }, captureId: '11111111-1111-4111-8111-111111111111' }, ['/bin/printf']), false);
for (const blocked of [
  { benchmarks: { releaseEvidence: 'blocked' } },
  { visuals: { status: 'blocked' } },
  { compatibility: { status: 'blocked' } },
  { parity: { status: 'incomplete' } },
  { blockers: ['manual evidence missing'] },
]) assert.equal(isReleaseReady({ ...ready, ...blocked }), false);

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-compatibility-'));
try {
  const resultsRoot = path.join(fixtureRoot, 'tests/device/results');
  fs.mkdirSync(resultsRoot, { recursive: true });
  const matrixFixture = { hosts: [{ id: 'expo54' }], platforms: ['android'], scenarios: ['static-mixed-corpus'], manualHardware: ['voiceover-check'], buildType: 'release', engine: 'hermes' };
  const source = { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) };
  const artifactSha256 = {};
  const coverage = requiredCompatibilityCoverage(matrixFixture).map((id, index) => {
    const rawRelative = `tests/device/results/${index}.log`;
    const resultRelative = `tests/device/results/${index}.json`;
    const raw = path.join(fixtureRoot, rawRelative);
    const result = path.join(fixtureRoot, resultRelative);
    const [host, platform, ...scenarioParts] = id.split(':');
    const evidenceType = host === 'manual' ? 'manual-accessibility' : 'device-runtime';
    const scenario = scenarioParts.join(':');
    const captureId = '11111111-1111-4111-8111-111111111111';
    const rawOutput = evidenceType === 'device-runtime'
      ? `2026-07-22 12:00:00.000 fixture[1:2] STREAMDOWN_DEVICE_RUNTIME ${JSON.stringify({ coverageId: id, platform, buildType: 'release', engine: 'hermes', appState: 'foreground', captureId, source })}\n2026-07-22 12:00:00.001 fixture[1:2] STREAMDOWN_DEVICE_SCENARIO ${JSON.stringify({ coverageId: id, scenario, status: 'passed', signal: requiredCompatibilityAssertions(scenario)[1], captureId, source })}\n`
      : `manual accessibility capture for ${id}`;
    fs.writeFileSync(raw, rawOutput);
    const rawHash = crypto.createHash('sha256').update(fs.readFileSync(raw)).digest('hex');
    fs.writeFileSync(result, JSON.stringify({
      schemaVersion: 1, coverageId: id, status: 'passed', host, platform, scenario, buildType: 'release', engine: 'hermes', evidenceType, source,
      retainedArtifacts: [{ path: rawRelative, sha256: rawHash }],
      ...(evidenceType === 'device-runtime'
        ? {
          receipt: {
            schemaVersion: 1, producer: 'streamdown-device-capture/v1', matrixSha256: compatibilityMatrixSha256(matrixFixture), coverageId: id, source,
            captureId,
            launch: { argv: ['adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', deviceEvidenceUrl({ host, platform, scenario, coverageId: id, source, captureId }), 'ai.aqua.streamdownrn.expo54/.MainActivity'], exitCode: 0 },
            command: { argv: ['adb', 'logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I'], exitCode: 0 },
            startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', rawArtifactSha256: [rawHash],
          },
          assertions: deriveDeviceAssertions({ coverageId: id, platform, scenario, buildType: 'release', engine: 'hermes', source, captureId }, rawOutput, [rawHash]),
        }
        : {}),
    }));
    artifactSha256[resultRelative] = crypto.createHash('sha256').update(fs.readFileSync(result)).digest('hex');
    if (evidenceType === 'manual-accessibility') {
      const attestationRelative = `tests/device/results/${index}.attestation.json`;
      const attestation = path.join(fixtureRoot, attestationRelative);
      fs.writeFileSync(attestation, JSON.stringify({
        schemaVersion: 1, producer: 'streamdown-accessibility-attestation/v1', coverageId: id, source, decision: 'environment-approved',
        approvalIdentity: 'not-exposed-by-github-environments', reviewedAt: '2026-01-01T00:02:00.000Z',
        result: { path: resultRelative, sha256: artifactSha256[resultRelative] }, retainedArtifacts: [{ path: rawRelative, sha256: rawHash }],
        evidenceArtifact: { name: 'release-evidence-unreviewed', id: '123456', digest: 'd'.repeat(64), sourceRunId: '123', sourceRunAttempt: '1' },
        workflow: { provider: 'github-actions', protectedEnvironment: 'release-evidence-review', repository: 'owner/repo', workflowRef: 'owner/repo/.github/workflows/release-evidence.yml@refs/heads/main', runId: '123', runAttempt: '1', job: 'visual-review', sha: source.commit },
      }));
      artifactSha256[attestationRelative] = crypto.createHash('sha256').update(fs.readFileSync(attestation)).digest('hex');
      return { id, status: 'passed', artifacts: [resultRelative], attestation: attestationRelative };
    }
    return { id, status: 'passed', artifacts: [resultRelative] };
  });
  const evidenceFixture = { status: 'pass', source, coverage, artifactSha256 };
  assert.equal(compatibilityStatus(evidenceFixture, matrixFixture, source, fixtureRoot).status, 'pass');
  assert.equal(compatibilityStatus({ ...evidenceFixture, coverage: coverage.slice(1) }, matrixFixture, source, fixtureRoot).status, 'blocked');
  assert.equal(compatibilityStatus(evidenceFixture, matrixFixture, { ...source, commit: 'c'.repeat(40) }, fixtureRoot).status, 'blocked');
  assert.equal(compatibilityStatus({ ...evidenceFixture, coverage: [...coverage, coverage[0]] }, matrixFixture, source, fixtureRoot).status, 'blocked');
  const reusedArtifact = structuredClone(evidenceFixture);
  reusedArtifact.coverage[1].artifacts = reusedArtifact.coverage[0].artifacts;
  assert.equal(compatibilityStatus(reusedArtifact, matrixFixture, source, fixtureRoot).status, 'blocked');
  const escapedArtifact = structuredClone(evidenceFixture);
  escapedArtifact.coverage[0].artifacts = ['../outside.json'];
  assert.equal(compatibilityStatus(escapedArtifact, matrixFixture, source, fixtureRoot).status, 'blocked');
  const badHash = structuredClone(evidenceFixture);
  badHash.artifactSha256[coverage[0].artifacts[0]] = '0'.repeat(64);
  assert.equal(compatibilityStatus(badHash, matrixFixture, source, fixtureRoot).status, 'blocked');
  const firstResult = path.join(fixtureRoot, coverage[0].artifacts[0]);
  const originalResult = fs.readFileSync(firstResult, 'utf8');
  const missingAssertion = structuredClone(evidenceFixture);
  const deviceResultPath = path.join(fixtureRoot, coverage[0].artifacts[0]);
  const deviceResult = JSON.parse(fs.readFileSync(deviceResultPath, 'utf8'));
  delete deviceResult.assertions;
  fs.writeFileSync(deviceResultPath, JSON.stringify(deviceResult));
  missingAssertion.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(deviceResultPath)).digest('hex');
  assert.equal(compatibilityStatus(missingAssertion, matrixFixture, source, fixtureRoot).status, 'blocked');
  deviceResult.assertions = [{ id: 'invented-pass', status: 'passed', observation: { kind: 'text', value: 'trust me' }, artifactSha256: [deviceResult.retainedArtifacts[0].sha256] }];
  fs.writeFileSync(deviceResultPath, JSON.stringify(deviceResult));
  const mismatchedAssertion = structuredClone(evidenceFixture);
  mismatchedAssertion.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(deviceResultPath)).digest('hex');
  assert.equal(compatibilityStatus(mismatchedAssertion, matrixFixture, source, fixtureRoot).status, 'blocked');
  deviceResult.assertions = deriveDeviceAssertions({ ...deviceResult, captureId: deviceResult.receipt.captureId }, fs.readFileSync(path.join(fixtureRoot, deviceResult.retainedArtifacts[0].path), 'utf8'), [deviceResult.retainedArtifacts[0].sha256]);
  deviceResult.receipt.command.argv = ['/bin/printf', 'forged markers'];
  fs.writeFileSync(deviceResultPath, JSON.stringify(deviceResult));
  const forgedCommand = structuredClone(evidenceFixture);
  forgedCommand.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(deviceResultPath)).digest('hex');
  assert.equal(compatibilityStatus(forgedCommand, matrixFixture, source, fixtureRoot).status, 'blocked');
  deviceResult.receipt.command.argv = ['adb', 'logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I'];
  deviceResult.receipt.command.exitCode = 1;
  fs.writeFileSync(deviceResultPath, JSON.stringify(deviceResult));
  const failedCommand = structuredClone(evidenceFixture);
  failedCommand.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(deviceResultPath)).digest('hex');
  assert.equal(compatibilityStatus(failedCommand, matrixFixture, source, fixtureRoot).status, 'blocked');
  deviceResult.receipt.command.exitCode = 0;
  deviceResult.receipt.matrixSha256 = '0'.repeat(64);
  fs.writeFileSync(deviceResultPath, JSON.stringify(deviceResult));
  const wrongMatrix = structuredClone(evidenceFixture);
  wrongMatrix.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(deviceResultPath)).digest('hex');
  assert.equal(compatibilityStatus(wrongMatrix, matrixFixture, source, fixtureRoot).status, 'blocked');
  fs.writeFileSync(deviceResultPath, originalResult);
  const manualResultPath = path.join(fixtureRoot, coverage[1].artifacts[0]);
  const originalManualResult = fs.readFileSync(manualResultPath, 'utf8');
  const missingAttestation = structuredClone(evidenceFixture);
  delete missingAttestation.coverage[1].attestation;
  assert.equal(compatibilityStatus(missingAttestation, matrixFixture, source, fixtureRoot).status, 'blocked');
  const attestationPath = path.join(fixtureRoot, coverage[1].attestation);
  const originalAttestation = fs.readFileSync(attestationPath, 'utf8');
  const attestation = JSON.parse(originalAttestation);
  assert.equal(Object.hasOwn(attestation, 'reviewer'), false);
  assert.equal(Object.hasOwn(attestation.workflow, 'actor'), false);
  attestation.workflow.sha = 'c'.repeat(40);
  fs.writeFileSync(attestationPath, JSON.stringify(attestation));
  const forgedAttestation = structuredClone(evidenceFixture);
  forgedAttestation.artifactSha256[coverage[1].attestation] = crypto.createHash('sha256').update(fs.readFileSync(attestationPath)).digest('hex');
  assert.equal(compatibilityStatus(forgedAttestation, matrixFixture, source, fixtureRoot).status, 'blocked');
  fs.writeFileSync(attestationPath, originalAttestation);
  const mismatched = JSON.parse(originalResult);
  mismatched.coverageId = coverage[1].id;
  fs.writeFileSync(firstResult, JSON.stringify(mismatched));
  const mismatchedEvidence = structuredClone(evidenceFixture);
  mismatchedEvidence.artifactSha256[coverage[0].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(firstResult)).digest('hex');
  assert.equal(compatibilityStatus(mismatchedEvidence, matrixFixture, source, fixtureRoot).status, 'blocked');
  fs.writeFileSync(firstResult, originalResult);
  const retainedReplay = JSON.parse(fs.readFileSync(path.join(fixtureRoot, coverage[1].artifacts[0]), 'utf8'));
  retainedReplay.retainedArtifacts = JSON.parse(originalResult).retainedArtifacts;
  const secondResult = path.join(fixtureRoot, coverage[1].artifacts[0]);
  fs.writeFileSync(secondResult, JSON.stringify(retainedReplay));
  const replayEvidence = structuredClone(evidenceFixture);
  replayEvidence.artifactSha256[coverage[1].artifacts[0]] = crypto.createHash('sha256').update(fs.readFileSync(secondResult)).digest('hex');
  assert.equal(compatibilityStatus(replayEvidence, matrixFixture, source, fixtureRoot).status, 'blocked');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
console.log('Release report matches the pinned ledger and evidence schemas.');
