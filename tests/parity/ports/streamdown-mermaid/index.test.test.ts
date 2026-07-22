import { createMermaidPlugin, mermaid, type MermaidAdapter } from '../../../../src/plugins/mermaid';

const adapter = (): MermaidAdapter => ({
  families: ['*'],
  render: async ({ source }) => {
    if (source.startsWith('invalid')) throw new Error('invalid diagram');
    return { kind: 'svg', svg: '<svg><text>diagram</text></svg>' };
  },
});

describe('native Mermaid companion contract', () => {
  // parity:0d9098544aa6625478c9e36de396536d3f0b255e9dd14b957466f51986b0a55c
  it('exposes the plugin identity', () => {
    expect(mermaid).toMatchObject({ name: 'mermaid', type: 'diagram' });
  });
  // parity:8e6a6608a570500bcd028af04250fc0f3990cc7693fc152d7a850a8799af301b
  it('uses the Mermaid fence language', () => {
    expect(mermaid.language).toBe('mermaid');
  });
  // parity:b6395724142a9ce43d6411056fad01d1c5ec4b3ad01a46ac0f430251cd34c192
  it('exposes an instance getter', () => {
    expect(typeof mermaid.getMermaid).toBe('function');
  });
  // parity:fe0e0de2b0a438e65d68426aacde2af674ae43002fb56c096116aed5ab1117d5
  it('returns a native instance contract', () => {
    const instance = mermaid.getMermaid();
    expect(typeof instance.initialize).toBe('function');
    expect(typeof instance.render).toBe('function');
  });
  // parity:5661560910acf089825dfe0303a829f183310e40c0462bbaa9ec8bbd7abf95f3
  it('accepts safe per-instance config', () => {
    expect(() => mermaid.getMermaid({ theme: 'dark' })).not.toThrow();
  });
  // parity:294f8a5261eb70e429f660c070cb65075f9e4117a57b6e8a78b435572b9217a7
  it('creates a default plugin', () => {
    expect(createMermaidPlugin()).toMatchObject({ name: 'mermaid', type: 'diagram', language: 'mermaid' });
  });
  // parity:7eca1de26311d55c501d40093f223a12f12f48965116f26f093537ee513d5794
  it('accepts safe custom config', () => {
    expect(() => createMermaidPlugin({ config: { theme: 'forest', fontFamily: 'Arial' } })).not.toThrow();
  });
  // parity:7b29e22f86a75f25d311da7a981361ab8599e04059d2bd028595d4c5938783b9
  it('creates independent instances', () => {
    const first = createMermaidPlugin(); const second = createMermaidPlugin();
    expect(first).not.toBe(second); expect(first.getMermaid).not.toBe(second.getMermaid);
  });
  // parity:5708072d39e2f93e47d6f20999186efdc8efb7a7d5b2573db5d2fb10b82e2d17
  it('retains all native plugin methods', () => {
    const plugin = createMermaidPlugin();
    expect(typeof plugin.getMermaid).toBe('function'); expect(typeof plugin.render).toBe('function');
  });
  // parity:7300384b9fa187178de3aef4df787ba34038f7b9d946e0327d85ba0fa858610a
  it('initializes with safe config', () => {
    const instance = createMermaidPlugin().getMermaid();
    expect(() => instance.initialize({ theme: 'dark' })).not.toThrow();
  });
  // parity:cf7bf716e8f5980cac8d48b0c564e1ffa691816f74fc7febb807334d8f5fb66d
  it('renders without explicit initialization', async () => {
    const result = await createMermaidPlugin({ fullFidelityAdapter: adapter() }).getMermaid().render('id', 'gantt\ntitle Auto');
    expect(result).toMatchObject({ kind: 'svg' });
  });
  // parity:d6ed2d9463ed1ea4dfa68ebcedd6d3cb93b14b5f634e2c8fa96b2e32298ecb6e
  it('renders after explicit initialization', async () => {
    const instance = createMermaidPlugin({ adapter: adapter() }).getMermaid();
    const initialize = jest.spyOn(instance, 'initialize');
    instance.initialize({ theme: 'default' });
    await expect(instance.render('id', 'graph TD\nA-->B')).resolves.toMatchObject({ kind: 'svg' });
    expect(initialize).toHaveBeenCalledTimes(1);
  });
  // parity:83076b9438c8fd67003d8e797eeb47e0505b992108e2b6453fd7823fc0f880ca
  it('renders a diagram through a supplied adapter', async () => {
    await expect(createMermaidPlugin({ adapter: adapter() }).render('graph TD\nA-->B')).resolves.toMatchObject({ svg: expect.stringContaining('<svg>') });
  });
  // parity:ca5ea6d8f45477d2679047985f69ff9f31d6249bb7a9c77187578bd67e5c2de5
  it('rejects invalid diagrams without losing source fallback', async () => {
    await expect(createMermaidPlugin({ fullFidelityAdapter: adapter() }).render('invalid %%%')).rejects.toThrow('invalid diagram');
  });
});
