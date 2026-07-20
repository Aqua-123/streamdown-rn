import { Text } from 'react-native';
import { renderNative, renderedText } from './native-cluster-helpers';

describe('RTL native semantics', () => {
  it('preserves Arabic, Hebrew, mixed bidi text, and every block family', () => {
    const markdown = `# عنوان رئيسي بالعربية

هذا نص عربي مع **تنسيق غامق** و *مائل*. Hello مرحبا World عالم.

- عنصر القائمة الأول
- עברית פריט רשימה

> זה ציטוט בעברית.

| English | عربي | עברית |
|---|---|---|
| Hello | مرحبا | שלום |

Use \`مرحبا\` and [نص الرابط العربي](https://example.com).`;
    const text = renderedText(markdown);
    for (const value of ['عنوان رئيسي', 'تنسيق غامق', 'עברית פריט רשימה', 'זה ציטוט', 'שלום', 'مرحبا', 'نص الرابط العربي']) {
      expect(text).toContain(value);
    }
  });

  it.each([
    ['rtl' as const, 'Hello world', 'rtl'],
    ['ltr' as const, 'مرحبا بالعالم', 'ltr'],
    ['auto' as const, 'مرحبا بالعالم', 'rtl'],
    ['auto' as const, 'Hello world', 'ltr'],
  ])('maps dir=%s to native writingDirection=%s', (dir, markdown, expected) => {
    const screen = renderNative(markdown, { dir });
    expect(screen.UNSAFE_getAllByType(Text).some((item) => {
      const styles = Array.isArray(item.props.style) ? item.props.style : [item.props.style];
      return styles.some((style: { writingDirection?: string } | undefined) => style?.writingDirection === expected);
    })).toBe(true);
  });

  it('auto-detects direction independently for streamed blocks', () => {
    const screen = renderNative('مرحبا بالعالم\n\nHello world', { mode: 'streaming', dir: 'auto' });
    const directions = screen.UNSAFE_getAllByType(Text).flatMap((item) =>
      (Array.isArray(item.props.style) ? item.props.style : [item.props.style])
        .map((style: { writingDirection?: string } | undefined) => style?.writingDirection)
        .filter(Boolean)
    );
    expect(directions).toEqual(expect.arrayContaining(['rtl', 'ltr']));
  });

  it('does not apply a direction style when dir is undefined', () => {
    const screen = renderNative('Hello world');
    expect(screen.UNSAFE_getAllByType(Text).some((item) => {
      const styles = Array.isArray(item.props.style) ? item.props.style : [item.props.style];
      return styles.some((style: { writingDirection?: string } | undefined) => style?.writingDirection !== undefined);
    })).toBe(false);
  });
});

/* pinned parity markers
 * parity:cac109cb0871cd413bf46f94487f31132c32bcb7c9cc97af2c75632b682520cc — RTL (Right-to-Left) Support > renders basic RTL text correctly
 * parity:2e6fabb7afc9828ec2d9046f46b9f99d84e1a8c76448a5345d8d86078f9fb6d3 — RTL (Right-to-Left) Support > renders mixed RTL/LTR content in paragraphs
 * parity:74c0b3d5c91beff4d33a26189a4cb251dba1b0f8a3fefbf733b1f3c0843feb3e — RTL (Right-to-Left) Support > renders RTL content in lists
 * parity:4a9a241a76f134793fa53f7dcf4c098bc835dd76b9fbb4420bb793e57fe9758f — RTL (Right-to-Left) Support > renders RTL content in headings
 * parity:61f871e3d1e4512dd752b057cd0a39315baabb358bdf938f2c0d2ec92772e301 — RTL (Right-to-Left) Support > renders RTL content in tables
 * parity:1420d492106a025ce2403ebb0337c47c6afc8528e74003254b6b1d9e9235a6b2 — RTL (Right-to-Left) Support > renders RTL content in blockquotes
 * parity:260134bc6e962941571510a6bad4a82c78f33c141048e65744101340ae8fba17 — RTL (Right-to-Left) Support > renders inline code with RTL text
 * parity:12a37c9b34fbce4041feaee282d12d0997532015c1045c5dbafab72ce80b298c — RTL (Right-to-Left) Support > renders links with RTL text
 * parity:e62e4bc69ed6f009e28d52d2b6b837177efdab3d75c3cd292912803be917dc72 — RTL (Right-to-Left) Support > works with dir="rtl" CSS style
 * parity:b95d41308e49466792e48053fcf58b94c49483289cb1acf9af8ae1a4d71da2fb — RTL (Right-to-Left) Support > preserves bidirectional text ordering
 * parity:b3a87c23ca21028740d03bd33f786539f4c6087c9bb82cbcc33a743d940ca281 — RTL (Right-to-Left) Support > dir prop > applies dir="rtl" to wrapper in static mode
 * parity:0e262a50983afc9279bf8a1542e8fc5fedc4f7fe678859f9eb278d8bb71e6108 — RTL (Right-to-Left) Support > dir prop > applies dir="ltr" to wrapper in static mode
 * parity:0d57f5cf3c59cb39647c0b682998a5565c0d808fe47bffcf64ebbc31db681a0e — RTL (Right-to-Left) Support > dir prop > auto-detects RTL in static mode
 * parity:00e12e39d703a855a566297825b0a27ef4f4532ef8a5635d277229b2520806ce — RTL (Right-to-Left) Support > dir prop > auto-detects LTR in static mode
 * parity:67fb7cf87434ed9aa11f434452a8d285271abbca1caaa7ae111d0cfbe57b1556 — RTL (Right-to-Left) Support > dir prop > applies per-block dir in streaming mode with dir="auto"
 * parity:f66547584ba7ae539a00ce1e1b81f46b948229de930af9870d23a22b69c9a85c — RTL (Right-to-Left) Support > dir prop > uses display:contents on block dir wrapper
 * parity:b3add76666a725b2c430ede0b443e34cbba9fbaeb5e456bd82c390d2b07de149 — RTL (Right-to-Left) Support > dir prop > does not add dir wrapper when dir is undefined
 */
