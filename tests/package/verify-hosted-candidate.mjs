import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-rn-hosted-candidate-'));

const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const inheritedCandidate = (env) => {
  if (!env.STREAMDOWN_RELEASE_TARBALL) return null;
  const tarball = path.resolve(root, env.STREAMDOWN_RELEASE_TARBALL);
  if (!fs.existsSync(tarball)) throw new Error(`Missing release tarball ${tarball}`);
  if (!/^[a-f0-9]{64}$/.test(env.STREAMDOWN_RELEASE_PACKAGE_SHA256 ?? '')) {
    throw new Error('STREAMDOWN_RELEASE_PACKAGE_SHA256 is required with STREAMDOWN_RELEASE_TARBALL');
  }
  assert.equal(digest(tarball), env.STREAMDOWN_RELEASE_PACKAGE_SHA256, 'Release tarball SHA-256 mismatch');
  return tarball;
};

if (process.argv.includes('--self-test')) {
  const sentinel = path.join(temporary, 'sealed.tgz');
  fs.writeFileSync(sentinel, 'sealed candidate');
  const expected = digest(sentinel);
  assert.equal(inheritedCandidate({ STREAMDOWN_RELEASE_TARBALL: sentinel, STREAMDOWN_RELEASE_PACKAGE_SHA256: expected }), sentinel);
  assert.throws(() => inheritedCandidate({ STREAMDOWN_RELEASE_TARBALL: sentinel, STREAMDOWN_RELEASE_PACKAGE_SHA256: '0'.repeat(64) }), /SHA-256 mismatch/);
  assert.throws(() => inheritedCandidate({ STREAMDOWN_RELEASE_TARBALL: sentinel }), /SHA256 is required/);
  fs.rmSync(temporary, { recursive: true, force: true });
  process.stdout.write('Hosted candidate inheritance self-test passed without building or packing.\n');
  process.exit(0);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? 1}`);
};

try {
  const supplied = inheritedCandidate(process.env);
  let tarball;
  let filename;
  if (supplied) {
    tarball = supplied;
    filename = path.basename(tarball);
  } else {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'removed-source-artifact.js'), 'throw new Error("stale build output");\n');
    run('npm', ['run', 'build']);
    const packed = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], {
      cwd: root,
      encoding: 'utf8',
    });
    if (packed.status !== 0) throw new Error(`${packed.stdout}${packed.stderr}`);
    [{ filename }] = JSON.parse(packed.stdout);
    tarball = path.join(temporary, filename);
  }
  const sha256 = digest(tarball);
  const env = {
    ...process.env,
    STREAMDOWN_RELEASE_TARBALL: tarball,
    STREAMDOWN_RELEASE_PACKAGE_SHA256: sha256,
  };

  run(process.execPath, ['scripts/docs/verify.mjs'], { env });
  run(process.execPath, ['tests/package/verify-pack.mjs'], { env });
  run(process.execPath, ['tests/package/verify-optional-renderers.mjs'], { env });
  process.stdout.write(`Verified one hosted candidate ${filename} (${sha256}).\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
