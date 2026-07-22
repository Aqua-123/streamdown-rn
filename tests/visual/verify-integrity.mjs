import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const platforms = ['ios', 'android'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sameDigestMap = (left, right) => {
  const leftEntries = Object.entries(left ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
};
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const scenarioSemantics = {
  controls: ['one', 'two', 'Copy table'],
  code: ['typescript', 'const one = 1;', 'Copy Code'],
  mermaid: ['Mermaid diagram:', 'flowchart LR'],
  'mermaid-sequence': ['Mermaid diagram:', 'participant Client'],
  'mermaid-state': ['Mermaid diagram:', 'Idle'],
  harness: ['Streamdown Lab', 'Open harness controls'],
};

export function requiredVisualSemantics(entry) {
  if (entry.scenario === 'fullscreen') return ['Fullscreen fixture', 'Exit fullscreen'];
  if (entry.scenario === 'harness') return scenarioSemantics.harness;
  return [`Fixture: ${entry.scenario}`, `Fixture state: ${entry.scenario}`, ...(scenarioSemantics[entry.scenario] ?? [])];
}

function pngError(file, baselineRoot) {
  if (path.basename(file) !== file) return 'artifact path must be a basename';
  const target = path.join(baselineRoot, file);
  if (!fs.existsSync(target)) return 'missing referenced PNG';
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size === 0) return 'PNG must be a nonempty regular file';
  if (stat.size > 25 * 1024 * 1024) return 'PNG exceeds 25 MiB';
  const relative = path.relative(fs.realpathSync(baselineRoot), fs.realpathSync(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return 'PNG canonical path mismatch';
  const bytes = fs.readFileSync(target);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'artifact is not a PNG';
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 64 || height < 64 || width > 4096 || height > 4096 || width * height > 12_000_000) return 'PNG dimensions are invalid';
  try {
    const decoded = PNG.sync.read(bytes);
    if (decoded.width !== width || decoded.height !== height) return 'PNG dimensions do not decode consistently';
    const buckets = new Map();
    for (let offset = 0; offset < decoded.data.length; offset += 4) {
      const bucket = (decoded.data[offset] >> 4) << 12
        | (decoded.data[offset + 1] >> 4) << 8
        | (decoded.data[offset + 2] >> 4) << 4
        | (decoded.data[offset + 3] >> 4);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const dominant = [...buckets.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    let contentPixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 4;
      const bucket = (decoded.data[offset] >> 4) << 12
        | (decoded.data[offset + 1] >> 4) << 8
        | (decoded.data[offset + 2] >> 4) << 4
        | (decoded.data[offset + 3] >> 4);
      if (bucket === dominant) continue;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      contentPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const minimumContent = Math.max(64, Math.ceil(width * height * 0.001));
    if (contentPixels < minimumContent
      || maxX - minX + 1 < Math.ceil(width * 0.05)
      || maxY - minY + 1 < Math.ceil(height * 0.05)) {
      return 'PNG has no meaningful spatial visual content';
    }
  } catch {
    return 'PNG cannot be decoded';
  }
  return null;
}

export function matrixSha256ForCases(matrixBytes, caseIds) {
  const wanted = new Set(caseIds);
  const lines = matrixBytes.toString('utf8').split('\n');
  const caseLines = lines.map((line, index) => {
    const trimmed = line.trim().replace(/,$/, '');
    if (!trimmed.startsWith('{ "id":')) return null;
    try { return { index, id: JSON.parse(trimmed).id }; } catch { return null; }
  }).filter(Boolean);
  const retained = caseLines.filter(({ id }) => wanted.has(id));
  const retainedIndexes = new Set(retained.map(({ index }) => index));
  const last = retained.at(-1)?.index;
  return sha256(Buffer.from(lines.map((line, index) => {
    if (caseLines.some((entry) => entry.index === index) && !retainedIndexes.has(index)) return null;
    return index === last ? line.replace(/,(\s*)$/, '$1') : line;
  }).filter((line) => line !== null).join('\n')));
}

export function assertCompleteBaselineManifest(manifest, platform, matrixBytes, caseIds) {
  const expected = caseIds.map((id) => `${platform}-${id}.png`).sort();
  const actual = Object.keys(manifest?.artifacts ?? {}).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error('Partial baseline updates require a complete current visual matrix');
  }
  const receipts = Object.keys(manifest?.receipts ?? {}).sort();
  if (receipts.length !== expected.length || receipts.some((name, index) => name !== expected[index])) {
    throw new Error('Partial baseline updates require complete capture receipts');
  }
  assert.equal(manifest.matrixSha256, sha256(matrixBytes), 'Partial baseline updates require the full current visual matrix hash');
}

function readJson(file, errors, label) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('JSON must be a regular file no larger than 10 MiB');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  catch (error) { errors.push(`${label}: malformed JSON (${error.message})`); return null; }
}

function metadataErrors(manifest, platform) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 && manifest?.schemaVersion !== 2) errors.push(`${platform}: manifest schemaVersion must be 1 or 2`);
  for (const key of ['device', 'runtime']) if (typeof manifest?.[key] !== 'string' || !manifest[key]) errors.push(`${platform}: manifest ${key} is required`);
  if (typeof manifest?.capturedAt !== 'string' || Number.isNaN(Date.parse(manifest.capturedAt))) errors.push(`${platform}: manifest capturedAt is invalid`);
  if (manifest?.platform !== platform) errors.push(`${platform}: manifest platform must be ${platform}`);
  if (!/^[a-f0-9]{64}$/.test(manifest?.matrixSha256 ?? '')) errors.push(`${platform}: manifest matrixSha256 is invalid`);
  if (!manifest?.artifacts || Array.isArray(manifest.artifacts) || typeof manifest.artifacts !== 'object') errors.push(`${platform}: manifest artifacts must be an object`);
  return errors;
}

export function verifyVisualEvidence(projectRoot, expectedSource) {
  const visualRoot = path.join(projectRoot, 'tests/visual');
  const baselineRoot = path.join(visualRoot, 'baselines');
  const matrixPath = path.join(visualRoot, 'matrix.json');
  const errors = [];
  let matrixBytes;
  try { matrixBytes = fs.readFileSync(matrixPath); }
  catch (error) { return { status: 'blocked', integrity: 'invalid', completeness: 'blocked', errors: [`matrix: ${error.message}`], platforms: [] }; }
  const matrix = readJson(matrixPath, errors, 'matrix');
  if (!matrix || matrix.schemaVersion !== 1 || !Array.isArray(matrix.cases)) {
    if (matrix) errors.push('matrix: schemaVersion 1 and cases array are required');
    return { status: 'blocked', integrity: 'invalid', completeness: 'blocked', errors, platforms: [] };
  }
  const matrixIds = matrix.cases.map((entry) => entry?.id);
  const duplicateMatrixIds = [...new Set(matrixIds.filter((id, index) => typeof id === 'string' && matrixIds.indexOf(id) !== index))].sort();
  if (matrixIds.some((id) => typeof id !== 'string' || !id)) errors.push('matrix: every case requires an id');
  if (duplicateMatrixIds.length) errors.push(`matrix: duplicate cases ${duplicateMatrixIds.join(', ')}`);
  const requiredIds = [...new Set(matrixIds.filter((id) => typeof id === 'string' && id))];
  const referencedPngs = new Set();
  const manifestDigests = {};
  const artifactDigests = {};
  const results = platforms.map((platform) => {
    const manifestPath = path.join(baselineRoot, `${platform}.manifest.json`);
    const manifest = readJson(manifestPath, errors, `${platform} manifest`);
    if (!manifest) return { platform, manifest: `tests/visual/baselines/${platform}.manifest.json`, integrity: 'invalid', completeness: 'blocked', missing: requiredIds };
    const start = errors.length;
    manifestDigests[`${platform}.manifest.json`] = sha256(fs.readFileSync(manifestPath));
    errors.push(...metadataErrors(manifest, platform));
    const artifacts = manifest.artifacts && !Array.isArray(manifest.artifacts) && typeof manifest.artifacts === 'object' ? Object.entries(manifest.artifacts) : [];
    const caseIds = [];
    const normalizedCases = new Set();
    for (const [name, expectedHash] of artifacts) {
      referencedPngs.add(name);
      const prefix = `${platform}-`;
      const id = name.startsWith(prefix) && name.endsWith('.png') ? name.slice(prefix.length, -4) : null;
      const normalized = id?.toLowerCase();
      if (normalized && normalizedCases.has(normalized)) errors.push(`${platform}: duplicate manifest case ${id}`);
      if (normalized) normalizedCases.add(normalized);
      if (!id || !requiredIds.includes(id)) errors.push(`${platform}: artifact ${name} does not name a matrix case`);
      else caseIds.push(id);
      if (!/^[a-f0-9]{64}$/.test(expectedHash)) errors.push(`${platform}: artifact ${name} has an invalid SHA-256`);
      const artifactPath = path.join(baselineRoot, name);
      const invalidPng = pngError(name, baselineRoot);
      if (invalidPng) errors.push(`${platform}: ${invalidPng} ${name}`);
      else if (sha256(fs.readFileSync(artifactPath)) !== expectedHash) errors.push(`${platform}: PNG hash mismatch ${name}`);
      else artifactDigests[name] = expectedHash;
    }
    if (/^[a-f0-9]{64}$/.test(manifest.matrixSha256 ?? '') && manifest.matrixSha256 !== matrixSha256ForCases(matrixBytes, caseIds)) {
      errors.push(`${platform}: stale matrix SHA-256`);
    }
    const missing = requiredIds.filter((id) => !caseIds.includes(id));
    const sourceMatched = !expectedSource || (
      manifest.source?.commit === expectedSource.commit
      && manifest.source?.packageSha256 === expectedSource.packageSha256
    );
    let reviewMatched = true;
    if (expectedSource) {
      if (manifest.schemaVersion !== 2 || Object.hasOwn(manifest, 'review')) {
        errors.push(`${platform}: release baseline requires schema 2 without imported reviewer claims`);
        reviewMatched = false;
      }
      for (const [name] of artifacts) {
        const receipt = manifest.receipts?.[name];
        const artifactPath = path.join(baselineRoot, name);
        const bytes = fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath) : null;
        const width = bytes && bytes.length >= 24 ? bytes.readUInt32BE(16) : 0;
        const height = bytes && bytes.length >= 24 ? bytes.readUInt32BE(20) : 0;
        const prefix = `${platform}-`;
        const scenario = name.startsWith(prefix) && name.endsWith('.png') ? name.slice(prefix.length, -4) : '';
        const entry = matrix.cases.find((candidate) => candidate.id === scenario);
        const expectedAssertions = entry ? requiredVisualSemantics(entry) : [];
        const assertions = receipt?.semanticAssertions;
        if (receipt?.schemaVersion !== 1 || receipt?.producer !== 'tests/visual/capture.mjs'
          || receipt?.scenario !== scenario || receipt?.platform !== platform
          || receipt?.matrixSha256 !== manifest.matrixSha256
          || receipt?.source?.commit !== expectedSource.commit || receipt?.source?.packageSha256 !== expectedSource.packageSha256
          || receipt?.artifact?.sha256 !== manifest.artifacts[name]
          || receipt?.artifact?.width !== width || receipt?.artifact?.height !== height
          || width < 320 || height < 320
          || receipt?.capture?.exitCode !== 0 || !['adb-screencap', 'simctl-screenshot'].includes(receipt?.capture?.tool)
          || !Array.isArray(assertions) || assertions.length !== expectedAssertions.length
          || assertions.some((assertion, index) => assertion?.id !== `semantic-${index + 1}`
            || assertion?.expected !== expectedAssertions[index]
            || !['uiautomator', 'maestro'].includes(assertion?.probe) || assertion?.exitCode !== 0)) {
          errors.push(`${platform}: release baseline receipt is missing or invalid for ${name}`);
          reviewMatched = false;
        }
      }
    }
    return {
      platform,
      manifest: `tests/visual/baselines/${platform}.manifest.json`,
      integrity: errors.length === start ? 'valid' : 'invalid',
      completeness: missing.length || !sourceMatched || !reviewMatched ? 'blocked' : 'complete',
      missing,
      sourceMatched,
      reviewMatched,
    };
  });
  if (expectedSource) {
    const attestationPath = path.join(baselineRoot, 'release-review-attestation.json');
    const attestation = fs.existsSync(attestationPath) ? readJson(attestationPath, errors, 'visual review attestation') : null;
    const validAttestation = attestation?.schemaVersion === 2
      && attestation?.producer === 'github-actions-protected-review-environment/v2'
      && attestation?.decision === 'environment-approved'
      && attestation?.environment === 'release-evidence-review'
      && attestation?.source?.commit === expectedSource.commit
      && attestation?.source?.packageSha256 === expectedSource.packageSha256
      && attestation?.matrixSha256 === sha256(matrixBytes)
      && sameDigestMap(attestation?.manifests, manifestDigests)
      && sameDigestMap(attestation?.artifacts, artifactDigests)
      && attestation?.workflow?.job === 'visual-review'
      && /^[1-9][0-9]*$/.test(String(attestation?.workflow?.runId ?? ''))
      && /^[1-9][0-9]*$/.test(String(attestation?.workflow?.runAttempt ?? ''))
      && /^[a-f0-9]{40}$/.test(attestation?.workflow?.sha ?? '')
      && /\/.github\/workflows\/release-evidence\.yml@refs\/heads\/main$/.test(attestation?.workflow?.ref ?? '')
      && typeof attestation?.workflow?.repository === 'string' && attestation.workflow.repository.includes('/')
      && attestation?.evidenceArtifact?.name === 'release-evidence-unreviewed'
      && /^[1-9][0-9]*$/.test(String(attestation?.evidenceArtifact?.id ?? ''))
      && /^[a-f0-9]{64}$/.test(attestation?.evidenceArtifact?.digest ?? '')
      && attestation?.evidenceArtifact?.sourceRunId === attestation?.workflow?.runId
      && attestation?.evidenceArtifact?.sourceRunAttempt === attestation?.workflow?.runAttempt
      && !Object.hasOwn(attestation?.workflow ?? {}, 'actor')
      && !Object.hasOwn(attestation ?? {}, 'reviewer')
      && typeof attestation?.createdAt === 'string' && !Number.isNaN(Date.parse(attestation.createdAt));
    if (!validAttestation) {
      errors.push('visual review attestation must be generated by the separate protected review environment and bind the immutable evidence artifact, candidate, matrix, manifests, and PNGs');
      for (const result of results) { result.reviewMatched = false; result.completeness = 'blocked'; }
    }
  }
  if (fs.existsSync(baselineRoot)) {
    for (const name of fs.readdirSync(baselineRoot).filter((name) => name.endsWith('.png'))) {
      if (!referencedPngs.has(name)) errors.push(`unreferenced PNG ${name}`);
    }
  }
  const integrity = errors.length ? 'invalid' : 'valid';
  const completeness = results.every((result) => result.completeness === 'complete') ? 'complete' : 'blocked';
  return {
    status: integrity === 'valid' && completeness === 'complete' ? 'available' : 'blocked',
    integrity,
    completeness,
    errors,
    platforms: results,
    required: platforms.map((platform) => `tests/visual/baselines/${platform}.manifest.json`),
    available: results.filter((result) => result.integrity === 'valid').map((result) => result.manifest),
  };
}

function writeFixture(root, caseIds = ['one', 'two']) {
  const baselineRoot = path.join(root, 'tests/visual/baselines');
  fs.mkdirSync(baselineRoot, { recursive: true });
  const matrix = `{\n  "schemaVersion": 1,\n  "cases": [\n${caseIds.map((id, index) => `    { "id": "${id}", "scenario": "${id}" }${index === caseIds.length - 1 ? '' : ','}`).join('\n')}\n  ]\n}\n`;
  fs.writeFileSync(path.join(root, 'tests/visual/matrix.json'), matrix);
  const source = { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) };
  for (const platform of platforms) {
    const artifacts = Object.fromEntries(caseIds.map((id) => {
      const name = `${platform}-${id}.png`;
      const data = Buffer.alloc(320 * 320 * 4);
      for (let pixel = 0; pixel < 320 * 320; pixel += 1) {
        const x = pixel % 320;
        const y = Math.floor(pixel / 320);
        const offset = pixel * 4;
        const light = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
        data[offset] = light ? 235 : 30;
        data[offset + 1] = light ? 245 : 80;
        data[offset + 2] = light ? 255 : 150;
        data[offset + 3] = 255;
      }
      const bytes = PNG.sync.write({ width: 320, height: 320, data });
      fs.writeFileSync(path.join(baselineRoot, name), bytes);
      return [name, sha256(bytes)];
    }));
    fs.writeFileSync(path.join(baselineRoot, `${platform}.manifest.json`), `${JSON.stringify({
      schemaVersion: 2, capturedAt: '2026-01-01T00:00:00.000Z', platform, source,
      device: 'test', runtime: 'test', matrixSha256: sha256(Buffer.from(matrix)), artifacts,
      receipts: Object.fromEntries(caseIds.map((id) => [`${platform}-${id}.png`, {
        schemaVersion: 1, producer: 'tests/visual/capture.mjs', scenario: id, platform,
        matrixSha256: sha256(Buffer.from(matrix)), source,
        artifact: { sha256: artifacts[`${platform}-${id}.png`], width: 320, height: 320 },
        capture: { tool: platform === 'ios' ? 'simctl-screenshot' : 'adb-screencap', exitCode: 0 },
        semanticAssertions: requiredVisualSemantics({ scenario: id }).map((expected, index) => ({
          id: `semantic-${index + 1}`, expected, probe: platform === 'ios' ? 'maestro' : 'uiautomator', exitCode: 0,
        })),
      }])),
    }, null, 2)}\n`);
  }
  const artifacts = Object.fromEntries(fs.readdirSync(baselineRoot).filter((name) => name.endsWith('.png')).sort().map((name) => [name, sha256(fs.readFileSync(path.join(baselineRoot, name)))]));
  const manifests = Object.fromEntries(platforms.map((platform) => [`${platform}.manifest.json`, sha256(fs.readFileSync(path.join(baselineRoot, `${platform}.manifest.json`)))]));
  fs.writeFileSync(path.join(baselineRoot, 'release-review-attestation.json'), JSON.stringify({
    schemaVersion: 2, producer: 'github-actions-protected-review-environment/v2', decision: 'environment-approved',
    environment: 'release-evidence-review', source, matrixSha256: sha256(Buffer.from(matrix)), manifests, artifacts,
    evidenceArtifact: { name: 'release-evidence-unreviewed', id: '7', digest: 'd'.repeat(64), sourceRunId: '1', sourceRunAttempt: '1' },
    workflow: { repository: 'owner/repo', ref: 'owner/repo/.github/workflows/release-evidence.yml@refs/heads/main', sha: 'c'.repeat(40), runId: '1', runAttempt: '1', job: 'visual-review' },
    createdAt: '2026-01-01T01:00:00.000Z',
  }));
}

function selfTest() {
  const roots = [];
  const make = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-visual-')); roots.push(root); writeFixture(root); return root; };
  try {
    let root = make();
    assert.equal(verifyVisualEvidence(root).status, 'available');
    assert.equal(verifyVisualEvidence(root, { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }).status, 'available');
    assert.equal(verifyVisualEvidence(root, { commit: 'c'.repeat(40), packageSha256: 'b'.repeat(64) }).status, 'blocked');
    assert.equal(verifyVisualEvidence(root, { commit: 'c'.repeat(40), packageSha256: 'd'.repeat(64) }).status, 'blocked');
    root = make();
    const attestationPath = path.join(root, 'tests/visual/baselines/release-review-attestation.json');
    const attestation = JSON.parse(fs.readFileSync(attestationPath));
    attestation.workflow.ref = 'owner/repo/.github/workflows/unprotected.yml@refs/heads/main';
    fs.writeFileSync(attestationPath, JSON.stringify(attestation));
    assert.match(verifyVisualEvidence(root, { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }).errors.join('\n'), /separate protected review environment/);
    root = make();
    let iosPath = path.join(root, 'tests/visual/baselines/ios.manifest.json');
    let ios = JSON.parse(fs.readFileSync(iosPath));
    delete ios.receipts['ios-one.png'];
    fs.writeFileSync(iosPath, JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root, { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }).errors.join('\n'), /receipt is missing or invalid/);
    root = make();
    iosPath = path.join(root, 'tests/visual/baselines/ios.manifest.json');
    ios = JSON.parse(fs.readFileSync(iosPath));
    ios.receipts['ios-one.png'].semanticAssertions[0].expected = 'self-attested success';
    fs.writeFileSync(iosPath, JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root, { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }).errors.join('\n'), /receipt is missing or invalid/);
    root = make();
    iosPath = path.join(root, 'tests/visual/baselines/ios.manifest.json');
    ios = JSON.parse(fs.readFileSync(iosPath));
    ios.review = { reviewer: 'self-asserted', decision: 'approved' };
    fs.writeFileSync(iosPath, JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root, { commit: 'a'.repeat(40), packageSha256: 'b'.repeat(64) }).errors.join('\n'), /without imported reviewer claims/);
    root = make();
    iosPath = path.join(root, 'tests/visual/baselines/ios.manifest.json');
    ios = JSON.parse(fs.readFileSync(iosPath));
    delete ios.artifacts['ios-two.png'];
    fs.rmSync(path.join(root, 'tests/visual/baselines/ios-two.png'));
    ios.matrixSha256 = matrixSha256ForCases(fs.readFileSync(path.join(root, 'tests/visual/matrix.json')), ['one']);
    fs.writeFileSync(iosPath, JSON.stringify(ios));
    let result = verifyVisualEvidence(root);
    assert.equal(result.integrity, 'valid'); assert.deepEqual(result.platforms[0].missing, ['two']);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); delete ios.artifacts['ios-one.png']; fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /unreferenced PNG ios-one\.png/);
    root = make(); fs.rmSync(path.join(root, 'tests/visual/baselines/ios-one.png'));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /missing referenced PNG ios-one\.png/);
    root = make(); fs.appendFileSync(path.join(root, 'tests/visual/matrix.json'), ' ');
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /stale matrix SHA-256/);
    root = make(); fs.appendFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), 'changed');
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /(?:PNG hash mismatch|PNG cannot be decoded) ios-one\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); const blankPng = PNG.sync.write({ width: 320, height: 320, data: Buffer.alloc(320 * 320 * 4, 255) }); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), blankPng); ios.artifacts['ios-one.png'] = sha256(blankPng); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /PNG has no meaningful spatial visual content ios-one\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); const nearBlankData = Buffer.alloc(320 * 320 * 4, 255); for (let pixel = 0; pixel < 32; pixel += 1) nearBlankData[pixel * 4] = 0; const nearBlankPng = PNG.sync.write({ width: 320, height: 320, data: nearBlankData }); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), nearBlankPng); ios.artifacts['ios-one.png'] = sha256(nearBlankPng); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /PNG has no meaningful spatial visual content ios-one\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); const onePixelPng = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([0, 0, 0, 255]) }); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), onePixelPng); ios.artifacts['ios-one.png'] = sha256(onePixelPng); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /PNG dimensions are invalid ios-one\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); const oversizedPng = fs.readFileSync(path.join(root, 'tests/visual/baselines/ios-one.png')); oversizedPng.writeUInt32BE(4097, 16); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), oversizedPng); ios.artifacts['ios-one.png'] = sha256(oversizedPng); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /PNG dimensions are invalid ios-one\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); const invalidPng = Buffer.from('not an image'); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), invalidPng); ios.artifacts['ios-one.png'] = sha256(invalidPng); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /artifact is not a PNG ios-one\.png/);
    root = make(); fs.writeFileSync(path.join(root, 'tests/visual/baselines/extra.png'), 'extra');
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /unreferenced PNG extra\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); ios.artifacts['ios-ONE.png'] = ios.artifacts['ios-one.png']; fs.copyFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), path.join(root, 'tests/visual/baselines/ios-ONE.png')); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /duplicate manifest case ONE/);
    root = make(); const matrixPath = path.join(root, 'tests/visual/matrix.json'); fs.writeFileSync(matrixPath, fs.readFileSync(matrixPath, 'utf8').replace('{ "id": "two", "scenario": "two" }', '{ "id": "one", "scenario": "one" }'));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /duplicate cases one/);
    root = make(); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), '{');
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /ios manifest: malformed JSON/);
  } finally {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    console.log('Visual evidence integrity self-test passed.');
  } else {
    const rootIndex = process.argv.indexOf('--root');
    const root = rootIndex === -1 ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') : path.resolve(process.argv[rootIndex + 1] ?? '');
    if (rootIndex !== -1 && !process.argv[rootIndex + 1]) throw new Error('--root requires a path');
    const result = verifyVisualEvidence(root);
    if (result.integrity === 'invalid') {
      console.error(`Visual evidence integrity failed:\n- ${result.errors.join('\n- ')}`);
      process.exitCode = 1;
    } else if (result.completeness === 'blocked') {
      for (const platform of result.platforms) console.log(`${platform.platform} visual evidence incomplete: ${platform.missing.join(', ')}`);
    } else console.log('Visual evidence integrity and completeness passed.');
  }
}
