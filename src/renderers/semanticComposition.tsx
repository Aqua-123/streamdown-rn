import React, { type ReactNode } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { Content, Root } from 'mdast';
import type { Node } from 'unist';
import type { NativeSemanticData } from '../core/types';
import { extractComponentData } from '../core/componentParser';
import { CheckIcon } from '../controls/icons';
import {
  NATIVE_ELEMENT_NAMES,
  type NativeDefaultOverrides,
  type NativeElementName,
  type NativeSlotProps,
  type NativeSlotSemanticData,
} from './types';
import { ComponentBlock } from './registryComponents';
import type { RenderContext, RenderNode, SemanticNode } from './rendererTypes';
import { renderNativeText } from './nativeTextRenderer';

export function rootFor(node: Node): Root {
  return node.type === 'root'
    ? node as Root
    : { type: 'root', children: [node as Content] };
}

export function textValue(node: SemanticNode): string {
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

const KNOWN_NODES = new Set([
  'root', 'paragraph', 'heading', 'code', 'blockquote', 'list', 'listItem',
  'thematicBreak', 'table', 'tableRow', 'tableCell', 'html', 'text', 'strong',
  'emphasis', 'delete', 'inlineCode', 'link', 'linkReference', 'image',
  'imageReference', 'break', 'footnoteReference', 'footnoteDefinition',
  'definition', 'yaml', 'toml', 'customTag', 'inlineMath', 'math',
]);

function overrideFor(node: SemanticNode, context: RenderContext, semanticElement?: string) {
  if (node.type === 'inlineCode' && context.components?.inlineCode) {
    return context.components.inlineCode;
  }
  const name = typeof node.data?.hName === 'string' ? elementName(node) : semanticElement ?? elementName(node);
  return context.components?.[name] ??
    (!KNOWN_NODES.has(node.type) ? context.components?.unknown : undefined);
}

export function withOverride(
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

export function defaultChildren(overrides: NativeDefaultOverrides<NativeElementName> | undefined, children: ReactNode) {
  return overrides && 'children' in overrides ? overrides.children : children;
}

export function viewStyle(overrides?: NativeDefaultOverrides<NativeElementName>): StyleProp<ViewStyle> {
  return overrides?.style as StyleProp<ViewStyle>;
}

export function textStyle(overrides?: NativeDefaultOverrides<NativeElementName>): StyleProp<TextStyle> {
  return overrides?.style as StyleProp<TextStyle>;
}

export function composedStyle<T extends TextStyle | ViewStyle>(
  base: StyleProp<T>,
  extra: StyleProp<TextStyle | ViewStyle>
): StyleProp<T> {
  return extra === undefined ? base : [base, extra] as StyleProp<T>;
}

export const INLINE_NODES = new Set([
  'text', 'strong', 'emphasis', 'delete', 'inlineCode', 'link', 'linkReference',
  'break', 'footnoteReference', 'customTag', 'inlineMath',
]);

export function renderChildren(
  node: SemanticNode,
  context: RenderContext,
  inline: boolean,
  renderNode: RenderNode
): ReactNode {
  return node.children?.map((child, index) => {
    if (!inline && INLINE_NODES.has(child.type)) {
      return <Text key={index}>{renderNode(child, context, true)}</Text>;
    }
    return renderNode(child, context, inline, index);
  }) ?? null;
}

export function renderInlineChildren(
  node: SemanticNode,
  context: RenderContext,
  renderNode: RenderNode
): ReactNode {
  return node.children?.map((child, index) => {
    if (child.type === 'image' || child.type === 'imageReference') {
      return child.alt ? `[Image: ${child.alt}]` : '';
    }
    return renderNode(child, context, true, index);
  }) ?? null;
}

export function renderParagraph(
  node: SemanticNode,
  context: RenderContext,
  renderNode: RenderNode,
  key?: React.Key
): ReactNode {
  const styles = context.textStyles;
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
    const rendered = renderInlineChildren(node, context, renderNode);
    return withOverride(node, context, false, rendered, (overrides) => (
      overrides && 'children' in overrides
        ? <Text key={key} style={composedStyle([styles.paragraph, { writingDirection: context.direction }], textStyle(overrides))}>{overrides.children}</Text>
        : renderNativeText(node, context, composedStyle([styles.paragraph, { writingDirection: context.direction }], textStyle(overrides)), rendered, key)
    ), key);
  }
  const rendered = children.map((child, index) => INLINE_NODES.has(child.type)
    ? <Text key={index} style={[styles.paragraph, { writingDirection: context.direction }]}>{renderNode(child, context, true)}</Text>
    : renderNode(child, context, false, index));
  return withOverride(node, context, false, rendered, (overrides) => <View key={key} style={viewStyle(overrides)}>{defaultChildren(overrides, rendered)}</View>, key);
}

export function renderList(
  node: SemanticNode,
  context: RenderContext,
  renderNode: RenderNode,
  key?: React.Key
): ReactNode {
  const styles = context.textStyles;
  const start = node.start ?? 1;
  const rows = (node.children ?? []).map((item, index) => {
    const marker = item.checked == null ? (node.ordered ? `${start + index}.` : '•') : null;
    const body = renderChildren(item, context, false, renderNode);
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
