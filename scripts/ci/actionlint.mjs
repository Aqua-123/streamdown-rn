import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const version = '1.7.12';
const assets = {
  'darwin-arm64': 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
  'darwin-x64': '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644',
  'linux-arm64': '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6',
  'linux-x64': '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
};

const key = `${process.platform}-${process.arch}`;
const expected = assets[key];
if (!expected) throw new Error(`Actionlint bootstrap does not support ${key}`);
const releaseArch = process.arch === 'x64' ? 'amd64' : process.arch;
const name = `actionlint_${version}_${process.platform}_${releaseArch}.tar.gz`;
const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${name}`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-actionlint-'));

try {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Actionlint download failed with HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actual = crypto.createHash('sha256').update(archive).digest('hex');
  if (actual !== expected) throw new Error(`Actionlint archive checksum mismatch: ${actual}`);
  const archivePath = path.join(temporary, name);
  fs.writeFileSync(archivePath, archive, { mode: 0o600 });
  const extract = spawnSync('tar', ['-xzf', archivePath, '-C', temporary, 'actionlint'], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error(`Could not extract Actionlint:\n${extract.stdout}${extract.stderr}`);
  const result = spawnSync(path.join(temporary, 'actionlint'), ['-color', '-oneline'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
