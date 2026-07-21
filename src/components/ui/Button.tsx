import React, { cloneElement, forwardRef, isValidElement, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type View,
  type ViewStyle,
} from 'react-native';

export type ButtonVariant = 'ghost' | 'menu';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  foregroundColor?: string;
  radius?: number;
  focusRingColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = forwardRef<View, ButtonProps>(function Button({
  children,
  variant = 'ghost',
  foregroundColor,
  radius,
  focusRingColor,
  disabled,
  accessibilityRole,
  accessibilityState,
  style,
  textStyle,
  onFocus,
  onBlur,
  ...props
}, ref) {
  const [focused, setFocused] = useState(false);
  const content = isValidElement<{ color?: string }>(children) && children.type !== React.Fragment && foregroundColor
    ? cloneElement(children, { color: foregroundColor })
    : children;
  return <Pressable
    {...props}
    ref={ref}
    accessibilityRole={accessibilityRole ?? 'button'}
    accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
    disabled={disabled}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={({ pressed }) => [
      styles.base,
      variant === 'menu' ? styles.menu : styles.ghost,
      radius === undefined ? undefined : { borderRadius: radius },
      focusRingColor ? { borderWidth: 1, borderColor: focused ? focusRingColor : 'transparent' } : undefined,
      pressed && styles.pressed,
      disabled && styles.disabled,
      style,
    ]}
  >
    {typeof children === 'string' || typeof children === 'number'
      ? <Text style={[styles.text, { color: foregroundColor }, textStyle]}>{children}</Text>
      : content}
  </Pressable>;
});

const styles = StyleSheet.create({
  base: { minHeight: 44, justifyContent: 'center' },
  ghost: { minWidth: 44, alignItems: 'center', paddingHorizontal: 8 },
  menu: { width: '100%', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 8 },
  text: { fontSize: 14 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.45 },
});
