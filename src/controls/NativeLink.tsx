import React from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import type { ResourcePolicy } from '../core/security';
import { sanitizeResourceURL } from '../core/security';
import type { CapabilityResult, NativeCapabilities } from '../platform/capabilities';
import type { StreamdownTranslations } from './translations';
import { defaultTranslations } from './translations';
import { useLinkAction } from './useLinkAction';

export interface NativeLinkProps {
  url: string;
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  resourcePolicy?: ResourcePolicy;
  translations?: StreamdownTranslations;
  style?: StyleProp<TextStyle>;
  onResult?: (result: CapabilityResult) => void;
}

export function NativeLink({ url, children, capabilities, resourcePolicy, translations = defaultTranslations, style, onResult }: NativeLinkProps) {
  const safe = sanitizeResourceURL(url, 'link', resourcePolicy);
  const { busy, error, press } = useLinkAction(capabilities, resourcePolicy, translations, onResult, safe);
  if (!safe) return <Text>{children}</Text>;

  return (
    <Text
      accessibilityRole="link"
      accessibilityState={{ busy }}
      onPress={() => { void press(safe); }}
      style={style}
    >
      {children}
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </Text>
  );
}
