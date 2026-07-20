import { renderedText } from './native-cluster-helpers';

describe('multiline HTML stays inert and readable', () => {
  it.each([
    ['<details>\n<summary>Summary</summary>\n\nParagraph inside details.\n</details>', ['Summary', 'Paragraph inside details']],
    ['<div>\n\nParagraph inside div.\n</div>', ['Paragraph inside div']],
    ['<details>\n<summary>Summary</summary>\n\nFirst paragraph.\n\nSecond paragraph.\n</details>', ['First paragraph', 'Second paragraph']],
    ['<div>\n<details>\n<summary>Nested Summary</summary>\n\nContent in nested structure.\n</details>\n</div>', ['Nested Summary', 'Content in nested structure']],
    ['<p>Before image</p>\n<img src="https://example.com/image.jpg" alt="Test Image">\n<p>After image</p>', ['Before image', 'Test Image', 'After image']],
  ])('preserves source text without executing HTML', (markdown, expected) => {
    const text = renderedText(markdown);
    expected.forEach((value) => expect(text).toContain(value));
    expect(text).toContain(markdown.slice(0, markdown.indexOf('>') + 1));
  });
});

/* pinned parity markers
 * parity:49d395d739e98c7668e9836eae80314ee642493f8da141bbdf6115888019f3fe — HTML Block Elements with Multiline Content - #164 > should render multiline content inside details element
 * parity:c70a2e817e33be70cb3faee788ca67d7f596ff4fcf24984fee182377c6bf7e80 — HTML Block Elements with Multiline Content - #164 > should render multiline content inside div element
 * parity:438f6f32e9cc19fb554457aad95e8936dd6e83f4e89c59b23a1ac5ec3476cec4 — HTML Block Elements with Multiline Content - #164 > should handle multiple paragraphs inside details
 * parity:1ce13878112a7f19850df40bdb0dfbf31e8880933a95f36c159ecb45394cb581 — HTML Block Elements with Multiline Content - #164 > should preserve nested structure in complex HTML blocks
 * parity:fe72624e82bab444f20b3bc156b45b0d6b2119a65a65200d388eb2f8425e205d — HTML Block Elements with Multiline Content - #164 > should handle img tag as self-closing HTML element
 */
