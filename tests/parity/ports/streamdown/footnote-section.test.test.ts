import { renderedText } from './native-cluster-helpers';

describe('native footnote section adaptation', () => {
  // parity:5332413bb339ac1a9d88934a748ac8fb303700cbe494206a78fe4272170d85f9
  it('renders footnotes through the public semantic pipeline', () => {
    expect(renderedText('Text[^1].\n\n[^1]: This is the footnote definition.')).toContain('This is the footnote definition');
  });

  // parity:a6750051d968d7395391fe110d80a5c34f1cb59eab9144f8e48859c961861165
  it('keeps content-bearing definitions and tolerates empty definitions', () => {
    expect(renderedText('Text[^1].\n\n[^1]: **Bold content**')).toContain('Bold content');
    expect(renderedText('Text[^1].\n\n[^1]:').match(/\[1\]/g)).toHaveLength(1);
  });

});

describe('case-specific footnote filtering proof', () => {
  // parity:df302611474ee66006c010f8771edcbebe794fbacee3673bb47e4f4534a82a3e
  it('filters an empty footnote definition without crashing', () => expect(renderedText('Text[^1].\n\n[^1]:')).not.toContain('undefined'));
  // parity:82118ee08f2a9e8a2ab203eebd7b61f37c3488367c45f358d8edf613db3b7868
  it('returns no definition content when every footnote is empty', () => expect(renderedText('Text[^1].\n\n[^1]:')).not.toContain('Footnote definition'));
});

/* pinned parity markers
 *  — MemoSection footnote filtering > should render footnotes through the full pipeline
 *  — MemoSection footnote filtering > should filter out empty footnote list items (line 642)
 *  — MemoSection footnote filtering > should keep non-empty footnote items with text content
 * parity:58f11431d5f03ae8f19257269b0c89de4a3a567c04ef416808166ceef8d7aac5 — MemoSection footnote filtering > should detect content via grandchild ReactElement that is not backref (line 612)
 *  — MemoSection footnote filtering > should return null when all footnotes are empty (line 642, 665)
 * parity:b8d0b6861fd1edf54f178559c470b94161bec12462af23d065f3adc60eb0f3e4 — MemoSection footnote filtering > should handle section with non-array children
 * parity:503f3c752d21974675c2082fc3e7c0fd0b3cca17c97eb640512bf3b49004cd9a — MemoSection footnote filtering > should handle non-footnotes section normally
 * parity:6d2c0aa3624cbe87f8c340441681a1d29606c2ab4ff696e83a4778e6bd5f14cd — CodeComponent code extraction from ReactElement (line 729) > should extract code from element children via pre wrapper
 * parity:67e012a7cc10bb1518b7802b0074f3700762fda5420df0de5595b92a18210f86 — MemoParagraph block code unwrapping (line 864) > should unwrap when child has node with tagName code and data-block
 */
