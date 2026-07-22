import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResourcePolicy } from '../core/security';
import { sanitizeResourceURL } from '../core/security';
import type { CapabilityResult, NativeCapabilities } from '../platform/capabilities';
import { failedCapability } from '../platform/capabilities';
import type { StreamdownTranslations } from './translations';

export function useLinkAction(
  capabilities: NativeCapabilities,
  resourcePolicy: ResourcePolicy | undefined,
  translations: StreamdownTranslations,
  onResult?: (result: CapabilityResult) => void,
  operationKey?: unknown
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const activeLinks = useRef(capabilities.links);
  const activePolicy = useRef(resourcePolicy);
  const activeOperationKey = useRef(operationKey);
  if (activeLinks.current !== capabilities.links) {
    activeLinks.current = capabilities.links;
    generation.current += 1;
  }
  if (activePolicy.current !== resourcePolicy) {
    activePolicy.current = resourcePolicy;
    generation.current += 1;
  }
  if (activeOperationKey.current !== operationKey) {
    activeOperationKey.current = operationKey;
    generation.current += 1;
  }
  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [capabilities.links, operationKey, resourcePolicy]);
  useEffect(() => () => { generation.current += 1; }, []);

  const press = useCallback(async (url: string) => {
    const safe = sanitizeResourceURL(url, 'link', resourcePolicy);
    if (!safe || busy) return;
    const operation = ++generation.current;
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
        if (operation !== generation.current) return;
        result = approval.status === 'success' ? await links.open(safe) : approval;
      }
    } catch (cause) { result = failedCapability(cause); }
    if (operation !== generation.current) return;
    setBusy(false);
    if (result.status !== 'success') setError(result.error?.message ?? `Link ${result.status}`);
    onResult?.(result);
  }, [busy, capabilities.links, onResult, resourcePolicy, translations]);

  return { busy, error, press };
}
