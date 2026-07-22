import { createContext, forwardRef, useContext } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { Button, type ButtonProps } from './Button';

export type ToolbarOrientation = 'horizontal' | 'vertical';

export interface ToolbarState {
  disabled: boolean;
  orientation: ToolbarOrientation;
}

const ToolbarContext = createContext<ToolbarState | null>(null);

function useToolbar(): ToolbarState {
  const value = useContext(ToolbarContext);
  if (!value) throw new Error('Toolbar parts must be rendered inside Toolbar.Root');
  return value;
}

export interface ToolbarRootProps extends Omit<ViewProps, 'accessibilityRole' | 'children'> {
  children: React.ReactNode | ((state: ToolbarState) => React.ReactNode);
  orientation?: ToolbarOrientation;
  disabled?: boolean;
}

export const ToolbarRoot = forwardRef<View, ToolbarRootProps>(function ToolbarRoot({ orientation = 'horizontal', disabled = false, accessibilityState, style, children, ...props }, ref) {
  const direction: ViewStyle = { flexDirection: orientation === 'horizontal' ? 'row' : 'column' };
  const effectiveDisabled = Boolean(disabled || accessibilityState?.disabled);
  const state = { disabled: effectiveDisabled, orientation } as const;
  return <ToolbarContext.Provider value={state}>
    <View
      {...props}
      ref={ref}
      accessibilityRole="toolbar"
      accessibilityState={{ ...accessibilityState, disabled: effectiveDisabled }}
      style={[direction, style]}
    >{typeof children === 'function' ? children(state) : children}</View>
  </ToolbarContext.Provider>;
});

export interface ToolbarButtonProps extends ButtonProps {}

export const ToolbarButton = forwardRef<View, ToolbarButtonProps>(function ToolbarButton({ disabled, accessibilityState, ...props }, ref) {
  const toolbar = useToolbar();
  const effectiveDisabled = Boolean(disabled || toolbar.disabled);
  return <Button {...props} ref={ref} accessibilityState={{ ...accessibilityState, disabled: effectiveDisabled }} disabled={effectiveDisabled} />;
});

export const Toolbar = { Root: ToolbarRoot, Button: ToolbarButton };
