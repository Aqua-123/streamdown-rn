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
import { hasIncompleteCodeFence, hasTable } from './core/blockSemantics';
import {
  classifyStreamUpdate,
  getAnimationWindow,
  normalizeAnimationConfig,
  StableRootCache,
  useReducedMotion,
} from './core/streaming';
import { resolveCapabilities } from './platform/defaults';
import { resolveTranslations, useStreamingAnnouncement } from './controls';
import type { ThemeInput } from './plugins/code';

const DEFAULT_CODE_THEMES: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];

function rejectDOMProps(props: Record<string, unknown>): void {
  const name = ['className', 'prefix', 'rehypePlugins', 'remarkRehypeOptions']
    .find((key) => props[key] !== undefined);
  if (name) throw new TypeError(`${name} is DOM-only and is not supported by Streamdown for React Native`);
}

const StreamdownComponent: React.FC<StreamdownProps> = (props) => {
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
    isAnimating = false,
    animated,
    caret,
    reducedMotion,
    onAnimationStart,
    onAnimationEnd,
    instrumentation,
    capabilities,
    controls,
    translations,
    icons,
    announceStreaming,
    remarkPlugins,
    plugins,
    shikiTheme = DEFAULT_CODE_THEMES,
    lineNumbers = true,
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
  const generationRef = useRef(0);
  const stableRootCacheRef = useRef(new StableRootCache(128, instrumentation));
  const lastUpdateTimeRef = useRef(performance.now());
  const previousContentRef = useRef('');
  const previousAnimatingRef = useRef<boolean | null>(null);
  const onAnimationStartRef = useRef(onAnimationStart);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const onErrorRef = useRef(onError);
  const instrumentationRef = useRef(instrumentation);
  onAnimationStartRef.current = onAnimationStart;
  onAnimationEndRef.current = onAnimationEnd;
  onErrorRef.current = onError;
  instrumentationRef.current = instrumentation;
  stableRootCacheRef.current.setInstrumentation(instrumentation);
  const prefersReducedMotion = useReducedMotion(reducedMotion);
  const nativeCapabilities = useMemo(() => resolveCapabilities(capabilities), [capabilities]);
  const nativeTranslations = useMemo(() => resolveTranslations(translations), [translations]);
  const requestedAnnouncementDelay = typeof announceStreaming === 'object' ? announceStreaming.delayMs ?? 400 : 400;
  const announcementDelay = Number.isFinite(requestedAnnouncementDelay)
    ? Math.max(250, requestedAnnouncementDelay)
    : 400;
  const streamingBusy = mode === 'streaming' && isAnimating && !isComplete;
  useStreamingAnnouncement(children, Boolean(announceStreaming && streamingBusy), nativeCapabilities, announcementDelay);
  const themeConfig = useMemo<ThemeConfig>(() => getTheme(theme), [theme]);
  const parseOptions = useMemo(() => ({
    before: plugins?.cjk?.remarkPluginsBefore,
    supplied: remarkPlugins,
    after: plugins?.cjk?.remarkPluginsAfter,
    math: plugins?.math?.remarkPlugin,
    customTags: Object.keys(allowedTags ?? {}),
    literalTags: literalTagContent,
  }), [allowedTags, literalTagContent, plugins?.cjk, plugins?.math, remarkPlugins]);
  const securityPolicy = useMemo<SecurityPolicyOptions>(() => ({
    allowedElements,
    disallowedElements,
    allowElement,
    unwrapDisallowed,
    skipHtml,
    urlTransform,
    allowedLinkSchemes,
    resolveRelativeUrl,
    dataImages,
  }), [
    allowedElements,
    disallowedElements,
    allowElement,
    unwrapDisallowed,
    skipHtml,
    urlTransform,
    allowedLinkSchemes,
    resolveRelativeUrl,
    dataImages,
  ]);
  const animationConfig = useMemo(
    () => normalizeAnimationConfig(animated),
    [
      typeof animated === 'object' ? animated.animation : animated,
      typeof animated === 'object' ? animated.duration : undefined,
      typeof animated === 'object' ? animated.easing : undefined,
      typeof animated === 'object' ? animated.sep : undefined,
      typeof animated === 'object' ? animated.stagger : undefined,
    ]
  );
  const completeRoot = useMemo(
    () => {
      if (!(mode === 'static' || isComplete) || !children) return null;
      instrumentationRef.current?.recordDocumentParse();
      return parseSemanticDocument(children, parseOptions);
    },
    [children, isComplete, mode, parseOptions]
  );

  const streamState = useMemo(() => {
    if (mode === 'static') {
      if (contentRef.current) {
        registryRef.current = INITIAL_REGISTRY;
        contentRef.current = '';
        stableRootCacheRef.current.clear();
        generationRef.current++;
        previousContentRef.current = '';
      }
      return { registry: INITIAL_REGISTRY, generation: generationRef.current, animationFrom: children.length };
    }
    if (!children || children.trim().length === 0) {
      if (contentRef.current) {
        instrumentation?.recordReset();
        stableRootCacheRef.current.clear();
        generationRef.current++;
        previousContentRef.current = '';
      }
      registryRef.current = INITIAL_REGISTRY;
      contentRef.current = '';
      return { registry: INITIAL_REGISTRY, generation: generationRef.current, animationFrom: 0 };
    }
    const previous = contentRef.current;
    const update = classifyStreamUpdate(previous, children);
    try {
      if (update.kind === 'reset') {
        registryRef.current = INITIAL_REGISTRY;
        stableRootCacheRef.current.clear();
        generationRef.current++;
        instrumentation?.recordReset();
        previousContentRef.current = '';
      } else if (update.kind === 'append') {
        instrumentation?.recordAppend(update.added.length);
      }
      contentRef.current = children;
      let updated = processNewContent(registryRef.current, children);
      if (isComplete && updated.activeBlock) updated = finalizeActiveBlock(updated);
      registryRef.current = updated;
      return { registry: updated, generation: generationRef.current, animationFrom: update.from };
    } catch (error) {
      onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
      return { registry: registryRef.current, generation: generationRef.current, animationFrom: children.length };
    }
  }, [children, instrumentation, isComplete, mode]);
  const { registry, generation, animationFrom } = streamState;
  const animationWindow = getAnimationWindow(
    children.slice(0, animationFrom),
    children,
    Boolean(animationConfig && isAnimating),
    prefersReducedMotion
  );
  const activeContent = registry.activeBlock?.content ?? '';
  const deferHeavyContent = hasIncompleteCodeFence(activeContent) || hasTable(activeContent);

  useEffect(() => {
    if (mode === 'static') {
      previousAnimatingRef.current = null;
      return;
    }
    const previous = previousAnimatingRef.current;
    previousAnimatingRef.current = isAnimating;
    if (previous === null) {
      if (isAnimating) onAnimationStartRef.current?.();
    } else if (isAnimating && !previous) {
      onAnimationStartRef.current?.();
    } else if (!isAnimating && previous) {
      onAnimationEndRef.current?.();
    }
  }, [isAnimating, mode]);

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
    return (
      <View style={style}>
        <ASTRenderer
          node={completeRoot!}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          onError={onError}
          securityPolicy={securityPolicy}
          allowedTags={allowedTags}
          literalTagContent={literalTagContent}
          dir={dir}
          capabilities={nativeCapabilities}
          controls={controls}
          translations={nativeTranslations}
          icons={icons}
          plugins={plugins}
          shikiTheme={shikiTheme}
          lineNumbers={lineNumbers}
        />
      </View>
    );
  }

  if (isComplete) {
    return (
      <View style={style}>
        <ASTRenderer
          node={completeRoot!}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          onError={onError}
          securityPolicy={securityPolicy}
          allowedTags={allowedTags}
          literalTagContent={literalTagContent}
          dir={dir}
          capabilities={nativeCapabilities}
          controls={controls}
          translations={nativeTranslations}
          icons={icons}
          plugins={plugins}
          shikiTheme={shikiTheme}
          lineNumbers={lineNumbers}
        />
      </View>
    );
  }

  return (
    <View style={style}>
      {streamingBusy ? <View accessible accessibilityRole="progressbar" accessibilityLabel={nativeTranslations.streamingResponse} accessibilityState={{ busy: true }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /> : null}
      {registry.blocks.map((block) => (
        <StableBlock
          key={`${generation}:${block.id}`}
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
          rootCache={stableRootCacheRef.current}
          instrumentation={instrumentation}
          capabilities={nativeCapabilities}
          controls={controls}
          translations={nativeTranslations}
          icons={icons}
          controlsDisabled={streamingBusy}
          plugins={plugins}
          shikiTheme={shikiTheme}
          lineNumbers={lineNumbers}
        />
      ))}
      <ActiveBlock
        key={generation}
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
        animation={animationWindow && !deferHeavyContent ? animationConfig : null}
        animationFrom={Math.max(0, (animationWindow?.from ?? children.length) - (registry.activeBlock?.startPos ?? 0))}
        showCaret={Boolean(caret && isAnimating && !isComplete && !deferHeavyContent)}
        caret={caret}
        instrumentation={instrumentation}
        capabilities={nativeCapabilities}
        controls={controls}
        translations={nativeTranslations}
        icons={icons}
        plugins={plugins}
        shikiTheme={shikiTheme}
        lineNumbers={lineNumbers}
      />
    </View>
  );
};

export const Streamdown = React.memo(StreamdownComponent);
Streamdown.displayName = 'Streamdown';

/** Backward-compatible alias. */
export const StreamdownRN = Streamdown;
export default Streamdown;
