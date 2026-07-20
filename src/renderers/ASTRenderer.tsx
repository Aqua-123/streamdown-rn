import React, { ReactNode, useContext, useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import type { Content, Root } from 'mdast';
import type { Node } from 'unist';
import type {
  ComponentRegistry,
  NativeComponents,
  NativeSemanticData,
  StableBlock,
  ThemeConfig,
} from '../core/types';
import { extractComponentData, type ComponentData } from '../core/componentParser';
import { sanitizeProps } from '../core/sanitize';
import {
  applySecurityPolicy,
  sanitizeResourceURL,
  type ResourcePolicy,
  type SecurityPolicyOptions,
} from '../core/security';
import { detectTextDirection } from '../core/blockSemantics';
import { getBlockStyles, getTextStyles } from '../themes';
import { materializeCustomTags } from './semanticTags';

type ComponentErrorHandler = (error: Error, componentName?: string) => void;
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
  children?: SemanticNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown>; literal?: boolean };
};

export interface ASTRendererProps {
  node: Node;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  components?: NativeComponents;
  isStreaming?: boolean;
  onError?: ComponentErrorHandler;
  securityPolicy?: SecurityPolicyOptions;
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  dir?: 'auto' | 'ltr' | 'rtl';
}

interface RenderContext extends Omit<ASTRendererProps, 'node'> {
  direction: 'ltr' | 'rtl';
  definitions: ReadonlyMap<string, { url?: string; title?: string | null }>;
}

const ComponentErrorContext = React.createContext<ComponentErrorHandler | undefined>(undefined);

class RegistryErrorBoundary extends React.Component<{
  children: ReactNode;
  componentName: string;
  fallback: ReactNode;
  onError?: ComponentErrorHandler;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError?.(error, this.props.componentName); }
  componentDidUpdate(previous: Readonly<{ componentName: string }>) {
    if (this.state.failed && previous.componentName !== this.props.componentName) {
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
    case 'break': return 'br';
    default: return node.type;
  }
}

function overrideFor(node: SemanticNode, context: RenderContext) {
  if (node.type === 'inlineCode' && context.components?.inlineCode) {
    return context.components.inlineCode;
  }
  return context.components?.[elementName(node)] ??
    (!KNOWN_NODES.has(node.type) ? context.components?.unknown : undefined);
}

function withOverride(
  node: SemanticNode,
  context: RenderContext,
  inline: boolean,
  children: ReactNode,
  fallback: () => ReactNode
): ReactNode {
  const Override = overrideFor(node, context);
  return Override
    ? <Override semantic={semantic(node, inline)}>{children}</Override>
    : fallback();
}

const INLINE_NODES = new Set([
  'text', 'strong', 'emphasis', 'delete', 'inlineCode', 'link', 'linkReference',
  'break', 'footnoteReference', 'customTag',
]);
const KNOWN_NODES = new Set([
  'root', 'paragraph', 'heading', 'code', 'blockquote', 'list', 'listItem',
  'thematicBreak', 'table', 'tableRow', 'tableCell', 'html', 'text', 'strong',
  'emphasis', 'delete', 'inlineCode', 'link', 'linkReference', 'image',
  'imageReference', 'break', 'footnoteReference', 'footnoteDefinition',
  'definition', 'yaml', 'toml', 'customTag',
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
    const rendered = renderInlineChildren(node, context);
    return withOverride(node, context, false, rendered, () => (
      <Text key={key} style={[styles.paragraph, { writingDirection: context.direction }]}>{rendered}</Text>
    ));
  }
  const rendered = children.map((child, index) => INLINE_NODES.has(child.type)
    ? <Text key={index} style={[styles.paragraph, { writingDirection: context.direction }]}>{renderNode(child, context, true)}</Text>
    : renderNode(child, context, false, index));
  return withOverride(node, context, false, rendered, () => <View key={key}>{rendered}</View>);
}

function renderList(node: SemanticNode, context: RenderContext, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const start = node.start ?? 1;
  const rows = (node.children ?? []).map((item, index) => {
    const marker = item.checked == null
      ? (node.ordered ? `${start + index}.` : '•')
      : (item.checked ? '☑' : '☐');
    const body = renderChildren(item, context, false);
    return withOverride(item, context, false, body, () => (
      <View key={index} style={{ flexDirection: 'row', marginBottom: context.theme.spacing.inline }}>
        <Text accessibilityRole={item.checked == null ? undefined : 'checkbox'} accessibilityState={item.checked == null ? undefined : { checked: item.checked }} style={[styles.body, { width: 28 }]}>{marker}</Text>
        <View style={{ flexShrink: 1 }}>{body}</View>
      </View>
    ));
  });
  return withOverride(node, context, false, rows, () => <View key={key}>{rows}</View>);
}

function renderTable(node: SemanticNode, context: RenderContext, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const rows = (node.children ?? []).map((row, rowIndex) => {
    const cells = (row.children ?? []).map((cell, cellIndex) => {
      const value = renderInlineChildren(cell, context);
      return withOverride(cell, context, false, value, () => (
        <View key={cellIndex} style={{ flex: 1, padding: 8 }}><Text style={rowIndex === 0 ? styles.bold : styles.body}>{value}</Text></View>
      ));
    });
    return withOverride(row, context, false, cells, () => (
      <View key={rowIndex} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: context.theme.colors.border }}>{cells}</View>
    ));
  });
  return withOverride(node, context, false, rows, () => <View key={key} style={getBlockStyles(context.theme).table}>{rows}</View>);
}

function AutoSizedImage({ uri, alt, theme }: { uri: string; alt?: string; theme: ThemeConfig }) {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  useEffect(() => {
    let mounted = true;
    Image.getSize(uri, (width, height) => {
      if (mounted && width && height) setAspectRatio(width / height);
    }, () => undefined);
    return () => { mounted = false; };
  }, [uri]);
  return <Image source={{ uri }} style={{ width: '100%', aspectRatio, backgroundColor: theme.colors.codeBackground }} resizeMode="contain" accessibilityLabel={alt ?? 'Image'} />;
}

function renderNode(node: SemanticNode, context: RenderContext, inline = false, key?: React.Key): ReactNode {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const children = renderChildren(node, context, inline);
  switch (node.type) {
    case 'root':
      return <View key={key}>{renderChildren(node, context, false)}</View>;
    case 'paragraph':
      return renderParagraph(node, context, key);
    case 'heading': {
      const style = styles[`heading${node.depth}` as keyof typeof styles];
      const content = renderInlineChildren(node, context);
      return withOverride(node, context, false, content, () => <Text key={key} accessibilityRole="header" style={[style, { writingDirection: context.direction }]}>{content}</Text>);
    }
    case 'text':
      return node.value ?? '';
    case 'strong':
      return withOverride(node, context, true, children, () => <Text key={key} style={styles.bold}>{children}</Text>);
    case 'emphasis':
      return withOverride(node, context, true, children, () => <Text key={key} style={styles.italic}>{children}</Text>);
    case 'delete':
      return withOverride(node, context, true, children, () => <Text key={key} style={styles.strikethrough}>{children}</Text>);
    case 'inlineCode':
      return withOverride(node, context, true, node.value, () => <Text key={key} style={styles.code}>{node.value}</Text>);
    case 'break':
      return '\n';
    case 'blockquote':
      return withOverride(node, context, false, children, () => <View key={key} style={blocks.blockquote}>{children}</View>);
    case 'list':
      return renderList(node, context, key);
    case 'listItem':
      return children;
    case 'thematicBreak':
      return withOverride(node, context, false, null, () => <View key={key} style={blocks.horizontalRule} />);
    case 'code': {
      const content = <Text style={[styles.code, { writingDirection: context.direction }]}>{node.value ?? ''}</Text>;
      return withOverride(node, context, false, content, () => (
        <View key={key} style={blocks.codeBlock}>
          {node.lang ? <Text style={{ color: context.theme.colors.muted }}>{node.lang}</Text> : null}
          <ScrollView horizontal><Text style={styles.code}>{node.value ?? ''}</Text></ScrollView>
        </View>
      ));
    }
    case 'table':
      return renderTable(node, context, key);
    case 'tableRow':
    case 'tableCell':
      return children;
    case 'link':
      if (!node.url) return <Text key={key}>{renderInlineChildren(node, context)}</Text>;
      return withOverride(node, context, true, children, () => <Text key={key} accessibilityRole="link" style={styles.link}>{children}</Text>);
    case 'linkReference':
      {
        const definition = node.identifier ? context.definitions.get(node.identifier) : undefined;
        if (!definition?.url) return <Text key={key}>{children}</Text>;
        return withOverride(
          { ...node, url: definition.url },
          context,
          true,
          children,
          () => <Text key={key} accessibilityRole="link" style={styles.link}>{children}</Text>
        );
      }
    case 'image': {
      if (inline) return node.alt ? `[Image: ${node.alt}]` : '';
      const safe = node.url ? sanitizeResourceURL(node.url, 'image', context.securityPolicy) : null;
      if (!safe) return node.alt ? <Text key={key} style={styles.body}>[Image: {node.alt}]</Text> : null;
      const image = <AutoSizedImage uri={safe} alt={node.alt ?? undefined} theme={context.theme} />;
      return withOverride(node, context, false, null, () => <View key={key}>{image}</View>);
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
          () => <View key={key}><AutoSizedImage uri={safe} alt={node.alt ?? undefined} theme={context.theme} /></View>
        );
      }
    case 'footnoteReference':
      return withOverride(node, context, true, `[${node.identifier}]`, () => <Text key={key}>[{node.identifier}]</Text>);
    case 'footnoteDefinition': {
      const content = <><Text style={styles.bold}>[{node.identifier}] </Text>{children}</>;
      return withOverride(node, context, false, content, () => <View key={key} accessibilityLabel={`Footnote ${node.identifier}`}>{content}</View>);
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
      });
    }
    default: {
      const fallbackChildren = node.children?.length
        ? renderChildren(node, context, inline)
        : (inline ? node.value ?? null : <Text>{node.value ?? ''}</Text>);
      return withOverride(node, context, inline, fallbackChildren, () => fallbackChildren);
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
    : detectTextDirection(textValue(root as unknown as SemanticNode));
  const definitions = new Map<string, { url?: string; title?: string | null }>();
  for (const child of root.children as unknown as SemanticNode[]) {
    if (child.type === 'definition' && child.identifier) {
      definitions.set(child.identifier, { url: child.url, title: (child as { title?: string | null }).title });
    }
  }
  return (
    <ComponentErrorContext.Provider value={options.onError}>
      {renderNode(root as unknown as SemanticNode, { ...options, direction, definitions })}
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
  componentName, componentRegistry, props, style, children, isStreaming, theme,
  onError: directOnError, resourcePolicy,
}: {
  componentName: string;
  componentRegistry: ComponentRegistry;
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ReactNode;
  isStreaming: boolean;
  theme: ThemeConfig;
  onError?: ComponentErrorHandler;
  resourcePolicy?: ResourcePolicy;
}) {
  const onError = directOnError ?? useContext(ComponentErrorContext);
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
  return (
    <RegistryErrorBoundary componentName={componentName} fallback={fallback} onError={onError}>
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
  const renderedChildren = children?.map((child, index) => (
    <ComponentBlock key={index} theme={theme} componentRegistry={componentRegistry} componentName={child.name} props={child.props} style={child.style} children={child.children} isStreaming={isStreaming} onError={onError} resourcePolicy={resourcePolicy} />
  ));
  return (
    <View style={{ marginBottom: theme.spacing.block }}>
      <ValidatedRegistryComponent componentName={name} componentRegistry={componentRegistry} props={props} style={style} isStreaming={isStreaming} theme={theme} onError={onError} resourcePolicy={resourcePolicy}>{renderedChildren}</ValidatedRegistryComponent>
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
