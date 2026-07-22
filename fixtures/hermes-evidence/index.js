import { requireNativeModule } from 'expo-modules-core';

const native = requireNativeModule('StreamdownHermesEvidence');
const EVENT_PREFIX = 'STREAMDOWN_HERMES_EVENT ';
const BUNDLE_PREFIX = 'STREAMDOWN_HERMES_BUNDLE ';
const COMPLETE_PREFIX = 'STREAMDOWN_HERMES_COMPLETE ';

function decodeConfig(value) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  try { return JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))); }
  catch { return null; }
}

export function startHermesEvidence() { native.startSession(); }
export function getHermesLaunchArguments() { return native.getLaunchArguments(); }
export function stopHermesEvidence() { native.stopSession(); }
export function beginHermesAppend(appendId) { native.beginAppend(appendId); }
export function endHermesAppend(appendId) { return native.endAppend(appendId); }
export function markHermesJsFrame() { native.markJsFrame(); }
export function emitHermesEvent(event) { console.log(EVENT_PREFIX + JSON.stringify(event)); }
export function emitHermesBundleReceipt(receipt) { console.log(BUNDLE_PREFIX + JSON.stringify(receipt)); }
export function completeHermesEvidence(receipt) { console.log(COMPLETE_PREFIX + JSON.stringify(receipt)); }
export function hermesNowNs() { return Math.round(performance.now() * 1_000_000); }
export function hermesHeapBytes() {
  const value = native.getProcessMemoryBytes();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('native process-memory instrumentation is unavailable');
  return value;
}

export function readHermesEvidenceConfig(url) {
  const fromUrl = url ? decodeConfig(new URL(url).searchParams.get('hermesEvidence')) : null;
  if (fromUrl) return fromUrl;
  const args = getHermesLaunchArguments();
  const index = args.indexOf('--streamdown-hermes-config');
  return index >= 0 ? decodeConfig(args[index + 1]) : null;
}

export function runHermesJsFrameLoop() {
  let active = true;
  let frame = requestAnimationFrame(function tick() {
    if (!active) return;
    markHermesJsFrame();
    frame = requestAnimationFrame(tick);
  });
  return () => {
    active = false;
    cancelAnimationFrame(frame);
  };
}
