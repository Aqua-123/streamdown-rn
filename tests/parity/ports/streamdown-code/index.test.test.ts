import {
  code,
  createCodePlugin,
  plainCodeResult,
  type CodeHighlighterPlugin,
  type HighlightOptions,
  type HighlightResult,
  type ThemeInput,
  type TokenProvider,
} from '../../../../src/plugins/code';

const themes: [ThemeInput, ThemeInput] = ['github-light', 'github-dark'];
const languages = ['javascript', 'typescript', 'python', 'html', 'css', 'rust', 'shell'];
const provider = (highlight: TokenProvider['highlight'] = async ({ code: source }) => ({ tokens: [[{ content: source, color: '#f00' }]] })): TokenProvider => ({
  languages,
  aliases: { js: 'javascript', ts: 'typescript', cjs: 'javascript', mjs: 'javascript', cts: 'typescript', mts: 'typescript', zsh: 'shell' },
  highlight,
});
const request = (code: string, language = 'javascript', selected = themes): HighlightOptions => ({ code, language, themes: selected });
const resolveHighlight = (plugin: CodeHighlighterPlugin, options: HighlightOptions): Promise<HighlightResult> => new Promise((resolve) => {
  const immediate = plugin.highlight(options, resolve);
  if (immediate) resolve(immediate);
});

describe('streamdown-code companion native adaptations', () => {
  // parity:26a1bb320329137a4d220e61f6a5842a8437a46b65cfc0993b728ba6349e8e7e
  it('keeps the upstream plugin identity', () => expect(createCodePlugin()).toMatchObject({ name: 'shiki', type: 'code-highlighter' }));
  // parity:6408d5c77236b5faf38eac132fdec1196e0222f433c9fdeded4ce2de618bae8f
  it('returns default themes', () => expect(code.getThemes()).toEqual(themes));
  // parity:e58c28347c0f8137c5002327c0cb50e5c88c0f40c511ede2b3c1c4a83ff6ef5b
  it('recognizes provider languages and aliases', () => {
    const plugin = createCodePlugin({ provider: provider() });
    for (const language of ['javascript', 'typescript', 'js', 'ts', 'cjs', 'mjs', 'cts', 'mts', 'zsh', 'python', 'rust']) expect(plugin.supportsLanguage(language)).toBe(true);
  });
  // parity:9bcfd1ec4002f2182a02fdd9255a77d18afd459a1b9e12c0a8076f37a0c56199
  it('rejects unsupported languages', () => {
    const plugin = createCodePlugin({ provider: provider() });
    expect(plugin.supportsLanguage('not-a-real-language')).toBe(false);
    expect(plugin.supportsLanguage('')).toBe(false);
  });
  // parity:5d6ee781303b3c613b9e4db81de677e6c3539fe3b10bab48f0504512469aeeea
  it('returns a language array', () => expect(Array.isArray(createCodePlugin({ provider: provider() }).getSupportedLanguages())).toBe(true));
  // parity:f28b4e07e48c6de2601a71a044bf1428475385a7e729b44a5aa50f2f2656150e
  it('reports common configured languages', () => expect(createCodePlugin({ provider: provider() }).getSupportedLanguages()).toEqual(expect.arrayContaining(['javascript', 'typescript', 'python', 'html', 'css'])));
  // parity:ed0b28b5806aa4b85e6e5286584ea389f4bcdffe1dd80e4d30dc85c068587d48
  it('returns null while an asynchronous provider loads and calls back', async () => {
    const plugin = createCodePlugin({ provider: provider() });
    const callback = jest.fn();
    expect(plugin.highlight(request('const x = 1'), callback)).toBeNull();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ tokens: expect.any(Array) }));
  });
  // parity:d3e9969a94e32a9d8b42a2ac6222063bdfabd08463797a32fda28b52e1cc5b70
  it('returns cached tokens on a subsequent call', async () => {
    const plugin = createCodePlugin({ provider: provider() });
    const result = await resolveHighlight(plugin, request('let y = 2'));
    expect(plugin.highlight(request('let y = 2'))).toBe(result);
  });
  // parity:d62ad670b44de4f51b08649907f65952ce472c8dcfb1e7f91ab6ad70ca52ff43
  it('loads without a callback', async () => {
    const plugin = createCodePlugin({ provider: provider() });
    expect(plugin.highlight(request('const z = 3'))).toBeNull();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(plugin.highlight(request('const z = 3'))).toEqual(expect.objectContaining({ tokens: expect.any(Array) }));
  });
  // parity:62c7c0893d5514c5940beb37f9a73198f7b7a5e8302c50b76fe32cf7793b564f
  it('highlights code longer than 100 characters', async () => {
    const long = 'const value = 1;\n'.repeat(20);
    expect((await resolveHighlight(createCodePlugin({ provider: provider() }), request(long))).tokens[0][0].content).toBe(long);
  });
  // parity:e1cc6fb10ff6c50e4c217b0004efa6932fac4cdc67a1b32d65bce37649746b88
  it('notifies concurrent subscribers', async () => {
    let finish!: (result: HighlightResult) => void;
    const plugin = createCodePlugin({ provider: provider(() => new Promise((resolve) => { finish = resolve; })) });
    const first = jest.fn();
    const second = jest.fn();
    plugin.highlight(request('same'), first);
    plugin.highlight(request('same'), second);
    finish(plainCodeResult('same'));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
  // parity:8defd0afac4345aa2a6df697ac7b78d08f36fce78e8b24d47a25920ca7b3e750
  it('falls back to plain text when text is not configured', () => expect(createCodePlugin({ provider: provider() }).highlight(request('hello', 'text'))).toEqual(plainCodeResult('hello')));
  // parity:24f8c256993a1d11a51d2c2d921523cf5000b857a9aa9519dbe73459da4551a1
  it('falls back for unknown or truncated language identifiers', () => expect(createCodePlugin({ provider: provider() }).highlight(request('const x = 1', 'javas'))).toEqual(plainCodeResult('const x = 1')));
  // parity:f2ada131ca99354ab0ee265a9e046f5904441cac47dbf4ef2510c5247bb7aca4
  it('resolves language aliases before calling the provider', async () => {
    const highlight = jest.fn(async (options: HighlightOptions) => plainCodeResult(options.language));
    const result = await resolveHighlight(createCodePlugin({ provider: provider(highlight) }), request('x', 'js'));
    expect(result).toEqual(plainCodeResult('javascript'));
  });
  // parity:36e219f29319f94374eba967a2729d5b3bf9f4a24946815bee4bed274d3b6999
  it('reports provider failures and returns readable fallback', async () => {
    const onError = jest.fn();
    const plugin = createCodePlugin({ provider: provider(async () => { throw new Error('failed'); }), onError });
    expect(await resolveHighlight(plugin, request('source'))).toEqual(plainCodeResult('source'));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
  // parity:41f1924534b0e032a767d118cec13bb219fb8b7b697b2964099c40fef8a47748
  it('creates default themes', () => expect(createCodePlugin().getThemes()).toEqual(themes));
  // parity:7c7deb247f0f67b750d3e1acd6230681b71a7402c2d656f92675a43c31dd6f62
  it('creates custom themes', () => expect(createCodePlugin({ themes: ['nord', 'dracula'] }).getThemes()).toEqual(['nord', 'dracula']));
  // parity:a88b8ca65501f3485c8fccf45ce811e87c0bda906e0ffaffa6faa3d80b49f1e1
  it('retains the highlighter contract methods', () => {
    const plugin = createCodePlugin();
    expect(typeof plugin.highlight).toBe('function');
    expect(typeof plugin.supportsLanguage).toBe('function');
    expect(typeof plugin.getSupportedLanguages).toBe('function');
    expect(typeof plugin.getThemes).toBe('function');
  });
  // parity:5f39069b19f90c0766c629130933f25c7c8367d30688e42d2d710ed4a4de2ebf
  it('preserves custom theme objects', () => {
    const light = { name: 'light', colors: { background: '#fff' } };
    const dark = { name: 'dark', colors: { background: '#000' } };
    expect(createCodePlugin({ themes: [light, dark] }).getThemes()).toEqual([light, dark]);
  });
  // parity:0049440fc40324ca33c845a74ac4c89912bb1eaeaf2cec207aaa0c97a1ffd805
  it('accepts mixed named and object themes', () => {
    const dark = { name: 'dark' };
    expect(createCodePlugin({ themes: ['github-light', dark] }).getThemes()).toEqual(['github-light', dark]);
  });
  // parity:fce462d901a24c3d758ab1c065e4fa5a058fad2558845ac0e32752538aa110a1
  it('keys unnamed theme objects without throwing', async () => {
    const unnamed = { colors: { background: '#fff' } };
    await expect(resolveHighlight(createCodePlugin({ provider: provider() }), request('x', 'javascript', [unnamed, 'dark']))).resolves.toEqual(expect.objectContaining({ tokens: expect.any(Array) }));
  });
  // parity:8c99f8ddc77b7714024740580002c421cf8aaf4471b6a38f539e5888e67d9d01
  it('passes custom themes to the token provider', async () => {
    const light = { name: 'custom-light' };
    const dark = { name: 'custom-dark' };
    const highlight = jest.fn(async ({ code: source }: HighlightOptions) => plainCodeResult(source));
    await resolveHighlight(createCodePlugin({ provider: provider(highlight), themes: [light, dark] }), request('x', 'javascript', [light, dark]));
    expect(highlight).toHaveBeenCalledWith(expect.objectContaining({ themes: [light, dark] }));
  });
});
