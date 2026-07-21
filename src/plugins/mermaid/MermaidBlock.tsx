import { useEffect, useRef, useState } from 'react';
import { Text, View, type View as NativeView } from 'react-native';
import type { ThemeConfig } from '../../core/types';
import type { NativeCapabilities } from '../../platform/capabilities';
import { Dropdown } from '../../components/ui';
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
  const [renderedResult, setRenderedResult] = useState<{ source: string; theme: ThemeConfig; revision: number; plugin: DiagramPlugin; result: MermaidRenderResult }>();
  const [error, setError] = useState<Error>();
  const [revision, setRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const opener = useRef<NativeView>(null);
  const resultRef = useRef<MermaidRenderResult | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setError(undefined);
    setRenderedResult(undefined);
    resultRef.current?.release?.();
    resultRef.current = undefined;
    if (incomplete) return () => { active = false; };
    void plugin.render(source, theme).then((next) => {
      if (!active) { next.release?.(); return; }
      resultRef.current = next;
      setRenderedResult({ source, theme, revision, plugin, result: next });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { active = false; };
  }, [incomplete, plugin, revision, source, theme]);

  useEffect(() => () => {
    resultRef.current?.release?.();
    resultRef.current = undefined;
  }, []);

  const result = !incomplete && renderedResult?.source === source && renderedResult.theme === theme && renderedResult.revision === revision && renderedResult.plugin === plugin
    ? renderedResult.result
    : undefined;
  const currentResult = result;
  const visual = result?.content;
  const panZoom = controlEnabled(controls, 'mermaid', 'panZoom');
  const rendered = visual
    ? <View
      testID={fullscreen ? 'mermaid-fullscreen-canvas' : undefined}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Mermaid diagram: ${renderedResult?.source ?? source}`}
      style={fullscreen ? { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' } : undefined}
    >
      {panZoom ? <PanZoomSurface capabilities={capabilities} icons={icons} disabled={disabled} color={theme.colors.foreground} backgroundColor={theme.colors.background} borderColor={theme.colors.border}>{visual}</PanZoomSurface> : visual}
    </View>
    : null;
  const copy = controlEnabled(controls, 'mermaid', 'copy') && Boolean(capabilities.clipboard);
  // Streamdown does not show Share in its default Mermaid action strip.
  const share = controls !== undefined && controlEnabled(controls, 'mermaid', 'share');
  const download = controlEnabled(controls, 'mermaid', 'download') && Boolean(capabilities.files);
  const allowFullscreen = controlEnabled(controls, 'mermaid', 'fullscreen');
  const saveDiagram = async (format: 'mmd' | 'svg' | 'png', output = result) => {
    const files = capabilities.files;
    if (!files) throw new Error('File saving unavailable');
    const response = await files.save(mermaidFileRequest(source, output, format));
    if (response.status !== 'success') throw response.error ?? new Error(response.status === 'unavailable' ? 'File saving unavailable' : `File saving ${response.status}`);
  };

  return <View testID="mermaid-block" style={{ marginVertical: theme.spacing.block, padding: 8, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.codeBackground }}>
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ flex: 1, marginLeft: 4, color: theme.colors.muted, fontFamily: theme.fonts.mono, fontSize: 12, textTransform: 'lowercase' }}>mermaid</Text>
      <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {download ? <Dropdown.Root open={downloadOpen} onOpenChange={setDownloadOpen}>
          <Dropdown.Trigger accessibilityLabel={translations.downloadDiagram} disabled={disabled} foregroundColor={theme.colors.muted}>{icons?.download ?? defaultIcons.download}</Dropdown.Trigger>
          <Dropdown.Popup accessibilityLabel={translations.downloadDiagram} style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            {currentResult?.svg?.trim() ? <Dropdown.Item accessibilityLabel={translations.downloadDiagramAsSvg} disabled={disabled} foregroundColor={theme.colors.foreground} onSelect={() => saveDiagram('svg', currentResult)}>{translations.mermaidFormatSvg}</Dropdown.Item> : null}
            {currentResult?.png?.byteLength ? <Dropdown.Item accessibilityLabel={translations.downloadDiagramAsPng} disabled={disabled} foregroundColor={theme.colors.foreground} onSelect={() => saveDiagram('png', currentResult)}>{translations.mermaidFormatPng}</Dropdown.Item> : null}
            <Dropdown.Item accessibilityLabel={translations.downloadDiagramAsMmd} disabled={disabled} foregroundColor={theme.colors.foreground} onSelect={() => saveDiagram('mmd')}>{translations.mermaidFormatMmd}</Dropdown.Item>
          </Dropdown.Popup>
        </Dropdown.Root> : null}
        {copy ? <ActionButton label={translations.copyDiagram} icon={icons?.copy ?? defaultIcons.copy} successMessage={translations.copied} disabled={disabled} color={theme.colors.muted} onAction={() => capabilities.clipboard!.writeText(source)} /> : null}
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
    <FullscreenModal visible={fullscreen} contentMode="canvas" label={translations.diagramFullscreen} closeLabel={translations.exitFullscreen} capabilities={capabilities} restoreTarget={opener.current} onClose={() => setFullscreen(false)} icons={icons} color={theme.colors.foreground} backgroundColor={theme.colors.background}>
      {fullscreen ? rendered ?? <Text selectable>{source}</Text> : null}
    </FullscreenModal>
  </View>;
}
