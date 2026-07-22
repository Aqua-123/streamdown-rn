import type { BlockRegistry } from '../types';
import { INITIAL_REGISTRY } from '../types';
import { updateTagState, INITIAL_INCOMPLETE_STATE } from '../incomplete';
import { logDebug, logStateSnapshot } from './logger';
import { processLines } from './processLines';
import { finalizeBlock } from './finalizeBlock';
import { hasIncompleteCodeFence } from '../blockSemantics';
import { findCodeBlockClose, findComponentClose } from './blockClosers';

const SPLITTER_VERSION = 'range-v2';

/**
 * Process appended content at line and explicit-block boundaries.
 */
export function processNewContent(
  registry: BlockRegistry,
  fullText: string
): BlockRegistry {
  logDebug('processNewContent', {
    previousCursor: registry.cursor,
    incomingLength: fullText.length,
  });
  logStateSnapshot('state.before', registry);

  attachGlobalVersion();

  if (registry.source === fullText) {
    return registry;
  }

  if (registry.source !== undefined && !fullText.startsWith(registry.source)) {
    return processNewContent(INITIAL_REGISTRY, fullText);
  }

  const lastBlock = registry.blocks[registry.blocks.length - 1];
  const tailAfterLastBlock = lastBlock ? fullText.slice(lastBlock.endPos) : '';
  if (
    lastBlock?.type === 'codeBlock' &&
    !tailAfterLastBlock.includes('\n') &&
    hasIncompleteCodeFence(fullText.slice(lastBlock.startPos))
  ) {
    return processNewContent(INITIAL_REGISTRY, fullText);
  }

  if (fullText.length <= registry.cursor) return registry;

  let currentRegistry = registry;

  while (currentRegistry.cursor < fullText.length) {
    currentRegistry = processRange(
      currentRegistry,
      fullText,
      nextBoundary(currentRegistry, fullText)
    );
  }

  // The splitter needs character-level boundary detection, but incomplete-tag
  // state is observational only now that Remend owns repair. Scan the final
  // active block once per append instead of rescanning it for every character.
  currentRegistry = {
    ...currentRegistry,
    activeTagState: currentRegistry.activeBlock
      ? updateTagState(INITIAL_INCOMPLETE_STATE, currentRegistry.activeBlock.content)
      : INITIAL_INCOMPLETE_STATE,
  };

  logStateSnapshot('state.after', currentRegistry);
  return { ...currentRegistry, source: fullText };
}

/**
 * Process content up to a structural boundary.
 */
function processRange(
  registry: BlockRegistry,
  fullText: string,
  endPos: number
): BlockRegistry {
  // Only process if we have new content
  if (endPos <= registry.cursor) {
    return registry;
  }

  const newContent = fullText.slice(registry.cursor, endPos);
  const activeContent = registry.activeBlock
    ? registry.activeBlock.content + newContent
    : newContent;
  const lines = activeContent.split('\n');

  // Create a virtual "fullText" that only goes up to endPos
  // This ensures cursor is set correctly for this character
  const virtualFullText = fullText.slice(0, endPos);

  return processLines({
    registry,
    fullText: virtualFullText,
    lines,
    activeContent,
    tagState: registry.activeTagState,
    activeStartPos: registry.activeBlock?.startPos ?? registry.cursor,
    canFinalizeCodeBlock: endPos === fullText.length || fullText[endPos] === '\n' || fullText[endPos] === '\r',
  });
}

function nextBoundary(registry: BlockRegistry, fullText: string): number {
  const { cursor, activeBlock } = registry;

  if (activeBlock?.type === 'codeBlock') {
    const close = findCodeBlockClose(fullText.slice(activeBlock.startPos));
    return close === null ? fullText.length : activeBlock.startPos + close;
  }

  if (activeBlock?.type === 'component') {
    const close = findComponentClose(fullText.slice(activeBlock.startPos));
    return close === null ? fullText.length : activeBlock.startPos + close;
  }

  if (/\n\n+$/.test(activeBlock?.content ?? '') && /\S/.test(fullText[cursor])) {
    return cursor + 1;
  }

  if (fullText[cursor] === '\n') return cursor + 1;

  const newline = fullText.indexOf('\n', cursor);
  const lineEnd = newline === -1 ? fullText.length : newline;
  const line = fullText.slice(cursor, lineEnd);
  const componentPrefix = line.match(/^\[\{c:\s*"[^"]+"/);
  if (componentPrefix) return cursor + componentPrefix[0].length;

  return lineEnd;
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

function attachGlobalVersion() {
  const target =
    typeof globalThis !== 'undefined'
      ? (globalThis as any)
      : typeof global !== 'undefined'
      ? (global as any)
      : undefined;
  if (!target) return;

  target.__streamdown = {
    ...(target.__streamdown || {}),
    splitterVersion: SPLITTER_VERSION,
  };
}
