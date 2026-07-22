export interface StreamingMetrics {
  appendedCharacters: number;
  resets: number;
  session: number;
  stableParses: number;
  activeParses: number;
  documentParses: number;
  stableRenders: number;
  activeRenders: number;
  cacheHits: number;
  cacheEntries: number;
  parserDurationNs: readonly number[];
}

export interface StreamingInstrumentation {
  recordAppend(count: number): void;
  recordReset(): void;
  recordStableParse(): void;
  recordActiveParse(): void;
  recordDocumentParse(): void;
  recordStableRender(): void;
  recordActiveRender(): void;
  recordCacheHit(): void;
  setCacheEntries(count: number): void;
  /** Optional high-resolution parser samples for Release-Hermes evidence. */
  recordParserDuration?(durationNs: number): void;
  snapshot(): Readonly<StreamingMetrics>;
}

export function createStreamingInstrumentation(): StreamingInstrumentation {
  const parserDurationNs: number[] = [];
  let parserDurationCursor = 0;
  const metrics: StreamingMetrics = {
    appendedCharacters: 0,
    resets: 0,
    session: 0,
    stableParses: 0,
    activeParses: 0,
    documentParses: 0,
    stableRenders: 0,
    activeRenders: 0,
    cacheHits: 0,
    cacheEntries: 0,
    parserDurationNs,
  };
  return {
    recordAppend: (count) => { metrics.appendedCharacters += count; },
    recordReset: () => { metrics.resets++; metrics.session++; metrics.cacheEntries = 0; },
    recordStableParse: () => { metrics.stableParses++; },
    recordActiveParse: () => { metrics.activeParses++; },
    recordDocumentParse: () => { metrics.documentParses++; },
    recordStableRender: () => { metrics.stableRenders++; },
    recordActiveRender: () => { metrics.activeRenders++; },
    recordCacheHit: () => { metrics.cacheHits++; },
    setCacheEntries: (count) => { metrics.cacheEntries = count; },
    recordParserDuration: (durationNs) => {
      if (!Number.isSafeInteger(durationNs) || durationNs < 0) return;
      if (parserDurationNs.length < 1024) parserDurationNs.push(durationNs);
      else {
        parserDurationNs[parserDurationCursor] = durationNs;
        parserDurationCursor = (parserDurationCursor + 1) % parserDurationNs.length;
      }
    },
    snapshot: () => {
      const samples = parserDurationCursor === 0
        ? [...parserDurationNs]
        : [...parserDurationNs.slice(parserDurationCursor), ...parserDurationNs.slice(0, parserDurationCursor)];
      return Object.freeze({ ...metrics, parserDurationNs: Object.freeze(samples) });
    },
  };
}
