import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import { defaultIcons, type IconMap } from './icons';

export function PanZoomSurface({ children, capabilities, min = 0.5, max = 3, step = 0.25, initialScale = 1, showControls = true, disabled, icons }: {
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  min?: number;
  max?: number;
  step?: number;
  initialScale?: number;
  showControls?: boolean;
  disabled?: boolean;
  icons?: IconMap;
}) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) throw new TypeError('PanZoomSurface requires finite bounds with 0 < min <= max');
  if (!Number.isFinite(step) || step <= 0) throw new TypeError('PanZoomSurface step must be positive and finite');
  if (!Number.isFinite(initialScale)) throw new TypeError('PanZoomSurface initialScale must be finite');
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  const resetScale = clamp(1);
  const [scale, setScale] = useState(() => clamp(initialScale));
  const set = (next: number) => {
    if (disabled || !Number.isFinite(next)) return { status: disabled ? 'unavailable' as const : 'failed' as const };
    setScale(clamp(next));
    return { status: 'success' as const };
  };
  const content = capabilities.gestures?.renderPanZoom({ children, scale, onScaleChange: (value) => set(value) })
    ?? <View style={{ transform: [{ scale }] }}>{children}</View>;
  return <View>
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Zoom"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityValue={{ min, max, now: scale }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') set(scale + step);
        if (event.nativeEvent.actionName === 'decrement') set(scale - step);
      }}
    />
    {showControls ? <View accessibilityRole="toolbar" style={{ flexDirection: 'row' }}>
      <ActionButton label="Zoom out" icon={icons?.zoomOut ?? defaultIcons.zoomOut} disabled={disabled || scale <= min} onAction={() => set(scale - step)} />
      <ActionButton label="Reset zoom" icon={icons?.zoomReset ?? defaultIcons.zoomReset} disabled={disabled || scale === resetScale} onAction={() => set(resetScale)} />
      <ActionButton label="Zoom in" icon={icons?.zoomIn ?? defaultIcons.zoomIn} disabled={disabled || scale >= max} onAction={() => set(scale + step)} />
    </View> : null}
    {content}
  </View>;
}
