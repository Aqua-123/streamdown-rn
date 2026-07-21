export type ThemeInput = string | Readonly<Record<string, unknown>>;

export interface HighlightToken {
  content: string;
  color?: string;
  bgColor?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  /** Provider styles translated only when they have a native text equivalent. */
  htmlStyle?: Readonly<Record<string, string>>;
}

export interface HighlightResult {
  bg?: string;
  fg?: string;
  tokens: HighlightToken[][];
  rootStyle?: string | false;
}

export interface HighlightOptions {
  code: string;
  language: string;
  themes: [ThemeInput, ThemeInput];
  colorScheme?: 'light' | 'dark';
}

export interface TokenProvider {
  languages: readonly string[];
  aliases?: Readonly<Record<string, string>>;
  highlight(options: HighlightOptions): HighlightResult | Promise<HighlightResult>;
}

export interface CodeHighlighterPlugin {
  name: 'shiki';
  type: 'code-highlighter';
  getSupportedLanguages(): string[];
  getThemes(): [ThemeInput, ThemeInput];
  supportsLanguage(language: string): boolean;
  highlight(options: HighlightOptions, callback?: (result: HighlightResult) => void): HighlightResult | null;
}

export interface CodePluginOptions {
  provider?: TokenProvider;
  themes?: [ThemeInput, ThemeInput];
  cacheSize?: number;
  /** Aggregate cache ceiling in estimated UTF-16 code units (keys plus token JSON). */
  maxCacheUnits?: number;
  /** Provider input ceiling in UTF-16 code units. Larger blocks stay readable as plain code. */
  maxCodeLength?: number;
  /** Maximum time for an asynchronous provider request. */
  highlightTimeoutMs?: number;
  onError?: (error: Error) => void;
}

const DEFAULT_THEMES: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];

export function plainCodeResult(code: string): HighlightResult {
  return { tokens: code.split('\n').map((line) => [{ content: line }]) };
}

function isPromiseLike(value: HighlightResult | Promise<HighlightResult>): value is Promise<HighlightResult> {
  return typeof (value as Promise<HighlightResult>).then === 'function';
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

export function createCodePlugin(options: CodePluginOptions = {}): CodeHighlighterPlugin {
  const provider = options.provider;
  const themes = options.themes ?? DEFAULT_THEMES;
  const limit = positiveInteger(options.cacheSize, 128, 'cacheSize');
  const maxCodeLength = positiveInteger(options.maxCodeLength, 1_000_000, 'maxCodeLength');
  const maxCacheUnits = positiveInteger(options.maxCacheUnits, 256_000, 'maxCacheUnits');
  const highlightTimeoutMs = positiveInteger(options.highlightTimeoutMs, 15_000, 'highlightTimeoutMs');
  const languages = new Set(provider?.languages.map((language) => language.toLowerCase()) ?? []);
  const aliases = Object.fromEntries(
    Object.entries(provider?.aliases ?? {}).map(([alias, language]) => [alias.toLowerCase(), language.toLowerCase()])
  );
  const cache = new Map<string, HighlightResult>();
  const cacheCosts = new Map<string, number>();
  let cachedUnits = 0;
  type PendingEntry = {
    subscribers: Set<(result: HighlightResult) => void>;
    timer?: ReturnType<typeof setTimeout>;
  };
  const pending = new Map<string, PendingEntry>();
  const themeIds = new WeakMap<object, number>();
  let nextThemeId = 1;
  const themeKey = (theme: ThemeInput): string => {
    if (typeof theme === 'string') return theme;
    let id = themeIds.get(theme);
    if (!id) {
      id = nextThemeId++;
      themeIds.set(theme, id);
    }
    return `theme:${id}`;
  };
  const normalize = (language: string) => aliases[language.trim().toLowerCase()] ?? language.trim().toLowerCase();
  const keyFor = ({ code, language, themes: selected, colorScheme = 'dark' }: HighlightOptions) =>
    JSON.stringify([normalize(language), themeKey(selected[0]), themeKey(selected[1]), colorScheme, code]);
  const remember = (key: string, result: HighlightResult) => {
    const cost = key.length + JSON.stringify(result).length;
    if (cost > maxCacheUnits) return;
    cachedUnits -= cacheCosts.get(key) ?? 0;
    cache.delete(key);
    cache.set(key, result);
    cacheCosts.set(key, cost);
    cachedUnits += cost;
    while (cache.size > limit || cachedUnits > maxCacheUnits) {
      const oldest = cache.keys().next().value as string;
      cache.delete(oldest);
      cachedUnits -= cacheCosts.get(oldest) ?? 0;
      cacheCosts.delete(oldest);
    }
  };

  return {
    name: 'shiki',
    type: 'code-highlighter',
    getSupportedLanguages: () => [...languages],
    getThemes: () => themes,
    supportsLanguage: (language) => languages.has(normalize(language)),
    highlight(input, callback) {
      const normalized = normalize(input.language);
      const request = { ...input, language: normalized, colorScheme: input.colorScheme ?? 'dark' };
      if (!provider || !languages.has(normalized) || input.code.length > maxCodeLength) {
        return plainCodeResult(input.code);
      }
      const key = keyFor(request);
      const cached = cache.get(key);
      if (cached) {
        cache.delete(key);
        cache.set(key, cached);
        return cached;
      }
      const existing = pending.get(key);
      if (callback) {
        existing?.subscribers.add(callback);
      }
      if (existing) return null;
      const entry: PendingEntry = { subscribers: new Set(callback ? [callback] : []) };
      pending.set(key, entry);
      try {
        const result = provider.highlight(request);
        if (!isPromiseLike(result)) {
          remember(key, result);
          if (pending.get(key) === entry) pending.delete(key);
          return result;
        }
        entry.timer = setTimeout(() => {
          if (pending.get(key) !== entry) return;
          pending.delete(key);
          const fallback = plainCodeResult(input.code);
          options.onError?.(new Error(`Code highlighting timed out after ${highlightTimeoutMs}ms`));
          entry.subscribers.forEach((subscriber) => subscriber(fallback));
        }, highlightTimeoutMs);
        (entry.timer as unknown as { unref?: () => void }).unref?.();
        void result.then((highlighted) => {
          if (pending.get(key) !== entry) return;
          clearTimeout(entry.timer);
          pending.delete(key);
          remember(key, highlighted);
          entry.subscribers.forEach((subscriber) => subscriber(highlighted));
        }).catch((reason: unknown) => {
          if (pending.get(key) !== entry) return;
          clearTimeout(entry.timer);
          pending.delete(key);
          const fallback = plainCodeResult(input.code);
          options.onError?.(reason instanceof Error ? reason : new Error(String(reason)));
          entry.subscribers.forEach((subscriber) => subscriber(fallback));
        });
        return null;
      } catch (reason) {
        options.onError?.(reason instanceof Error ? reason : new Error(String(reason)));
        if (pending.get(key) === entry) pending.delete(key);
        return plainCodeResult(input.code);
      }
    },
  };
}

/** Plain-code default. Supply a release-Hermes-proven provider to highlight. */
export const code = createCodePlugin();
