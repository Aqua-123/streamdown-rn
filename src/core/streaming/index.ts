export {
  classifyStreamUpdate,
  getAnimationWindow,
  getAnimationWindowFrom,
  normalizeAnimationConfig,
  type AnimationConfig,
  type NormalizedAnimationConfig,
  type StreamUpdate,
} from './lifecycle';
export {
  createStreamingInstrumentation,
  type StreamingInstrumentation,
  type StreamingMetrics,
} from './instrumentation';
export { StableRootCache } from './stableRootCache';
export { useReducedMotion } from './useReducedMotion';
export { useFrameCoalescedValue } from './useFrameCoalescedValue';
