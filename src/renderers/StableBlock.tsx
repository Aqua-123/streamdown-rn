/**
 * StableBlock Renderer
 * 
 * Renders completed, immutable blocks using cached AST.
 * Memoized to prevent re-renders — once a block is stable, it never changes.
 */

import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import type { StableBlock as StableBlockType, ThemeConfig, ComponentRegistry, NativeComponents } from '../core/types';
import type { SecurityPolicyOptions } from '../core/security';
import { getSemanticParseError, parseSemanticDocument, type SemanticParseOptions } from '../core/parser';
import { ASTRenderer, ComponentBlock } from './ASTRenderer';
import type { StableRootCache, StreamingInstrumentation } from '../core/streaming';
import type { NativeCapabilities } from '../platform/capabilities';
import type { ControlsConfig, IconMap, StreamdownTranslations } from '../controls';
import type { PluginConfig } from '../plugins/renderers';
import type { ThemeInput } from '../plugins/code';
import type { NativeSlots } from './types';

interface StableBlockProps {
  block: StableBlockType;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  onError?: (error: Error, componentName?: string) => void;
  components?: NativeComponents;
  slots?: NativeSlots;
  securityPolicy?: SecurityPolicyOptions;
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  dir?: 'auto' | 'ltr' | 'rtl';
  parseOptions?: SemanticParseOptions;
  rootCache: StableRootCache;
  instrumentation?: StreamingInstrumentation;
  capabilities?: NativeCapabilities;
  controls?: ControlsConfig;
  translations?: StreamdownTranslations;
  icons?: IconMap;
  controlsDisabled?: boolean;
  plugins?: PluginConfig;
  shikiTheme?: [ThemeInput, ThemeInput];
  lineNumbers?: boolean;
}

/**
 * StableBlock component — renders finalized blocks from cached AST.
 * U6 owns memoization after all renderer-bearing inputs are instrumented.
 */
const StableBlockRenderer: React.FC<StableBlockProps> =
  ({ block, theme, componentRegistry, onError, components, slots, securityPolicy, allowedTags, literalTagContent, dir, parseOptions, rootCache, instrumentation, capabilities, controls, translations, icons, controlsDisabled, plugins, shikiTheme, lineNumbers }) => {
    useLayoutEffect(() => instrumentation?.recordStableRender());
    // Component blocks don't have AST (custom syntax, not markdown)
    if (block.type === 'component') {
      return (
        <ComponentBlock
          block={block}
          theme={theme}
          componentRegistry={componentRegistry}
          onError={onError}
          resourcePolicy={securityPolicy}
        />
      );
    }
    
    return <MarkdownStableBlock {...{ block, theme, componentRegistry, onError, components, slots, securityPolicy, allowedTags, literalTagContent, dir, parseOptions, rootCache, instrumentation, capabilities, controls, translations, icons, controlsDisabled, plugins, shikiTheme, lineNumbers }} />;
  };

const MarkdownStableBlock: React.FC<StableBlockProps> = ({
  block, theme, componentRegistry, onError, components, slots, securityPolicy,
  allowedTags, literalTagContent, dir, parseOptions, rootCache, instrumentation, capabilities,
  controls, translations, icons, controlsDisabled, plugins, shikiTheme, lineNumbers,
}) => {
  const cachedAst = rootCache.peek(block, parseOptions);
  const ast = useMemo(
    () => {
      if (cachedAst) return cachedAst;
      const startedAt = performance.now();
      const root = parseSemanticDocument(block.content, parseOptions);
      instrumentation?.recordParserDuration?.(Math.round((performance.now() - startedAt) * 1_000_000));
      return root;
    },
    [block, cachedAst, instrumentation, parseOptions]
  );
  useEffect(() => {
    rootCache.commit(block, parseOptions, ast, cachedAst !== undefined);
  });
  useEffect(() => {
    const parseError = getSemanticParseError(ast);
    if (parseError) onError?.(parseError);
  }, [ast, onError]);
  return (
    <ASTRenderer
      node={ast}
      theme={theme}
      componentRegistry={componentRegistry}
      onError={onError}
      components={components}
      slots={slots}
      securityPolicy={securityPolicy}
      allowedTags={allowedTags}
      literalTagContent={literalTagContent}
      dir={dir}
      capabilities={capabilities}
      controls={controls}
      translations={translations}
      icons={icons}
      controlsDisabled={controlsDisabled}
      plugins={plugins}
      shikiTheme={shikiTheme}
      lineNumbers={lineNumbers}
    />
  );
};

export const StableBlock = React.memo(StableBlockRenderer);

StableBlock.displayName = 'StableBlock';
