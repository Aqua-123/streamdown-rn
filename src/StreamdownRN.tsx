import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import type {
  BlockRegistry,
  DebugSnapshot,
  StreamdownProps,
  ThemeConfig,
} from './core/types';
import type { SecurityPolicyOptions } from './core/security';
import { INITIAL_REGISTRY } from './core/types';
import { processNewContent, finalizeActiveBlock } from './core/splitter';
import { fixIncompleteMarkdown } from './core/incomplete';
import { parseSemanticDocument } from './core/parser';
import { getTheme } from './themes';
import { StableBlock } from './renderers/StableBlock';
import { ActiveBlock } from './renderers/ActiveBlock';
import { ASTRenderer } from './renderers/ASTRenderer';

function rejectDOMProps(props: Record<string, unknown>): void {
  const name = ['className', 'prefix', 'rehypePlugins', 'remarkRehypeOptions']
    .find((key) => props[key] !== undefined);
  if (name) throw new TypeError(`${name} is DOM-only and is not supported by Streamdown for React Native`);
}

export const Streamdown: React.FC<StreamdownProps> = (props) => {
  rejectDOMProps(props as unknown as Record<string, unknown>);
  const {
    children: value,
    componentRegistry,
    components,
    theme = 'dark',
    style,
    onError,
    onDebug,
    isComplete = false,
    mode = 'streaming',
    dir = 'auto',
    parseIncompleteMarkdown = true,
    remarkPlugins,
    allowedTags,
    literalTagContent,
    allowedElements,
    disallowedElements,
    allowElement,
    unwrapDisallowed,
    skipHtml,
    urlTransform,
    allowedLinkSchemes,
    resolveRelativeUrl,
    dataImages,
  } = props;
  const children = typeof value === 'string' ? value : '';
  const registryRef = useRef<BlockRegistry>(INITIAL_REGISTRY);
  const contentRef = useRef('');
  const lastUpdateTimeRef = useRef(performance.now());
  const previousContentRef = useRef('');
  const themeConfig = useMemo<ThemeConfig>(() => getTheme(theme), [theme]);
  const parseOptions = useMemo(() => ({
    after: remarkPlugins,
    customTags: Object.keys(allowedTags ?? {}),
    literalTags: literalTagContent,
  }), [allowedTags, literalTagContent, remarkPlugins]);
  const securityPolicy: SecurityPolicyOptions = {
    allowedElements,
    disallowedElements,
    allowElement,
    unwrapDisallowed,
    skipHtml,
    urlTransform,
    allowedLinkSchemes,
    resolveRelativeUrl,
    dataImages,
  };

  const registry = useMemo(() => {
    if (!children || children.trim().length === 0) {
      registryRef.current = INITIAL_REGISTRY;
      contentRef.current = '';
      return INITIAL_REGISTRY;
    }
    try {
      if (contentRef.current && !children.startsWith(contentRef.current)) {
        registryRef.current = INITIAL_REGISTRY;
      }
      contentRef.current = children;
      let updated = processNewContent(registryRef.current, children);
      if (isComplete && updated.activeBlock) updated = finalizeActiveBlock(updated);
      registryRef.current = updated;
      return updated;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return registryRef.current;
    }
  }, [children, isComplete, onError]);

  useEffect(() => {
    if (!onDebug || !children) return;
    const now = performance.now();
    const previousContent = previousContentRef.current;
    const snapshot: DebugSnapshot = {
      position: registry.cursor,
      totalLength: children.length,
      newChars: children.slice(previousContent.length),
      newCharsCount: Math.max(0, children.length - previousContent.length),
      registry: {
        stableBlockCount: registry.blocks.length,
        stableBlocks: registry.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          contentLength: block.content.length,
          content: block.content,
        })),
        activeBlock: registry.activeBlock ? {
          type: registry.activeBlock.type,
          contentLength: registry.activeBlock.content.length,
          content: registry.activeBlock.content,
        } : null,
        tagState: { ...registry.activeTagState },
      },
      fixedContent: registry.activeBlock
        ? fixIncompleteMarkdown(registry.activeBlock.content, registry.activeTagState)
        : null,
      timestamp: now,
      deltaMs: now - lastUpdateTimeRef.current,
    };
    onDebug(snapshot);
    lastUpdateTimeRef.current = now;
    previousContentRef.current = children;
  }, [children, onDebug, registry]);

  if (!children || children.trim().length === 0) return null;

  if (mode === 'static') {
    const root = parseSemanticDocument(children, parseOptions);
    return (
      <View style={style}>
        <ASTRenderer
          node={root}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          onError={onError}
          securityPolicy={securityPolicy}
          allowedTags={allowedTags}
          literalTagContent={literalTagContent}
          dir={dir}
        />
      </View>
    );
  }

  return (
    <View style={style}>
      {registry.blocks.map((block) => (
        <StableBlock
          key={block.id}
          block={block}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          onError={onError}
          securityPolicy={securityPolicy}
          allowedTags={allowedTags}
          literalTagContent={literalTagContent}
          dir={dir}
          parseOptions={parseOptions}
        />
      ))}
      <ActiveBlock
        block={registry.activeBlock}
        tagState={registry.activeTagState}
        theme={themeConfig}
        componentRegistry={componentRegistry}
        components={components}
        onError={onError}
        parseOptions={parseOptions}
        securityPolicy={securityPolicy}
        allowedTags={allowedTags}
        literalTagContent={literalTagContent}
        dir={dir}
        parseIncompleteMarkdown={parseIncompleteMarkdown}
      />
    </View>
  );
};

Streamdown.displayName = 'Streamdown';

/** Backward-compatible alias. */
export const StreamdownRN = Streamdown;
export default Streamdown;
