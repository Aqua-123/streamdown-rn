import React, { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { Content, Root } from 'mdast';
import type { Node } from 'unist';
import type {
  ComponentRegistry,
  NativeComponents,
  NativeSemanticData,
  StableBlock,
  ThemeConfig,
} from '../core/types';
import { hashContent } from '../core/types';
import { extractComponentData, type ComponentData } from '../core/componentParser';
import { sanitizeProps } from '../core/sanitize';
import {
  applySecurityPolicy,
  sanitizeResourceURL,
  type ResourcePolicy,
  type SecurityPolicyOptions,
} from '../core/security';
import { detectTextDirection } from '../core/blockSemantics';
import { controlRadius, getBlockStyles, getTextStyles, innerRadius, resolveThemePrimitives } from '../themes';
import { materializeCustomTags } from './semanticTags';
import { AnimatedRevealText, type NormalizedAnimationConfig } from '../core/streaming';
import type { NativeCapabilities } from '../platform/capabilities';
import { resolveCapabilities } from '../platform/defaults';
import {
  CodeControls,
  NativeLink,
  SafeImage,
  TableControls,
  defaultTranslations,
  type ControlsConfig,
  type IconMap,
  type StreamdownTranslations,
} from '../controls';
import { CheckIcon } from '../controls/icons';
import type { TableData } from '../core/tableSerialization';
import type { CustomRenderer, PluginConfig, RendererPlugin } from '../plugins/renderers';
import type { HighlightResult, HighlightToken, ThemeInput } from '../plugins/code';
import {
  NATIVE_ELEMENT_NAMES,
  type NativeDefaultOverrides,
  type NativeElementName,
  type NativeSlotProps,
  type NativeSlotSemanticData,
  type NativeSlots,
} from './types';

type ComponentErrorHandler = (error: Error, componentName?: string) => void;
const DEFAULT_CODE_THEMES: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];

// Kept local so the core runtime does not load the optional renderers subpath.
function selectCustomRenderer(
  plugin: RendererPlugin | readonly CustomRenderer[] | undefined,
  language: string
): CustomRenderer | undefined {
  const normalized = language.toLowerCase();
  const renderers = Array.isArray(plugin)
    ? plugin as readonly CustomRenderer[]
    : (plugin as RendererPlugin | undefined)?.renderers;
  return renderers?.find(({ language: candidate }) =>
    (Array.isArray(candidate) ? candidate : [candidate])
      .some((value) => value.toLowerCase() === normalized)
  );
}
type SemanticNode = Node & {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  depth?: 1 | 2 | 3 | 4 | 5 | 6;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
  meta?: string | null;
  identifier?: string;
  align?: Array<'left' | 'center' | 'right' | null>;
  children?: SemanticNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown>; literal?: boolean };
};

const TABLE_MIN_COLUMN_WIDTH = 120;
const TABLE_MAX_COLUMN_WIDTH = 320;
const TABLE_CHARACTER_WIDTH = 8;
const TABLE_HORIZONTAL_PADDING = 32;

function normalizedTableText(node: SemanticNode): string {
  return textValue(node).trim().replace(/\s+/g, ' ');
}

function tableColumnWidths(node: SemanticNode, count: number): number[] {
  return Array.from({ length: count }, (_, columnIndex) => {
    const contentWidth = Math.max(0, ...(node.children ?? []).map((row) => {
      const cell = row.children?.[columnIndex];
      return cell ? Array.from(normalizedTableText(cell)).length * TABLE_CHARACTER_WIDTH : 0;
    }));
    return Math.max(TABLE_MIN_COLUMN_WIDTH, Math.min(TABLE_MAX_COLUMN_WIDTH, contentWidth + TABLE_HORIZONTAL_PADDING));
  });
}

export interface ASTRendererProps {
  node: Node;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  components?: NativeComponents;
  slots?: NativeSlots;
  isStreaming?: boolean;
  /** Internal active-root signal; independent of animation-dependent streaming UI. */
  suppressEmptyFootnotes?: boolean;
  onError?: ComponentErrorHandler;
  securityPolicy?: SecurityPolicyOptions;
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  dir?: 'auto' | 'ltr' | 'rtl';
  animation?: NormalizedAnimationConfig & { from: number };
  capabilities?: NativeCapabilities;
  controls?: ControlsConfig;
  translations?: StreamdownTranslations;
  icons?: IconMap;
  controlsDisabled?: boolean;
  plugins?: PluginConfig;
  shikiTheme?: [ThemeInput, ThemeInput];
  lineNumbers?: boolean;
  codeFenceIncomplete?: boolean;
}

interface RenderContext extends Omit<ASTRendererProps, 'node'> {
  direction?: 'ltr' | 'rtl';
  definitions: ReadonlyMap<string, { url?: string; title?: string | null }>;
  emptyFootnotes: ReadonlySet<string>;
}

const ComponentErrorContext = React.createContext<ComponentErrorHandler | undefined>(undefined);

class RegistryErrorBoundary extends React.Component<{
  children: ReactNode;
  componentName: string;
  retryKey: number;
  retryComponent: React.ElementType;
  fallback: ReactNode;
  onError?: ComponentErrorHandler;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError?.(error, this.props.componentName); }
  componentDidUpdate(previous: Readonly<typeof this.props>, previousState: Readonly<typeof this.state>) {
    if (previousState.failed && this.state.failed && (
      previous.componentName !== this.props.componentName ||
      previous.retryKey !== this.props.retryKey ||
      previous.retryComponent !== this.props.retryComponent
    )) {
      this.setState({ failed: false });
    }
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function rootFor(node: Node): Root {
  return node.type === 'root'
    ? node as Root
    : { type: 'root', children: [node as Content] };
}

function textValue(node: SemanticNode): string {
  if (typeof node.value === 'string') return node.value;
  return node.children?.map(textValue).join('') ?? '';
}

function semantic(node: SemanticNode, inline: boolean): NativeSemanticData {
  return {
    type: node.type,
    node,
    inline,
    value: node.value,
    url: node.url,
    alt: node.alt ?? undefined,
    depth: node.depth,
    ordered: node.ordered,
    checked: node.checked,
    language: node.lang ?? undefined,
    metadata: node.meta ?? undefined,
    identifier: node.identifier,
    attributes: node.data?.hProperties,
  };
}

const NATIVE_ELEMENTS = new Set<NativeElementName>(NATIVE_ELEMENT_NAMES);

function isNativeElementName(value: string): value is NativeElementName {
  return NATIVE_ELEMENTS.has(value as NativeElementName);
}

function slotSemantic<Name extends NativeElementName>(
  node: SemanticNode,
  inline: boolean,
  element: Name
): NativeSlotSemanticData<Name> {
  return {
    element,
    type: node.type,
    inline,
    value: node.value,
    url: node.url,
    alt: node.alt ?? undefined,
    depth: node.depth,
    ordered: node.ordered,
    checked: node.checked,
    language: node.lang ?? undefined,
    metadata: node.meta ?? undefined,
    identifier: node.identifier,
  };
}

function elementName(node: SemanticNode): string {
  if (node.data?.hName) return node.data.hName;
  switch (node.type) {
    case 'heading': return `h${node.depth}`;
    case 'paragraph': return 'p';
    case 'blockquote': return 'blockquote';
    case 'code': return 'pre';
    case 'inlineCode': return 'code';
    case 'strong': return 'strong';
    case 'emphasis': return 'em';
    case 'delete': return 'del';
    case 'link':
    case 'linkReference': return 'a';
    case 'image':
    case 'imageReference': return 'img';
    case 'list': return node.ordered ? 'ol' : 'ul';
    case 'listItem': return 'li';
    case 'table': return 'table';
    case 'tableRow': return 'tr';
    case 'tableCell': return 'td';
    case 'thematicBreak': return 'hr';
    case 'footnoteReference': return 'sup';
    case 'break': return 'br';
    default: return node.type;
  }
}

function overrideFor(node: SemanticNode, context: RenderContext, semanticElement?: string) {
  if (node.type === 'inlineCode' && context.components?.inlineCode) {
    return context.components.inlineCode;
  }
  const name = typeof node.data?.hName === 'string' ? elementName(node) : semanticElement ?? elementName(node);
  return context.components?.[name] ??
    (!KNOWN_NODES.has(node.type) ? context.components?.unknown : undefined);
}

function withOverride(
  node: SemanticNode,
  context: RenderContext,
  inline: boolean,
  children: ReactNode,
  fallback: (overrides?: NativeDefaultOverrides<NativeElementName>) => ReactNode,
  key?: React.Key,
  semanticElement?: string
): ReactNode {
  const Override = overrideFor(node, context, semanticElement);
  if (Override) return <Override key={key} semantic={semantic(node, inline)}>{children}</Override>;
  if (typeof node.data?.hName === 'string' && !KNOWN_NODES.has(node.type)) return fallback();
  const name = semanticElement ?? elementName(node);
  if (!isNativeElementName(name)) return fallback();
  const Slot = context.slots?.[name] as React.ComponentType<NativeSlotProps> | undefined;
  return Slot
    ? <Slot key={key} semantic={slotSemantic(node, inline, name)} renderDefault={fallback}>{children}</Slot>
    : fallback();
}

function defaultChildren(overrides: NativeDefaultOverrides<NativeElementName> | undefined, children: ReactNode) {
  return overrides && 'children' in overrides ? overrides.children : children;
}

function viewStyle(overrides?: NativeDefaultOverrides<NativeElementName>): StyleProp<ViewStyle> {
  return overrides?.style as StyleProp<ViewStyle>;
}

function textStyle(overrides?: NativeDefaultOverrides<NativeElementName>): StyleProp<TextStyle> {
  return overrides?.style as StyleProp<TextStyle>;
}

function composedStyle<T extends TextStyle | ViewStyle>(
  base: StyleProp<T>,
  extra: StyleProp<TextStyle | ViewStyle>
): StyleProp<T> {
  return extra === undefined ? base : [base, extra] as StyleProp<T>;
}

const INLINE_NODES = new Set([
  'text', 'strong', 'emphasis', 'delete', 'inlineCode', 'link', 'linkReference',
  'break', 'footnoteReference', 'customTag', 'inlineMath',
]);
const KNOWN_NODES = new Set([
  'root', 'paragraph', 'heading', 'code', 'blockquote', 'list', 'listItem',
  'thematicBreak', 'table', 'tableRow', 'tableCell', 'html', 'text', 'strong',
  'emphasis', 'delete', 'inlineCode', 'link', 'linkReference', 'image',
  'imageReference', 'break', 'footnoteReference', 'footnoteDefinition',
  'definition', 'yaml', 'toml', 'customTag', 'inlineMath', 'math',
]);

function renderChildren(node: SemanticNode, context: RenderContext, inline: boolean): ReactNode {
  return node.children?.map((child, index) => {
    if (!inline && INLINE_NODES.has(child.type)) {
      return <Text key={index}>{renderNode(child, context, true)}</Text>;
    }
    return renderNode(child, context, inline, index);
  }) ?? null;
}

function renderInlineChildren(node: SemanticNode, context: RenderContext): ReactNode {
  return node.children?.map((child, index) => {
    if (child.type === 'image' || child.type === 'imageReference') {
      return child.alt ? `[Image: ${child.alt}]` : '';
    }
    return renderNode(child, context, true, index);
  }) ?? null;
}

function renderParagraph(node: SemanticNode, context: RenderContext, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const children = node.children ?? [];
  if (
    context.componentRegistry &&
    children.length === 1 &&
    children[0].type === 'text' &&
    children[0].value?.trim().startsWith('[{c:') &&
    children[0].value?.trim().endsWith('}]')
  ) {
    const data = extractComponentData(children[0].value, context.securityPolicy);
    if (data.name) {
      return (
        <ComponentBlock
          key={key}
          componentName={data.name}
          props={data.props}
          style={data.style}
          children={data.children}
          componentRegistry={context.componentRegistry}
          theme={context.theme}
          isStreaming={context.isStreaming}
          onError={context.onError}
          resourcePolicy={context.securityPolicy}
        />
      );
    }
  }
  if (children.every((child) => INLINE_NODES.has(child.type))) {
    if (children.some((child) => child.type === 'inlineMath')) {
      const rendered = children.map((child, index) => child.type === 'inlineMath'
        ? renderNode(child, context, true, index)
        : <Text key={index} style={[styles.paragraph, { marginBottom: 0, writingDirection: context.direction }]}>{renderNode(child, context, true)}</Text>);
      return withOverride(node, context, false, rendered, (overrides) => (
        <View key={key} style={composedStyle({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: context.theme.spacing.block }, viewStyle(overrides))}>{defaultChildren(overrides, rendered)}</View>
      ), key);
    }
    const rendered = renderInlineChildren(node, context);
    return withOverride(node, context, false, rendered, (overrides) => (
      <Text key={key} style={composedStyle([styles.paragraph, { writingDirection: context.direction }], textStyle(overrides))}>{defaultChildren(overrides, rendered)}</Text>
    ), key);
  }
  const rendered = children.map((child, index) => INLINE_NODES.has(child.type)
    ? <Text key={index} style={[styles.paragraph, { writingDirection: context.direction }]}>{renderNode(child, context, true)}</Text>
    : renderNode(child, context, false, index));
  return withOverride(node, context, false, rendered, (overrides) => <View key={key} style={viewStyle(overrides)}>{defaultChildren(overrides, rendered)}</View>, key);
}

function renderList(node: SemanticNode, context: RenderContext, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const start = node.start ?? 1;
  const rows = (node.children ?? []).map((item, index) => {
    const marker = item.checked == null ? (node.ordered ? `${start + index}.` : '•') : null;
    const body = renderChildren(item, context, false);
    return withOverride(item, context, false, body, (overrides) => (
      <View key={index} style={composedStyle({ flexDirection: 'row', marginBottom: context.theme.spacing.inline }, viewStyle(overrides))}>
        {item.checked == null
          ? <Text style={[styles.body, { width: 24 }]}>{marker}</Text>
          : <View accessible accessibilityRole="checkbox" accessibilityLabel={textValue(item)} accessibilityState={{ checked: item.checked }} style={{ width: 24, minHeight: 24, paddingTop: 4 }}>
              <View style={{ width: 16, height: 16, borderWidth: 1, borderColor: item.checked ? context.theme.colors.accent : context.theme.colors.border, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: item.checked ? context.theme.colors.accent : 'transparent' }}>
                {item.checked ? <CheckIcon size={11} color={context.theme.colors.background} /> : null}
              </View>
            </View>}
        <View style={{ flexShrink: 1 }}>{defaultChildren(overrides, body)}</View>
      </View>
    ), index);
  });
  return withOverride(node, context, false, rows, (overrides) => <View key={key} style={viewStyle(overrides)}>{defaultChildren(overrides, rows)}</View>, key);
}

function renderTable(node: SemanticNode, context: RenderContext, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const primitives = resolveThemePrimitives(context.theme);
  const columnCount = Math.max(0, ...(node.children ?? []).map((row) => row.children?.length ?? 0));
  const columnWidths = tableColumnWidths(node, columnCount);
  const rows = (node.children ?? []).map((row, rowIndex) => {
    const cells = (row.children ?? []).map((cell, cellIndex) => {
      const value = renderInlineChildren(cell, context);
      const alignment = node.align?.[cellIndex] ?? 'left';
      const alignItems = alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start';
      return withOverride(cell, context, false, value, (overrides) => (
        <View key={cellIndex} style={composedStyle([rowIndex === 0 ? blocks.tableHeader : blocks.tableCell, {
          width: columnWidths[cellIndex],
          alignItems,
          borderRightWidth: cellIndex < columnCount - 1 ? 1 : 0,
          borderRightColor: primitives.border,
        }], viewStyle(overrides))}><Text style={[styles.body, { width: '100%', fontSize: 14, lineHeight: 20, textAlign: alignment }, rowIndex === 0 ? styles.bold : undefined]}>{defaultChildren(overrides, value)}</Text></View>
      ), cellIndex, rowIndex === 0 ? 'th' : 'td');
    });
    return withOverride(row, context, false, cells, (overrides) => (
      <View key={rowIndex} style={composedStyle({ flexDirection: 'row', borderBottomWidth: rowIndex < (node.children?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: primitives.border }, viewStyle(overrides))}>{defaultChildren(overrides, cells)}</View>
    ), rowIndex);
  });
  const table: TableData = {
    headers: (node.children?.[0]?.children ?? []).map(textValue),
    rows: (node.children ?? []).slice(1).map((row) => (row.children ?? []).map(textValue)),
  };
  return withOverride(node, context, false, rows, (overrides) => {
    const content = <ScrollView horizontal style={composedStyle({ borderWidth: 1, borderColor: primitives.border, borderRadius: innerRadius(primitives.radius), backgroundColor: primitives.background }, viewStyle(overrides))}><View key={key}>{defaultChildren(overrides, rows)}</View></ScrollView>;
    return <TableControls
      key={key}
      table={table}
      capabilities={context.capabilities ?? resolveCapabilities()}
      controls={context.controls}
      translations={context.translations ?? defaultTranslations}
      disabled={context.controlsDisabled ?? context.isStreaming}
      icons={context.icons}
      color={primitives.mutedForeground}
      backgroundColor={primitives.background}
      surfaceColor={primitives.sidebar}
      borderColor={primitives.sidebarBorder}
      popoverColor={primitives.popover}
      popoverForegroundColor={primitives.popoverForeground}
      popoverBorderColor={primitives.border}
      radius={controlRadius(primitives.radius)}
      focusRingColor={primitives.ring}
    >{content}</TableControls>;
  }, key);
}

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

function NativeCodeBlock({
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
  // Match Streamdown's visible-code contract: terminal newlines remain available
  // to copy/download controls, but do not create empty rendered rows.
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

function renderNode(node: SemanticNode, context: RenderContext, inline = false, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const children = renderChildren(node, context, inline);
  const primitives = resolveThemePrimitives(context.theme);
  switch (node.type) {
    case 'root':
      return <View key={key} style={{ backgroundColor: primitives.background }}>{renderChildren(node, context, false)}</View>;
    case 'paragraph':
      return renderParagraph(node, context, key);
    case 'heading': {
      const style = styles[`heading${node.depth}` as keyof typeof styles];
      const content = renderInlineChildren(node, context);
      return withOverride(node, context, false, content, (overrides) => <Text key={key} accessibilityRole="header" style={composedStyle([style, { writingDirection: context.direction }], textStyle(overrides))}>{defaultChildren(overrides, content)}</Text>, key);
    }
    case 'text':
      {
        const value = node.value ?? '';
        const start = node.position?.start.offset;
        const from = context.animation?.from;
        if (start === undefined || from === undefined || start + value.length <= from) return value;
        const split = Math.max(0, Math.min(value.length, from - start));
        const suffix = value.slice(split);
        const parts = context.animation!.sep === 'char'
          ? Array.from(suffix)
          : suffix.split(/(\s+)/).filter(Boolean);
        return <React.Fragment key={key}>{value.slice(0, split)}{parts.map((part, index) => /^\s+$/.test(part)
          ? part
          : <AnimatedRevealText
              key={`${from}:${index}`}
              animation={context.animation!.animation}
              delay={index * context.animation!.stagger}
              duration={context.animation!.duration}
              easing={context.animation!.easing}
            >{part}</AnimatedRevealText>
        )}</React.Fragment>;
      }
    case 'strong':
      return withOverride(node, context, true, children, (overrides) => <Text key={key} style={composedStyle(styles.bold, textStyle(overrides))}>{defaultChildren(overrides, children)}</Text>, key);
    case 'emphasis':
      return withOverride(node, context, true, children, (overrides) => <Text key={key} style={composedStyle(styles.italic, textStyle(overrides))}>{defaultChildren(overrides, children)}</Text>, key);
    case 'delete':
      return withOverride(node, context, true, children, (overrides) => <Text key={key} style={composedStyle(styles.strikethrough, textStyle(overrides))}>{defaultChildren(overrides, children)}</Text>, key);
    case 'inlineCode':
      return withOverride(node, context, true, node.value, (overrides) => <Text key={key} style={composedStyle(styles.code, textStyle(overrides))}>{defaultChildren(overrides, node.value)}</Text>, key);
    case 'inlineMath': {
      const source = node.value ?? '';
      const visual = context.plugins?.math?.render({ source, display: false, errorColor: context.theme.colors.muted });
      return withOverride(node, context, true, source, () => visual
        ? <View key={key} accessible accessibilityLabel={source}>{visual}</View>
        : <Text key={key} style={styles.code}>{source}</Text>, key);
    }
    case 'math': {
      const source = node.value ?? '';
      const visual = context.plugins?.math?.render({ source, display: true, errorColor: context.theme.colors.muted });
      return withOverride(node, context, false, source, () => <View key={key} accessibilityLabel={source}>{visual ?? <Text style={styles.code}>{source}</Text>}</View>, key);
    }
    case 'break':
      return '\n';
    case 'blockquote':
      return withOverride(node, context, false, children, (overrides) => <View key={key} style={composedStyle(blocks.blockquote, viewStyle(overrides))}>{defaultChildren(overrides, children)}</View>, key);
    case 'list':
      return renderList(node, context, key);
    case 'listItem':
      return children;
    case 'thematicBreak':
      return withOverride(node, context, false, null, (overrides) => <View key={key} style={composedStyle(blocks.horizontalRule, viewStyle(overrides))} />, key);
    case 'code': {
      const custom = selectCustomRenderer(context.plugins?.renderers, node.lang ?? '');
      if (custom) {
        const Custom = custom.component;
        return <Custom key={key} code={node.value ?? ''} language={node.lang ?? ''} isIncomplete={Boolean(context.isStreaming && context.codeFenceIncomplete)} meta={node.meta ?? undefined} />;
      }
      if ((node.lang ?? '').toLowerCase() === 'mermaid' && context.plugins?.mermaid) {
        const Diagram = context.plugins.mermaid.component;
        return <Diagram
          key={key}
          source={node.value ?? ''}
          plugin={context.plugins.mermaid}
          theme={context.theme}
          capabilities={context.capabilities ?? resolveCapabilities()}
          controls={context.controls}
          translations={context.translations ?? defaultTranslations}
          icons={context.icons}
          disabled={context.controlsDisabled ?? context.isStreaming}
          incomplete={Boolean(context.isStreaming && context.codeFenceIncomplete)}
        />;
      }
      const content = <Text style={[styles.code, { writingDirection: context.direction }]}>{node.value ?? ''}</Text>;
      return withOverride(node, context, false, content, (overrides) => (
        <NativeCodeBlock
          key={key}
          node={node}
          context={context}
          style={viewStyle(overrides)}
          content={defaultChildren(overrides, content)}
          hasContentOverride={Boolean(overrides && 'children' in overrides)}
        />
      ), key);
    }
    case 'table':
      return renderTable(node, context, key);
    case 'tableRow':
    case 'tableCell':
      return children;
    case 'link': {
      const safe = node.url ? sanitizeResourceURL(node.url, 'link', context.securityPolicy) : null;
      if (!safe) return <Text key={key}>{renderInlineChildren(node, context)}</Text>;
      return withOverride(
        safe === node.url ? node : { ...node, url: safe },
        context,
        true,
        children,
        (overrides) => <NativeLink key={key} url={safe} capabilities={context.capabilities ?? resolveCapabilities()} resourcePolicy={context.securityPolicy} translations={context.translations} style={composedStyle(styles.link, textStyle(overrides))}>{defaultChildren(overrides, children)}</NativeLink>,
        key
      );
    }
    case 'linkReference':
      {
        const definition = node.identifier ? context.definitions.get(node.identifier) : undefined;
        const safe = definition?.url
          ? sanitizeResourceURL(definition.url, 'link', context.securityPolicy)
          : null;
        if (!safe) return <Text key={key}>{children}</Text>;
        return withOverride(
          { ...node, url: safe },
          context,
          true,
          children,
          (overrides) => <NativeLink key={key} url={safe} capabilities={context.capabilities ?? resolveCapabilities()} resourcePolicy={context.securityPolicy} translations={context.translations} style={composedStyle(styles.link, textStyle(overrides))}>{defaultChildren(overrides, children)}</NativeLink>,
          key
        );
      }
    case 'image': {
      if (inline) return node.alt ? `[Image: ${node.alt}]` : '';
      const safe = node.url ? sanitizeResourceURL(node.url, 'image', context.securityPolicy) : null;
      if (!safe) return node.alt ? <Text key={key} style={styles.body}>[Image: {node.alt}]</Text> : null;
      const image = <SafeImage key={safe} uri={safe} alt={node.alt ?? undefined} theme={context.theme} capabilities={context.capabilities ?? resolveCapabilities()} controls={context.controls} translations={context.translations ?? defaultTranslations} icons={context.icons} disabled={context.controlsDisabled ?? context.isStreaming} />;
      return withOverride(safe === node.url ? node : { ...node, url: safe }, context, false, null, (overrides) => <View key={key} style={viewStyle(overrides)}>{image}</View>, key);
    }
    case 'imageReference':
      {
        if (inline) return node.alt ? `[Image: ${node.alt}]` : '';
        const definition = node.identifier ? context.definitions.get(node.identifier) : undefined;
        const safe = definition?.url
          ? sanitizeResourceURL(definition.url, 'image', context.securityPolicy)
          : null;
        if (!safe) return node.alt ? <Text key={key}>[Image: {node.alt}]</Text> : null;
        return withOverride(
          { ...node, url: safe },
          context,
          false,
          null,
          (overrides) => <View key={key} style={viewStyle(overrides)}><SafeImage key={safe} uri={safe} alt={node.alt ?? undefined} theme={context.theme} capabilities={context.capabilities ?? resolveCapabilities()} controls={context.controls} translations={context.translations ?? defaultTranslations} icons={context.icons} disabled={context.controlsDisabled ?? context.isStreaming} /></View>,
          key
        );
      }
    case 'footnoteReference':
      if (context.suppressEmptyFootnotes && node.identifier && context.emptyFootnotes.has(node.identifier)) return null;
      return withOverride(node, context, true, `[${node.identifier}]`, (overrides) => <Text key={key} style={textStyle(overrides)}>{defaultChildren(overrides, `[${node.identifier}]`)}</Text>, key);
    case 'footnoteDefinition': {
      if (!node.children?.length) return null;
      const content = <><Text style={styles.bold}>[{node.identifier}] </Text>{children}</>;
      return withOverride(node, context, false, content, () => <View key={key} accessibilityLabel={`Footnote ${node.identifier}`}>{content}</View>, key);
    }
    case 'definition':
      return null;
    case 'html':
    case 'yaml':
    case 'toml':
      return <Text key={key} style={[styles.code, { color: context.theme.colors.muted }]}>{node.value ?? ''}</Text>;
    case 'customTag': {
      const customChildren = node.data?.literal
        ? textValue(node)
        : renderChildren(node, context, inline);
      return withOverride(node, context, inline, customChildren, () => {
        if (inline) return <Text key={key}>{customChildren}</Text>;
        if (node.data?.literal) return <View key={key}><Text>{customChildren}</Text></View>;
        return <View key={key}>{customChildren}</View>;
      }, key);
    }
    default: {
      const fallbackChildren = node.children?.length
        ? renderChildren(node, context, inline)
        : (inline ? node.value ?? null : <Text>{node.value ?? ''}</Text>);
      return withOverride(node, context, inline, fallbackChildren, () => fallbackChildren, key);
    }
  }
}

export const ASTRenderer: React.FC<ASTRendererProps> = ({ node, ...options }) => {
  const rawRoot = materializeCustomTags(
    rootFor(node),
    options.allowedTags,
    options.literalTagContent,
    options.securityPolicy
  );
  const root = applySecurityPolicy(rawRoot, options.securityPolicy);
  const direction = options.dir === 'rtl' || options.dir === 'ltr'
    ? options.dir
    : options.dir === 'auto'
      ? detectTextDirection(textValue(root as unknown as SemanticNode))
      : undefined;
  const definitions = new Map<string, { url?: string; title?: string | null }>();
  const emptyFootnotes = new Set<string>();
  for (const child of root.children as unknown as SemanticNode[]) {
    if (child.type === 'definition' && child.identifier) {
      definitions.set(child.identifier, { url: child.url, title: (child as { title?: string | null }).title });
    }
    if (child.type === 'footnoteDefinition' && child.identifier && !textValue(child).trim()) {
      emptyFootnotes.add(child.identifier);
    }
  }
  return (
    <ComponentErrorContext.Provider value={options.onError}>
      {renderNode(root as unknown as SemanticNode, { ...options, direction, definitions, emptyFootnotes })}
    </ComponentErrorContext.Provider>
  );
};

export { extractComponentData, type ComponentData };

export interface ComponentBlockProps {
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  block?: StableBlock;
  componentName?: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ComponentData[];
  isStreaming?: boolean;
  onError?: ComponentErrorHandler;
  resourcePolicy?: ResourcePolicy;
}

function componentError(theme: ThemeConfig, message: string): ReactNode {
  return <View style={{ padding: 12, backgroundColor: theme.colors.codeBackground, marginBottom: theme.spacing.block }}><Text style={{ color: theme.colors.muted }}>{message}</Text></View>;
}

function ValidatedRegistryComponent({
  componentName, componentRegistry, props, style, children, childrenKey, isStreaming, theme,
  onError: directOnError, resourcePolicy,
}: {
  componentName: string;
  componentRegistry: ComponentRegistry;
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ReactNode;
  childrenKey: number;
  isStreaming: boolean;
  theme: ThemeConfig;
  onError?: ComponentErrorHandler;
  resourcePolicy?: ResourcePolicy;
}) {
  const contextualOnError = useContext(ComponentErrorContext);
  const onError = directOnError ?? contextualOnError;
  const definition = componentRegistry.get(componentName);
  const safeProps = sanitizeProps(props, resourcePolicy);
  const safeStyle = style ? sanitizeProps(style, resourcePolicy) : undefined;
  let validationError: Error | null = null;
  try {
    const result = componentRegistry.validate(componentName, safeProps);
    if (!result.valid) validationError = new Error(`Invalid props for ${componentName}: ${result.errors.join(', ')}`);
  } catch (error) {
    validationError = error instanceof Error ? error : new Error(String(error));
  }
  useEffect(() => {
    if (validationError) onError?.(validationError, componentName);
  }, [componentName, onError, validationError?.message]);
  const fallback = componentError(theme, `⚠️ Invalid component: ${componentName}`);
  if (!definition || validationError) return fallback;
  const Component = isStreaming && definition.skeletonComponent
    ? definition.skeletonComponent
    : definition.component;
  const retryKey = hashContent(JSON.stringify([safeProps, safeStyle, childrenKey, isStreaming]));
  return (
    <RegistryErrorBoundary componentName={componentName} retryKey={retryKey} retryComponent={Component} fallback={fallback} onError={onError}>
      <Component {...safeProps} style={{ ...(safeProps.style as object), ...safeStyle }} _isStreaming={isStreaming}>{children}</Component>
    </RegistryErrorBoundary>
  );
}

export const ComponentBlock: React.FC<ComponentBlockProps> = ({
  theme, componentRegistry, block, componentName: directName, props: directProps,
  style: directStyle, children: directChildren, isStreaming = false, onError,
  resourcePolicy,
}) => {
  const extracted = block ? extractComponentData(block.content, resourcePolicy) : undefined;
  const name = directName ?? extracted?.name ?? '';
  const props = directProps ?? extracted?.props ?? {};
  const style = directStyle ?? extracted?.style;
  const children = directChildren ?? extracted?.children;
  if (!name) return null;
  if (!componentRegistry) return componentError(theme, '⚠️ No component registry provided');
  if (!componentRegistry.get(name)) return componentError(theme, `⚠️ Unknown component: ${name}`);
  const childrenKey = hashContent(JSON.stringify(children ?? null));
  const renderedChildren = children?.map((child, index) => (
    <ComponentBlock key={index} theme={theme} componentRegistry={componentRegistry} componentName={child.name} props={child.props} style={child.style} children={child.children} isStreaming={isStreaming} onError={onError} resourcePolicy={resourcePolicy} />
  ));
  return (
    <View style={{ marginBottom: theme.spacing.block }}>
      <ValidatedRegistryComponent componentName={name} componentRegistry={componentRegistry} props={props} style={style} childrenKey={childrenKey} isStreaming={isStreaming} theme={theme} onError={onError} resourcePolicy={resourcePolicy}>{renderedChildren}</ValidatedRegistryComponent>
    </View>
  );
};

export function renderAST(
  nodes: Content[],
  theme: ThemeConfig,
  componentRegistry?: ComponentRegistry,
  isStreaming = false
): ReactNode {
  return <ASTRenderer node={{ type: 'root', children: nodes } as Root} theme={theme} componentRegistry={componentRegistry} isStreaming={isStreaming} />;
}
