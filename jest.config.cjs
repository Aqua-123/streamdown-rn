module.exports = {
  preset: 'react-native',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts?(x)',
    '<rootDir>/tests/parity/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: { '^react-native$': '<rootDir>/node_modules/react-native' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@testing-library/react-native|remark[^/]*|unified|bail|is-plain-obj|trough|vfile[^/]*|unist-util-[^/]+|micromark[^/]*|mdast-util-[^/]+|decode-named-character-reference|character-entities[^/]*|ccount|devlop|escape-string-regexp|longest-streak|markdown-table|zwitch)/)',
  ],
};
