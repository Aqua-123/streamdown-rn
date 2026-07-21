import React, { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/ui';
import type { CapabilityResult } from '../platform/capabilities';
import { failedCapability } from '../platform/capabilities';

export interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onAction: () => Promise<CapabilityResult> | CapabilityResult;
  onResult?: (result: CapabilityResult) => void;
  buttonRef?: React.Ref<View>;
  successMessage?: string;
  resetAfterMs?: number;
  color?: string;
  expanded?: boolean;
}

function resultMessage(result: CapabilityResult): string | null {
  if (result.status === 'success') return null;
  return result.error?.message ?? ({
    unavailable: 'Unavailable', denied: 'Action denied', cancelled: 'Action cancelled', failed: 'Action failed',
  } as const)[result.status];
}

export function ActionButton({ label, icon, disabled, onAction, onResult, buttonRef, successMessage, resetAfterMs = 2000, color, expanded }: ActionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);
  const press = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setMessage(null);
    let result: CapabilityResult;
    try {
      const value = onAction();
      result = 'then' in Object(value) ? await value : value as CapabilityResult;
    } catch (error) { result = failedCapability(error); }
    setBusy(false);
    const nextMessage = result.status === 'success' ? successMessage ?? null : resultMessage(result);
    setMessage(nextMessage);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (nextMessage && result.status === 'success') resetTimer.current = setTimeout(() => setMessage(null), resetAfterMs);
    onResult?.(result);
  };
  const visual = icon ?? label;
  const coloredVisual = isValidElement<{ color?: string }>(visual) && color
    ? cloneElement(visual, { color })
    : visual;
  return (
    <View>
      <Button
        ref={buttonRef}
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled), busy, ...(expanded === undefined ? {} : { expanded }) }}
        disabled={disabled || busy}
        onPress={press}
        foregroundColor={color}
      >
        {typeof coloredVisual === 'string' || typeof coloredVisual === 'number' ? <Text style={{ color }}>{coloredVisual}</Text> : coloredVisual}
      </Button>
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color }}>{message}</Text> : null}
    </View>
  );
}
