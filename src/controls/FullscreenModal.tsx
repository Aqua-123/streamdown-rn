import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { defaultIcons, type IconMap } from './icons';

export function FullscreenModal({ visible, label, closeLabel, children, capabilities, restoreTarget, onClose, icons }: {
  visible: boolean;
  label: string;
  closeLabel: string;
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  restoreTarget?: unknown;
  onClose: () => void;
  icons?: IconMap;
}) {
  const close = () => {
    onClose();
    capabilities.focus?.restore(restoreTarget);
  };
  const closeIcon = icons?.close ?? defaultIcons.close;
  return (
    <Modal visible={visible} transparent={false} animationType="none" onRequestClose={close}>
      <View
        accessibilityViewIsModal
        style={{ flex: 1, padding: 16 }}
      >
        <Text
          accessible
          accessibilityRole="alert"
          accessibilityLabel={label}
          accessibilityState={{ expanded: visible }}
          accessibilityActions={[{ name: 'escape', label: closeLabel }]}
          onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'escape') close(); }}
        >{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={close}
          style={{ minWidth: 44, minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' }}
        >{typeof closeIcon === 'string' || typeof closeIcon === 'number' ? <Text>{closeIcon}</Text> : closeIcon}</Pressable>
        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}
