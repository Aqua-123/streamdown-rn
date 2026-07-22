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

export interface ButtonState {
  pressed: boolean;
  focused: boolean;
  hovered: boolean;
  disabled: boolean;
}

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: React.ReactNode | ((state: ButtonState) => React.ReactNode);
  variant?: ButtonVariant;
  foregroundColor?: string;
  radius?: number;
  focusRingColor?: string;
  style?: StyleProp<ViewStyle> | ((state: ButtonState) => StyleProp<ViewStyle>);
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
  onHoverIn,
  onHoverOut,
  ...props
}, ref) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const effectiveDisabled = Boolean(disabled || accessibilityState?.disabled);
  const getButtonState = (pressed: boolean): ButtonState => ({ pressed, focused, hovered, disabled: effectiveDisabled });
  return <Pressable
    {...props}
    ref={ref}
    accessibilityRole={accessibilityRole ?? 'button'}
    accessibilityState={{ ...accessibilityState, disabled: effectiveDisabled }}
    disabled={effectiveDisabled}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
    onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
    style={({ pressed }) => [
      styles.base,
      variant === 'menu' ? styles.menu : styles.ghost,
      radius === undefined ? undefined : { borderRadius: radius },
      focusRingColor ? { borderWidth: 1, borderColor: focused ? focusRingColor : 'transparent' } : undefined,
      pressed && styles.pressed,
      effectiveDisabled && styles.disabled,
      typeof style === 'function' ? style(getButtonState(pressed)) : style,
    ]}
  >
    {({ pressed }) => {
      const resolvedChildren = typeof children === 'function' ? children(getButtonState(pressed)) : children;
      const content = isValidElement<{ color?: string }>(resolvedChildren) && resolvedChildren.type !== React.Fragment && foregroundColor
        ? cloneElement(resolvedChildren, { color: foregroundColor })
        : resolvedChildren;
      return typeof resolvedChildren === 'string' || typeof resolvedChildren === 'number'
        ? <Text style={[styles.text, { color: foregroundColor }, textStyle]}>{resolvedChildren}</Text>
        : content;
    }}
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
