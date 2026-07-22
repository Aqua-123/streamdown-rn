import React, { useEffect, useRef, useState } from 'react';
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
  const activeSafe = useRef(safe);
  const activeLinks = useRef(capabilities.links);
  const operationGeneration = useRef(0);
  if (activeSafe.current !== safe || activeLinks.current !== capabilities.links) {
    activeSafe.current = safe;
    activeLinks.current = capabilities.links;
    operationGeneration.current += 1;
  }
  useEffect(() => {
    setBusy(false);
    setError(null);
    return () => { operationGeneration.current += 1; };
  }, [safe, capabilities.links]);
  if (!safe) return <Text>{children}</Text>;

  const press = async () => {
    if (busy) return;
    const generation = ++operationGeneration.current;
    const requestedURL = safe;
    setBusy(true);
    setError(null);
    let result: CapabilityResult;
    try {
      const links = capabilities.links;
      if (!links) result = { status: 'unavailable', error: new Error('Link opening unavailable') };
      else {
        const approval = await links.approve(requestedURL, {
              title: translations.openExternalLink,
              message: translations.externalLinkWarning,
              cancel: translations.close,
              open: translations.openLink,
            });
        if (generation !== operationGeneration.current || activeSafe.current !== requestedURL) return;
        result = approval.status === 'success' ? await links.open(requestedURL) : approval;
      }
    } catch (cause) { result = failedCapability(cause); }
    if (generation !== operationGeneration.current || activeSafe.current !== requestedURL) return;
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
