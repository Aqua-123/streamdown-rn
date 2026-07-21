import { View } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import { codeFileRequest } from './serialization';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

export function CodeControls({ code, language, capabilities, controls, translations, disabled, icons, color }: {
  code: string;
  language?: string | null;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  disabled?: boolean;
  icons?: IconMap;
  color?: string;
}) {
  const copy = controlEnabled(controls, 'code', 'copy') && Boolean(capabilities.clipboard);
  const download = controlEnabled(controls, 'code', 'download') && Boolean(capabilities.files);
  if (!copy && !download) return null;
  return (
    <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {copy ? <ActionButton
        label={translations.copyCode}
        icon={icons?.copy ?? defaultIcons.copy}
        successMessage={translations.copied}
        disabled={disabled}
        color={color}
        onAction={() => capabilities.clipboard!.writeText(code)}
      /> : null}
      {download ? <ActionButton
        label={translations.downloadFile}
        icon={icons?.download ?? defaultIcons.download}
        disabled={disabled}
        color={color}
        onAction={() => capabilities.files!.save(codeFileRequest(code, language))}
      /> : null}
    </View>
  );
}
