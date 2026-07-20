import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { ThemeConfig } from '../core/types';
import type { NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import type { StreamdownTranslations } from './translations';
import { fetchImageFileRequest } from './serialization';
import { defaultIcons, type IconMap } from './icons';

export function SafeImage({ uri, alt, theme, capabilities, controls, translations, icons, disabled, onLoad, onError, width, height }: {
  uri: string;
  alt?: string;
  theme: ThemeConfig;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  icons?: IconMap;
  disabled?: boolean;
  onLoad?: () => void;
  onError?: (error?: unknown) => void;
  width?: number;
  height?: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  useEffect(() => {
    setState('loading');
    setAspectRatio(16 / 9);
  }, [uri]);
  useEffect(() => {
    let mounted = true;
    Image.getSize(uri, (width, height) => {
      if (mounted && width > 0 && height > 0) setAspectRatio(width / height);
    }, () => undefined);
    return () => { mounted = false; };
  }, [uri, attempt]);
  if (state === 'failed') {
    return <View accessibilityRole="alert"><Text style={{ color: theme.colors.foreground }}>{translations.imageNotAvailable}</Text><ActionButton
      label={translations.retryImage}
      icon={icons?.retry ?? defaultIcons.retry}
      color={theme.colors.foreground}
      onAction={() => { setState('loading'); setAttempt((value) => value + 1); return { status: 'success' }; }}
    /></View>;
  }
  const decorative = !alt;
  return (
    <View accessibilityState={{ busy: state === 'loading' }}>
      <Image
        key={`${uri}:${attempt}`}
        source={{ uri }}
        style={[{ width: width ?? '100%', height, aspectRatio: height ? undefined : aspectRatio, backgroundColor: theme.colors.codeBackground }]}
        resizeMode="contain"
        accessible={!decorative}
        accessibilityRole={decorative ? undefined : 'image'}
        accessibilityLabel={decorative ? undefined : alt}
        onLoad={() => { setState('loaded'); onLoad?.(); }}
        onError={(event) => { setState('failed'); onError?.(event); }}
      />
      {(state === 'loaded' || Boolean(width && height)) && controlEnabled(controls, 'image', 'download') && capabilities.files ? <ActionButton
        label={translations.downloadImage}
        icon={icons?.download ?? defaultIcons.download}
        disabled={disabled}
        color={theme.colors.foreground}
        onAction={async () => capabilities.files!.save(await fetchImageFileRequest(uri, alt || 'image'))}
      /> : null}
    </View>
  );
}
