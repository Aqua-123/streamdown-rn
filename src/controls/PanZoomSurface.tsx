import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import { defaultIcons, type IconMap } from './icons';

export function PanZoomSurface({ children, capabilities, min = 0.5, max = 3, step = 0.25, icons }: {
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  min?: number;
  max?: number;
  step?: number;
  icons?: IconMap;
}) {
  const [scale, setScale] = useState(1);
  const set = (next: number) => { setScale(Math.min(max, Math.max(min, next))); return { status: 'success' as const }; };
  const content = capabilities.gestures?.renderPanZoom({ children, scale, onScaleChange: (value) => set(value) })
    ?? <View style={{ transform: [{ scale }] }}>{children}</View>;
  return <View>
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Zoom"
      accessibilityValue={{ min, max, now: scale }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') set(scale + step);
        if (event.nativeEvent.actionName === 'decrement') set(scale - step);
      }}
    />
    <View accessibilityRole="toolbar" style={{ flexDirection: 'row' }}>
      <ActionButton label="Zoom out" icon={icons?.zoomOut ?? defaultIcons.zoomOut} disabled={scale <= min} onAction={() => set(scale - step)} />
      <ActionButton label="Reset zoom" icon={icons?.zoomReset ?? defaultIcons.zoomReset} disabled={scale === 1} onAction={() => set(1)} />
      <ActionButton label="Zoom in" icon={icons?.zoomIn ?? defaultIcons.zoomIn} disabled={scale >= max} onAction={() => set(scale + step)} />
    </View>
    {content}
  </View>;
}
