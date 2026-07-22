import type { BlockType, ExplicitBlockScanState } from '../types';

export interface ExplicitBlockScanResult {
  close: number | null;
  state: ExplicitBlockScanState | undefined;
}

/** Scan only content added since the prior explicit-block scan. */
export function scanExplicitBlock(
  content: string,
  type: BlockType | null,
  previous?: ExplicitBlockScanState,
  appendedContent?: string
): ExplicitBlockScanResult {
  if (type === 'codeBlock') return scanCodeBlock(content, previous?.type === 'codeBlock' ? previous : undefined, appendedContent);
  if (type === 'component') return scanComponent(content, previous?.type === 'component' ? previous : undefined, appendedContent);
  return { close: null, state: undefined };
}

function scanCodeBlock(
  content: string,
  previous?: Extract<ExplicitBlockScanState, { type: 'codeBlock' }>,
  appendedContent?: string
): ExplicitBlockScanResult {
  const openMatch = !previous || previous.openingLine
    ? content.match(/^ {0,3}(`{3,}|~{3,})/)
    : null;
  if (!previous && !openMatch) return { close: null, state: undefined };
  const run = openMatch?.[1];
  let state = previous ? {
    ...previous,
    fenceLength: run ? Math.max(previous.fenceLength, run.length) : previous.fenceLength,
  } : {
    type: 'codeBlock' as const,
    scannedTo: openMatch![0].length,
    lineStart: 0,
    fenceCharacter: run![0] as '`' | '~',
    fenceLength: run!.length,
    pendingLine: '',
    openingLine: true,
  };
  const input = previous && appendedContent !== undefined ? appendedContent : content.slice(state.scannedTo);
  const base = state.scannedTo;
  let pendingLine = state.pendingLine ?? '';
  let openingLine = state.openingLine ?? false;
  const isCloseLine = (line: string) => {
    const normalized = line.replace(/\r$/, '').replace(/^ {0,3}/, '');
    let runLength = 0;
    while (normalized[runLength] === state.fenceCharacter) runLength++;
    return runLength >= state.fenceLength && /^[ \t]*$/.test(normalized.slice(runLength));
  };
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character !== '\n' && character !== '\r') {
      if (!openingLine && pendingLine.length <= state.fenceLength + 16) pendingLine += character;
      continue;
    }
    if (!openingLine && isCloseLine(pendingLine)) {
      const close = base + index;
      return { close, state: { ...state, scannedTo: close, lineStart: close - pendingLine.length, pendingLine, openingLine } };
    }
    openingLine = false;
    pendingLine = '';
  }
  const scannedTo = base + input.length;
  const close = !openingLine && isCloseLine(pendingLine) ? scannedTo : null;
  state = { ...state, scannedTo, lineStart: scannedTo - pendingLine.length, pendingLine, openingLine };
  return { close, state };
}

function scanComponent(
  content: string,
  previous?: Extract<ExplicitBlockScanState, { type: 'component' }>,
  appendedContent?: string
): ExplicitBlockScanResult {
  if (!previous && !content.startsWith('[{')) return { close: null, state: undefined };
  let state = previous ?? {
    type: 'component' as const,
    scannedTo: 2,
    braceDepth: 1,
    bracketDepth: 1,
    inString: false,
    escape: false,
    lastCharacter: '{',
  };
  const input = previous && appendedContent !== undefined ? appendedContent : content.slice(state.scannedTo);
  const base = state.scannedTo;
  let { braceDepth, bracketDepth, inString, escape } = state;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (char === '[') bracketDepth++;
    if (char === ']') bracketDepth--;
    const previousCharacter = index > 0 ? input[index - 1] : (state.lastCharacter ?? '');
    if (braceDepth === 0 && bracketDepth === 0 && previousCharacter === '}') {
      const close = base + index + 1;
      state = { type: 'component', scannedTo: close, braceDepth, bracketDepth, inString, escape, lastCharacter: char };
      return { close, state };
    }
  }
  state = { type: 'component', scannedTo: base + input.length, braceDepth, bracketDepth, inString, escape, lastCharacter: input[input.length - 1] ?? state.lastCharacter };
  return { close: null, state };
}

export function isCodeBlockClosed(content: string): boolean {
  return scanExplicitBlock(content, 'codeBlock').close !== null;
}

export function findCodeBlockClose(content: string): number | null {
  const openMatch = content.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!openMatch) return null;

  const fence = openMatch[1];
  const closePattern = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?=\\r?$)`, 'm');
  const match = closePattern.exec(content.slice(openMatch[0].length));
  return match ? openMatch[0].length + match.index + match[0].length : null;
}

export function isComponentClosed(content: string): boolean {
  return findComponentClose(content) !== null;
}

export function findComponentClose(content: string): number | null {
  return scanExplicitBlock(content, 'component').close;
}
