const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// npm links the local Expo evidence module outside this fixture directory.
// Explicitly watch the real package location so Metro can follow that link both
// in this repository and when the release verifier relocates the fixture.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../hermes-evidence'),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
