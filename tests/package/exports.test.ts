import fs from 'node:fs';
import path from 'node:path';

describe('packed package', () => {
  it('loads every current runtime export from built files', () => {
    const packageRoot = process.env.PACKED_PACKAGE_PATH;
    expect(packageRoot).toBeTruthy();

    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot as string, 'package.json'), 'utf8')
    );
    const rootExport = manifest.exports['.'];

    expect(rootExport.types).toBe('./dist/index.d.ts');
    expect(rootExport['react-native']).toBe('./dist/index.js');
    expect(rootExport.default).toBe('./dist/index.js');

    for (const target of Object.values(rootExport) as string[]) {
      expect(fs.existsSync(path.join(packageRoot as string, target))).toBe(true);
    }

    const api = require(path.join(packageRoot as string, rootExport.default));
    expect(api.default).toBe(api.Streamdown);
    expect(api.StreamdownRN).toBe(api.Streamdown);
    for (const exportName of [
      'StreamdownRN',
      'Streamdown',
      'Skeleton',
      'SkeletonText',
      'SkeletonRect',
      'SkeletonCircle',
      'SkeletonNumber',
    ]) {
      expect(api[exportName]).toBeDefined();
    }
    expect(typeof api.sanitizeURL).toBe('function');
    expect(typeof api.sanitizeProps).toBe('function');
  });
});
