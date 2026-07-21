import React, { forwardRef } from 'react';
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
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = forwardRef<View, ButtonProps>(function Button({
  children,
  variant = 'ghost',
  foregroundColor,
  disabled,
  accessibilityRole,
  accessibilityState,
  style,
  textStyle,
  ...props
}, ref) {
  return <Pressable
    {...props}
    ref={ref}
    accessibilityRole={accessibilityRole ?? 'button'}
    accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
    disabled={disabled}
    style={({ pressed }) => [styles.base, variant === 'menu' ? styles.menu : styles.ghost, pressed && styles.pressed, disabled && styles.disabled, style]}
  >
    {typeof children === 'string' || typeof children === 'number'
      ? <Text style={[styles.text, { color: foregroundColor }, textStyle]}>{children}</Text>
      : children}
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
