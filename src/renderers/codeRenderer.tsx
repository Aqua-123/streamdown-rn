import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CodeControls, defaultTranslations } from '../controls';
import { resolveCapabilities } from '../platform/defaults';
import type { HighlightResult, HighlightToken, ThemeInput } from '../plugins/code';
import { controlRadius, getBlockStyles, getTextStyles, innerRadius, resolveThemePrimitives } from '../themes';
import type { RenderContext, SemanticNode } from './rendererTypes';
import { composedStyle } from './semanticComposition';

const DEFAULT_CODE_THEMES: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];

function tokenStyle(token: HighlightToken): TextStyle {
  const providerStyle = token.htmlStyle;
  return {
    color: providerStyle?.color ?? token.color,
    backgroundColor: providerStyle?.['background-color'] ?? token.bgColor,
    fontStyle: providerStyle?.['font-style'] === 'italic' ? 'italic' : token.fontStyle,
    fontWeight: providerStyle?.['font-weight'] === 'bold' ? 'bold' : token.fontWeight,
  };
}

function plainCodeResult(code: string): HighlightResult {
  return { tokens: code.split('\n').map((line) => [{ content: line }]) };
}

export function NativeCodeBlock({
  node,
  context,
  style,
  content,
  hasContentOverride = false,
}: {
  node: SemanticNode;
  context: RenderContext;
  style?: StyleProp<ViewStyle>;
  content?: ReactNode;
  hasContentOverride?: boolean;
}) {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const primitives = resolveThemePrimitives(context.theme);
  const code = node.value ?? '';
  const displayCode = useMemo(() => code.replace(/\n+$/, ''), [code]);
  const raw = useMemo(() => plainCodeResult(displayCode), [displayCode]);
  const [result, setResult] = useState<HighlightResult>(raw);
  const [loading, setLoading] = useState(false);
  const plugin = context.plugins?.code;
  const themes = useMemo(
    () => plugin?.getThemes() ?? context.shikiTheme ?? DEFAULT_CODE_THEMES,
    [context.shikiTheme, plugin]
  );

  useEffect(() => {
    let active = true;
    setResult(raw);
    setLoading(false);
    if (!plugin || context.codeFenceIncomplete) return () => { active = false; };
    const highlighted = plugin.highlight({ code: displayCode, language: node.lang ?? '', themes, colorScheme: context.theme.colorScheme ?? 'dark' }, (next) => {
      if (!active) return;
      setResult(next);
      setLoading(false);
    });
    if (highlighted) setResult(highlighted);
    else setLoading(true);
    return () => { active = false; };
  }, [context.codeFenceIncomplete, context.theme.colorScheme, displayCode, node.lang, plugin, raw, themes]);

  const startMatch = node.meta?.match(/(?:^|\s)startLine=(\d+)(?:\s|$)/);
  const parsedStart = startMatch ? Number.parseInt(startMatch[1], 10) : 1;
  const startLine = parsedStart >= 1 ? parsedStart : 1;
  const showLineNumbers = context.lineNumbers !== false && !/(?:^|\s)noLineNumbers(?:\s|$)/.test(node.meta ?? '');

  return (
    <View style={composedStyle(blocks.codeBlock, style)}>
      <View style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, marginLeft: 4, color: primitives.mutedForeground, fontFamily: context.theme.fonts.mono, fontSize: 12, textTransform: 'lowercase' }}>{node.lang ?? ''}</Text>
        <CodeControls
          code={code}
          language={node.lang}
          capabilities={context.capabilities ?? resolveCapabilities()}
          controls={context.controls}
          translations={context.translations ?? defaultTranslations}
          disabled={context.controlsDisabled ?? context.isStreaming}
          icons={context.icons}
          color={primitives.mutedForeground}
          radius={controlRadius(primitives.radius)}
          focusRingColor={primitives.ring}
        />
      </View>
      {loading ? <View accessible accessibilityLabel="Highlighting code" accessibilityState={{ busy: true }} /> : null}
      <ScrollView horizontal style={[{ padding: 16, borderWidth: 1, borderColor: primitives.border, borderRadius: innerRadius(primitives.radius), backgroundColor: primitives.background }, result.bg ? { backgroundColor: result.bg } : undefined]}>
        {hasContentOverride ? <View>{content}</View> : <View>
          {result.tokens.map((line, lineIndex) => (
            <View key={lineIndex} style={{ flexDirection: 'row' }}>
              {showLineNumbers ? (
                <Text accessibilityLabel={`Line ${startLine + lineIndex}`} style={styles.codeLineNumber}>
                  {startLine + lineIndex}
                </Text>
              ) : null}
              <Text style={[styles.codeBlock, result.fg ? { color: result.fg } : undefined]}>
                {line.length ? line.map((token, tokenIndex) => (
                  <Text key={tokenIndex} style={tokenStyle(token)}>{token.content}</Text>
                )) : ''}
              </Text>
            </View>
          ))}
        </View>}
      </ScrollView>
    </View>
  );
}
