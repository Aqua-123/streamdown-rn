import React from 'react';
import { View } from 'react-native';
import { Action } from '../components/ui/Action';
import type { CapabilityResult } from '../platform/capabilities';

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
  radius?: number;
  focusRingColor?: string;
}

export function ActionButton({ label, icon, disabled, onAction, onResult, buttonRef, successMessage, resetAfterMs = 2000, color, expanded, radius, focusRingColor }: ActionButtonProps) {
  const visual = icon ?? label;
  return (
    <Action.Root disabled={disabled} onAction={onAction} onResult={onResult} successMessage={successMessage} resetAfterMs={resetAfterMs}>
      <View>
        <Action.Trigger
          ref={buttonRef}
          accessibilityLabel={label}
          accessibilityState={expanded === undefined ? undefined : { expanded }}
          foregroundColor={color}
          radius={radius}
          focusRingColor={focusRingColor}
        >
          {visual}
        </Action.Trigger>
        <Action.Status style={{ color }} />
      </View>
    </Action.Root>
  );
}
