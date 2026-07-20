import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const EASING = {
  linear: Easing.linear,
  'ease-in': Easing.in(Easing.ease),
  'ease-out': Easing.out(Easing.ease),
  'ease-in-out': Easing.inOut(Easing.ease),
};

export function AnimatedRevealText({
  children,
  duration,
  easing,
  animation,
  delay,
}: {
  children: string;
  duration: number;
  easing: keyof typeof EASING;
  animation: 'fadeIn' | 'slideUp';
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(animation === 'slideUp' ? 6 : 0)).current;
  useEffect(() => {
    const animations = [Animated.timing(opacity, {
      toValue: 1, duration, delay, easing: EASING[easing], useNativeDriver: true,
    })];
    if (animation === 'slideUp') {
      animations.push(Animated.timing(translateY, {
        toValue: 0, duration, delay, easing: EASING[easing], useNativeDriver: true,
      }));
    }
    const running = Animated.parallel(animations);
    running.start();
    return () => running.stop();
  }, [animation, delay, duration, easing, opacity, translateY]);
  return <Animated.Text testID="streamdown-new-content" style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.Text>;
}
