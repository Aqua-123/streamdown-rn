import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import type { TableData } from '../core/tableSerialization';
import type { NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import { FullscreenModal } from './FullscreenModal';
import { serializeTable, tableFileRequest } from './serialization';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

export function TableControls({ table, children, capabilities, controls, translations, disabled, icons }: {
  table: TableData;
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  disabled?: boolean;
  icons?: IconMap;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const opener = useRef<View>(null);
  const copy = controlEnabled(controls, 'table', 'copy');
  const download = controlEnabled(controls, 'table', 'download');
  const expand = controlEnabled(controls, 'table', 'fullscreen');
  if (!copy && !download && !expand) return <>{children}</>;
  return (
    <View>
      <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {copy ? <>
          <ActionButton label={translations.copyTableAsMarkdown} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} onAction={() => capabilities.clipboard?.writeText(serializeTable(table, 'markdown')) ?? { status: 'unavailable', error: new Error('Clipboard unavailable') }} />
          <ActionButton label={translations.copyTableAsCsv} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} onAction={() => capabilities.clipboard?.writeText(serializeTable(table, 'csv')) ?? { status: 'unavailable', error: new Error('Clipboard unavailable') }} />
          <ActionButton label={translations.copyTableAsTsv} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} onAction={() => capabilities.clipboard?.writeText(serializeTable(table, 'tsv')) ?? { status: 'unavailable', error: new Error('Clipboard unavailable') }} />
        </> : null}
        {download ? <>
          <ActionButton label={translations.downloadTableAsCsv} icon={icons?.download ?? defaultIcons.download} disabled={disabled} onAction={() => capabilities.files?.save(tableFileRequest(table, 'csv')) ?? { status: 'unavailable', error: new Error('File saving unavailable') }} />
          <ActionButton label={translations.downloadTableAsMarkdown} icon={icons?.download ?? defaultIcons.download} disabled={disabled} onAction={() => capabilities.files?.save(tableFileRequest(table, 'markdown')) ?? { status: 'unavailable', error: new Error('File saving unavailable') }} />
        </> : null}
        {expand ? <ActionButton buttonRef={opener} label={translations.viewFullscreen} icon={icons?.fullscreen ?? defaultIcons.fullscreen} disabled={disabled} onAction={() => {
          setFullscreen(true);
          return { status: 'success' };
        }} /> : null}
      </View>
      {children}
      <FullscreenModal
        visible={fullscreen}
        label={translations.tableFullscreen}
        closeLabel={translations.exitFullscreen}
        capabilities={capabilities}
        restoreTarget={opener.current}
        onClose={() => setFullscreen(false)}
        icons={icons}
      >{children}</FullscreenModal>
    </View>
  );
}
