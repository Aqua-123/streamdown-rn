module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import ai.darkresearch.streamdown.StreamdownTextPackage;',
        packageInstance: 'new StreamdownTextPackage()',
        cmakeListsPath: './src/main/jni/CMakeLists.txt',
      },
    },
  },
};
