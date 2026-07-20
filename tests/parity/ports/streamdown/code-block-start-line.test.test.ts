import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Code, Root } from 'mdast';
import { Streamdown } from '../../../../src';
import { parseSemanticDocument } from '../../../../src/core/parser';

function codeNode(markdown: string, supplied: Array<() => (tree: Root) => void> = []): Code {
  return parseSemanticDocument(markdown, { supplied }).children[0] as Code;
}

function renderCode(meta = '') {
  return render(React.createElement(
    Streamdown,
    { mode: 'static' },
    `\`\`\`js${meta ? ` ${meta}` : ''}\nfirst\nsecond\n\`\`\``
  ));
}

describe('native code metadata', () => {
  it('exports the native semantic parser as a function', () => {
    // parity:4e0db765094f72cdff1b12af82d0aa383a45422b534328da66aa6f2d6a47b913
    expect(typeof parseSemanticDocument).toBe('function');
  });

  it('preserves a present code metastring on the semantic node', () => {
    // parity:6b6aa363c5a776abf1ef541e40c67383a45e204b79ddd930446b22c2f09c6503
    expect(codeNode('```js startLine=10\nconst x = 1;\n```').meta).toBe('startLine=10');
  });

  it('leaves code metadata absent when the fence has no metastring', () => {
    // parity:f022630a33b1adf495651bf89e19b76b56c8325ed7b9cf4d5e4269ebed16388a
    expect(codeNode('```js\nconst x = 1;\n```').meta).toBeNull();
  });

  it('preserves supplied node properties alongside the metastring', () => {
    // parity:abf9b7cc8f49cfaf0ffac270d9252069bfadb84da35fe8f54b18a33ec0ed292f
    const existingProperty = () => (tree: Root) => {
      const node = tree.children[0] as Code;
      node.data = { ...node.data, hProperties: { existing: 'value' } };
    };
    const node = codeNode('```js startLine=5\nconst y = 2;\n```', [existingProperty]);

    expect(node.meta).toBe('startLine=5');
    expect((node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties)
      .toEqual({ existing: 'value' });
  });
});

describe('native code line-number semantics', () => {
  it('starts at line 1 when startLine is undefined', () => {
    // parity:104869941c9c12fb7cbc5b45919e99abc702595de1b4b9ee1ab489431b1c3c7d
    renderCode();
    expect(screen.getByLabelText('Line 1')).toBeTruthy();
    expect(screen.getByLabelText('Line 2')).toBeTruthy();
  });

  it('does not offset numbering when startLine is 1', () => {
    // parity:c8554a45e9947a52a16e2dad9ee9ca30e71d713a7ab5b2988e549ab8a69ba422
    renderCode('startLine=1');
    expect(screen.getByLabelText('Line 1')).toBeTruthy();
    expect(screen.getByLabelText('Line 2')).toBeTruthy();
  });

  it('starts at line 10 when startLine is 10', () => {
    // parity:a32d7e851af1b6b96753eaa3250695084c92c76be5bdb016dae85a611d4225f7
    renderCode('startLine=10');
    expect(screen.getByLabelText('Line 10')).toBeTruthy();
    expect(screen.getByLabelText('Line 11')).toBeTruthy();
  });

  it('starts at line 100 when startLine is 100', () => {
    // parity:00e7bd9d704d73e46cce79f0bc78a4719c6539bf8f4e0b1b6be1890ccdf0fea5
    renderCode('startLine=100');
    expect(screen.getByLabelText('Line 100')).toBeTruthy();
    expect(screen.getByLabelText('Line 101')).toBeTruthy();
  });

  it('renders a code block without startLine from line 1', () => {
    // parity:64a0df3b60dd04f45f58d068d10fda5146e8ec979e50147fb66ccdec0659b56b
    renderCode();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders startLine=10 from line 10', () => {
    // parity:68a2f5aa6761933b815b9c0883a330ef4786c124cb2f6c5c1e150c361a184a17
    renderCode('startLine=10');
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('renders startLine=1 without an offset', () => {
    // parity:3ec6a98b1507ca3cd8fa30f3f18cae27b1d64c05735404445486182802a73ca7
    renderCode('startLine=1');
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders startLine=50 from line 50', () => {
    // parity:099cd71d3c543d4340bfa79a7306f50f84e74ca2329a25f6037e241904a0645f
    renderCode('startLine=50');
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('51')).toBeTruthy();
  });
});
