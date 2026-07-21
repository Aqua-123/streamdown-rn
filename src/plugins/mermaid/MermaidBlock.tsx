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
import { mermaidFileRequest } from './download';

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
  const [renderedResult, setRenderedResult] = useState<{ source: string; result: MermaidRenderResult }>();
  const [error, setError] = useState<Error>();
  const [revision, setRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const opener = useRef<NativeView>(null);
  const resultRef = useRef<MermaidRenderResult | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setError(undefined);
    if (incomplete) return () => { active = false; };
    void plugin.render(source).then((next) => {
      if (!active) { next.release?.(); return; }
      if (resultRef.current !== next) resultRef.current?.release?.();
      resultRef.current = next;
      setRenderedResult({ source, result: next });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { active = false; };
  }, [incomplete, plugin, revision, source]);

  useEffect(() => () => {
    resultRef.current?.release?.();
    resultRef.current = undefined;
  }, []);

  const result = renderedResult?.result;
  const currentResult = renderedResult?.source === source ? result : undefined;
  const visual = result?.content;
  const panZoom = controlEnabled(controls, 'mermaid', 'panZoom');
  const rendered = visual
    ? <View accessible accessibilityRole="image" accessibilityLabel={`Mermaid diagram: ${renderedResult?.source ?? source}`}>
      {panZoom ? <PanZoomSurface capabilities={capabilities} icons={icons} disabled={disabled} color={theme.colors.foreground}>{visual}</PanZoomSurface> : visual}
    </View>
    : null;
  const copy = controlEnabled(controls, 'mermaid', 'copy');
  // Streamdown does not show Share in its default Mermaid action strip.
  const share = controls !== undefined && controlEnabled(controls, 'mermaid', 'share');
  const download = controlEnabled(controls, 'mermaid', 'download');
  const allowFullscreen = controlEnabled(controls, 'mermaid', 'fullscreen');

  return <View testID="mermaid-block" style={{ marginVertical: theme.spacing.block, padding: 8, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.codeBackground }}>
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ flex: 1, marginLeft: 4, color: theme.colors.muted, fontFamily: theme.fonts.mono, fontSize: 12, textTransform: 'lowercase' }}>mermaid</Text>
      <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {download ? <ActionButton label={translations.downloadDiagramAsMmd} icon={icons?.download ?? defaultIcons.download} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.files?.save(mermaidFileRequest(source, result, 'mmd')) ?? { status: 'unavailable' }} /> : null}
        {download && currentResult?.svg?.trim() ? <ActionButton label={translations.downloadDiagramAsSvg} icon={icons?.download ?? defaultIcons.download} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.files?.save(mermaidFileRequest(source, currentResult, 'svg')) ?? { status: 'unavailable' }} /> : null}
        {download && currentResult?.png?.byteLength ? <ActionButton label={translations.downloadDiagramAsPng} icon={icons?.download ?? defaultIcons.download} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.files?.save(mermaidFileRequest(source, currentResult, 'png')) ?? { status: 'unavailable' }} /> : null}
        {copy ? <ActionButton label={translations.copyDiagram} icon={icons?.copy ?? defaultIcons.copy} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.clipboard?.writeText(source) ?? { status: 'unavailable' }} /> : null}
        {share ? <ActionButton label={translations.shareDiagram} icon={icons?.share ?? defaultIcons.share} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.share?.shareText(source, 'Mermaid diagram') ?? { status: 'unavailable' }} /> : null}
        {allowFullscreen ? <ActionButton buttonRef={opener} label={translations.viewFullscreen} icon={icons?.fullscreen ?? defaultIcons.fullscreen} disabled={disabled} color={theme.colors.muted} onAction={() => { setFullscreen(true); return { status: 'success' }; }} /> : null}
        {error ? <ActionButton label={translations.retryDiagram} icon={icons?.retry ?? defaultIcons.retry} disabled={disabled} color={theme.colors.muted} onAction={() => { setRevision((value) => value + 1); return { status: 'success' }; }} /> : null}
      </View>
    </View>
    {!incomplete && !result && !error ? <View accessible accessibilityLabel="Rendering Mermaid diagram" accessibilityState={{ busy: true }} /> : null}
    <View testID="mermaid-surface" style={{ minHeight: 180, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, backgroundColor: theme.colors.background }}>
      {fullscreen ? null : rendered}
      {!visual ? <Text selectable style={{ padding: 16, color: theme.colors.muted, fontFamily: theme.fonts.mono }}>{source}</Text> : null}
      {error && plugin.errorComponent
        ? <plugin.errorComponent error={error} source={source} retry={() => setRevision((value) => value + 1)} />
        : error ? <Text accessibilityRole="alert" style={{ padding: 16, color: theme.colors.muted }}>{error.message}</Text> : null}
    </View>
    <FullscreenModal visible={fullscreen} label={translations.diagramFullscreen} closeLabel={translations.exitFullscreen} capabilities={capabilities} restoreTarget={opener.current} onClose={() => setFullscreen(false)} icons={icons} color={theme.colors.foreground} backgroundColor={theme.colors.background}>
      {fullscreen ? rendered ?? <Text selectable>{source}</Text> : null}
    </FullscreenModal>
  </View>;
}
