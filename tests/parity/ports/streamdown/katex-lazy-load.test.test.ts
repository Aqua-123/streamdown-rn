import { createMathPlugin } from '../../../../src/plugins/math';
import { parseSemanticDocument } from '../../../../src/core/parser';

describe('native math adapter loading boundary', () => {
  it('does not invoke or require a renderer without math syntax', () => {
    const adapter = { render: jest.fn(() => null) };
    const plugin = createMathPlugin({ adapter });
    parseSemanticDocument('Ordinary prose without math.', { math: plugin.remarkPlugin });
    expect(adapter.render).not.toHaveBeenCalled();
    expect(plugin.getStyles).toBeUndefined();
  });

  it('detects block math without requiring a native renderer adapter', () => {
    const plugin = createMathPlugin();
    expect(JSON.stringify(parseSemanticDocument('$$\nx = \\frac{1}{2}\n$$', { math: plugin.remarkPlugin }))).toContain('"type":"math"');
    expect(plugin.getStyles).toBeUndefined();
  });

  it.each(['This $E = mc^2$ stays text.', 'The price is $$100 or $50 for students.'])('does not activate single-dollar/currency syntax: %s', (source) => {
    const plugin = createMathPlugin();
    expect(JSON.stringify(parseSemanticDocument(source, { math: plugin.remarkPlugin }))).not.toContain('inlineMath');
  });
});

/* pinned parity markers
 * parity:35e51024bc9b162ac0121fe65e1ea79cbefe838134504d626e551ee351d02027 — KaTeX CSS Lazy Loading > should render without errors when no math syntax is present
 * parity:3299b1465888a7ec73af2222b77f0234d6b4297091aaae9c62f727bb11ed83ef — KaTeX CSS Lazy Loading > should load KaTeX CSS when block math syntax is present
 * parity:ac427e4303b0d66751d0c1a85005215d01811ccccdc69e905bfb70476ca7c53b — KaTeX CSS Lazy Loading > should not load KaTeX CSS for single dollar by default (singleDollarTextMath: false)
 * parity:ec39aed63d0f366b389ab93c8c9c2f8ba7f16c8987f811e35a2b1cbbd4eca6d3 — KaTeX CSS Lazy Loading > should not load KaTeX CSS for dollar signs that are not math
 */
