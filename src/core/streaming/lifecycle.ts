export type StreamUpdate =
  | { kind: 'identity'; from: number; added: '' }
  | { kind: 'append'; from: number; added: string }
  | { kind: 'reset'; from: 0; added: string };

export function classifyStreamUpdate(previous: string, next: string): StreamUpdate {
  if (previous === next) return { kind: 'identity', from: next.length, added: '' };
  if (next.length > previous.length && next.startsWith(previous)) {
    return { kind: 'append', from: previous.length, added: next.slice(previous.length) };
  }
  return { kind: 'reset', from: 0, added: next };
}

export interface AnimationConfig {
  animation?: 'fadeIn' | 'slideUp';
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  sep?: 'char' | 'word';
  stagger?: number;
}

export interface NormalizedAnimationConfig {
  animation: 'fadeIn' | 'slideUp';
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  sep: 'char' | 'word';
  stagger: number;
}

const DEFAULT_ANIMATION: NormalizedAnimationConfig = Object.freeze({
  animation: 'fadeIn',
  duration: 160,
  easing: 'ease-out',
  sep: 'word',
  stagger: 40,
});

export function normalizeAnimationConfig(
  value: boolean | AnimationConfig | undefined
): NormalizedAnimationConfig | null {
  if (!value) return null;
  if (value === true) return DEFAULT_ANIMATION;
  return {
    animation: value.animation ?? DEFAULT_ANIMATION.animation,
    duration: Math.max(0, value.duration ?? DEFAULT_ANIMATION.duration),
    easing: value.easing ?? DEFAULT_ANIMATION.easing,
    sep: value.sep ?? DEFAULT_ANIMATION.sep,
    stagger: Math.max(0, value.stagger ?? DEFAULT_ANIMATION.stagger),
  };
}

export function getAnimationWindow(
  previous: string,
  next: string,
  enabled: boolean,
  reducedMotion: boolean
): { from: number; to: number } | null {
  if (!enabled || reducedMotion || !next.startsWith(previous) || next.length <= previous.length) {
    return null;
  }
  return { from: previous.length, to: next.length };
}
