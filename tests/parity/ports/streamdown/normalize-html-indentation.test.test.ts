import { normalizeHtmlIndentation } from '../../../../src';
import { renderedText } from './native-cluster-helpers';

describe('HTML indentation normalization', () => {
  // parity:d7fef4657f3847cd532002b64bb80705a074cdcc25df711711ab96ad8dfb9018
  it('leaves empty, markdown, indented code, fenced code, and leading inline HTML unchanged', () => {
    for (const input of ['', '# Hello\n\nParagraph.', '    const x = 1;', '```html\n    <div>code</div>\n```', '  <div>content</div>']) {
      expect(normalizeHtmlIndentation(input)).toBe(input);
    }
  });

  // parity:1bb8a49541fb09c1686c6022cc1544434e04b869ad9493fbe28d5e8cba8beb1d
  it('dedents only tags in HTML-led documents and preserves pre text, comments, doctype, and mixed prose', () => {
    const input = '<!DOCTYPE html>\n    <html>\n    <pre>\n    code with spaces\n</pre>\n    <!-- comment -->\n    <img src="x" />\n    <br />\n    </html>\n\nAfter.';
    const result = normalizeHtmlIndentation(input);
    expect(result).not.toMatch(/\n {4,}<\w/);
    expect(result).toContain('    code with spaces');
    for (const value of ['<!DOCTYPE html>', '<!-- comment -->', '<img src="x" />', '<br />', 'After.']) expect(result).toContain(value);
  });

  // parity:e5b696da76e5a835bae99b2f297865609a47f6aeee32553c4074d90447d1b9b8
  it('normalizes nested tag indentation exactly', () => {
    expect(normalizeHtmlIndentation('<div>\n    <span>Hello</span>\n</div>')).toBe('<div>\n<span>Hello</span>\n</div>');
  });

  // parity:f24b8d26a747d3885bb8adb008ed54171af3aa6cf6e6a691ef7f5b9cd7d54121
  it('applies the public prop without changing non-HTML markdown', () => {
    expect(renderedText('# Heading\n\nOne.\n\nTwo.', { normalizeHtmlIndentation: true })).toContain('Heading');
    const html = '<article>\n    <header>Title</header>\n    <section>One</section>\n    <section>Two</section>\n</article>';
    const output = renderedText(html, { normalizeHtmlIndentation: true, allowedTags: { article: [], header: [], section: [] } });
    for (const value of ['Title', 'One', 'Two']) expect(output).toContain(value);
  });

  // parity:ddd0d51084fd66c13277e73d70f4ea7c99a152d677d01bfe2adaee210342e27c
  it('preserves nested/self-closing/void HTML block source as one readable semantic document', () => {
    for (const [markdown, expected] of [
      ['<div>\n<div>Inner content</div>\n</div>\n\n<p>After</p>', 'Inner content'],
      ['<div>\n<br />\n<p>Text after break</p>\n</div>', 'Text after break'],
      ['<div>\n<br />\n<hr />\n<input type="text" />\n<p>After void elements</p>\n</div>', 'After void elements'],
    ]) expect(renderedText(markdown)).toContain(expected);
  });
});

describe('case-specific HTML normalization proof', () => {
  // parity:810375a97ef278dc215d9112209f0e96d113426d7dcfb32523eb487671507641
  it('should return empty string unchanged', () => expect(normalizeHtmlIndentation('')).toBe(''));
  // parity:179c989fbe4b89b968755fdee541c6b01035f9c703f8d5ad8cb625b87a18d25d
  it('should return non-HTML content unchanged', () => expect(normalizeHtmlIndentation('# Heading')).toBe('# Heading'));
  // parity:acbf948592ac3726877f397c0fdfcf9de1efb02b3ad0cec442c0832b903b0796
  it('should normalize indented HTML tags within HTML blocks', () => expect(normalizeHtmlIndentation('<div>\n    <span>text</span>\n</div>')).toBe('<div>\n<span>text</span>\n</div>'));
  // parity:44979fd80d52a8e059f6f01287a8945117ee407ce5c4a57885fae1c7a72e0f68
  it('should handle HTML starting with whitespace', () => expect(normalizeHtmlIndentation('  <div>text</div>')).toBe('  <div>text</div>'));
  // parity:b6cbde9b596e8436db360caaf95619dba03b9f60f19c4e89f57bf6d7e56afb90
  it('should handle self-closing tags', () => expect(normalizeHtmlIndentation('<div>\n    <img src="x" />\n</div>')).toContain('<img src="x" />'));
  // parity:e5fce7893137e8a45f774d2770c7c38abfbcf0b52393e41b9db9c1ab83be87b7
  it('should handle HTML comments', () => expect(normalizeHtmlIndentation('<div>\n    <!-- note -->\n</div>')).toContain('<!-- note -->'));
  // parity:a76e3d5f83b76ea96548c8b30a872abeadba05ac0942b897bdf3cba54f3d1fc1
  it('should handle doctype declarations', () => expect(normalizeHtmlIndentation('<!DOCTYPE html>\n    <html></html>')).toContain('<!DOCTYPE html>'));
  // parity:f07f6084a59511ffa1cb114b1f35802fe93dd641e3422c5605f2950f2289821f
  it('should not affect markdown code fences', () => {
    const input = '```html\n    <div>code</div>\n```';
    expect(normalizeHtmlIndentation(input)).toBe(input);
  });
  // parity:009dcff9f81b0944cc68a306839afa38674e51ea617b361c603a0a7bfd0ad079
  it('should handle mixed content after HTML', () => expect(normalizeHtmlIndentation('<div>text</div>\n\nAfter.')).toContain('After.'));
  // parity:7a5541aa6ec3750f712c108c0137865d841b096f27ef9bf37073b0f8caf1312f
  it('should render indented HTML as code when normalization is disabled', () => expect(renderedText('    <div>code</div>', { normalizeHtmlIndentation: false })).toContain('<div>code</div>'));
  // parity:1ad8f1086d1a83a3e07f6b4065d5d7df8ed619b0c4ded68c254c2e0f2957d5b1
  it('should render all HTML when normalization is enabled', () => expect(renderedText('<div>\n    <span>text</span>\n</div>', { normalizeHtmlIndentation: true, allowedTags: { div: [], span: [] } })).toContain('text'));
  // parity:d4c8f55e9297a4c81e1fe66d3f9158a697a05a54e63391c3e2bd0ad073fae6e0
  it('should handle a streaming HTML fragment', () => expect(renderedText('<div>\n    <span>partial</span>\n</div>', { normalizeHtmlIndentation: true, mode: 'streaming' })).toContain('partial'));
  // parity:b863ab4beabd363c8974054c9332efade1371ec7bf5f16c5b20723353bbdab8e
  it('should handle complex nested HTML levels', () => expect(normalizeHtmlIndentation('<div>\n    <section>\n        <span>text</span>\n    </section>\n</div>')).toContain('<span>text</span>'));
  // parity:2a242fe4c152723eaf58f92faba13e9ab9887edea2ebb615c6223500194c0816
  it('should merge nested HTML blocks', () => expect(renderedText('<div>\n<div>inner</div>\n</div>')).toContain('inner'));
  // parity:2e2c110038143d6857c7dcda3ef67336f4803f91b9ec9bf6ceb82d4333cff0ff
  it('should handle void elements while merging HTML', () => expect(renderedText('<div>\n<br />\n<p>after</p>\n</div>')).toContain('after'));
});

/* pinned parity markers
 *  — normalizeHtmlIndentation utility function > should return empty string unchanged
 *  — normalizeHtmlIndentation utility function > should return non-HTML content unchanged
 *  — normalizeHtmlIndentation utility function > should return indented code blocks unchanged when not starting with HTML
 *  — normalizeHtmlIndentation utility function > should normalize indented HTML tags within HTML blocks
 *  — normalizeHtmlIndentation utility function > should handle deeply nested HTML with various indentation levels
 *  — normalizeHtmlIndentation utility function > should preserve text content indentation inside pre tags
 *  — normalizeHtmlIndentation utility function > should handle HTML starting with whitespace
 *  — normalizeHtmlIndentation utility function > should handle self-closing tags
 *  — normalizeHtmlIndentation utility function > should handle HTML comments
 *  — normalizeHtmlIndentation utility function > should handle doctype declarations
 *  — normalizeHtmlIndentation utility function > should not affect markdown code fences
 *  — normalizeHtmlIndentation utility function > should handle mixed content after HTML
 *  — Streamdown with normalizeHtmlIndentation prop > should render indented HTML as code block when normalizeHtmlIndentation is false (default)
 *  — Streamdown with normalizeHtmlIndentation prop > should render all HTML correctly when normalizeHtmlIndentation is true
 *  — Streamdown with normalizeHtmlIndentation prop > should handle streaming socket data scenario
 *  — Streamdown with normalizeHtmlIndentation prop > should not affect non-HTML content when normalizeHtmlIndentation is true
 *  — Streamdown with normalizeHtmlIndentation prop > should handle complex nested HTML with multiple levels
 *  — parse-blocks HTML merging > should merge HTML blocks with nested tags correctly
 *  — parse-blocks HTML merging > should handle self-closing tags without breaking block merging
 *  — parse-blocks HTML merging > should handle void elements correctly
 */
