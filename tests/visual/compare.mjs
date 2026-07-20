import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export function comparePng(actualPath, baselinePath, diffPath, options) {
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    throw new Error(`Image dimensions differ: actual ${actual.width}x${actual.height}, baseline ${baseline.width}x${baseline.height}`);
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const changed = pixelmatch(actual.data, baseline.data, diff.data, actual.width, actual.height, { threshold: options.pixelThreshold });
  const ratio = changed / (actual.width * actual.height);
  if (ratio > options.maxDifferentPixelRatio) {
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    throw new Error(`Visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(options.maxDifferentPixelRatio * 100).toFixed(3)}%`);
  }
  return ratio;
}
