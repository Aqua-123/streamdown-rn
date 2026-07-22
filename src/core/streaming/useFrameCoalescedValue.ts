import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Presents append-only updates at most once per display frame. Resets and
 * disabled states bypass the queue so corrections and completion are atomic.
 */
export function useFrameCoalescedValue(value: string, enabled: boolean, resetKey?: string | number): string {
  const [, presentFrame] = useState(0);
  const latest = useRef(value);
  const presentedRef = useRef(value);
  const keyRef = useRef(resetKey);
  const frame = useRef<number | null>(null);
  latest.current = value;

  const immediate = !enabled || keyRef.current !== resetKey || !value.startsWith(presentedRef.current);
  const output = immediate ? value : presentedRef.current;

  useLayoutEffect(() => {
    if (immediate) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      keyRef.current = resetKey;
      presentedRef.current = value;
      return;
    }
    if (value === presentedRef.current || frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      presentedRef.current = latest.current;
      presentFrame((current) => current + 1);
    });
  }, [immediate, resetKey, value]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return output;
}
