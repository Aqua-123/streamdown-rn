import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Text, type TextProps, type View } from 'react-native';
import type { CapabilityResult } from '../../platform/capabilities';
import { failedCapability } from '../../platform/capabilities';
import { Button, type ButtonProps } from './Button';

export interface ActionState {
  busy: boolean;
  disabled: boolean;
  result: CapabilityResult | null;
  message: string | null;
  run: () => Promise<void>;
}

export interface ActionRootProps {
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  onAction: () => Promise<CapabilityResult> | CapabilityResult;
  onResult?: (result: CapabilityResult) => void;
  disabled?: boolean;
  successMessage?: string;
  resetAfterMs?: number;
}

const ActionContext = createContext<ActionState | null>(null);

function useAction(): ActionState {
  const value = useContext(ActionContext);
  if (!value) throw new Error('Action parts must be rendered inside Action.Root');
  return value;
}

function resultMessage(result: CapabilityResult): string | null {
  if (result.status === 'success') return null;
  return result.error?.message ?? ({
    unavailable: 'Unavailable', denied: 'Action denied', cancelled: 'Action cancelled', failed: 'Action failed',
  } as const)[result.status];
}

export function ActionRoot({ children, onAction, onResult, disabled = false, successMessage, resetAfterMs = 2000 }: ActionRootProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CapabilityResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);
  const run = useCallback(async () => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusy(true);
    setResult(null);
    setMessage(null);
    let next: CapabilityResult;
    try {
      const value = onAction();
      next = 'then' in Object(value) ? await value : value as CapabilityResult;
    } catch (error) {
      next = failedCapability(error);
    }
    if (!mounted.current) return;
    busyRef.current = false;
    setBusy(false);
    setResult(next);
    const nextMessage = next.status === 'success' ? successMessage ?? null : resultMessage(next);
    setMessage(nextMessage);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (nextMessage && next.status === 'success') resetTimer.current = setTimeout(() => {
      if (mounted.current) setMessage(null);
    }, resetAfterMs);
    onResult?.(next);
  }, [disabled, onAction, onResult, resetAfterMs, successMessage]);
  const value = useMemo<ActionState>(() => ({ busy, disabled, result, message, run }), [busy, disabled, message, result, run]);
  return <ActionContext.Provider value={value}>{typeof children === 'function' ? children(value) : children}</ActionContext.Provider>;
}

export interface ActionTriggerProps extends Omit<ButtonProps, 'onPress'> {}

export const ActionTrigger = forwardRef<View, ActionTriggerProps>(function ActionTrigger({ disabled, accessibilityState, ...props }, ref) {
  const action = useAction();
  const effectiveDisabled = Boolean(disabled || action.disabled || action.busy);
  return <Button
    {...props}
    ref={ref}
    accessibilityState={{ ...accessibilityState, busy: action.busy, disabled: effectiveDisabled }}
    disabled={effectiveDisabled}
    onPress={action.run}
  />;
});

export interface ActionStatusProps extends Omit<TextProps, 'children'> {}

export function ActionStatus({ accessibilityRole, accessibilityLiveRegion, ...props }: ActionStatusProps) {
  const { message } = useAction();
  if (!message) return null;
  return <Text {...props} accessibilityRole={accessibilityRole ?? 'alert'} accessibilityLiveRegion={accessibilityLiveRegion ?? 'polite'}>{message}</Text>;
}

export const Action = { Root: ActionRoot, Trigger: ActionTrigger, Status: ActionStatus };
