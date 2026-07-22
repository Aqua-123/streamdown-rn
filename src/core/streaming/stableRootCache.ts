import type { Root } from 'mdast';
import type { SemanticParseOptions } from '../parser';
import type { StableBlock } from '../types';
import type { StreamingInstrumentation } from './instrumentation';

interface Entry {
  block: StableBlock;
  options: SemanticParseOptions | undefined;
  root: Root;
}

export class StableRootCache {
  private readonly entries: Entry[] = [];
  constructor(
    private readonly capacity = 128,
    private instrumentation?: StreamingInstrumentation
  ) {}

  setInstrumentation(instrumentation?: StreamingInstrumentation): void {
    this.instrumentation = instrumentation;
    instrumentation?.setCacheEntries(this.entries.length);
  }

  peek(
    block: StableBlock,
    options: SemanticParseOptions | undefined
  ): Root | undefined {
    return this.entries.find((entry) => entry.block === block && entry.options === options)?.root;
  }

  commit(
    block: StableBlock,
    options: SemanticParseOptions | undefined,
    root: Root,
    cacheHit: boolean
  ): void {
    const index = this.entries.findIndex((entry) => entry.block === block && entry.options === options);
    if (index >= 0) {
      const [entry] = this.entries.splice(index, 1);
      this.entries.push(entry);
      if (cacheHit) this.instrumentation?.recordCacheHit();
      return;
    }
    this.instrumentation?.recordStableParse();
    this.entries.push({ block, options, root });
    if (this.entries.length > this.capacity) this.entries.shift();
    this.instrumentation?.setCacheEntries(this.entries.length);
  }

  clear(): void {
    this.entries.length = 0;
    this.instrumentation?.setCacheEntries(0);
  }
}
