import React from 'react';
import { render, type RenderAPI } from '@testing-library/react-native';
import type { Root } from 'mdast';
import { Streamdown, type StreamdownProps } from '../../../../src';
import { getProcessorCacheSizeForTests } from '../../../../src/core/parser';

function markdown(children?: string, props: Omit<StreamdownProps, 'children'> = {}): RenderAPI {
  return render(React.createElement(Streamdown, { mode: 'static', ...props }, children));
}

function outputText(screen: RenderAPI): string {
  const read = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(read).join('');
    if (value && typeof value === 'object' && 'children' in value) {
      return read((value as { children?: unknown }).children);
    }
    return '';
  };
  return read(screen.toJSON());
}

function replaceFirstText(value: string) {
  return () => (tree: Root) => {
    const visit = (node: Root['children'][number] | Root): boolean => {
      if (node.type === 'text') {
        node.value = value;
        return true;
      }
      return 'children' in node && Array.isArray(node.children)
        ? node.children.some((child) => visit(child as Root['children'][number]))
        : false;
    };
    visit(tree);
  };
}

describe('Markdown Component native adaptations', () => {
  describe('Plugin Support', () => {
    // parity:75e901b50a24f9afefb8e48dbf4dd62612e799ab59756ce8bf898daaa22a2151
    it('rejects rehype plugins as DOM-only', () => {
      expect(() => markdown('# Test', { rehypePlugins: [] } as never)).toThrow(
        'rehypePlugins is DOM-only'
      );
    });

    // parity:999bb8d372d8d35de4255482316207329f9b47d412665cd74b8edaea37f2bb0f
    it('accepts remark plugins with options', () => {
      const plugin = (options: { value: string }) => replaceFirstText(options.value)();
      expect(outputText(markdown('# Test', { remarkPlugins: [[plugin, { value: 'Configured' }]] }))).toContain('Configured');
    });

    // parity:85e53d1bddf2579efbe05fb8bd58d38a9f72a931fea8178af5badf8dc1f067dd
    it('applies multiple remark plugins in declaration order', () => {
      const seen: string[] = [];
      const first = () => (tree: Root) => { seen.push('first'); return tree; };
      const second = () => (tree: Root) => { seen.push('second'); return tree; };
      markdown('# Test', { remarkPlugins: [first, second] });
      expect(seen).toEqual(['first', 'second']);
    });

    // parity:2d58e97e4d92617724bd77d41dd1dbce7e3c17d2500a4cd26b3af28b19ff9d79
    it('rejects multiple rehype plugins as DOM-only', () => {
      expect(() => markdown('# Test', { rehypePlugins: [() => {}, () => {}] } as never)).toThrow(
        'rehypePlugins is DOM-only'
      );
    });

    // parity:0ff03a5ca924f38e0db121a6f6423d0f741756fcbeb4c04bad51ac5b14f1f78d
    it('rejects remarkRehypeOptions as DOM-only', () => {
      expect(() => markdown('# Test', { remarkRehypeOptions: { allowDangerousHtml: false } } as never)).toThrow(
        'remarkRehypeOptions is DOM-only'
      );
    });

    it('keeps raw HTML inert by default', () => {
      // parity:bc9aedc599ca7ce76b0c318e610a0b7aacef6e05a8a641ead958a4e6a4f705d9
      const screen = markdown('Text with <em>HTML</em> tags');
      expect(outputText(screen)).toContain('<em>HTML</em>');
      expect(screen.queryByText('HTML')).toBeNull();
    });

    // parity:0dc3e519d641cb5a048c1943eda30149f1d5fc4078564a89365e01cb0c308c52
    it('renders raw HTML as literal text without a DOM rehype stage', () => {
      const screen = markdown('Text with <em>HTML</em> and <h2>heading</h2> tags');
      expect(outputText(screen)).toContain('<em>HTML</em>');
      expect(outputText(screen)).toContain('<h2>heading</h2>');
      expect(screen.queryByRole('header', { name: 'heading' })).toBeNull();
    });
  });

  describe('Processor Caching', () => {
    it('renders distinct content with identical processor options', () => {
      expect(outputText(markdown('Test 1'))).toContain('Test 1');
      expect(outputText(markdown('Test 2'))).toContain('Test 2');
    });

    // parity:e11e5d6e701ae9e8a1d22e0deb06f72ee6f15d0116ac8b2f4ec82012b98f082c
    it('reuses the cached processor for identical plugin options', () => {
      const initialize = jest.fn(() => (tree: Root) => tree);
      const options = { remarkPlugins: [initialize] };
      expect(outputText(markdown('First', options))).toContain('First');
      expect(outputText(markdown('Second', options))).toContain('Second');
      expect(initialize).toHaveBeenCalledTimes(1);
    });

    // parity:283a93d3aa0b814b1a6da5ab0ce014fc68fc452de05e90b2e91afc1b32175c35
    it('keeps plugin option configurations isolated in the processor cache', () => {
      const plugin = (options: { value: string }) => replaceFirstText(options.value)();
      expect(outputText(markdown('Test', { remarkPlugins: [[plugin, { value: 'one' }]] }))).toContain('one');
      expect(outputText(markdown('Test', { remarkPlugins: [[plugin, { value: 'two' }]] }))).toContain('two');
    });

    // parity:2ac35d6670e4489618d6c2e31fd186f02e22f9f00a7b7aa81a9cfeba1ff4036a
    it('rejects every remarkRehypeOptions configuration consistently', () => {
      for (const allowDangerousHtml of [true, false]) {
        expect(() => markdown('Test', { remarkRehypeOptions: { allowDangerousHtml } } as never)).toThrow(
          'remarkRehypeOptions is DOM-only'
        );
      }
    });
  });

  describe('Edge Cases', () => {
    // parity:4592a675ebc1b8fb565aa1516c82cb6107381ce4a2af08c12055eb4ad24bcbae
    it('preserves special characters as native text', () => {
      expect(outputText(markdown(`Text with & < > " ' characters`))).toContain(`& < > " '`);
    });

    // parity:d070cd1558cc45f7490f7d1bccf5de31e2412ffa6322510596b4ab68b1db834d
    it('preserves unicode characters', () => {
      expect(outputText(markdown('Unicode: 你好 🌟 café'))).toContain('你好 🌟 café');
    });

    // parity:4fbab664abc39e0d93738ca59bf206d2f7519f994312fd7fd407cd90fe9fc536
    it('renders very long text without truncation', () => {
      const content = 'a'.repeat(10_000);
      expect(outputText(markdown(content))).toContain(content);
    });

    // parity:63385318153e72f4fd53feb6c299234d94329179d606ac95d01ff402547ae4c7
    it('handles malformed markdown without throwing', () => {
      expect(outputText(markdown('**bold without closing'))).toContain('**bold without closing');
    });

    // parity:702e7e7294f1d408206997fecdbd353e9689ad09c6020bab838f2596f2cf4a3c
    it('renders nested formatting', () => {
      expect(outputText(markdown('***bold and italic***'))).toContain('bold and italic');
    });

    // parity:76a45f5c42bd6c551fd109f39c0335f6938eba1df99a121fac9425877994c9d6
    it('renders escaped markdown punctuation literally', () => {
      expect(outputText(markdown('\\*not italic\\*'))).toContain('*not italic*');
    });

    // parity:819a094887b204af307fde98f8a055d1488e08ca3f5797e3a8e8a8458d99a8df
    it('preserves content separated by consecutive blank lines', () => {
      const text = outputText(markdown('Line 1\n\n\n\nLine 2'));
      expect(text).toContain('Line 1');
      expect(text).toContain('Line 2');
    });

    // parity:755fb3ee398551a7ab18438107fccfdbd839578b55a6871ecf65a6b9094346d7
    it('renders whitespace-only content without native output', () => {
      expect(markdown('   \n\n   ').toJSON()).toBeNull();
    });
  });

  describe('Performance and Caching', () => {
    // parity:79c40c1feebb308fcf81fc86fdcd0ea0b5b92ab2da2102e0f64642605271cabf
    it('handles repeated renders with the same options', () => {
      for (let index = 0; index < 3; index += 1) {
        const screen = markdown('Test content');
        expect(outputText(screen)).toContain('Test content');
        screen.unmount();
      }
    });

    // parity:d3211e7287ad1ffc8b9b1da1242dcffbb98a27b24b1d27b338c3bba7e833de56
    it('updates output across rapid plugin changes', () => {
      const screen = markdown('Test', { remarkPlugins: [replaceFirstText('one')] });
      expect(outputText(screen)).toContain('one');
      screen.rerender(React.createElement(Streamdown, { mode: 'static', remarkPlugins: [replaceFirstText('two')] }, 'Test'));
      expect(outputText(screen)).toContain('two');
      screen.rerender(React.createElement(Streamdown, { mode: 'static', remarkPlugins: [replaceFirstText('three')] }, 'Test'));
      expect(outputText(screen)).toContain('three');
    });

    // parity:a7c4f97b1ece30ccdd9bc8c6b3dd515ab19d2c45a149a75ec9734e72a16657f0
    it('renders with an explicitly empty plugin list', () => {
      expect(outputText(markdown('# Test', { remarkPlugins: [] }))).toContain('Test');
    });
  });

  describe('Type Safety', () => {
    // parity:5005261ae3cdda57f8c56e65a74ff337cccaf463b55898f99e612a8cbbee1712
    it('accepts valid native Streamdown options', () => {
      const options: StreamdownProps = { children: 'Test', components: {}, remarkPlugins: [], mode: 'static' };
      expect(outputText(render(React.createElement(Streamdown, options)))).toContain('Test');
    });

    // parity:d786963f61d9a7e0e55429ef7c4c6154751415d03da5b4fa0221574645b6ab99
    it('accepts minimal options', () => {
      const options: StreamdownProps = { children: 'Minimal test' };
      expect(outputText(render(React.createElement(Streamdown, options)))).toContain('Minimal test');
    });

    // parity:49887445fac087ca131300e6f3475d9cae1079c60af13804b3cb072e179c9e04
    it('accepts options without children', () => {
      const options: StreamdownProps = {};
      expect(render(React.createElement(Streamdown, options)).toJSON()).toBeNull();
    });
  });

  describe('Native React integration', () => {
    // parity:e0e0c0a45966fc816c4eae32e74bfac6d1b76748f56e440a7097450532aa39c3
    it('generates a valid native React tree', () => {
      const tree = markdown('# Test').toJSON();
      expect(tree).toMatchObject({ type: 'View' });
    });

    // parity:71772cd0e0f1badfb6494dc83717072025b669aa5a0ec1584c2ed663b7748d7a
    it('preserves every generated list item across reconciliation', () => {
      const screen = markdown('- Item 1\n- Item 2\n- Item 3');
      for (const item of ['Item 1', 'Item 2', 'Item 3']) expect(screen.getByText(item)).toBeTruthy();
      screen.rerender(React.createElement(Streamdown, { mode: 'static' }, '- Item 1\n- Item 2\n- Item 3'));
      for (const item of ['Item 1', 'Item 2', 'Item 3']) expect(screen.getByText(item)).toBeTruthy();
    });

    // parity:439ad84c4746973c44f89954ed9a1555b0f7b8d7a783f3be7c05e9625f419218
    it('renders plain text through the native root without an HTML wrapper', () => {
      expect(outputText(markdown('Text without wrapper'))).toContain('Text without wrapper');
    });
  });

  describe('Error Handling', () => {
    // parity:980c7cb618160c140490757cdb7e1514effe2653a4b343fc92df507d0722bac6
    it('handles an invalid plugin without crashing the native tree', () => {
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => markdown('Test', { remarkPlugins: [null] as never })).not.toThrow();
      expect(warning).toHaveBeenCalledWith('Remark parse error:', expect.anything());
      warning.mockRestore();
    });

    // parity:244ca29fb71f60f9c0cfdbff308fc45a0b0d8b4c3d72f0a968ca12d8d18d02ad
    it('handles undefined in the plugin array without crashing the native tree', () => {
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => markdown('Test', { remarkPlugins: [undefined] as never })).not.toThrow();
      expect(warning).toHaveBeenCalledWith('Remark parse error:', expect.anything());
      warning.mockRestore();
    });
  });

  describe('Processor Cache Limits', () => {
    // parity:5bc848de76dc6436f1569aa71cf997dc71ce0dc48cf60e573a1409e40122b058
    it('handles 150 distinct processor configurations', () => {
      for (let index = 0; index < 150; index += 1) {
        const plugin = replaceFirstText(`Test ${index}`);
        const screen = markdown('source', { remarkPlugins: [plugin] });
        expect(outputText(screen)).toContain(`Test ${index}`);
        screen.unmount();
      }
      expect(getProcessorCacheSizeForTests()).toBeLessThanOrEqual(100);
    });
  });

  describe('Real-world Scenarios', () => {
    // parity:64fe3030c7dea9b2560eca69aa22727eadfdc2d7ea04015d7e4bd139eb9fda4a
    it('renders a blog post structure', () => {
      const screen = markdown(`# Blog Post Title\n\nBy Author Name\n\n## Introduction\n\nThis is the introduction paragraph with **important** points.\n\n## Main Content\n\n- Point 1\n- Point 2\n- Point 3\n\n### Subsection\n\nMore details here with \`code examples\`.\n\n## Conclusion\n\nFinal thoughts.`);
      for (const text of ['Blog Post Title', 'Introduction', 'Point 1', 'Subsection', 'code examples', 'Final thoughts.']) {
        expect(screen.getByText(text)).toBeTruthy();
      }
    });

    // parity:967b27742838349061e008c3b0ed3a0b38a27a4be974d5e8909d21ea405253a5
    it('renders documentation format', () => {
      const screen = markdown(`# API Documentation\n\n## Overview\n\nThis API provides access to data.\n\n## Endpoints\n\n### GET /api/data\n\nReturns data.\n\n\`\`\`javascript\nfetch('/api/data')\n  .then(res => res.json())\n\`\`\`\n\n### POST /api/data\n\nCreates data.`);
      for (const text of ['API Documentation', 'Overview', 'GET /api/data', 'javascript', "fetch('/api/data')", 'POST /api/data']) {
        expect(outputText(screen)).toContain(text);
      }
    });

    // parity:d06e17d2d53fa1b854dc003444c2174775a3e3a36a3f2d400ad97ed046591cce
    it('renders chat message format', () => {
      const screen = markdown(`Here's what I found:\n\n- Option A: **Best for performance**\n- Option B: *Easier to implement*\n\nLet me know which you prefer!`);
      for (const text of ["Here's what I found:", 'Best for performance', 'Easier to implement', 'Let me know which you prefer!']) {
        expect(outputText(screen)).toContain(text);
      }
    });
  });
});
