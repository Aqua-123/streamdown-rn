import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const allowed = /^(?:MIT|ISC|Apache-2\.0|BSD-(?:2|3)-Clause)$/;
const errors = [];
for (const name of Object.keys(pkg.dependencies ?? {}).sort()) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  if (typeof manifest.license !== 'string' || !allowed.test(manifest.license)) errors.push(`${name}: unsupported or missing direct runtime license ${String(manifest.license)}`);
}
for (const required of ['LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md']) {
  if (!fs.existsSync(path.join(root, required))) errors.push(`missing ${required}`);
}
if (pkg.license !== 'Apache-2.0') errors.push('package license must be Apache-2.0');
if (!pkg.repository?.url) errors.push('package repository URL is required');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Verified Apache-2.0 provenance and ${Object.keys(pkg.dependencies ?? {}).length} direct runtime dependency licenses.`);
