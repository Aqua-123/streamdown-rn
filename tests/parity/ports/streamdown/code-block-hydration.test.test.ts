import React from 'react';
import { render } from '@testing-library/react-native';
import { Image, Text, View } from 'react-native';
import { Streamdown, type NativeComponentProps } from '../../../../src';

const Paragraph = ({ children }: NativeComponentProps) => React.createElement(Text, { testID: 'paragraph' }, children);
const CodeBlock = ({ children }: NativeComponentProps) => React.createElement(View, { testID: 'code-block' }, children);
const InlineCode = ({ children }: NativeComponentProps) => React.createElement(Text, { testID: 'inline-code' }, children);
const components = { p: Paragraph, pre: CodeBlock, inlineCode: InlineCode };
const subject = (markdown: string) => React.createElement(Streamdown, { mode: 'static', components, children: markdown });

interface NativeTestNode {
  parent: NativeTestNode | null;
  props: Readonly<Record<string, unknown>>;
  type: unknown;
}

function hasAncestor(node: NativeTestNode, testID: string): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.props.testID === testID) return true;
  }
  return false;
}

function hasTextAncestor(node: NativeTestNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === Text) return true;
  }
  return false;
}

describe('native code block hierarchy', () => {
  it('keeps fenced code outside paragraph-native text containers', () => {
    // parity:386c3176a5a1f92b49dc8b636d999e06a31da180c3896117d709b739634d9429
    const screen = render(subject('Here is some text.\n\n```typescript\nconst foo = "bar";\n```\n\nMore text after.'));
    expect(hasAncestor(screen.getByTestId('code-block'), 'paragraph')).toBe(false);
  });

  it('keeps inline code inside its paragraph-native text container', () => {
    // parity:d266ca8753110197b302029a2307446d16211304808ffcb53e838778d0103460
    const screen = render(subject('This is a paragraph with `inline code` in it.'));
    expect(hasAncestor(screen.getByTestId('inline-code'), 'paragraph')).toBe(true);
  });

  it('renders multiple fenced blocks outside paragraphs', () => {
    // parity:f9ee342477ee36e5e4b0b861935f9ef07d3c366802a69fc8a6c4c2d27d64fc53
    const markdown = 'First code block:\n\n```javascript\nconst a = 1;\n```\n\nSecond code block:\n\n```python\nx = 2\n```';
    const blocks = render(subject(markdown)).getAllByTestId('code-block');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((block) => !hasAncestor(block, 'paragraph'))).toBe(true);
  });

  it('keeps block images and fenced code outside paragraphs', () => {
    // parity:05c78fd7410450ff0e4cf7eb75468e50a6542578703195dbe70fc9fa7e9bf277
    const markdown = 'Some text.\n\n![Image](https://example.com/image.png)\n\n```typescript\nconst x = 1;\n```\n\nMore text.';
    const getSize = jest.spyOn(Image, 'getSize').mockImplementation(() => undefined as never);
    try {
      const screen = render(React.createElement(Streamdown, { mode: 'static', components: { pre: CodeBlock }, children: markdown }));
      expect(hasTextAncestor(screen.getByLabelText('Image'))).toBe(false);
      expect(hasAncestor(screen.getByTestId('code-block'), 'paragraph')).toBe(false);
    } finally {
      getSize.mockRestore();
    }
  });
});
