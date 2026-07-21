import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Dropdown } from '../components/ui';
import type { TableData } from '../core/tableSerialization';
import type { CapabilityResult, NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import { FullscreenModal } from './FullscreenModal';
import { serializeTable, tableFileRequest } from './serialization';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

function capabilityError(result: CapabilityResult): Error {
  return result.error ?? new Error(result.status === 'unavailable' ? 'Unavailable'
    : result.status === 'denied' ? 'Action denied'
      : result.status === 'cancelled' ? 'Action cancelled' : 'Action failed');
}

export function TableControls({ table, children, capabilities, controls, translations, disabled, icons, color, backgroundColor, surfaceColor, borderColor }: {
  table: TableData;
  children: React.ReactNode;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  disabled?: boolean;
  icons?: IconMap;
  color?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  borderColor?: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [menu, setMenu] = useState<{ type: 'copy' | 'download'; scope: 'inline' | 'fullscreen' } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{ scope: 'inline' | 'fullscreen'; revision: number } | null>(null);
  const opener = useRef<View>(null);
  const copy = controlEnabled(controls, 'table', 'copy') && Boolean(capabilities.clipboard);
  const download = controlEnabled(controls, 'table', 'download') && Boolean(capabilities.files);
  const expand = controlEnabled(controls, 'table', 'fullscreen');
  useEffect(() => {
    if (!copyFeedback) return;
    const timer = setTimeout(() => setCopyFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [copyFeedback]);
  if (!copy && !download && !expand) return <>{children}</>;
  const copyTable = async (scope: 'inline' | 'fullscreen', format: 'markdown' | 'csv' | 'tsv') => {
    const result = await capabilities.clipboard!.writeText(serializeTable(table, format));
    if (result.status !== 'success') throw capabilityError(result);
    setCopyFeedback((current) => ({ scope, revision: (current?.revision ?? 0) + 1 }));
  };
  const downloadTable = async (format: 'csv' | 'markdown') => {
    const result = await capabilities.files!.save(tableFileRequest(table, format));
    if (result.status !== 'success') throw capabilityError(result);
  };
  const renderActions = (scope: 'inline' | 'fullscreen', includeFullscreen: boolean) => <View accessibilityRole="toolbar" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
    {copy ? <Dropdown.Root open={menu?.type === 'copy' && menu.scope === scope} onOpenChange={(open) => setMenu(open ? { type: 'copy', scope } : null)}>
      <Dropdown.Trigger accessibilityLabel={translations.copyTable} disabled={disabled} foregroundColor={color}>{icons?.copy ?? defaultIcons.copy}</Dropdown.Trigger>
      <Dropdown.Popup accessibilityLabel={translations.copyTable} style={{ borderColor, backgroundColor: surfaceColor }}>
        <Dropdown.Item accessibilityLabel={translations.copyTableAsMarkdown} disabled={disabled} foregroundColor={color} onSelect={() => copyTable(scope, 'markdown')}>{translations.tableFormatMarkdown}</Dropdown.Item>
        <Dropdown.Item accessibilityLabel={translations.copyTableAsCsv} disabled={disabled} foregroundColor={color} onSelect={() => copyTable(scope, 'csv')}>{translations.tableFormatCsv}</Dropdown.Item>
        <Dropdown.Item accessibilityLabel={translations.copyTableAsTsv} disabled={disabled} foregroundColor={color} onSelect={() => copyTable(scope, 'tsv')}>{translations.tableFormatTsv}</Dropdown.Item>
      </Dropdown.Popup>
    </Dropdown.Root> : null}
    {download ? <Dropdown.Root open={menu?.type === 'download' && menu.scope === scope} onOpenChange={(open) => setMenu(open ? { type: 'download', scope } : null)}>
      <Dropdown.Trigger accessibilityLabel={translations.downloadTable} disabled={disabled} foregroundColor={color}>{icons?.download ?? defaultIcons.download}</Dropdown.Trigger>
      <Dropdown.Popup accessibilityLabel={translations.downloadTable} style={{ borderColor, backgroundColor: surfaceColor }}>
        <Dropdown.Item accessibilityLabel={translations.downloadTableAsCsv} disabled={disabled} foregroundColor={color} onSelect={() => downloadTable('csv')}>{translations.tableFormatCsv}</Dropdown.Item>
        <Dropdown.Item accessibilityLabel={translations.downloadTableAsMarkdown} disabled={disabled} foregroundColor={color} onSelect={() => downloadTable('markdown')}>{translations.tableFormatMarkdown}</Dropdown.Item>
      </Dropdown.Popup>
    </Dropdown.Root> : null}
    {expand && includeFullscreen ? <ActionButton buttonRef={opener} label={translations.viewFullscreen} icon={icons?.fullscreen ?? defaultIcons.fullscreen} disabled={disabled} color={color} onAction={() => { setFullscreen(true); return { status: 'success' }; }} /> : null}
  </View>;
  const renderCopyFeedback = (scope: 'inline' | 'fullscreen') => copyFeedback?.scope === scope
    ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color }}>{translations.copied}</Text>
    : null;
  return (
    <View style={{ marginVertical: 16, borderWidth: 1, borderColor, borderRadius: 8, backgroundColor: surfaceColor, padding: 8, gap: 8 }}>
      {renderActions('inline', true)}
      {renderCopyFeedback('inline')}
      {children}
      <FullscreenModal
        visible={fullscreen}
        label={translations.tableFullscreen}
        closeLabel={translations.exitFullscreen}
        capabilities={capabilities}
        restoreTarget={opener.current}
        onClose={() => { setFullscreen(false); setMenu((current) => current?.scope === 'fullscreen' ? null : current); }}
        icons={icons}
        color={color}
        backgroundColor={backgroundColor}
      ><View>{renderActions('fullscreen', false)}{renderCopyFeedback('fullscreen')}{children}</View></FullscreenModal>
    </View>
  );
}
