import type { BlockRegistry, ExplicitBlockScanState, IncompleteTagState, StableBlock } from '../types';
import { INITIAL_INCOMPLETE_STATE } from '../incomplete';
import { detectBlockType, detectPartialBlockType } from './blockPatterns';
import { finalizeBlock } from './finalizeBlock';
import { scanExplicitBlock } from './blockClosers';
import { analyzeMarkdownBoundary } from '../blockSemantics';
import { advanceTrailingNewlineState } from './newlineState';

interface ProcessArgs {
  registry: BlockRegistry;
  fullText: { readonly length: number };
  lines: string[];
  activeContent: string;
  tagState: IncompleteTagState;
  activeStartPos: number;
  canFinalizeCodeBlock: boolean;
  explicitScanState?: ExplicitBlockScanState;
  explicitBlockClosed?: boolean;
  appendedHasNewline?: boolean;
  appendedHasNonWhitespace?: boolean;
  appendedHasBlockBreak?: boolean;
  blockBuffer?: StableBlock[];
}

export function processLines(args: ProcessArgs): BlockRegistry {
  const normalizedArgs = normalizeExplicitType(consumeLeadingBlocks(args));
  const active = normalizedArgs.registry.activeBlock;
  if (active?.typeLocked
    && active.type !== 'heading'
    && active.type !== 'codeBlock'
    && active.type !== 'component'
    && (!normalizedArgs.appendedHasNewline || active.type === 'paragraph')
    && (active.hasNonWhitespace || !normalizedArgs.appendedHasNewline)
    && !normalizedArgs.appendedHasBlockBreak) {
    return updateActiveBlock(
      normalizedArgs.registry,
      normalizedArgs.activeContent,
      normalizedArgs.tagState,
      normalizedArgs.fullText,
      undefined,
      false,
      normalizedArgs.appendedHasNonWhitespace
    );
  }
  return (
    handleExplicitClosingBlocks(normalizedArgs) ??
    handleHeadingBlock(normalizedArgs) ??
    handleParagraphBoundary(normalizedArgs) ??
    handleDoubleNewline(normalizedArgs) ??
    handleActiveBlock(normalizedArgs)
  );
}

function handleExplicitClosingBlocks({
  registry,
  fullText,
  activeContent,
  tagState,
  canFinalizeCodeBlock,
  explicitScanState,
  explicitBlockClosed,
  blockBuffer,
}: ProcessArgs): BlockRegistry | null {
  const currentType = registry.activeBlock?.type;
  if (currentType !== 'codeBlock' && currentType !== 'component') return null;
  const scan = explicitScanState
    ? { state: explicitScanState, close: explicitBlockClosed ? activeContent.length : null }
    : scanExplicitBlock(activeContent, currentType, registry.activeBlock?.explicitScanState);
  const closed = scan.close !== null && (currentType === 'component' || canFinalizeCodeBlock);
  if (!closed) return updateActiveBlock(registry, activeContent, tagState, fullText, scan.state);
  const block = finalizeBlock(activeContent, currentType, registry.blockCounter, registry.activeBlock!.startPos);
  return {
    blocks: appendBlock(registry.blocks, block, blockBuffer),
    activeBlock: null,
    activeTagState: INITIAL_INCOMPLETE_STATE,
    cursor: fullText.length,
    blockCounter: registry.blockCounter + 1,
  };
}

function handleHeadingBlock({
  registry,
  fullText,
  activeContent,
  tagState,
  blockBuffer,
}: ProcessArgs): BlockRegistry | null {
  if (registry.activeBlock?.type !== 'heading') return null;

  const newline = firstLineBreak(activeContent);
  if (!newline) return null;
  if (detectBlockType(activeContent.slice(0, newline.index))?.type !== 'heading') return null;

  const headingContent = activeContent.slice(0, newline.index).trimEnd();
  const remainder = activeContent.slice(newline.index + newline.length);

  const headingBlock = finalizeBlock(
    headingContent,
    'heading',
    registry.blockCounter,
    registry.activeBlock.startPos
  );

  const normalizedRemainder = normalizeBlockContent(
    remainder,
    headingBlock.endPos + newline.length
  );

  if (!normalizedRemainder.content.trim()) {
    return {
      blocks: appendBlock(registry.blocks, headingBlock, blockBuffer),
      activeBlock: null,
      activeTagState: INITIAL_INCOMPLETE_STATE,
      cursor: fullText.length,
      blockCounter: registry.blockCounter + 1,
    };
  }

  const detectedNext = detectBlockType(
    firstLine(normalizedRemainder.content)
  );
  return {
    blocks: appendBlock(registry.blocks, headingBlock, blockBuffer),
    activeBlock: {
      type: detectedNext?.type || 'paragraph',
      content: normalizedRemainder.content,
      startPos: normalizedRemainder.startPos,
    },
    activeTagState: tagState,
    cursor: fullText.length,
    blockCounter: registry.blockCounter + 1,
  };
}

function handleParagraphBoundary({
  registry,
  fullText,
  activeContent,
  tagState,
  blockBuffer,
}: ProcessArgs): BlockRegistry | null {
  if (registry.activeBlock?.type !== 'paragraph') return null;

  const lastNewline = lastLineBreak(activeContent);
  if (
    !lastNewline ||
    lastNewline.index + lastNewline.length >= activeContent.length
  ) {
    return null;
  }

  const lastLine = activeContent.slice(lastNewline.index + lastNewline.length);
  const detectedNext = detectBlockType(lastLine);
  if (!detectedNext || detectedNext.type === 'paragraph') return null;
  if (detectedNext.type === 'footnote') {
    const identifier = lastLine.match(/^\[\^([^\]]+)\]:/)?.[1];
    const prior = activeContent.slice(0, lastNewline.index);
    if (identifier && prior.includes(`[^${identifier}]`)) return null;
  }

  const paragraphContent = activeContent.slice(0, lastNewline.index).trimEnd();
  const normalizedRemainder = normalizeBlockContent(
    activeContent.slice(lastNewline.index + lastNewline.length),
    registry.activeBlock.startPos + lastNewline.index + lastNewline.length
  );

  const blocks = paragraphContent
    ? appendBlock(
        registry.blocks,
        finalizeBlock(
          paragraphContent,
          'paragraph',
          registry.blockCounter,
          registry.activeBlock.startPos
        ),
        blockBuffer
      )
    : registry.blocks;

  const blockCounter =
    registry.blockCounter + (paragraphContent ? 1 : 0);

  return {
    blocks,
    activeBlock: {
      type: detectedNext.type,
      content: normalizedRemainder.content,
      startPos: normalizedRemainder.startPos,
    },
    activeTagState: tagState,
    cursor: fullText.length,
    blockCounter,
  };
}

function handleDoubleNewline({
  registry,
  fullText,
  activeContent,
  tagState,
  activeStartPos,
  blockBuffer,
}: ProcessArgs): BlockRegistry | null {
  if (!/(?:\r\n|\r|\n){2}/.test(activeContent)) return null;
  const closesAtBoundary = /(?:\r\n|\r|\n){2,}$/.test(activeContent);
  const inspectsDeferredBoundary = /(?:\r\n|\r|\n){2,}[ \t]*\S$/.test(activeContent);
  const closesHtml = /<\/\s*[a-z][\w-]*\s*>$/i.test(activeContent);
  if (!closesAtBoundary && !inspectsDeferredBoundary && !closesHtml) return null;

  const candidate = closesAtBoundary ? activeContent.replace(/(?:\r\n|\r|\n)+$/, '') : activeContent;
  const analysis = analyzeMarkdownBoundary(candidate);
  if (analysis.retain) return null;

  const stableCount = closesAtBoundary || analysis.closedHtml
    ? analysis.partitions.length
    : Math.max(0, analysis.partitions.length - 1);
  let offset = 0;
  const blocks = blockBuffer ?? [...registry.blocks];
  let blockCounter = registry.blockCounter;
  const baseStart =
    registry.activeBlock?.startPos !== undefined
      ? registry.activeBlock.startPos
      : activeStartPos;

  for (const partition of analysis.partitions.slice(0, stableCount)) {
    const segment = partition.trimEnd();
    if (!segment) continue;
    const detected = detectBlockType(firstLine(segment));
    const type = detected?.type || 'paragraph';
    blocks.push(finalizeBlock(segment, type, blockCounter, baseStart + offset));
    blockCounter++;
    offset += partition.length;
  }

  const remainder = analysis.partitions.slice(stableCount).join('');
  const remainderStart = baseStart + offset;
  const normalizedRemainder = normalizeBlockContent(
    remainder,
    remainderStart
  );
  const detected = detectBlockType(
    firstLine(normalizedRemainder.content)
  );

  return {
    blocks,
    activeBlock: normalizedRemainder.content
      ? {
          type: detected?.type || 'paragraph',
          content: normalizedRemainder.content,
          startPos: normalizedRemainder.startPos,
        }
      : null,
    activeTagState: normalizedRemainder.content
      ? tagState
      : INITIAL_INCOMPLETE_STATE,
    cursor: fullText.length,
    blockCounter,
  };
}

function handleActiveBlock({
  registry,
  fullText,
  activeContent,
  tagState,
  activeStartPos,
  canFinalizeCodeBlock,
  appendedHasNewline,
  appendedHasBlockBreak,
}: ProcessArgs): BlockRegistry {
  if (!registry.activeBlock) {
    const { normalizedContent, trimmedChars } =
      trimLeadingWhitespace(activeContent);
    const normalizedLines = splitLines(normalizedContent);
    
    // Use partial detection for immediate type recognition
    const partialDetected = detectPartialBlockType(normalizedContent);
    const completeDetected = detectBlockType(normalizedLines[0]);
    const detected = completeDetected || partialDetected;
    const initialNewlineState = advanceTrailingNewlineState({ count: 0, pendingCarriageReturn: false }, normalizedContent);

    const updatedRegistry = {
      ...registry,
      activeBlock: {
        type: detected?.type || 'paragraph',
        content: normalizedContent,
        startPos: activeStartPos + trimmedChars,
        trailingNewlines: initialNewlineState.count,
        trailingCarriageReturn: initialNewlineState.pendingCarriageReturn,
        hasNonWhitespace: /\S/.test(normalizedContent),
        typeLocked: Boolean(
          (completeDetected && completeDetected.type !== 'horizontalRule')
          || (partialDetected?.confidence === 'definite' && partialDetected.type !== 'horizontalRule')
        )
          || (!detected && normalizedContent.trim().length > 0 && !canStillBecomeSpecialBlock(normalizedContent)),
      },
      activeTagState: tagState,
      cursor: fullText.length,
    };
    return processLines({
      registry: updatedRegistry,
      fullText,
      lines: normalizedLines,
      activeContent: normalizedContent,
      tagState,
      activeStartPos: activeStartPos + trimmedChars,
      canFinalizeCodeBlock,
      appendedHasNewline: appendedHasNewline ?? /[\r\n]/.test(normalizedContent),
      appendedHasBlockBreak: appendedHasBlockBreak ?? /(?:\r\n|\r|\n){2}/.test(normalizedContent),
    });
  }

  const updated = updateActiveBlock(registry, activeContent, tagState, fullText);
  const promoted = registry.activeBlock.type !== updated.activeBlock?.type
    && (updated.activeBlock?.type === 'codeBlock' || updated.activeBlock?.type === 'component');
  return promoted
    ? processLines({
        registry: updated,
        fullText,
        lines: [activeContent],
        activeContent,
        tagState,
        activeStartPos,
        canFinalizeCodeBlock,
        appendedHasNewline,
        appendedHasBlockBreak,
      })
    : updated;
}

function updateActiveBlock(
  registry: BlockRegistry,
  content: string,
  tagState: IncompleteTagState,
  fullText: { readonly length: number },
  explicitScanState?: ExplicitBlockScanState,
  checkWhitespaceBoundary = true,
  appendedHasNonWhitespace?: boolean
): BlockRegistry {
  if (!registry.activeBlock) {
    return {
      ...registry,
      activeBlock: null,
      activeTagState: tagState,
      cursor: fullText.length,
    };
  }

  if (
    registry.activeBlock.type !== 'codeBlock'
    && registry.activeBlock.type !== 'component'
    && checkWhitespaceBoundary
    && /[\r\n]/.test(content)
    && content.trim().length === 0
  ) {
    return {
      ...registry,
      activeBlock: null,
      activeTagState: INITIAL_INCOMPLETE_STATE,
      cursor: fullText.length,
    };
  }

  if (registry.activeBlock.type === 'codeBlock' || registry.activeBlock.type === 'component') {
    return {
      ...registry,
      activeBlock: {
        ...registry.activeBlock,
        content,
        explicitScanState,
        hasNonWhitespace: registry.activeBlock.hasNonWhitespace || appendedHasNonWhitespace || /\S/.test(content),
      },
      activeTagState: INITIAL_INCOMPLETE_STATE,
      cursor: fullText.length,
    };
  }

  if (registry.activeBlock.typeLocked) {
    return {
      ...registry,
      activeBlock: {
        ...registry.activeBlock,
        content,
        hasNonWhitespace: registry.activeBlock.hasNonWhitespace || appendedHasNonWhitespace || /\S/.test(content),
      },
      activeTagState: tagState,
      cursor: fullText.length,
    };
  }
  
  // Re-detect type on each update using partial detection
  // This allows type to change as more characters arrive
  // e.g., "#" → heading, "# " → heading (confirmed), "# Hello" → heading
  const partialDetected = detectPartialBlockType(content);
  const completeDetected = detectBlockType(firstLine(content));
  
  // Prefer complete detection, fall back to partial, then keep current type
  const newType = completeDetected?.type 
    ?? partialDetected?.type 
    ?? 'paragraph';
  
  return {
    ...registry,
    activeBlock: {
      ...registry.activeBlock,
      content,
      type: newType,
      explicitScanState,
      hasNonWhitespace: registry.activeBlock.hasNonWhitespace || appendedHasNonWhitespace || /\S/.test(content),
      typeLocked: Boolean(
        (completeDetected && completeDetected.type !== 'horizontalRule')
        || (partialDetected?.confidence === 'definite' && partialDetected.type !== 'horizontalRule')
      )
        || (!completeDetected && !partialDetected && content.trim().length > 0 && !canStillBecomeSpecialBlock(content)),
    },
    activeTagState: tagState,
    cursor: fullText.length,
  };
}

function normalizeExplicitType(args: ProcessArgs): ProcessArgs {
  const active = args.registry.activeBlock;
  if (active?.type !== 'codeBlock') return args;
  if (active.explicitScanState?.type === 'codeBlock' && active.explicitScanState.openingLine === false) return args;
  if (detectBlockType(firstLine(args.activeContent))?.type === 'codeBlock') return args;
  return {
    ...args,
    registry: {
      ...args.registry,
      activeBlock: { ...active, type: 'paragraph', explicitScanState: undefined, typeLocked: false },
    },
  };
}

function canStillBecomeSpecialBlock(content: string): boolean {
  if (/[\r\n]/.test(content)) return false;
  const indentation = content.match(/^[ \t]*/)?.[0] ?? '';
  if (indentation.length > 3) return false;
  const prefix = content.slice(indentation.length, indentation.length + 256);
  if (!prefix) return true;
  return /^#{1,6}$/.test(prefix)
    || /^`{1,2}$/.test(prefix)
    || /^~{1,2}$/.test(prefix)
    || /^[-*+_]{1,2}$/.test(prefix)
    || /^\d+\.?$/.test(prefix)
    || ['[', '[{', '[{c', '[{c:', '!'].includes(prefix)
    || /^\[\^[^\]\n]*\]?:?/.test(prefix);
}

function trimLeadingWhitespace(content: string) {
  const match = content.match(/^([\r\n]+)/);
  if (!match) {
    return { normalizedContent: content, trimmedChars: 0 };
  }
  return {
    normalizedContent: content.slice(match[0].length),
    trimmedChars: match[0].length,
  };
}

function normalizeBlockContent(content: string, startPos: number) {
  const { normalizedContent, trimmedChars } = trimLeadingWhitespace(content);
  return {
    content: normalizedContent,
    startPos: startPos + trimmedChars,
  };
}

function consumeLeadingBlocks(args: ProcessArgs): ProcessArgs {
  if (args.registry.activeBlock) {
    return args;
  }

  const source = args.activeContent;
  let offset = 0;
  let startPos = args.activeStartPos;
  const blocks = args.blockBuffer ?? [...args.registry.blocks];
  let blockCounter = args.registry.blockCounter;

  while (true) {
    const beforeTrim = offset;
    while (source[offset] === '\r' || source[offset] === '\n') offset++;
    startPos += offset - beforeTrim;

    if (offset >= source.length) {
      return {
        ...args,
        registry: { ...args.registry, blocks, blockCounter },
        activeContent: '',
        tagState: INITIAL_INCOMPLETE_STATE,
        lines: [''],
        activeStartPos: startPos,
      };
    }

    const newline = firstLineBreakFrom(source, offset);
    if (!newline) {
      break;
    }

    const line = source.slice(offset, newline.index);
    const detected = detectBlockType(line);
    if (!detected || detected.type !== 'heading') {
      break;
    }

    const headingBlock = finalizeBlock(
      line.trimEnd(),
      'heading',
      blockCounter,
      startPos
    );
    blocks.push(headingBlock);
    blockCounter++;
    const consumed = newline.index + newline.length - offset;
    offset = newline.index + newline.length;
    startPos += consumed;
  }

  const content = source.slice(offset);

  return {
    ...args,
    registry: { ...args.registry, blocks, blockCounter },
    activeContent: content,
    lines: splitLines(content),
    tagState: INITIAL_INCOMPLETE_STATE,
    activeStartPos: startPos,
  };
}

function appendBlock(
  blocks: readonly StableBlock[],
  block: StableBlock,
  blockBuffer?: StableBlock[]
): readonly StableBlock[] {
  if (blockBuffer) {
    blockBuffer.push(block);
    return blockBuffer;
  }
  return [...blocks, block];
}

function splitLines(content: string): string[] {
  return content.split(/\r\n|\r|\n/);
}

function firstLine(content: string): string {
  const newline = firstLineBreak(content);
  return newline ? content.slice(0, newline.index) : content;
}

function firstLineBreak(content: string): { index: number; length: 1 | 2 } | null {
  return firstLineBreakFrom(content, 0);
}

function firstLineBreakFrom(content: string, from: number): { index: number; length: 1 | 2 } | null {
  const carriageReturn = content.indexOf('\r', from);
  const lineFeed = content.indexOf('\n', from);
  const index = carriageReturn === -1
    ? lineFeed
    : lineFeed === -1 ? carriageReturn : Math.min(carriageReturn, lineFeed);
  if (index === -1) return null;
  return { index, length: content[index] === '\r' && content[index + 1] === '\n' ? 2 : 1 };
}

function lastLineBreak(content: string): { index: number; length: 1 | 2 } | null {
  for (let index = content.length - 1; index >= 0; index--) {
    if (content[index] === '\n') {
      return { index: index > 0 && content[index - 1] === '\r' ? index - 1 : index, length: index > 0 && content[index - 1] === '\r' ? 2 : 1 };
    }
    if (content[index] === '\r') return { index, length: 1 };
  }
  return null;
}
