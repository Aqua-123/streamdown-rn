/**
 * ActiveBlock Renderer
 * 
 * Renders the currently streaming block with format-as-you-type UX.
 * 
 * Flow:
 * 1. Fix incomplete markdown tags (auto-close for preview)
 * 2. Parse with remark to get AST
 * 3. Render AST with ASTRenderer
 */

import React, { useEffect, useMemo } from 'react';
import type { Root } from 'mdast';
import type { ActiveBlock as ActiveBlockType, ThemeConfig, ComponentRegistry, IncompleteTagState, NativeComponents } from '../core/types';
import { fixIncompleteMarkdown } from '../core/incomplete';
import { getSemanticParseError, parseSemanticDocument, type SemanticParseOptions } from '../core/parser';
import type { SecurityPolicyOptions } from '../core/security';
import { ASTRenderer, ComponentBlock, extractComponentData } from './ASTRenderer';
import type { NormalizedAnimationConfig, StreamingInstrumentation } from '../core/streaming';
import { Text } from 'react-native';
import type { NativeCapabilities } from '../platform/capabilities';
import type { ControlsConfig, IconMap, StreamdownTranslations } from '../controls';
import type { PluginConfig } from '../plugins/renderers';
import type { ThemeInput } from '../plugins/code';
import { hasIncompleteCodeFence } from '../core/blockSemantics';
import type { NativeSlots } from './types';

const EMPTY_ROOT: Root = { type: 'root', children: [] };
const MAX_FORMATTED_ACTIVE_BLOCK_LENGTH = 2 * 1024;
const MAX_PROGRESSIVE_COMPONENT_LENGTH = 8 * 1024;
const OVERSIZED_PREVIEW_LENGTH = 2 * 1024;
const OVERSIZED_PREVIEW_CADENCE = 256;

function oversizedPreview(content: string): string {
  const visibleEnd = content.length - (content.length % OVERSIZED_PREVIEW_CADENCE);
  const visibleStart = Math.max(0, visibleEnd - OVERSIZED_PREVIEW_LENGTH);
  return `${visibleStart ? '…' : ''}${content.slice(visibleStart, visibleEnd)}`;
}

interface ActiveBlockProps {
  block: ActiveBlockType | null;
  tagState: IncompleteTagState;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  onError?: (error: Error, componentName?: string) => void;
  components?: NativeComponents;
  slots?: NativeSlots;
  parseOptions?: SemanticParseOptions;
  securityPolicy?: SecurityPolicyOptions;
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  dir?: 'auto' | 'ltr' | 'rtl';
  parseIncompleteMarkdown?: boolean;
  animation?: NormalizedAnimationConfig | null;
  animationFrom?: number;
  showCaret?: boolean;
  caret?: 'block' | 'circle';
  instrumentation?: StreamingInstrumentation;
  capabilities?: NativeCapabilities;
  controls?: ControlsConfig;
  translations?: StreamdownTranslations;
  icons?: IconMap;
  plugins?: PluginConfig;
  shikiTheme?: [ThemeInput, ThemeInput];
  lineNumbers?: boolean;
  isAnimating?: boolean;
}

/**
 * ActiveBlock component — renders the currently streaming block.
 * 
 * This component INTENTIONALLY re-renders on each token.
 * It applies "format-as-you-type" by auto-closing incomplete tags.
 */
export const ActiveBlock: React.FC<ActiveBlockProps> = ({
  block,
  tagState,
  theme,
  componentRegistry,
  onError,
  components,
  slots,
  parseOptions,
  securityPolicy,
  allowedTags,
  literalTagContent,
  dir,
  parseIncompleteMarkdown = true,
  animation,
  animationFrom = 0,
  showCaret = false,
  caret,
  instrumentation,
  capabilities,
  controls,
  translations,
  icons,
  plugins,
  shikiTheme,
  lineNumbers,
  isAnimating = false,
}) => {
  useEffect(() => instrumentation?.recordActiveRender());
  const exceedsFormattedPreviewLimit = Boolean(block && block.type !== 'component' && block.content.length > MAX_FORMATTED_ACTIVE_BLOCK_LENGTH);
  const exceedsComponentPreviewLimit = Boolean(block?.type === 'component' && block.content.length > MAX_PROGRESSIVE_COMPONENT_LENGTH);
  const shouldParse = Boolean(block?.content.trim() && block.type !== 'component' && !exceedsFormattedPreviewLimit);
  const fixedContent = shouldParse
    ? (parseIncompleteMarkdown ? fixIncompleteMarkdown(block!.content, tagState) : block!.content)
    : '';
  const ast = useMemo(
    () => {
      if (!shouldParse) return EMPTY_ROOT;
      const startedAt = performance.now();
      const root = parseSemanticDocument(fixedContent, parseOptions);
      instrumentation?.recordParserDuration?.(Math.round((performance.now() - startedAt) * 1_000_000));
      return root;
    },
    [fixedContent, instrumentation, parseOptions, shouldParse]
  );
  useEffect(() => {
    if (shouldParse) instrumentation?.recordActiveParse();
  }, [instrumentation, parseOptions, shouldParse, block?.content]);
  useEffect(() => {
    const parseError = getSemanticParseError(ast);
    if (parseError) onError?.(parseError);
  }, [ast, onError]);
  // No active block — nothing to render
  if (!block || !block.content.trim()) {
    return null;
  }
  
  // Special handling for component blocks (don't use remark)
  if (block.type === 'component') {
    if (exceedsComponentPreviewLimit) {
      return (
        <Text style={{ color: theme.colors.foreground, fontFamily: theme.fonts.regular }}>
          {oversizedPreview(block.content)}{showCaret && caret ? (caret === 'circle' ? ' ●' : ' ▋') : ''}
        </Text>
      );
    }
    const { name, props, style, children } = extractComponentData(block.content, securityPolicy);
    return (
      <ComponentBlock
        componentName={name}
        props={props}
        style={style}
        children={children}
        isStreaming={isAnimating}
        theme={theme}
        componentRegistry={componentRegistry}
        onError={onError}
        resourcePolicy={securityPolicy}
      />
    );
  }

  // Re-parsing every token of one pathological, unbroken block is quadratic.
  // Keep the streaming preview readable and bounded; completion uses the full
  // stable/document parser and restores semantic formatting.
  if (exceedsFormattedPreviewLimit) {
    return (
      <Text style={{ color: theme.colors.foreground, fontFamily: theme.fonts.regular }}>
        {oversizedPreview(block.content)}{showCaret && caret ? (caret === 'circle' ? ' ●' : ' ▋') : ''}
      </Text>
    );
  }
  
  // Render from AST
  if (ast.children.length) {
    return (
      <>
      <ASTRenderer
        node={ast}
        theme={theme}
        componentRegistry={componentRegistry}
        isStreaming={isAnimating}
        suppressEmptyFootnotes
        onError={onError}
        components={components}
        slots={slots}
        securityPolicy={securityPolicy}
        allowedTags={allowedTags}
        literalTagContent={literalTagContent}
        dir={dir}
        animation={animation ? { ...animation, from: animationFrom } : undefined}
        capabilities={capabilities}
        controls={controls}
        translations={translations}
        icons={icons}
        plugins={plugins}
        shikiTheme={shikiTheme}
        lineNumbers={lineNumbers}
        codeFenceIncomplete={hasIncompleteCodeFence(block.content)}
      />
      {showCaret && caret ? <Text testID="streamdown-caret">{caret === 'circle' ? ' ●' : ' ▋'}</Text> : null}
      </>
    );
  }
  
  // Fallback if parsing fails (shouldn't happen)
  return null;
};

ActiveBlock.displayName = 'ActiveBlock';
