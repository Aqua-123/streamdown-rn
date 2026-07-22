import { parseSemanticDocument } from '../../../../src/core/parser';
import { math } from '../../../../src/plugins/math';

describe('matrix equation parsing', () => {
  const matrix = '$$\n\\begin{bmatrix}\n1 & 2 \\\\ 3 & 4\n\\end{bmatrix}\n\\cdot\\begin{bmatrix}x \\\\ y\\end{bmatrix}\n$$';

  // parity:4edf2bec5f71ecddd72e58839b08321c669c2e4621a487cad0af91e8007f34e3
  it('keeps a complete matrix in one semantic math node', () => {
    const tree = parseSemanticDocument(matrix, { math: math.remarkPlugin });
    expect(JSON.stringify(tree).match(/"type":"math"/g)).toHaveLength(1);
    expect(JSON.stringify(tree)).toContain('begin{bmatrix}');
  });

  // parity:48140dc436b80918baf0931fa8ee74ebf3108b454eb1323d32abc343cc94a1a9
  it('keeps math intact after prose and across multiple blocks', () => {
    const tree = parseSemanticDocument(`For example:\n${matrix}\n\nMore:\n$$\nx=y\n$$`, { math: math.remarkPlugin });
    expect(JSON.stringify(tree).match(/"type":"math"/g)).toHaveLength(2);
  });

  // parity:e51b9c4d4beb2e5b76bdef936a1233f52cf5e89b0853959d5b00898457f087fa
  it('keeps an unclosed matrix readable rather than dropping it', () => {
    const tree = parseSemanticDocument(matrix.slice(0, -2), { math: math.remarkPlugin });
    expect(JSON.stringify(tree)).toContain('begin{bmatrix}');
  });

  // parity:3ccac10e8a4944c7dfc7b50229b22bd58acc4df2f2b19d57d9c4104711ac5185
  it('keeps multiple matrix math blocks intact after prose', () => {
    const tree = parseSemanticDocument(`Matrices:\n${matrix}\n\n${matrix}`, { math: math.remarkPlugin });
    expect(JSON.stringify(tree).match(/"type":"math"/g)).toHaveLength(2);
  });
});

/* pinned parity markers
 *  — Matrix equation rendering > should render complete matrix equation properly
 *  — Matrix equation rendering > should keep math block intact when preceded by text (#194)
 *  — Matrix equation rendering > should keep multiple math blocks intact when preceded by text (#194)
 *  — Matrix equation rendering > should handle matrix equation without closing $$
 */
