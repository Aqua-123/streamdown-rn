export interface TrailingNewlineState {
  count: 0 | 1 | 2;
  pendingCarriageReturn: boolean;
  reachedBlockBreak?: boolean;
}

/** Advance logical CRLF/LF newline state by scanning only the appended delta. */
export function advanceTrailingNewlineState(
  previous: TrailingNewlineState,
  appended: string
): TrailingNewlineState {
  let count = previous.count;
  let pendingCarriageReturn = previous.pendingCarriageReturn;
  let reachedBlockBreak = previous.count === 2;
  for (const character of appended) {
    if (character === '\r') {
      count = Math.min(2, count + 1) as 0 | 1 | 2;
      if (count === 2) reachedBlockBreak = true;
      pendingCarriageReturn = true;
    } else if (character === '\n') {
      if (!pendingCarriageReturn) count = Math.min(2, count + 1) as 0 | 1 | 2;
      if (count === 2) reachedBlockBreak = true;
      pendingCarriageReturn = false;
    } else {
      count = 0;
      pendingCarriageReturn = false;
    }
  }
  return { count, pendingCarriageReturn, reachedBlockBreak };
}
