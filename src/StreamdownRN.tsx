import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import type {
  BlockRegistry,
  DebugSnapshot,
  StreamdownProps,
  ThemeConfig,
} from './core/types';
import type { SecurityPolicyOptions } from './core/security';
import { INITIAL_REGISTRY } from './core/types';
import { processNewContent, finalizeActiveBlock } from './core/splitter';
import { fixIncompleteMarkdown, INITIAL_INCOMPLETE_STATE, updateTagState } from './core/incomplete';
import { getSemanticParseError, normalizeHtmlIndentation, parseSemanticDocument } from './core/parser';
import { getTheme } from './themes';
import { StableBlock } from './renderers/StableBlock';
import { ActiveBlock } from './renderers/ActiveBlock';
import { ASTRenderer } from './renderers/ASTRenderer';
import { hasIncompleteCodeFence, hasTable } from './core/blockSemantics';
import {
  classifyStreamUpdate,
  getAnimationWindowFrom,
  normalizeAnimationConfig,
  StableRootCache,
  useFrameCoalescedValue,
  useReducedMotion,
} from './core/streaming';
import { resolveCapabilities } from './platform/defaults';
import { resolveTranslations, useStreamingAnnouncement } from './controls';
import type { ThemeInput } from './plugins/code';

const DEFAULT_CODE_THEMES: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];
const DEFAULT_MAX_INPUT_LENGTH = 2 * 1024 * 1024;
const MAX_INPUT_FALLBACK_LENGTH = 2 * 1024;
const STABLE_BLOCK_BATCH_SIZE = 32;

function rejectDOMProps(props: Record<string, unknown>): void {
  const name = ['className', 'prefix', 'rehypePlugins', 'remarkRehypeOptions']
    .find((key) => props[key] !== undefined);
  if (name) throw new TypeError(`${name} is DOM-only and is not supported by Streamdown for React Native`);
}

type StableBlockProps = React.ComponentProps<typeof StableBlock>;
type StableBlockListProps = Omit<StableBlockProps, 'block'> & {
  blocks: readonly StableBlockProps['block'][];
  generation: number;
};

const StableBlockBatch = React.memo(({
  blocks,
  generation,
  ...props
}: StableBlockListProps) => (
  <>
    {blocks.map((block) => (
      <StableBlock key={`${generation}:${block.id}`} block={block} {...props} />
    ))}
  </>
));
StableBlockBatch.displayName = 'StableBlockBatch';

const StableBlockList: React.FC<StableBlockListProps> = ({ blocks, generation, ...props }) => {
  const cache = useRef<{
    generation: number;
    source: readonly StableBlockProps['block'][];
    batches: Array<readonly StableBlockProps['block'][]>;
  }>({ generation, source: [], batches: [] });
  const previous = cache.current;
  const extendsPrevious = previous.generation === generation
    && blocks.length >= previous.source.length
    && (!previous.source.length || blocks[previous.source.length - 1] === previous.source[previous.source.length - 1]);

  if (!extendsPrevious) {
    const batches: Array<readonly StableBlockProps['block'][]> = [];
    for (let index = 0; index < blocks.length; index += STABLE_BLOCK_BATCH_SIZE) {
      batches.push(blocks.slice(index, index + STABLE_BLOCK_BATCH_SIZE));
    }
    cache.current = { generation, source: blocks, batches };
  } else if (blocks.length > previous.source.length) {
    let index = previous.source.length;
    const partial = index % STABLE_BLOCK_BATCH_SIZE;
    if (partial) {
      const room = STABLE_BLOCK_BATCH_SIZE - partial;
      const added = blocks.slice(index, index + room);
      previous.batches[previous.batches.length - 1] = [...previous.batches[previous.batches.length - 1], ...added];
      index += added.length;
    }
    for (; index < blocks.length; index += STABLE_BLOCK_BATCH_SIZE) {
      previous.batches.push(blocks.slice(index, index + STABLE_BLOCK_BATCH_SIZE));
    }
    previous.source = blocks;
  }

  return <>{cache.current.batches.map((batch, index) => (
    <StableBlockBatch key={`${generation}:${index}`} blocks={batch} generation={generation} {...props} />
  ))}</>;
};

const StreamdownComponent: React.FC<StreamdownProps> = (props) => {
  rejectDOMProps(props as unknown as Record<string, unknown>);
  const {
    children: value,
    maxInputLength: requestedMaxInputLength,
    componentRegistry,
    components,
    slots,
    theme = 'dark',
    style,
    onError,
    onDebug,
    isComplete = false,
    mode = 'streaming',
    dir,
    parseIncompleteMarkdown = true,
    normalizeHtmlIndentation: shouldNormalizeHtmlIndentation = false,
    isAnimating = false,
    appendOnly = false,
    streamKey,
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
  const rawChildren = typeof value === 'string' ? value : '';
  const maxInputLengthValid = requestedMaxInputLength === undefined
    || (Number.isSafeInteger(requestedMaxInputLength) && requestedMaxInputLength > 0);
  const maxInputLength = requestedMaxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const inputTooLarge = maxInputLengthValid && rawChildren.length > maxInputLength;
  const inputRejected = !maxInputLengthValid || inputTooLarge;
  const children = shouldNormalizeHtmlIndentation && !inputRejected
    ? normalizeHtmlIndentation(rawChildren)
    : inputRejected ? '' : rawChildren;
  const registryRef = useRef<BlockRegistry>(INITIAL_REGISTRY);
  const contentRef = useRef('');
  const generationRef = useRef(0);
  const stableRootCacheRef = useRef(new StableRootCache(128, instrumentation));
  const lastUpdateTimeRef = useRef(performance.now());
  const previousContentRef = useRef('');
  const previousAnimatingRef = useRef<boolean | null>(null);
  const streamKeyRef = useRef(streamKey);
  const onAnimationStartRef = useRef(onAnimationStart);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const onErrorRef = useRef(onError);
  const instrumentationRef = useRef(instrumentation);
  onAnimationStartRef.current = onAnimationStart;
  onAnimationEndRef.current = onAnimationEnd;
  onErrorRef.current = onError;
  instrumentationRef.current = instrumentation;
  useEffect(() => {
    if (inputRejected) {
      const message = maxInputLengthValid
        ? `Markdown input exceeds the ${maxInputLength}-UTF-16-code-unit limit`
        : 'maxInputLength must be a positive safe integer measured in UTF-16 code units';
      onErrorRef.current?.(new RangeError(message));
    }
  }, [inputRejected, maxInputLength, maxInputLengthValid, streamKey]);
  useLayoutEffect(() => {
    stableRootCacheRef.current.setInstrumentation(instrumentation);
  }, [instrumentation]);
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
  const presentedChildren = useFrameCoalescedValue(
    children,
    process.env.NODE_ENV !== 'test'
      && mode === 'streaming'
      && Boolean(animationConfig)
      && isAnimating
      && !isComplete
      && !prefersReducedMotion,
    streamKey
  );
  const completeRoot = useMemo(
    () => {
      if (!(mode === 'static' || isComplete) || !presentedChildren) return null;
      const startedAt = performance.now();
      const root = parseSemanticDocument(presentedChildren, parseOptions);
      instrumentationRef.current?.recordParserDuration?.(Math.round((performance.now() - startedAt) * 1_000_000));
      return root;
    },
    [presentedChildren, isComplete, mode, parseOptions]
  );
  useEffect(() => {
    if (!completeRoot) return;
    instrumentationRef.current?.recordDocumentParse();
    const parseError = getSemanticParseError(completeRoot);
    if (parseError) onErrorRef.current?.(parseError);
  }, [completeRoot]);

  const streamState = useMemo(() => {
    const currentGeneration = generationRef.current;
    if (mode === 'static') {
      const reset = Boolean(contentRef.current);
      return {
        registry: INITIAL_REGISTRY,
        generation: currentGeneration + Number(reset),
        animationFrom: presentedChildren.length,
        nextContent: '',
        nextStreamKey: streamKey,
        clearCache: reset,
        resetDebugContent: reset,
        event: 'none' as const,
      };
    }
    if (!presentedChildren || presentedChildren.trim().length === 0) {
      const reset = Boolean(contentRef.current);
      return {
        registry: INITIAL_REGISTRY,
        generation: currentGeneration + Number(reset),
        animationFrom: 0,
        nextContent: '',
        nextStreamKey: streamKey,
        clearCache: reset,
        resetDebugContent: reset,
        event: reset ? 'reset' as const : 'none' as const,
      };
    }
    const keyChanged = streamKeyRef.current !== streamKey;
    const previous = keyChanged ? '' : contentRef.current;
    const update = keyChanged
      ? { kind: 'reset' as const, from: 0, added: presentedChildren }
      : classifyStreamUpdate(previous, presentedChildren, appendOnly);
    try {
      let baseRegistry = registryRef.current;
      let generation = currentGeneration;
      let clearCache = false;
      if (update.kind === 'reset') {
        baseRegistry = INITIAL_REGISTRY;
        generation++;
        clearCache = true;
      }
      let updated = processNewContent(
        baseRegistry,
        presentedChildren,
        update.kind === 'append',
        update.kind === 'append' ? update.added : undefined
      );
      if (isComplete && updated.activeBlock) updated = finalizeActiveBlock(updated);
      return {
        registry: updated,
        generation,
        animationFrom: update.from,
        nextContent: presentedChildren,
        nextStreamKey: streamKey,
        clearCache,
        resetDebugContent: update.kind === 'reset',
        event: update.kind,
        appendLength: update.kind === 'append' ? update.added.length : 0,
      };
    } catch (error) {
      return {
        registry: registryRef.current,
        generation: currentGeneration,
        animationFrom: presentedChildren.length,
        nextContent: contentRef.current,
        nextStreamKey: streamKeyRef.current,
        clearCache: false,
        resetDebugContent: false,
        event: 'none' as const,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [appendOnly, presentedChildren, isComplete, mode, streamKey]);
  useLayoutEffect(() => {
    if (streamState.error) {
      onErrorRef.current?.(streamState.error);
      return;
    }
    if (streamState.clearCache) stableRootCacheRef.current.clear();
    if (streamState.resetDebugContent) previousContentRef.current = '';
    registryRef.current = streamState.registry;
    contentRef.current = streamState.nextContent;
    streamKeyRef.current = streamState.nextStreamKey;
    generationRef.current = streamState.generation;
    if (streamState.event === 'reset') instrumentationRef.current?.recordReset();
    if (streamState.event === 'append') instrumentationRef.current?.recordAppend(streamState.appendLength ?? 0);
  }, [streamState]);
  const { registry, generation, animationFrom } = streamState;
  const animationWindow = getAnimationWindowFrom(
    animationFrom,
    presentedChildren.length,
    Boolean(animationConfig && isAnimating),
    prefersReducedMotion
  );
  const activeContent = registry.activeBlock?.content ?? '';
  const deferHeavyContent = activeContent.length > 2 * 1024
    || hasIncompleteCodeFence(activeContent)
    || hasTable(activeContent);
  const showCaret = Boolean(caret && isAnimating && !isComplete && mode === 'streaming' && !deferHeavyContent);

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
    if (!onDebug || !presentedChildren) return;
    const now = performance.now();
    const previousContent = previousContentRef.current;
    const tagState = registry.activeBlock
      ? updateTagState(INITIAL_INCOMPLETE_STATE, registry.activeBlock.content)
      : INITIAL_INCOMPLETE_STATE;
    const snapshot: DebugSnapshot = {
      position: registry.cursor,
      totalLength: presentedChildren.length,
      newChars: presentedChildren.slice(previousContent.length),
      newCharsCount: Math.max(0, presentedChildren.length - previousContent.length),
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
        tagState: { ...tagState },
      },
      fixedContent: registry.activeBlock
        ? fixIncompleteMarkdown(registry.activeBlock.content, tagState)
        : null,
      timestamp: now,
      deltaMs: now - lastUpdateTimeRef.current,
    };
    onDebug(snapshot);
    lastUpdateTimeRef.current = now;
    previousContentRef.current = presentedChildren;
  }, [presentedChildren, onDebug, registry]);

  if (inputRejected) {
    const preview = rawChildren.slice(-MAX_INPUT_FALLBACK_LENGTH);
    const omission = rawChildren.length > MAX_INPUT_FALLBACK_LENGTH ? '…' : '';
    const message = maxInputLengthValid
      ? `Markdown input exceeds the ${maxInputLength}-UTF-16-code-unit limit.`
      : 'maxInputLength must be a positive safe integer measured in UTF-16 code units.';
    return (
      <View style={style}>
        <Text accessibilityRole="alert">
          {`${message}\n${omission}${preview}`}
        </Text>
      </View>
    );
  }

  if (!presentedChildren || presentedChildren.trim().length === 0) {
    return showCaret ? (
      <View style={style}>
        <Text testID="streamdown-caret">{caret === 'circle' ? ' ●' : ' ▋'}</Text>
      </View>
    ) : null;
  }

  if (mode === 'static' || isComplete) {
    return (
      <View style={style}>
        <ASTRenderer
          node={completeRoot!}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          slots={slots}
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
      <StableBlockList
          generation={generation}
          blocks={registry.blocks}
          theme={themeConfig}
          componentRegistry={componentRegistry}
          components={components}
          slots={slots}
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
      <ActiveBlock
        key={generation}
        block={registry.activeBlock}
        tagState={registry.activeTagState}
        theme={themeConfig}
        componentRegistry={componentRegistry}
        components={components}
        slots={slots}
        onError={onError}
        parseOptions={parseOptions}
        securityPolicy={securityPolicy}
        allowedTags={allowedTags}
        literalTagContent={literalTagContent}
        dir={dir}
        parseIncompleteMarkdown={parseIncompleteMarkdown}
        animation={animationWindow && !deferHeavyContent ? animationConfig : null}
        animationFrom={Math.max(0, (animationWindow?.from ?? presentedChildren.length) - (registry.activeBlock?.startPos ?? 0))}
        showCaret={false}
        instrumentation={instrumentation}
        capabilities={nativeCapabilities}
        controls={controls}
        translations={nativeTranslations}
        icons={icons}
        plugins={plugins}
        shikiTheme={shikiTheme}
        lineNumbers={lineNumbers}
        isAnimating={isAnimating}
      />
      {showCaret ? <Text testID="streamdown-caret">{caret === 'circle' ? ' ●' : ' ▋'}</Text> : null}
    </View>
  );
};

export const Streamdown = React.memo(StreamdownComponent);
Streamdown.displayName = 'Streamdown';

/** Backward-compatible alias. */
export const StreamdownRN = Streamdown;
export default Streamdown;
