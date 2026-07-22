import type { BlockRegistry, StableBlock } from '../types';
import { INITIAL_REGISTRY } from '../types';
import { INITIAL_INCOMPLETE_STATE } from '../incomplete';
import { processLines } from './processLines';
import { finalizeBlock } from './finalizeBlock';
import { scanExplicitBlock } from './blockClosers';
import type { ExplicitBlockScanState } from '../types';
import { advanceTrailingNewlineState } from './newlineState';

/**
 * Process appended content at line and explicit-block boundaries.
 */
export function processNewContent(
  registry: BlockRegistry,
  fullText: string,
  appendOnly = false,
  appendedContent?: string
): BlockRegistry {
  if (registry.source === fullText) {
    return registry;
  }

  if (!appendOnly && registry.source !== undefined && !fullText.startsWith(registry.source)) {
    return processNewContent(INITIAL_REGISTRY, fullText);
  }

  const lastBlock = registry.blocks[registry.blocks.length - 1];
  if (lastBlock?.type === 'codeBlock' && closingFenceWasExtended(registry, fullText, appendedContent)) {
    return processNewContent(INITIAL_REGISTRY, fullText);
  }

  if (fullText.length <= registry.cursor) return registry;

  const appendNewlineState = appendedContent === undefined ? undefined : advanceTrailingNewlineState({
    count: registry.activeBlock?.trailingNewlines ?? 0,
    pendingCarriageReturn: registry.activeBlock?.trailingCarriageReturn ?? false,
  }, appendedContent);
  const appendedCreatesBlockBreak = appendedContent !== undefined && (
    appendNewlineState?.reachedBlockBreak || /<\/\s*[a-z][\w-]*\s*>$/i.test(appendedContent)
  );
  if (
    appendedContent !== undefined
    && registry.activeBlock?.typeLocked
    && registry.activeBlock.hasNonWhitespace
    && registry.activeBlock.type === 'paragraph'
    && !appendedCreatesBlockBreak
  ) {
    const updated = processRange(registry, fullText, fullText.length);
    return { ...updated, source: fullText };
  }

  let currentRegistry = registry;
  const blockBuffer = [...registry.blocks];
  currentRegistry = { ...currentRegistry, blocks: blockBuffer };

  while (currentRegistry.cursor < fullText.length) {
    const boundary = nextBoundary(currentRegistry, fullText);
    currentRegistry = processRange(
      currentRegistry,
      fullText,
      boundary.endPos,
      boundary.explicitScanState,
      boundary.explicitBlockClosed,
      boundary.activeContent,
      blockBuffer
    );
  }

  return { ...currentRegistry, source: fullText };
}

function closingFenceWasExtended(
  registry: BlockRegistry,
  fullText: string,
  appendedContent?: string
): boolean {
  const lastBlock = registry.blocks[registry.blocks.length - 1];
  if (!lastBlock || lastBlock.endPos >= fullText.length) return false;

  const firstSuffixCharacter = fullText[lastBlock.endPos];
  if (firstSuffixCharacter === '\r' || firstSuffixCharacter === '\n') return false;
  if (/\S/.test(firstSuffixCharacter)) return true;
  if (registry.activeBlock && registry.activeBlock.startPos > lastBlock.endPos) return false;

  if (appendedContent === undefined) {
    const suffix = fullText.slice(lastBlock.endPos);
    const lineEnd = suffix.search(/[\r\n]/);
    return /\S/.test(lineEnd === -1 ? suffix : suffix.slice(0, lineEnd));
  }

  const appendedLineEnd = appendedContent.search(/[\r\n]/);
  const appendedLine = appendedLineEnd === -1
    ? appendedContent
    : appendedContent.slice(0, appendedLineEnd);
  if (!/\S/.test(appendedLine)) return false;

  // A non-whitespace delta needs one look behind to distinguish "fence   x"
  // from "fence   \n x". This scan runs only on the first meaningful delta.
  const previousSource = registry.source ?? '';
  const previousSuffix = previousSource.slice(lastBlock.endPos);
  return !/[\r\n]/.test(previousSuffix);
}

/** Append a known delta without rescanning the previous source prefix. */
export function appendContent(registry: BlockRegistry, content: string): BlockRegistry {
  const fullText = `${registry.source ?? ''}${content}`;
  return processNewContent(registry, fullText, true, content);
}

/**
 * Process content up to a structural boundary.
 */
function processRange(
  registry: BlockRegistry,
  fullText: string,
  endPos: number,
  explicitScanState?: ExplicitBlockScanState,
  explicitBlockClosed = false,
  scannedActiveContent?: string,
  blockBuffer?: StableBlock[]
): BlockRegistry {
  // Only process if we have new content
  if (endPos <= registry.cursor) {
    return registry;
  }

  const newContent = fullText.slice(registry.cursor, endPos);
  if (!registry.activeBlock && /^[\r\n]+$/.test(newContent)) {
    return { ...registry, cursor: endPos, activeTagState: INITIAL_INCOMPLETE_STATE };
  }
  const newlineState = advanceTrailingNewlineState({
    count: registry.activeBlock?.trailingNewlines ?? 0,
    pendingCarriageReturn: registry.activeBlock?.trailingCarriageReturn ?? false,
  }, newContent);
  const trailingNewlines = newlineState.count;
  const registryWithTail = registry.activeBlock
    ? { ...registry, activeBlock: { ...registry.activeBlock, trailingNewlines, trailingCarriageReturn: newlineState.pendingCarriageReturn } }
    : registry;
  const activeContent = scannedActiveContent ?? (registry.activeBlock
    ? registry.activeBlock.content + newContent
    : newContent);
  const avoidsLineScan = registry.activeBlock?.typeLocked
    || registry.activeBlock?.type === 'codeBlock'
    || registry.activeBlock?.type === 'component';
  const lines = avoidsLineScan ? [activeContent] : activeContent.split(/\r\n|\r|\n/);

  // Create a virtual "fullText" that only goes up to endPos
  // This ensures cursor is set correctly for this character
  const virtualFullText = { length: endPos };

  return processLines({
    registry: registryWithTail,
    fullText: virtualFullText,
    lines,
    activeContent,
    tagState: registry.activeTagState,
    activeStartPos: registry.activeBlock?.startPos ?? registry.cursor,
    canFinalizeCodeBlock: endPos === fullText.length || fullText[endPos] === '\n' || fullText[endPos] === '\r',
    explicitScanState,
    explicitBlockClosed,
    appendedHasNewline: /[\r\n]/.test(newContent),
    appendedHasNonWhitespace: /\S/.test(newContent),
    appendedHasBlockBreak: /(?:\r\n|\r|\n){2}/.test(newContent)
      || trailingNewlines === 2
      || registry.activeBlock?.trailingNewlines === 2
      || (registry.activeBlock?.trailingNewlines === 1 && /^(?:\r\n|\r|\n)/.test(newContent))
      || /<\/\s*[a-z][\w-]*\s*>$/i.test(newContent),
    blockBuffer,
  });
}

interface Boundary {
  endPos: number;
  explicitScanState?: ExplicitBlockScanState;
  explicitBlockClosed?: boolean;
  activeContent?: string;
}

function nextBoundary(registry: BlockRegistry, fullText: string): Boundary {
  const { cursor, activeBlock } = registry;

  if (activeBlock?.type === 'codeBlock' || activeBlock?.type === 'component') {
    const appendedContent = fullText.slice(cursor);
    const activeContent = activeBlock.content + appendedContent;
    const scan = scanExplicitBlock(activeContent, activeBlock.type, activeBlock.explicitScanState, appendedContent);
    const endPos = scan.close === null ? fullText.length : activeBlock.startPos + scan.close;
    return {
      endPos,
      explicitScanState: scan.state,
      explicitBlockClosed: scan.close !== null,
      activeContent: scan.close === null ? activeContent : activeContent.slice(0, scan.close),
    };
  }

  if (/(?:\r\n|\r|\n){2,}$/.test(activeBlock?.content ?? '') && /\S/.test(fullText[cursor])) {
    return { endPos: cursor + 1 };
  }

  if (fullText[cursor] === '\n') return { endPos: cursor + 1 };
  if (fullText[cursor] === '\r') return { endPos: cursor + (fullText[cursor + 1] === '\n' ? 2 : 1) };

  const carriageReturn = fullText.indexOf('\r', cursor);
  const lineFeed = fullText.indexOf('\n', cursor);
  const lineEnd = carriageReturn === -1
    ? (lineFeed === -1 ? fullText.length : lineFeed)
    : (lineFeed === -1 ? carriageReturn : Math.min(carriageReturn, lineFeed));
  const line = fullText.slice(cursor, lineEnd);
  const componentPrefix = line.match(/^\[\{c:\s*"[^"]+"/);
  if (componentPrefix) return { endPos: cursor + componentPrefix[0].length };

  return { endPos: lineEnd };
}

export function resetRegistry(): BlockRegistry {
  return INITIAL_REGISTRY;
}

/**
 * Finalize the active block into a stable block.
 * Call this when streaming is complete to ensure the last block is properly memoized.
 */
export function finalizeActiveBlock(registry: BlockRegistry): BlockRegistry {
  if (!registry.activeBlock || !registry.activeBlock.content.trim()) {
    return registry;
  }

  const { activeBlock } = registry;
  const type = activeBlock.type || 'paragraph';
  
  const stableBlock = finalizeBlock(
    activeBlock.content,
    type,
    registry.blockCounter,
    activeBlock.startPos
  );

  return {
    source: registry.source,
    blocks: [...registry.blocks, stableBlock],
    activeBlock: null,
    activeTagState: INITIAL_INCOMPLETE_STATE,
    cursor: registry.cursor,
    blockCounter: registry.blockCounter + 1,
  };
}
