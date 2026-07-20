import { createMathPlugin, math } from '../../../../src/plugins/math';

describe('native math companion contract', () => {
  it('exposes the plugin identity', () => {
    // parity:ee60cf470bc9e2341d82738aa3107eb06bdee273b02e6d427873e9f39b46f61e
    expect(math).toMatchObject({ name: 'katex', type: 'math' });
  });
  it('exposes portable remark parsing', () => {
    // parity:964f453356a024e5c7701646fd5417486e309048178aaeb4e7d30cb5adad25c5
    expect(Array.isArray(math.remarkPlugin)).toBe(true);
  });
  it('omits the DOM-only rehype pipeline', () => {
    // parity:71721b0f0da201b18c157f0b36b524a5af86b5939887fa2d71950d1c0dc34696
    expect(math.rehypePlugin).toBeUndefined();
  });
  it('omits DOM-only CSS metadata', () => {
    // parity:b6acede60f4f57fd906bd988a9e5d051dd3af2fc39f3ee01cc4d13f3fa5bbed9
    expect(math.getStyles).toBeUndefined();
  });
  it('creates a default native plugin', () => {
    // parity:353e5123bc9ac7fac3d43d74239eaa1c8741b091f2b73b46c9275da31468db28
    expect(createMathPlugin()).toMatchObject({ name: 'katex', type: 'math' });
  });
  it('forwards the single-dollar parser option', () => {
    // parity:427156f363f3fe7ace24475dcd79bd4e7ec40039029a44422e9cc91e37c5be15
    expect((createMathPlugin({ singleDollarTextMath: true }).remarkPlugin as [unknown, { singleDollarTextMath: boolean }])[1].singleDollarTextMath).toBe(true);
  });
  it('disables single-dollar parsing by default', () => {
    // parity:135814dd80d958fa8f78a2e3e0d9460bff03d650417b3f77beb181d3838c8102
    expect((createMathPlugin().remarkPlugin as [unknown, { singleDollarTextMath: boolean }])[1].singleDollarTextMath).toBe(false);
  });
  it('forwards the native fallback error color', () => {
    // parity:7ff49bc710af12936987db82b21c6bd6134f574bc24d99d528ca4f4f2a45cede
    expect(createMathPlugin({ errorColor: '#f00' }).errorColor).toBe('#f00');
  });
  it('defers fallback color to the native theme', () => {
    // parity:1100e05ab38054b9c16776d8c8dfc9dab37c184753f21c21acb17e093ecb1911
    expect(createMathPlugin().errorColor).toBeUndefined();
  });
  it('creates independent instances', () => {
    // parity:6ddf2a4cd53d16065cf330547ed622aff510134864a48c9ff6bdf6017076f96e
    const first = createMathPlugin({ singleDollarTextMath: true });
    const second = createMathPlugin({ singleDollarTextMath: false });
    expect(first).not.toBe(second);
    expect(first.remarkPlugin).not.toBe(second.remarkPlugin);
  });
});
