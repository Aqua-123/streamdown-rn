export const u9AdapterDeviceScenarios = [
  'ios-native-math-inline-block-matrix-fallback',
  'android-native-math-inline-block-matrix-fallback',
  'ios-mermaid-supported-families-panzoom-fullscreen-voiceover',
  'android-mermaid-supported-families-panzoom-fullscreen-talkback',
  'ios-offline-webview-timeout-retry-teardown',
  'android-offline-webview-timeout-retry-teardown',
] as const;

/** Scenario definitions only. Recorded simulator/device evidence is owned by U10. */
export type U9AdapterDeviceScenario = typeof u9AdapterDeviceScenarios[number];
