import { View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { codeFileRequest } from './serialization';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

export function CodeControls({ code, language, capabilities, controls, translations, disabled, icons }: {
  code: string;
  language?: string | null;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  disabled?: boolean;
  icons?: IconMap;
}) {
  const copy = controlEnabled(controls, 'code', 'copy');
  const download = controlEnabled(controls, 'code', 'download');
  if (!copy && !download) return null;
  return (
    <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {copy ? <ActionButton
        label={translations.copyCode}
        icon={icons?.copy ?? defaultIcons.copy}
        disabled={disabled}
        onAction={() => capabilities.clipboard?.writeText(code) ?? {
          status: 'unavailable', error: new Error('Clipboard unavailable'),
        }}
      /> : null}
      {download ? <ActionButton
        label={translations.downloadFile}
        icon={icons?.download ?? defaultIcons.download}
        disabled={disabled}
        onAction={() => capabilities.files?.save(codeFileRequest(code, language)) ?? {
          status: 'unavailable', error: new Error('File saving unavailable'),
        }}
      /> : null}
    </View>
  );
}
