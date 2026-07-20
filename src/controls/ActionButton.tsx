import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { CapabilityResult } from '../platform/capabilities';
import { failedCapability } from '../platform/capabilities';

export interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onAction: () => Promise<CapabilityResult> | CapabilityResult;
  onResult?: (result: CapabilityResult) => void;
  buttonRef?: React.Ref<View>;
}

function resultMessage(result: CapabilityResult): string | null {
  if (result.status === 'success') return null;
  return result.error?.message ?? ({
    unavailable: 'Unavailable', denied: 'Action denied', cancelled: 'Action cancelled', failed: 'Action failed',
  } as const)[result.status];
}

export function ActionButton({ label, icon, disabled, onAction, onResult, buttonRef }: ActionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(resultMessage(result));
    onResult?.(result);
  };
  const visual = icon ?? label;
  return (
    <View>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled), busy }}
        disabled={disabled || busy}
        onPress={press}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
      >
        {typeof visual === 'string' || typeof visual === 'number' ? <Text>{visual}</Text> : visual}
      </Pressable>
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{message}</Text> : null}
    </View>
  );
}
