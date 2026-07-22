import React, { type ReactNode } from 'react';
import type { Content, Root } from 'mdast';
import type { ComponentRegistry, ThemeConfig } from '../core/types';
import { applySecurityPolicy } from '../core/security';
import { detectTextDirection } from '../core/blockSemantics';
import { materializeCustomTags } from './semanticTags';
import { renderNode } from './nodeDispatcher';
import { ComponentErrorContext } from './registryComponents';
import { rootFor, textValue } from './semanticComposition';
import type { ASTRendererProps, SemanticNode } from './rendererTypes';
import { getBlockStyles, getTextStyles, resolveThemePrimitives } from '../themes';

export type { ASTRendererProps } from './rendererTypes';
export {
  ComponentBlock,
  extractComponentData,
  type ComponentBlockProps,
  type ComponentData,
} from './registryComponents';

export const ASTRenderer: React.FC<ASTRendererProps> = ({ node, ...options }) => {
  const rawRoot = materializeCustomTags(
    rootFor(node),
    options.allowedTags,
    options.literalTagContent,
    options.securityPolicy
  );
  const root = applySecurityPolicy(rawRoot, options.securityPolicy);
  const semanticRoot = root as unknown as SemanticNode;
  const direction = options.dir === 'rtl' || options.dir === 'ltr'
    ? options.dir
    : options.dir === 'auto'
      ? detectTextDirection(textValue(semanticRoot))
      : undefined;
  const definitions = new Map<string, { url?: string; title?: string | null }>();
  const emptyFootnotes = new Set<string>();
  for (const child of semanticRoot.children ?? []) {
    if (child.type === 'definition' && child.identifier) {
      definitions.set(child.identifier, { url: child.url, title: (child as { title?: string | null }).title });
    }
    if (child.type === 'footnoteDefinition' && child.identifier && !textValue(child).trim()) {
      emptyFootnotes.add(child.identifier);
    }
  }
  return (
    <ComponentErrorContext.Provider value={options.onError}>
      {renderNode(semanticRoot, {
        ...options,
        direction,
        definitions,
        emptyFootnotes,
        textStyles: getTextStyles(options.theme),
        blockStyles: getBlockStyles(options.theme),
        themePrimitives: resolveThemePrimitives(options.theme),
      })}
    </ComponentErrorContext.Provider>
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
