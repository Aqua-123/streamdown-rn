import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AnimatedRevealText } from '../core/streaming';
import { sanitizeResourceURL } from '../core/security';
import { NativeLink, SafeImage, defaultTranslations } from '../controls';
import { resolveCapabilities } from '../platform/defaults';
import type { CustomRenderer, RendererPlugin } from '../plugins/renderers';
import { getBlockStyles, getTextStyles, resolveThemePrimitives } from '../themes';
import { NativeCodeBlock } from './codeRenderer';
import {
  composedStyle,
  defaultChildren,
  renderChildren,
  renderInlineChildren,
  renderList,
  renderParagraph,
  textStyle,
  textValue,
  viewStyle,
  withOverride,
} from './semanticComposition';
import { renderTable } from './tableRenderer';
import type { RenderContext, SemanticNode } from './rendererTypes';

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

/** The single auditable semantic-node dispatcher. */
export function renderNode(
  node: SemanticNode,
  context: RenderContext,
  inline = false,
  key?: React.Key
): ReactNode {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const children = renderChildren(node, context, inline, renderNode);
  const primitives = resolveThemePrimitives(context.theme);
  switch (node.type) {
    case 'root':
      return <View key={key} style={{ backgroundColor: primitives.background }}>{renderChildren(node, context, false, renderNode)}</View>;
    case 'paragraph':
      return renderParagraph(node, context, renderNode, key);
    case 'heading': {
      const style = styles[`heading${node.depth}` as keyof typeof styles];
      const content = renderInlineChildren(node, context, renderNode);
      return withOverride(node, context, false, content, (overrides) => <Text key={key} accessibilityRole="header" style={composedStyle([style, { writingDirection: context.direction }], textStyle(overrides))}>{defaultChildren(overrides, content)}</Text>, key);
    }
    case 'text': {
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
      return renderList(node, context, renderNode, key);
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
      return renderTable(node, context, renderNode, key);
    case 'tableRow':
    case 'tableCell':
      return children;
    case 'link': {
      const safe = node.url ? sanitizeResourceURL(node.url, 'link', context.securityPolicy) : null;
      if (!safe) return <Text key={key}>{renderInlineChildren(node, context, renderNode)}</Text>;
      return withOverride(
        safe === node.url ? node : { ...node, url: safe },
        context,
        true,
        children,
        (overrides) => <NativeLink key={key} url={safe} capabilities={context.capabilities ?? resolveCapabilities()} resourcePolicy={context.securityPolicy} translations={context.translations} style={composedStyle(styles.link, textStyle(overrides))}>{defaultChildren(overrides, children)}</NativeLink>,
        key
      );
    }
    case 'linkReference': {
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
    case 'imageReference': {
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
        : renderChildren(node, context, inline, renderNode);
      return withOverride(node, context, inline, customChildren, () => {
        if (inline) return <Text key={key}>{customChildren}</Text>;
        if (node.data?.literal) return <View key={key}><Text>{customChildren}</Text></View>;
        return <View key={key}>{customChildren}</View>;
      }, key);
    }
    default: {
      const fallbackChildren = node.children?.length
        ? renderChildren(node, context, inline, renderNode)
        : (inline ? node.value ?? null : <Text>{node.value ?? ''}</Text>);
      return withOverride(node, context, inline, fallbackChildren, () => fallbackChildren, key);
    }
  }
}
