/**
 * Incomplete Markdown Handler
 * 
 * Provides "format-as-you-type" UX by:
 * 1. Tracking open markdown tags in a state stack
 * 2. Auto-closing incomplete tags for rendering
 * 3. Hiding markers that have no content yet
 * 
 * Optimized for incremental updates during streaming.
 */

import type { IncompleteTagState } from './types';
import remend from 'remend';

// ============================================================================
// Constants
// ============================================================================

export const INITIAL_INCOMPLETE_STATE: IncompleteTagState = {
  stack: [],
  tagCounts: {},
  previousTextLength: 0,
  earliestPosition: 0,
  inCodeBlock: false,
  inInlineCode: false,
};

// ============================================================================
// Helper Functions (DRY)
// ============================================================================

/**
 * Find and remove a tag from the stack
 */
function removeTagFromStack(
  stack: IncompleteTagState['stack'],
  tagCounts: Record<string, number>,
  type: string
): boolean {
  const idx = stack.findIndex(t => t.type === type);
  if (idx !== -1) {
    stack.splice(idx, 1);
    tagCounts[type] = Math.max(0, (tagCounts[type] || 0) - 1);
    return true;
  }
  return false;
}

/**
 * Add a tag to the stack
 */
function addTagToStack(
  stack: IncompleteTagState['stack'],
  tagCounts: Record<string, number>,
  type: string,
  position: number,
  marker: string,
  earliestPosition: number
): number {
  stack.push({ type, position, marker });
  tagCounts[type] = (tagCounts[type] || 0) + 1;
  return earliestPosition === 0 ? position : earliestPosition;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Update tag state based on new text.
 * Only processes new characters since last update.
 * 
 * @param state - Current state
 * @param fullText - Complete text (all tokens so far)
 * @returns Updated state
 */
export function updateTagState(
  state: IncompleteTagState,
  fullText: string
): IncompleteTagState {
  // Handle text shrinking (unlikely in AI responses, but handle it)
  if (fullText.length < state.previousTextLength) {
    return rebuildTagState(fullText);
  }
  
  // No new content
  if (fullText.length === state.previousTextLength) {
    return state;
  }
  
  // For simplicity and correctness, rebuild from scratch
  // This is fast enough for typical streaming (< 1ms for ~10KB)
  return rebuildTagState(fullText);
}

/**
 * Rebuild state from scratch using token-based scanning
 * This properly handles multi-character markers like ** and ```
 */
function rebuildTagState(fullText: string): IncompleteTagState {
  const stack: IncompleteTagState['stack'] = [];
  const tagCounts: Record<string, number> = {};
  let earliestPosition = 0;
  let inCodeBlock = false;
  let inInlineCode = false;
  let inComponent = false;  // Track if we're inside a component [{...}]
  let componentBraceDepth = 0;  // Track nested braces inside component
  
  let i = 0;
  while (i < fullText.length) {
    // === Code block: ``` (must check first, before inline code) ===
    if (fullText.slice(i, i + 3) === '```') {
      if (inCodeBlock) {
        // Close code block
        removeTagFromStack(stack, tagCounts, 'codeBlock');
        inCodeBlock = false;
      } else {
        // Open code block
        earliestPosition = addTagToStack(stack, tagCounts, 'codeBlock', i, '```', earliestPosition);
        inCodeBlock = true;
      }
      i += 3;
      continue;
    }
    
    // === Two backticks at end (pending) ===
    // This handles BOTH:
    // 1. Outside code block: `` is building toward opening ```
    // 2. Inside code block: `` is building toward closing ```
    if (fullText.slice(i, i + 2) === '``' && i + 2 === fullText.length) {
      // Track as pending - will be hidden by hideIncompleteMarkers
      earliestPosition = addTagToStack(stack, tagCounts, 'pendingCodeBlock', i, '``', earliestPosition);
      i += 2;
      continue;
    }
    
    // === Single backtick at end inside code block ===
    // Could be building toward closing ```, hide it
    if (inCodeBlock && fullText[i] === '`' && i + 1 === fullText.length) {
      // Track as pending single backtick inside code block
      earliestPosition = addTagToStack(stack, tagCounts, 'pendingBacktick', i, '`', earliestPosition);
      i++;
      continue;
    }
    
    // Skip everything else inside code blocks
    if (inCodeBlock) {
      i++;
      continue;
    }
    
    // === Component detection: [{ ===
    // When we see [{, we're entering component DSL - skip markdown processing
    if (fullText.slice(i, i + 2) === '[{') {
      inComponent = true;
      componentBraceDepth = 1;  // The { after [
      i += 2;
      continue;
    }
    
    // Track braces inside component to know when we exit
    if (inComponent) {
      // Check for closing }] BEFORE updating depth
      // Component is complete when we see }] at depth 1 (the outermost brace)
      if (fullText.slice(i, i + 2) === '}]' && componentBraceDepth === 1) {
        inComponent = false;
        componentBraceDepth = 0;
        i += 2;
        continue;
      }
      
      // Track nested braces
      if (fullText[i] === '{') {
        componentBraceDepth++;
      } else if (fullText[i] === '}') {
        componentBraceDepth--;
      }
      
      // Skip all markdown processing inside components
      i++;
      continue;
    }
    
    // === Inline code: ` (single backtick, not part of ```) ===
    if (fullText[i] === '`') {
      if (inInlineCode) {
        removeTagFromStack(stack, tagCounts, 'code');
        inInlineCode = false;
      } else {
        earliestPosition = addTagToStack(stack, tagCounts, 'code', i, '`', earliestPosition);
        inInlineCode = true;
      }
      i++;
      continue;
    }
    
    // Skip everything inside inline code
    if (inInlineCode) {
      i++;
      continue;
    }
    
    // === Bold: ** (must check before italic) ===
    if (fullText.slice(i, i + 2) === '**') {
      const boldIdx = stack.findIndex(t => t.type === 'bold');
      if (boldIdx !== -1) {
        removeTagFromStack(stack, tagCounts, 'bold');
      } else {
        earliestPosition = addTagToStack(stack, tagCounts, 'bold', i, '**', earliestPosition);
      }
      i += 2;
      continue;
    }
    
    // === Italic: * (single asterisk, not part of **) ===
    if (fullText[i] === '*') {
      const italicIdx = stack.findIndex(t => t.type === 'italic');
      const boldOpen = stack.some(t => t.type === 'bold');
      const isLastChar = i === fullText.length - 1;
      
      // SPECIAL CASE: If bold is open, italic is NOT open, and this is the last character,
      // this * is likely the start of the closing ** (user still typing).
      // BUT: if this * immediately follows the bold opener (i.e., ***), it's opening italic.
      if (boldOpen && italicIdx === -1 && isLastChar) {
        // Check if there's content between bold opener and this *
        const boldTag = stack.find(t => t.type === 'bold');
        const boldOpenerEnd = boldTag ? boldTag.position + 2 : 0; // ** is 2 chars
        const hasContentBetween = i > boldOpenerEnd;
        
        // Only skip if there's content (e.g., "**bold*" not "***")
        if (hasContentBetween) {
          i++;
          continue;
        }
      }
      
      if (italicIdx !== -1) {
        removeTagFromStack(stack, tagCounts, 'italic');
      } else {
        earliestPosition = addTagToStack(stack, tagCounts, 'italic', i, '*', earliestPosition);
      }
      i++;
      continue;
    }
    
    // === Strikethrough: ~~ or ~ ===
    // Support both single and double tilde (remark-gfm parses both as strikethrough)
    if (fullText.slice(i, i + 2) === '~~') {
      const strikeIdx = stack.findIndex(t => t.type === 'strikethrough');
      if (strikeIdx !== -1) {
        removeTagFromStack(stack, tagCounts, 'strikethrough');
      } else {
        earliestPosition = addTagToStack(stack, tagCounts, 'strikethrough', i, '~~', earliestPosition);
      }
      i += 2;
      continue;
    }
    
    // Single ~ also opens/closes strikethrough
    if (fullText[i] === '~') {
      const strikeTag = stack.find(t => t.type === 'strikethrough');
      const isLastChar = i === fullText.length - 1;
      
      // SPECIAL CASE: If strikethrough was opened with ~~ and this is the last character,
      // this ~ is likely the start of the closing ~~ (user still typing)
      if (strikeTag && strikeTag.marker === '~~' && isLastChar) {
        // Skip - treat as partial closer
        i++;
        continue;
      }
      
      if (strikeTag) {
        // Only close if markers match, or if single ~ closes single ~
        if (strikeTag.marker === '~') {
          removeTagFromStack(stack, tagCounts, 'strikethrough');
        }
        // If marker is ~~, don't close with single ~ (mismatched)
      } else {
        earliestPosition = addTagToStack(stack, tagCounts, 'strikethrough', i, '~', earliestPosition);
      }
      i++;
      continue;
    }
    
    // === Link: [text](url) ===
    // Track link in two phases:
    //   1. Text phase: marker='[' - waiting for ]( 
    //   2. URL phase: marker='](' - waiting for )
    
    if (fullText[i] === '[' && fullText[i + 1] !== '{') {
      earliestPosition = addTagToStack(stack, tagCounts, 'link', i, '[', earliestPosition);
      i++;
      continue;
    }
    
    // Transition from text phase to URL phase on ](
    if (fullText[i] === ']' && fullText[i + 1] === '(') {
      const linkIdx = stack.findIndex(t => t.type === 'link' && t.marker === '[');
      if (linkIdx !== -1) {
        // Transition to URL mode
        stack[linkIdx].marker = '](';
        i += 2; // Skip ](
        continue;
      }
    }
    
    // Close link on ) when in URL phase
    if (fullText[i] === ')') {
      const linkIdx = stack.findIndex(t => t.type === 'link' && t.marker === '](');
      if (linkIdx !== -1) {
        removeTagFromStack(stack, tagCounts, 'link');
        i++;
        continue;
      }
    }
    
    i++;
  }
  
  return {
    stack,
    tagCounts,
    previousTextLength: fullText.length,
    earliestPosition,
    inCodeBlock,
    inInlineCode,
  };
}

// ============================================================================
// Markdown Fixing
// ============================================================================

/**
 * Complete incomplete ordered list markers.
 * 
 * When streaming, we might have:
 *   "1. First item\n2" (incomplete - missing period)
 * 
 * This adds the period so remark parses it as a list marker:
 *   "1. First item\n2."
 * 
 * Only matches digits at the very END of the string after a newline,
 * so completed markers like "2." are not affected.
 */
/** Repair incomplete streaming markdown with the pinned Streamdown oracle. */
export function fixIncompleteMarkdown(text: string, state: IncompleteTagState): string {
  void state;
  return text ? remend(text) : text;
}
