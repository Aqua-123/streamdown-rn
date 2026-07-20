import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import type { ResourcePolicy } from '../core/security';
import { sanitizeResourceURL } from '../core/security';
import type { CapabilityResult, NativeCapabilities } from '../platform/capabilities';
import { failedCapability } from '../platform/capabilities';
import type { StreamdownTranslations } from './translations';
import { defaultTranslations } from './translations';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setBusy(false); setError(null); }, [safe]);
  if (!safe) return <Text>{children}</Text>;

  const press = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    let result: CapabilityResult;
    try {
      const links = capabilities.links;
      if (!links) result = { status: 'unavailable', error: new Error('Link opening unavailable') };
      else {
        const approval = await links.approve(safe, {
              title: translations.openExternalLink,
              message: translations.externalLinkWarning,
              cancel: translations.close,
              open: translations.openLink,
            });
        result = approval.status === 'success' ? await links.open(safe) : approval;
      }
    } catch (cause) { result = failedCapability(cause); }
    setBusy(false);
    if (result.status !== 'success') setError(result.error?.message ?? `Link ${result.status}`);
    onResult?.(result);
  };

  return (
    <Text
      accessibilityRole="link"
      accessibilityState={{ busy }}
      onPress={press}
      style={style}
    >
      {children}
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </Text>
  );
}
