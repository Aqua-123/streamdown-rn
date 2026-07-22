import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const svgPeerRange = '>=15.12.1 <16.0.0';

export const assertSvgPeerManifest = (manifest) => {
  assert.equal(manifest.peerDependencies?.['react-native-svg'], svgPeerRange);
  assert.equal(manifest.dependencies?.['react-native-svg'], undefined);
};

export const assertSingleHostSvg = (consumer, run) => {
  const paths = run('npm', ['ls', 'react-native-svg', '--all', '--parseable'], { cwd: consumer })
    .split('\n')
    .filter((entry) => path.basename(entry) === 'react-native-svg');
  assert.deepEqual(paths.map((entry) => fs.realpathSync(entry)), [fs.realpathSync(path.join(consumer, 'node_modules/react-native-svg'))]);
};
