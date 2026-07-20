/**
 * StableBlock Renderer
 * 
 * Renders completed, immutable blocks using cached AST.
 * Memoized to prevent re-renders — once a block is stable, it never changes.
 */

import React from 'react';
import type { StableBlock as StableBlockType, ThemeConfig, ComponentRegistry, NativeComponents } from '../core/types';
import type { SecurityPolicyOptions } from '../core/security';
import { parseSemanticDocument, type SemanticParseOptions } from '../core/parser';
import { ASTRenderer, ComponentBlock } from './ASTRenderer';
import type { StableRootCache, StreamingInstrumentation } from '../core/streaming';
import type { NativeCapabilities } from '../platform/capabilities';
import type { ControlsConfig, IconMap, StreamdownTranslations } from '../controls';
import type { PluginConfig } from '../plugins/renderers';
import type { ThemeInput } from '../plugins/code';

interface StableBlockProps {
  block: StableBlockType;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  onError?: (error: Error, componentName?: string) => void;
  components?: NativeComponents;
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
  ({ block, theme, componentRegistry, onError, components, securityPolicy, allowedTags, literalTagContent, dir, parseOptions, rootCache, instrumentation, capabilities, controls, translations, icons, controlsDisabled, plugins, shikiTheme, lineNumbers }) => {
    instrumentation?.recordStableRender();
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
    
    // Cache the complete Root so document-wide constructs retain every sibling.
    const ast = rootCache.get(block, parseOptions, () => parseSemanticDocument(block.content, parseOptions));
    if (ast) {
      return (
        <ASTRenderer
          node={ast}
          theme={theme}
          componentRegistry={componentRegistry}
          onError={onError}
          components={components}
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
    }
    
    // Fallback if no AST (shouldn't happen for stable blocks)
    console.warn('StableBlock has no AST:', block.type, block.id);
    return null;
  };

export const StableBlock = React.memo(StableBlockRenderer, (previous, next) =>
  previous.block === next.block &&
  previous.theme === next.theme &&
  previous.componentRegistry === next.componentRegistry &&
  previous.onError === next.onError &&
  previous.components === next.components &&
  previous.securityPolicy === next.securityPolicy &&
  previous.allowedTags === next.allowedTags &&
  previous.literalTagContent === next.literalTagContent &&
  previous.dir === next.dir &&
  previous.parseOptions === next.parseOptions &&
  previous.rootCache === next.rootCache &&
  previous.instrumentation === next.instrumentation
  && previous.capabilities === next.capabilities
  && previous.controls === next.controls
  && previous.translations === next.translations
  && previous.icons === next.icons
  && previous.controlsDisabled === next.controlsDisabled
  && previous.plugins === next.plugins
  && previous.shikiTheme === next.shikiTheme
  && previous.lineNumbers === next.lineNumbers
);

StableBlock.displayName = 'StableBlock';
