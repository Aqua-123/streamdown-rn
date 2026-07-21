import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import { defaultIcons, type IconMap } from './icons';

export function PanZoomSurface({ children, capabilities, min = 0.5, max = 3, step = 0.25, initialScale = 1, showControls = true, disabled, icons, color, backgroundColor, borderColor }: {
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  min?: number;
  max?: number;
  step?: number;
  initialScale?: number;
  showControls?: boolean;
  disabled?: boolean;
  icons?: IconMap;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
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
  const renderPanZoom = capabilities.gestures?.renderPanZoom;
  if (!renderPanZoom) return <>{children}</>;
  const content = renderPanZoom({ children, scale, onScaleChange: (value) => set(value) });
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
    {content}
    {showControls ? <View accessibilityRole="toolbar" style={{ flexDirection: 'row', borderWidth: 1, borderColor: borderColor ?? '#e4e4e7', borderRadius: 8, backgroundColor: backgroundColor ?? '#ffffff' }}>
      <ActionButton label="Zoom in" icon={icons?.zoomIn ?? defaultIcons.zoomIn} disabled={disabled || scale >= max} color={color} onAction={() => set(scale + step)} />
      <ActionButton label="Zoom out" icon={icons?.zoomOut ?? defaultIcons.zoomOut} disabled={disabled || scale <= min} color={color} onAction={() => set(scale - step)} />
      <ActionButton label="Reset zoom" icon={icons?.zoomReset ?? defaultIcons.zoomReset} disabled={disabled || scale === resetScale} color={color} onAction={() => set(resetScale)} />
    </View> : null}
  </View>;
}
