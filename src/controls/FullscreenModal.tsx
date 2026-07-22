import React, { cloneElement, isValidElement, useCallback, useEffect, useRef } from 'react';
import { InteractionManager, Modal, Platform, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import type { NativeCapabilities } from '../platform/capabilities';
import { defaultIcons, type IconMap } from './icons';

export interface FullscreenModalProps {
  visible: boolean;
  label: string;
  closeLabel: string;
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  restoreTarget?: unknown;
  onClose: () => void;
  icons?: IconMap;
  color?: string;
  backgroundColor?: string;
  contentMode?: 'horizontal' | 'document' | 'canvas';
}

export function FullscreenModal({ visible, label, closeLabel, children, capabilities, restoreTarget, onClose, icons, color, backgroundColor, contentMode = 'horizontal' }: FullscreenModalProps) {
  const closeRequested = useRef(false);
  const restorePending = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const restoreFocus = useCallback(() => {
    if (visibleRef.current || !restorePending.current) return;
    restorePending.current = false;
    capabilities.focus?.restore(restoreTarget);
  }, [capabilities.focus, restoreTarget]);
  const close = () => {
    if (!visible || closeRequested.current) return;
    closeRequested.current = true;
    restorePending.current = true;
    onClose();
  };
  useEffect(() => {
    if (visible) {
      closeRequested.current = false;
      return;
    }
    if (!restorePending.current || Platform.OS !== 'android') return;
    const task = InteractionManager.runAfterInteractions(restoreFocus);
    return () => task.cancel();
  }, [restoreFocus, visible]);
  const closeIcon = icons?.close ?? defaultIcons.close;
  const coloredCloseIcon = isValidElement<{ color?: string }>(closeIcon) && color ? cloneElement(closeIcon, { color }) : closeIcon;
  const content = contentMode === 'document'
    ? <ScrollView testID="fullscreen-content-document" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>
    : contentMode === 'canvas'
      ? <View testID="fullscreen-content-canvas" style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      : <ScrollView testID="fullscreen-content-horizontal" horizontal contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>;
  return (
    <Modal visible={visible} transparent={false} animationType="none" onRequestClose={close} onDismiss={restoreFocus}>
      {visible ? <SafeAreaView style={{ flex: 1, backgroundColor }}>
        <View
          accessibilityViewIsModal
          style={{ flex: 1, padding: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 16 }}
        >
          <Text
            accessible
            accessibilityRole="alert"
            accessibilityLabel={label}
            accessibilityState={{ expanded: visible }}
            accessibilityActions={[{ name: 'escape', label: closeLabel }]}
            onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'escape') close(); }}
            style={{ color }}
          >{label}</Text>
          <Button
            accessibilityLabel={closeLabel}
            onPress={close}
            style={{ minWidth: 44, minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' }}
          >{typeof coloredCloseIcon === 'string' || typeof coloredCloseIcon === 'number' ? <Text style={{ color }}>{coloredCloseIcon}</Text> : coloredCloseIcon}</Button>
          {content}
        </View>
      </SafeAreaView> : null}
    </Modal>
  );
}
