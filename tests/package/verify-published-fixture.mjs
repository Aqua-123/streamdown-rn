import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(root, 'tests/package/fixtures/published-0.2.1');
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, 'package.json'), 'utf8'));
assert.equal(manifest.npmIntegrity, 'sha512-KbnVYi85Xl7h9TJxWKsOFrEERF9bI3kcxUjbepayX1IHv9H/SIhQapqYlGmcEzoo/H/dToFXFN1mQsaOnHizvQ==');
assert.equal(manifest.tarballSha256, 'f86c31b995ed7e066a39861f0902c4c5d7f57efae26646a6484fa28683350876');

for (const [relative, expected] of Object.entries(manifest.declarationSha256)) {
  const bytes = fs.readFileSync(path.join(fixture, relative));
  const tarballBytes = bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
  assert.equal(crypto.createHash('sha256').update(tarballBytes).digest('hex'), expected, `${relative} differs from npm 0.2.1`);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-rn-published-types-'));
try {
  fs.writeFileSync(path.join(temporary, 'contract.ts'), `import type { StreamdownRNProps } from 'streamdown-rn';
const valid: StreamdownRNProps = { children: '# published', theme: 'dark' };
// @ts-expect-error npm 0.2.1 requires a complete ThemeConfig, not an arbitrary object.
const invalid: StreamdownRNProps = { children: '# published', theme: {} };
void valid; void invalid;
`);
  fs.writeFileSync(path.join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020', module: 'CommonJS', moduleResolution: 'Node', strict: true,
      skipLibCheck: true, noEmit: true, baseUrl: root,
      paths: { 'streamdown-rn': ['tests/package/fixtures/published-0.2.1/dist/index.d.ts'] },
    },
    include: ['./contract.ts'],
  }));
  const result = spawnSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', path.join(temporary, 'tsconfig.json')], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${result.stdout}${result.stderr}`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
process.stdout.write('Verified the integrity-pinned npm 0.2.1 declaration tree and strict theme contract.\n');
