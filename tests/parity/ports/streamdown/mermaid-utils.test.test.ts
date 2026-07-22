import { mermaidFileRequest, type MermaidRenderResult } from '../../../../src/plugins/mermaid';

describe('Mermaid native image export utility', () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const result: MermaidRenderResult = { kind: 'native', content: null, svg: '<svg></svg>', png };

  // parity:18f2ca2005aa1359956b647353a79ea25546f0858043e302868eb2d8f77c7cff
  it('uses adapter-provided PNG bytes instead of a browser canvas and preserves them exactly', () => {
    const request = mermaidFileRequest('graph TD; A-->B', result, 'png');
    expect(request).toEqual({ basename: 'diagram', extension: 'png', mimeType: 'image/png', content: png });
    expect(request.content).toBe(png);
  });
  // parity:78d9feb5d1e7bf488b359b3cc163a996fcfd99c2f1147f8057ae81c8a6b3ad93
  it('converts the native adapter PNG result into an exact PNG file request', () => {
    expect(mermaidFileRequest('graph TD; A-->B', result, 'png')).toEqual({
      basename: 'diagram', extension: 'png', mimeType: 'image/png', content: png,
    });
  });

  // parity:85afbc1ce9f230f3060208113374e165d04b9278db4cca0219b80d046b953103
  // parity:514bbdc05f1186398ca1641fb351a26e15d350750d53cef4ae1637ba0c496afa
  // parity:9a3c4f73a8ce39984a25c186270374300d42ed048771da94fa00cd0d323ed740
  it('fails closed when the native adapter did not provide non-empty PNG bytes', () => {
    expect(() => mermaidFileRequest('graph TD; A-->B', undefined, 'png')).toThrow('Mermaid PNG is unavailable');
    expect(() => mermaidFileRequest('graph TD; A-->B', { kind: 'native', content: null, png: new Uint8Array() }, 'png')).toThrow('Mermaid PNG is unavailable');
  });

  // parity:e80b83b47aeeb5f4801986174af4bcc257da1b6d851753440e8d6fb0f689d61b
  // parity:79ac3af52aba4be66a0e80bc0adcb49955ead61aa776351f64b2ba29f8e64e64
  it('does not encode SVG into an Image URL or attach browser cross-origin state', () => {
    const request = mermaidFileRequest('graph TD; A-->B', result, 'svg');
    expect(request.content).toBe('<svg></svg>');
    expect(request).not.toHaveProperty('url');
    expect(request).not.toHaveProperty('crossOrigin');
  });
});
