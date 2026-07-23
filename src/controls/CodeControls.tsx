import type { NativeCapabilities } from '../platform/capabilities';
import { Toolbar } from '../components/ui/Toolbar';
import { codeFileRequest } from './serialization';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

export function CodeControls({ code, language, capabilities, controls, translations, disabled, icons, color, radius, focusRingColor }: {
  code: string;
  language?: string | null;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  disabled?: boolean;
  icons?: IconMap;
  color?: string;
  radius?: number;
  focusRingColor?: string;
}) {
  const copy = controlEnabled(controls, 'code', 'copy') && Boolean(capabilities.clipboard);
  const download = controlEnabled(controls, 'code', 'download') && Boolean(capabilities.files);
  if (!copy && !download) return null;
  return (
    <Toolbar.Root disabled={disabled} style={{ flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {download ? <ActionButton
        label={translations.downloadFile}
        icon={icons?.download ?? defaultIcons.download}
        disabled={disabled}
        color={color}
        radius={radius}
        focusRingColor={focusRingColor}
        onAction={() => capabilities.files!.save(codeFileRequest(code, language))}
      /> : null}
      {copy ? <ActionButton
        label={translations.copyCode}
        icon={icons?.copy ?? defaultIcons.copy}
        successIcon={icons?.check ?? defaultIcons.check}
        successMessage={translations.copied}
        disabled={disabled}
        color={color}
        radius={radius}
        focusRingColor={focusRingColor}
        onAction={() => capabilities.clipboard!.writeText(code)}
      /> : null}
    </Toolbar.Root>
  );
}
