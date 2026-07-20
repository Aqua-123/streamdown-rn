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

import React from 'react';
import type { ActiveBlock as ActiveBlockType, ThemeConfig, ComponentRegistry, IncompleteTagState, NativeComponents } from '../core/types';
import { fixIncompleteMarkdown } from '../core/incomplete';
import { parseSemanticDocument, type SemanticParseOptions } from '../core/parser';
import type { SecurityPolicyOptions } from '../core/security';
import { ASTRenderer, ComponentBlock, extractComponentData } from './ASTRenderer';
import type { NormalizedAnimationConfig, StreamingInstrumentation } from '../core/streaming';
import { Text } from 'react-native';

interface ActiveBlockProps {
  block: ActiveBlockType | null;
  tagState: IncompleteTagState;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  onError?: (error: Error, componentName?: string) => void;
  components?: NativeComponents;
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
}) => {
  instrumentation?.recordActiveRender();
  // No active block — nothing to render
  if (!block || !block.content.trim()) {
    return null;
  }
  
  // Special handling for component blocks (don't use remark)
  if (block.type === 'component') {
    const { name, props } = extractComponentData(block.content, securityPolicy);
    return (
      <ComponentBlock
        componentName={name}
        props={props}
        isStreaming={true}
        theme={theme}
        componentRegistry={componentRegistry}
        onError={onError}
        resourcePolicy={securityPolicy}
      />
    );
  }
  
  // Fix incomplete markdown for format-as-you-type UX
  const fixedContent = parseIncompleteMarkdown
    ? fixIncompleteMarkdown(block.content, tagState)
    : block.content;
  
  // Parse with remark
  instrumentation?.recordActiveParse();
  const ast = parseSemanticDocument(fixedContent, parseOptions);
  
  // Render from AST
  if (ast.children.length) {
    return (
      <>
      <ASTRenderer
        node={ast}
        theme={theme}
        componentRegistry={componentRegistry}
        isStreaming={true}
        onError={onError}
        components={components}
        securityPolicy={securityPolicy}
        allowedTags={allowedTags}
        literalTagContent={literalTagContent}
        dir={dir}
        animation={animation ? { ...animation, from: animationFrom } : undefined}
      />
      {showCaret && caret ? <Text testID="streamdown-caret">{caret === 'circle' ? ' ●' : ' ▋'}</Text> : null}
      </>
    );
  }
  
  // Fallback if parsing fails (shouldn't happen)
  return null;
};

ActiveBlock.displayName = 'ActiveBlock';
