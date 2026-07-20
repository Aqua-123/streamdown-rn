import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(override?: boolean): boolean {
  const [nativeValue, setNativeValue] = useState(false);
  useEffect(() => {
    if (override !== undefined) return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setNativeValue(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setNativeValue);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [override]);
  return override ?? nativeValue;
}
