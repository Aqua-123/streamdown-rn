import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const REQUIRED = [
  'benchmarks/results',
  'tests/device/evidence.json',
  'tests/device/results',
  'tests/visual/baselines',
];

function fail(message) { throw new Error(message); }

export function validateEvidenceDirectory(target, options = {}) {
  const limits = {
    maxFiles: options.maxFiles ?? 2_000,
    maxTotalBytes: options.maxTotalBytes ?? 8 * GIB,
    maxFileBytes: options.maxFileBytes ?? 2 * GIB,
    maxJsonBytes: options.maxJsonBytes ?? 10 * MIB,
  };
  const rootStat = fs.lstatSync(target);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('Evidence root must be a real directory');
  const resolved = fs.realpathSync(target);
  if (options.allowedPrefix) {
    const allowed = fs.realpathSync(options.allowedPrefix);
    const relative = path.relative(allowed, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail(`Evidence must be below ${allowed}`);
  }
  for (const required of REQUIRED) {
    const entry = path.join(resolved, required);
    const stat = fs.lstatSync(entry);
    if (required.endsWith('.json') ? !stat.isFile() : !stat.isDirectory()) fail(`Invalid required evidence path: ${required}`);
  }
  let files = 0;
  let totalBytes = 0;
  const visit = (current) => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(`Evidence must not contain symlinks: ${current}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current)) visit(path.join(current, name));
      return;
    }
    if (!stat.isFile()) fail(`Evidence must contain only files and directories: ${current}`);
    files += 1;
    totalBytes += stat.size;
    if (files > limits.maxFiles) fail(`Evidence exceeds ${limits.maxFiles} files`);
    if (stat.size > limits.maxFileBytes) fail(`Evidence file exceeds ${limits.maxFileBytes} bytes: ${current}`);
    if (current.endsWith('.json') && stat.size > limits.maxJsonBytes) fail(`Evidence JSON exceeds ${limits.maxJsonBytes} bytes: ${current}`);
    if (totalBytes > limits.maxTotalBytes) fail(`Evidence exceeds ${limits.maxTotalBytes} aggregate bytes`);
  };
  visit(resolved);
  if (files === 0) fail('Evidence directory is empty');
  return { resolved, files, totalBytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const prefixIndex = process.argv.indexOf('--allowed-prefix');
  if (!target) fail('Usage: validate-evidence-directory.mjs DIRECTORY [--allowed-prefix DIRECTORY]');
  console.log(JSON.stringify(validateEvidenceDirectory(target, {
    allowedPrefix: prefixIndex >= 0 ? process.argv[prefixIndex + 1] : undefined,
  })));
}
