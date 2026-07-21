import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { TableData } from '../core/tableSerialization';
import type { CapabilityResult, NativeCapabilities } from '../platform/capabilities';
import { ActionButton } from './ActionButton';
import type { ControlsConfig } from './config';
import { controlEnabled } from './config';
import { FullscreenModal } from './FullscreenModal';
import { serializeTable, tableFileRequest } from './serialization';
import type { StreamdownTranslations } from './translations';
import { defaultIcons, type IconMap } from './icons';

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
  const closeMenu = (result: { status: string }) => { if (result.status === 'success') setMenu(null); };
  const finishCopy = (scope: 'inline' | 'fullscreen', result: CapabilityResult) => {
    if (result.status !== 'success') return;
    setCopyFeedback((current) => ({ scope, revision: (current?.revision ?? 0) + 1 }));
    setMenu(null);
  };
  const toggleMenu = (type: 'copy' | 'download', scope: 'inline' | 'fullscreen') => {
    setMenu((current) => current?.type === type && current.scope === scope ? null : { type, scope });
    return { status: 'success' as const };
  };
  const renderActions = (scope: 'inline' | 'fullscreen', includeFullscreen: boolean) => <View accessibilityRole="toolbar" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
    {copy ? <ActionButton label={translations.copyTable} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} color={color} onAction={() => toggleMenu('copy', scope)} /> : null}
    {download ? <ActionButton label={translations.downloadTable} icon={icons?.download ?? defaultIcons.download} disabled={disabled} color={color} onAction={() => toggleMenu('download', scope)} /> : null}
    {expand && includeFullscreen ? <ActionButton buttonRef={opener} label={translations.viewFullscreen} icon={icons?.fullscreen ?? defaultIcons.fullscreen} disabled={disabled} color={color} onAction={() => { setFullscreen(true); return { status: 'success' }; }} /> : null}
  </View>;
  const renderMenu = (scope: 'inline' | 'fullscreen') => menu?.scope === scope ? <View style={{ alignSelf: 'flex-end', minWidth: 180, borderWidth: 1, borderColor, borderRadius: 6, backgroundColor, padding: 4 }}>
    {menu.type === 'copy' ? <>
      <ActionButton label={translations.copyTableAsMarkdown} icon={translations.tableFormatMarkdown} disabled={disabled} color={color} onResult={(result) => finishCopy(scope, result)} onAction={() => capabilities.clipboard!.writeText(serializeTable(table, 'markdown'))} />
      <ActionButton label={translations.copyTableAsCsv} icon={translations.tableFormatCsv} disabled={disabled} color={color} onResult={(result) => finishCopy(scope, result)} onAction={() => capabilities.clipboard!.writeText(serializeTable(table, 'csv'))} />
      <ActionButton label={translations.copyTableAsTsv} icon={translations.tableFormatTsv} disabled={disabled} color={color} onResult={(result) => finishCopy(scope, result)} onAction={() => capabilities.clipboard!.writeText(serializeTable(table, 'tsv'))} />
    </> : <>
      <ActionButton label={translations.downloadTableAsCsv} icon={translations.tableFormatCsv} disabled={disabled} color={color} onResult={closeMenu} onAction={() => capabilities.files!.save(tableFileRequest(table, 'csv'))} />
      <ActionButton label={translations.downloadTableAsMarkdown} icon={translations.tableFormatMarkdown} disabled={disabled} color={color} onResult={closeMenu} onAction={() => capabilities.files!.save(tableFileRequest(table, 'markdown'))} />
    </>}
  </View> : null;
  const renderCopyFeedback = (scope: 'inline' | 'fullscreen') => copyFeedback?.scope === scope
    ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color }}>{translations.copied}</Text>
    : null;
  return (
    <View style={{ marginVertical: 16, borderWidth: 1, borderColor, borderRadius: 8, backgroundColor: surfaceColor, padding: 8, gap: 8 }}>
      {renderActions('inline', true)}
      {renderMenu('inline')}
      {renderCopyFeedback('inline')}
      {children}
      <FullscreenModal
        visible={fullscreen}
        label={translations.tableFullscreen}
        closeLabel={translations.exitFullscreen}
        capabilities={capabilities}
        restoreTarget={opener.current}
        onClose={() => setFullscreen(false)}
        icons={icons}
        color={color}
        backgroundColor={backgroundColor}
      ><View>{renderActions('fullscreen', false)}{renderMenu('fullscreen')}{renderCopyFeedback('fullscreen')}{children}</View></FullscreenModal>
    </View>
  );
}
