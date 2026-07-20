import { useEffect, useRef, useState } from 'react';
import { Text, View, type View as NativeView } from 'react-native';
import type { ThemeConfig } from '../../core/types';
import type { NativeCapabilities } from '../../platform/capabilities';
import {
  ActionButton,
  FullscreenModal,
  PanZoomSurface,
  controlEnabled,
  defaultIcons,
  type ControlsConfig,
  type IconMap,
  type StreamdownTranslations,
} from '../../controls';
import type { DiagramPlugin, MermaidRenderResult } from '.';

function diagramFile(source: string, result?: MermaidRenderResult) {
  return result?.svg
    ? { basename: 'diagram', extension: 'svg', mimeType: 'image/svg+xml;charset=utf-8', content: result.svg }
    : { basename: 'diagram', extension: 'mmd', mimeType: 'text/plain;charset=utf-8', content: source };
}

export interface MermaidBlockProps {
  source: string;
  plugin: DiagramPlugin;
  theme: ThemeConfig;
  capabilities: NativeCapabilities;
  controls?: ControlsConfig;
  translations: StreamdownTranslations;
  icons?: IconMap;
  disabled?: boolean;
  incomplete?: boolean;
}

export function MermaidBlock({ source, plugin, theme, capabilities, controls, translations, icons, disabled, incomplete }: MermaidBlockProps) {
  const [result, setResult] = useState<MermaidRenderResult>();
  const [error, setError] = useState<Error>();
  const [revision, setRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const opener = useRef<NativeView>(null);

  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    setResult(undefined);
    setError(undefined);
    if (incomplete) return () => { active = false; };
    void plugin.render(source).then((next) => {
      if (!active) { next.release?.(); return; }
      release = next.release;
      setResult(next);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { active = false; release?.(); };
  }, [incomplete, plugin, revision, source]);

  const visual = result?.content;
  const panZoom = controlEnabled(controls, 'mermaid', 'panZoom');
  const rendered = visual
    ? (panZoom ? <PanZoomSurface capabilities={capabilities} icons={icons}>{visual}</PanZoomSurface> : visual)
    : null;
  const copy = controlEnabled(controls, 'mermaid', 'copy');
  const share = controlEnabled(controls, 'mermaid', 'share');
  const download = controlEnabled(controls, 'mermaid', 'download');
  const allowFullscreen = controlEnabled(controls, 'mermaid', 'fullscreen');

  return <View style={{ padding: theme.spacing.inline }}>
    <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {copy ? <ActionButton label={translations.copyDiagram} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} onAction={() => capabilities.clipboard?.writeText(source) ?? { status: 'unavailable' }} /> : null}
      {share ? <ActionButton label={translations.shareDiagram} icon={icons?.share ?? defaultIcons.share} disabled={disabled} onAction={() => capabilities.share?.shareText(source, 'Mermaid diagram') ?? { status: 'unavailable' }} /> : null}
      {download ? <ActionButton label={translations.downloadDiagram} icon={icons?.download ?? defaultIcons.download} disabled={disabled} onAction={() => capabilities.files?.save(diagramFile(source, result)) ?? { status: 'unavailable' }} /> : null}
      {allowFullscreen ? <ActionButton buttonRef={opener} label={translations.viewFullscreen} icon={icons?.fullscreen ?? defaultIcons.fullscreen} disabled={disabled} onAction={() => { setFullscreen(true); return { status: 'success' }; }} /> : null}
      {error ? <ActionButton label={translations.retryDiagram} icon={icons?.retry ?? defaultIcons.retry} disabled={disabled} onAction={() => { setRevision((value) => value + 1); return { status: 'success' }; }} /> : null}
    </View>
    {fullscreen ? null : rendered}
    <Text selectable style={{ color: theme.colors.muted, fontFamily: theme.fonts.mono }}>{source}</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.muted }}>{error.message}</Text> : null}
    <FullscreenModal visible={fullscreen} label={translations.diagramFullscreen} closeLabel={translations.exitFullscreen} capabilities={capabilities} restoreTarget={opener.current} onClose={() => setFullscreen(false)} icons={icons}>
      {fullscreen ? rendered ?? <Text selectable>{source}</Text> : null}
    </FullscreenModal>
  </View>;
}
