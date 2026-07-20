import { AccessibilityInfo, Alert, Linking, Share } from 'react-native';
import type { LinkApprovalLabels, NativeCapabilities } from './capabilities';
import { failedCapability } from './capabilities';

const fallbackLabels: LinkApprovalLabels = {
  title: 'Open external link?',
  message: "You're about to visit an external website.",
  cancel: 'Close',
  open: 'Open link',
};

export const defaultNativeCapabilities: NativeCapabilities = {
  links: {
    approve: (url, labels = fallbackLabels) => new Promise((resolve) => {
      Alert.alert(labels.title, `${labels.message}\n\n${url}`, [
        { text: labels.cancel, style: 'cancel', onPress: () => resolve({ status: 'cancelled' }) },
        { text: labels.open, onPress: () => resolve({ status: 'success' }) },
      ], { cancelable: true, onDismiss: () => resolve({ status: 'cancelled' }) });
    }),
    open: async (url) => {
      try {
        if (!(await Linking.canOpenURL(url))) return { status: 'unavailable' };
        await Linking.openURL(url);
        return { status: 'success' };
      } catch (error) {
        return failedCapability(error);
      }
    },
  },
  share: {
    shareText: async (text, title) => {
      try {
        const result = await Share.share({ message: text, title });
        return { status: result.action === Share.dismissedAction ? 'cancelled' : 'success' };
      } catch (error) {
        return failedCapability(error);
      }
    },
  },
  announcements: { announce: (message) => AccessibilityInfo.announceForAccessibility(message) },
};

export function resolveCapabilities(overrides?: NativeCapabilities): NativeCapabilities {
  return {
    ...defaultNativeCapabilities,
    ...overrides,
    links: overrides?.links === false
      ? undefined
      : overrides?.links ?? defaultNativeCapabilities.links,
  };
}
