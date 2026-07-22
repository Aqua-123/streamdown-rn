import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const platforms = ['ios', 'android'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
  assert.equal(manifest.matrixSha256, sha256(matrixBytes), 'Partial baseline updates require the full current visual matrix hash');
}

function readJson(file, errors, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${label}: malformed JSON (${error.message})`); return null; }
}

function metadataErrors(manifest, platform) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push(`${platform}: manifest schemaVersion must be 1`);
  for (const key of ['reviewId', 'device', 'runtime']) if (typeof manifest?.[key] !== 'string' || !manifest[key]) errors.push(`${platform}: manifest ${key} is required`);
  if (typeof manifest?.capturedAt !== 'string' || Number.isNaN(Date.parse(manifest.capturedAt))) errors.push(`${platform}: manifest capturedAt is invalid`);
  if (manifest?.platform !== platform) errors.push(`${platform}: manifest platform must be ${platform}`);
  if (!/^[a-f0-9]{64}$/.test(manifest?.matrixSha256 ?? '')) errors.push(`${platform}: manifest matrixSha256 is invalid`);
  if (!manifest?.artifacts || Array.isArray(manifest.artifacts) || typeof manifest.artifacts !== 'object') errors.push(`${platform}: manifest artifacts must be an object`);
  return errors;
}

export function verifyVisualEvidence(projectRoot) {
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
  const results = platforms.map((platform) => {
    const manifestPath = path.join(baselineRoot, `${platform}.manifest.json`);
    const manifest = readJson(manifestPath, errors, `${platform} manifest`);
    if (!manifest) return { platform, manifest: `tests/visual/baselines/${platform}.manifest.json`, integrity: 'invalid', completeness: 'blocked', missing: requiredIds };
    const start = errors.length;
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
      if (!fs.existsSync(artifactPath)) errors.push(`${platform}: missing referenced PNG ${name}`);
      else if (sha256(fs.readFileSync(artifactPath)) !== expectedHash) errors.push(`${platform}: PNG hash mismatch ${name}`);
    }
    if (/^[a-f0-9]{64}$/.test(manifest.matrixSha256 ?? '') && manifest.matrixSha256 !== matrixSha256ForCases(matrixBytes, caseIds)) {
      errors.push(`${platform}: stale matrix SHA-256`);
    }
    const missing = requiredIds.filter((id) => !caseIds.includes(id));
    return {
      platform,
      manifest: `tests/visual/baselines/${platform}.manifest.json`,
      integrity: errors.length === start ? 'valid' : 'invalid',
      completeness: missing.length ? 'blocked' : 'complete',
      missing,
    };
  });
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
  const matrix = `{\n  "schemaVersion": 1,\n  "cases": [\n${caseIds.map((id, index) => `    { "id": "${id}" }${index === caseIds.length - 1 ? '' : ','}`).join('\n')}\n  ]\n}\n`;
  fs.writeFileSync(path.join(root, 'tests/visual/matrix.json'), matrix);
  for (const platform of platforms) {
    const artifacts = Object.fromEntries(caseIds.map((id) => {
      const name = `${platform}-${id}.png`;
      const bytes = Buffer.from(`${platform}-${id}`);
      fs.writeFileSync(path.join(baselineRoot, name), bytes);
      return [name, sha256(bytes)];
    }));
    fs.writeFileSync(path.join(baselineRoot, `${platform}.manifest.json`), `${JSON.stringify({
      schemaVersion: 1, reviewId: 'test', capturedAt: '2026-01-01T00:00:00.000Z', platform,
      device: 'test', runtime: 'test', matrixSha256: sha256(Buffer.from(matrix)), artifacts,
    }, null, 2)}\n`);
  }
}

function selfTest() {
  const roots = [];
  const make = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-visual-')); roots.push(root); writeFixture(root); return root; };
  try {
    let root = make();
    assert.equal(verifyVisualEvidence(root).status, 'available');
    root = make();
    const iosPath = path.join(root, 'tests/visual/baselines/ios.manifest.json');
    let ios = JSON.parse(fs.readFileSync(iosPath));
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
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /PNG hash mismatch ios-one\.png/);
    root = make(); fs.writeFileSync(path.join(root, 'tests/visual/baselines/extra.png'), 'extra');
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /unreferenced PNG extra\.png/);
    root = make(); ios = JSON.parse(fs.readFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'))); ios.artifacts['ios-ONE.png'] = ios.artifacts['ios-one.png']; fs.copyFileSync(path.join(root, 'tests/visual/baselines/ios-one.png'), path.join(root, 'tests/visual/baselines/ios-ONE.png')); fs.writeFileSync(path.join(root, 'tests/visual/baselines/ios.manifest.json'), JSON.stringify(ios));
    assert.match(verifyVisualEvidence(root).errors.join('\n'), /duplicate manifest case ONE/);
    root = make(); const matrixPath = path.join(root, 'tests/visual/matrix.json'); fs.writeFileSync(matrixPath, fs.readFileSync(matrixPath, 'utf8').replace('{ "id": "two" }', '{ "id": "one" }'));
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
