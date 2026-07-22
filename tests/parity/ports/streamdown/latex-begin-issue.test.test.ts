import { fixIncompleteMarkdown } from '../../../../src/core/incomplete';
import { parseSemanticDocument } from '../../../../src/core/parser';
import { math } from '../../../../src/plugins/math';
import { INITIAL_INCOMPLETE_STATE } from '../../../../src/core/incomplete';

describe('LaTeX begin blocks', () => {
  const complete = '$$\n\\begin{pmatrix}\nx \\\\ y\n\\end{pmatrix}\n=\n\\begin{pmatrix}\na \\\\ b\n\\end{pmatrix}\n$$';

  // parity:5e7332d16c25c14e6463674dc1722662dc307a59d093b72091a1e9a4431086e1
  it('keeps complete begin/end blocks as one math node', () => {
    const tree = parseSemanticDocument(complete, { math: math.remarkPlugin });
    expect(JSON.stringify(tree)).toContain('begin{pmatrix}');
    expect(JSON.stringify(tree).match(/"type":"math"/g)).toHaveLength(1);
  });

  it.each([
    /* parity:6faf457d41f23a9ba6fd3956848a4fb493874fab18d67cfa5e41c6534601848b */ ['ending with equals', '$$\n\\begin{pmatrix}\nx \\\\ y\n\\end{pmatrix}\n='],
    /* parity:8419f8fd8c8274322e24455a9d015e84f4130377da8edf0997e7a3afe46c170c */ ['missing end', '$$\n\\begin{pmatrix}\nx \\\\ y'],
  ])('repairs incomplete LaTeX %s once without duplicate delimiters', (_caseName, input) => {
    const fixed = fixIncompleteMarkdown(input, INITIAL_INCOMPLETE_STATE);
    expect((fixed.match(/\$\$/g) ?? []).length).toBeLessThanOrEqual(2);
    expect(fixed).toContain('begin{pmatrix}');
  });

  // parity:b7d0c2e2dcf4c7dfcb831dd96c3166fa24a9282701032a6584dbd62ffc4783b1
  it('repairs a begin block ending with an equals sign without adding extra delimiters', () => {
    const fixed = fixIncompleteMarkdown('$$\n\\begin{pmatrix}\nx \\\\ y\n\\end{pmatrix}\n=', INITIAL_INCOMPLETE_STATE);
    expect(fixed.match(/\$\$/g)).toHaveLength(2);
    expect(fixed).toContain('=');
  });
});

/* pinned parity markers
 *  — LaTeX \begin block (#54) > should handle incomplete LaTeX block with \begin without adding extra $$
 *  — LaTeX \begin block (#54) > should handle complete LaTeX block with \begin
 */
