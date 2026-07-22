import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadHermesResults, verifyHermesResults } from '../benchmarks/verify-hermes.mjs';
import { verifyVisualEvidence } from '../../tests/visual/verify-integrity.mjs';
import { deriveDeviceAssertions, requiredDeviceAssertions, validDeviceCaptureCommand, validDeviceLaunchCommand } from './device-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const countBy = (values, key) => Object.fromEntries([...new Set(values.map((value) => value[key]))].sort().map((name) => [name, values.filter((value) => value[key] === name).length]));
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024;
const sha256File = (file) => {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      digest.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest('hex');
};

function confinedFile(projectRoot, relative) {
  if (!relative || path.isAbsolute(relative)) return null;
  const canonicalRoot = fs.realpathSync(projectRoot);
  const target = path.resolve(canonicalRoot, relative);
  const allowed = [
    path.resolve(canonicalRoot, 'tests/device/results'),
    path.resolve(canonicalRoot, 'tests/visual/baselines'),
  ];
  if (!allowed.some((directory) => {
    const value = path.relative(directory, target);
    return value && !value.startsWith('..') && !path.isAbsolute(value);
  })) return null;
  if (!fs.existsSync(target) || !fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()) return null;
  const size = fs.statSync(target).size;
  if (size === 0 || size > MAX_ARTIFACT_BYTES) return null;
  return fs.realpathSync(target) === target ? target : null;
}

function confinedJson(projectRoot, relative) {
  const target = confinedFile(projectRoot, relative);
  if (!target || fs.statSync(target).size > 10 * 1024 * 1024) return null;
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return null; }
}

export function requiredCompatibilityCoverage(matrix) {
  const scenarios = matrix.hosts.flatMap((host) => matrix.platforms.flatMap((platform) =>
    (host.scenarios ?? matrix.scenarios).map((scenario) => `${host.id}:${platform}:${scenario}`)
  ));
  return [
    ...scenarios,
    ...matrix.manualHardware.map((scenario) => `manual:${scenario.startsWith('voiceover-') ? 'ios' : 'android'}:${scenario}`),
  ];
}

export const compatibilityMatrixSha256 = (matrix) => crypto.createHash('sha256').update(JSON.stringify(matrix)).digest('hex');

export function requiredCompatibilityAssertions(scenario) {
  return requiredDeviceAssertions(scenario);
}

export function compatibilityStatus(evidence, matrix, expectedSource, projectRoot = root) {
  if (evidence.status !== 'pass') return { status: evidence.status, sourceMatched: false };
  if (!expectedSource || evidence.source?.commit !== expectedSource.commit || evidence.source?.packageSha256 !== expectedSource.packageSha256) {
    return { status: 'blocked', sourceMatched: false, reason: 'compatibility evidence does not match the publish candidate' };
  }
  const required = requiredCompatibilityCoverage(matrix);
  const coverage = Array.isArray(evidence.coverage) ? evidence.coverage : [];
  const coverageIds = coverage.map((entry) => entry?.id);
  if (new Set(coverageIds).size !== coverageIds.length) return { status: 'blocked', sourceMatched: true, reason: 'duplicate compatibility coverage id' };
  const missing = required.filter((id) => !coverageIds.includes(id));
  if (missing.length) return { status: 'blocked', sourceMatched: true, reason: `missing compatibility coverage: ${missing.join(', ')}` };
  const seenPaths = new Set();
  const seenDigests = new Set();
  const matrixSha256 = compatibilityMatrixSha256(matrix);
  for (const summary of coverage.filter((entry) => required.includes(entry.id))) {
    if (summary.status !== 'passed' || !(summary.artifacts?.length > 0)) return { status: 'blocked', sourceMatched: true, reason: `invalid compatibility coverage: ${summary.id}` };
    for (const artifact of summary.artifacts) {
      const target = confinedFile(projectRoot, artifact);
      if (!target || seenPaths.has(target)) return { status: 'blocked', sourceMatched: true, reason: `compatibility artifact reused or invalid: ${artifact}` };
      const resultDigest = sha256File(target);
      if (seenDigests.has(resultDigest) || evidence.artifactSha256?.[artifact] !== resultDigest) return { status: 'blocked', sourceMatched: true, reason: `compatibility artifact hash mismatch or replay: ${artifact}` };
      seenPaths.add(target);
      seenDigests.add(resultDigest);
      const result = confinedJson(projectRoot, artifact);
      if (!result) return { status: 'blocked', sourceMatched: true, reason: `compatibility result is not bounded valid JSON: ${artifact}` };
      if (result.source?.commit !== expectedSource.commit || result.source?.packageSha256 !== expectedSource.packageSha256) return { status: 'blocked', sourceMatched: false, reason: `compatibility result source mismatch: ${artifact}` };
      const [host, platform, ...scenarioParts] = summary.id.split(':');
      const scenario = scenarioParts.join(':');
      if (result.schemaVersion !== 1 || result.coverageId !== summary.id || result.status !== 'passed'
        || result.host !== host || result.platform !== platform || result.scenario !== scenario
        || result.buildType !== matrix.buildType || result.engine !== matrix.engine
        || result.evidenceType !== (host === 'manual' ? 'manual-accessibility' : 'device-runtime')) {
        return { status: 'blocked', sourceMatched: true, reason: `compatibility result identity mismatch: ${artifact}` };
      }
      const retainedDigests = [];
      const retainedPaths = [];
      for (const retained of result.retainedArtifacts ?? []) {
        const retainedPath = confinedFile(projectRoot, retained.path);
        if (!retainedPath || seenPaths.has(retainedPath) || !/^[a-f0-9]{64}$/.test(retained.sha256 ?? '')) return { status: 'blocked', sourceMatched: true, reason: `retained compatibility evidence invalid or reused: ${retained.path ?? artifact}` };
        const retainedDigest = sha256File(retainedPath);
        if (seenDigests.has(retainedDigest) || retainedDigest !== retained.sha256) return { status: 'blocked', sourceMatched: true, reason: `retained compatibility evidence hash mismatch or replay: ${retained.path ?? artifact}` };
        seenPaths.add(retainedPath);
        seenDigests.add(retainedDigest);
        retainedDigests.push(retainedDigest);
        retainedPaths.push(retainedPath);
      }
      if (!(result.retainedArtifacts?.length > 0)) return { status: 'blocked', sourceMatched: true, reason: `no retained compatibility evidence: ${artifact}` };
      const exactDigestSet = (values) => Array.isArray(values)
        && values.length === retainedDigests.length
        && new Set(values).size === values.length
        && values.every((digest) => retainedDigests.includes(digest));
      if (result.evidenceType === 'device-runtime') {
        const assertions = result.assertions;
        const requiredAssertions = requiredCompatibilityAssertions(scenario);
        const receipt = result.receipt;
        if (requiredAssertions.length === 0
          || receipt?.schemaVersion !== 1 || receipt?.producer !== 'streamdown-device-capture/v1'
          || receipt?.matrixSha256 !== matrixSha256 || receipt?.coverageId !== summary.id
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(receipt?.captureId ?? '')
          || receipt?.source?.commit !== expectedSource.commit || receipt?.source?.packageSha256 !== expectedSource.packageSha256
          || !Array.isArray(receipt?.launch?.argv)
          || !validDeviceLaunchCommand({ host, platform, scenario, coverageId: summary.id, source: expectedSource, captureId: receipt.captureId }, receipt.launch.argv)
          || receipt.launch.exitCode !== 0
          || !Array.isArray(receipt?.command?.argv) || receipt.command.argv.length === 0
          || receipt.command.argv.some((value) => typeof value !== 'string' || !value)
          || !validDeviceCaptureCommand(platform, receipt.command.argv, host)
          || receipt.command.exitCode !== 0
          || Number.isNaN(Date.parse(receipt.startedAt)) || Number.isNaN(Date.parse(receipt.completedAt))
          || Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)
          || !exactDigestSet(receipt.rawArtifactSha256)) {
          return { status: 'blocked', sourceMatched: true, reason: `machine receipt is not bound to the matrix, candidate, command, and raw evidence: ${artifact}` };
        }
        if (retainedPaths.some((value) => fs.statSync(value).size > 10 * 1024 * 1024)) return { status: 'blocked', sourceMatched: true, reason: `device output exceeds parser bound: ${artifact}` };
        const derived = deriveDeviceAssertions({ coverageId: summary.id, platform, scenario, buildType: matrix.buildType, engine: matrix.engine, source: expectedSource, captureId: receipt.captureId }, retainedPaths.map((value) => fs.readFileSync(value, 'utf8')).join('\n'), retainedDigests);
        if (!derived || JSON.stringify(assertions) !== JSON.stringify(derived)) return { status: 'blocked', sourceMatched: true, reason: `machine assertions do not match retained device output: ${artifact}` };
      } else {
        if ('review' in result) return { status: 'blocked', sourceMatched: true, reason: `embedded manual review is not trusted: ${artifact}` };
        const attestationPath = confinedFile(projectRoot, summary.attestation);
        if (!attestationPath || seenPaths.has(attestationPath)) return { status: 'blocked', sourceMatched: true, reason: `manual accessibility attestation is missing or invalid: ${artifact}` };
        const attestationDigest = sha256File(attestationPath);
        if (seenDigests.has(attestationDigest) || evidence.artifactSha256?.[summary.attestation] !== attestationDigest) return { status: 'blocked', sourceMatched: true, reason: `manual accessibility attestation hash mismatch or replay: ${artifact}` };
        seenPaths.add(attestationPath);
        seenDigests.add(attestationDigest);
        const attestation = confinedJson(projectRoot, summary.attestation);
        const attestedRetained = attestation?.retainedArtifacts;
        if (attestation?.schemaVersion !== 1 || attestation?.producer !== 'streamdown-accessibility-attestation/v1'
          || attestation.coverageId !== summary.id || attestation.decision !== 'environment-approved'
          || attestation.source?.commit !== expectedSource.commit || attestation.source?.packageSha256 !== expectedSource.packageSha256
          || attestation.result?.path !== artifact || attestation.result?.sha256 !== resultDigest
          || attestation.approvalIdentity !== 'not-exposed-by-github-environments'
          || Number.isNaN(Date.parse(attestation.reviewedAt))
          || !Array.isArray(attestedRetained) || attestedRetained.length !== result.retainedArtifacts.length
          || attestedRetained.some((entry, index) => entry?.path !== result.retainedArtifacts[index]?.path || entry?.sha256 !== retainedDigests[index])
          || attestation.workflow?.provider !== 'github-actions' || attestation.workflow?.protectedEnvironment !== 'release-evidence-review'
          || typeof attestation.workflow?.repository !== 'string' || !attestation.workflow.repository
          || typeof attestation.workflow?.workflowRef !== 'string' || !attestation.workflow.workflowRef
          || !/^\d+$/.test(attestation.workflow?.runId ?? '') || !/^\d+$/.test(attestation.workflow?.runAttempt ?? '')
          || typeof attestation.workflow?.job !== 'string' || !attestation.workflow.job
          || attestation.workflow?.sha !== expectedSource.commit
          || attestation.evidenceArtifact?.name !== 'release-evidence-unreviewed'
          || !/^[1-9][0-9]*$/.test(attestation.evidenceArtifact?.id ?? '')
          || !/^[a-f0-9]{64}$/.test(attestation.evidenceArtifact?.digest ?? '')
          || attestation.evidenceArtifact?.sourceRunId !== attestation.workflow.runId
          || attestation.evidenceArtifact?.sourceRunAttempt !== attestation.workflow.runAttempt
          || attestation.workflow.job !== 'visual-review'
          || attestation.workflow.workflowRef !== `${attestation.workflow.repository}/.github/workflows/release-evidence.yml@refs/heads/main`) {
          return { status: 'blocked', sourceMatched: true, reason: `manual accessibility protected attestation contract is invalid: ${artifact}` };
        }
      }
    }
  }
  return { status: 'pass', sourceMatched: true };
}

export function isReleaseReady(report) {
  return report.parity.status === 'complete'
    && report.compatibility.status === 'pass'
    && report.blockers.length === 0
    && report.benchmarks.releaseEvidence === 'available'
    && report.visuals.status === 'available';
}

export function createReleaseReport() {
  const pkg = read('package.json');
  const inventory = read('parity/upstream.json');
  const manifest = read('parity/manifest.json');
  const matrix = read('tests/device/matrix.json');
  const evidence = read('tests/device/evidence.json');
  const protocol = read('benchmarks/protocol.json');
  const releaseCommit = process.env.STREAMDOWN_RELEASE_COMMIT;
  const releasePackageSha256 = process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256;
  const baselineCommit = process.env.STREAMDOWN_BASELINE_COMMIT;
  const baselinePackageSha256 = process.env.STREAMDOWN_BASELINE_PACKAGE_SHA256;
  const expectedSource = releaseCommit && releasePackageSha256
    ? { commit: releaseCommit, packageSha256: releasePackageSha256 }
    : undefined;
  const expectedBaselineSource = baselineCommit && baselinePackageSha256
    ? { commit: baselineCommit, packageSha256: baselinePackageSha256 }
    : undefined;
  const visuals = verifyVisualEvidence(root, expectedSource);
  const compatibility = compatibilityStatus(evidence, matrix, expectedSource);
  const implemented = manifest.entries.filter((entry) => entry.status === 'implemented').length;
  const nativeAdaptations = manifest.entries.filter((entry) => entry.classification === 'adapted');
  const divergences = manifest.entries.filter((entry) => entry.classification === 'browser-only' || entry.classification === 'known-upstream-bug');
  const characterizations = evidence.results.flatMap((result) => (result.artifacts ?? []).map((artifact) => {
    const value = confinedJson(root, artifact);
    if (!value) return null;
    return value.streamingCharacterization ? { artifact, status: value.streamingCharacterization.status, metrics: value.streamingCharacterization.appendToLayoutMs } : null;
  })).filter(Boolean);
  let hermes;
  try { hermes = verifyHermesResults(loadHermesResults(), true, expectedSource, expectedBaselineSource); }
  catch (error) { hermes = { status: 'blocked', reason: error.message }; }
  const report = {
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
    compatibility: { ...compatibility, hosts: matrix.hosts, platforms: matrix.platforms, evidence: evidence.results },
    benchmarks: {
      protocol: { corpusSha256: protocol.corpusSha256, budgets: protocol.budgets },
      characterizations,
      deltas: [hermes],
      releaseEvidence: hermes.status === 'pass' ? 'available' : 'blocked',
    },
    visuals,
    blockers: evidence.blockers,
  };
  report.releaseReady = isReleaseReady(report);
  return report;
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
