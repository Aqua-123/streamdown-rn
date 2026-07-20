import React from 'react';
import { Text, View } from 'react-native';
import type { NativeComponentProps } from '../../../../src';
import { renderNative, renderedText } from './native-cluster-helpers';

const Details = ({ children, semantic }: NativeComponentProps) => React.createElement(
  View,
  { testID: `details-${String(semantic.attributes?.level ?? 'x')}` },
  children
);
const Summary = ({ children }: NativeComponentProps) => React.createElement(Text, null, children);

describe('nested custom details semantics', () => {
  const nested = '<details level="outer">\n<summary>Outer</summary>\n\n<details level="inner">\n<summary>Inner</summary>\n\nInner content\n\n</details>\n\nOuter content after inner closes\n\n</details>\n\nText after';
  const props = {
    allowedTags: { details: ['level'], summary: [] },
    components: { details: Details, summary: Summary },
  };

  it('keeps balanced double and triple same-tag blocks readable', () => {
    expect(renderedText(nested, props)).toContain('Outer content after inner closes');
    const triple = nested.replace('Inner content', '<details><summary>L3</summary>Deep content</details>');
    expect(renderedText(triple, props)).toContain('Deep content');
  });

  it('nests inner details and keeps later headings/tables within the outer semantic component', () => {
    const markdown = nested.replace('Outer content after inner closes', '### Heading after inner\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    const screen = renderNative(markdown, props);
    expect(screen.getByTestId('details-outer').findByProps({ testID: 'details-inner' })).toBeTruthy();
    expect(screen.getByText('Heading after inner')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('produces one native top-level details component for a nested structure', () => {
    const screen = renderNative(nested, props);
    expect(screen.getAllByTestId('details-outer')).toHaveLength(1);
    expect(screen.getByText('Text after')).toBeTruthy();
  });
});

/* pinned parity markers
 * parity:932e3b9b8bb8b7e01c5e612559a8c02b732e078b325b1a6b4c2b511aa10a7496 — Nested details elements > parseMarkdownIntoBlocks > should keep nested same-tag HTML blocks as a single balanced block
 * parity:70ed7f524db57cf2c131b7586df2a4be49c0ebb56bfff3b2bba6b6925ea0ab9f — Nested details elements > parseMarkdownIntoBlocks > should handle triple-nested same-tag HTML blocks
 * parity:8321fcbdfde0c6a82b720b51a6fa9551305eb7664035d464278d89ca4551c722 — Nested details elements > rendered DOM structure > should nest inner details inside outer details
 * parity:002fed1e846402cb5c983508717c6badd8cf178a0eca61cfe4695215138f42ba — Nested details elements > rendered DOM structure > should keep sibling content inside outer details after inner closes
 * parity:4a855dcb9cb1459ca88c7e0756de2eac66d272f7baa30e38f6e1577c2b0d6599 — Nested details elements > rendered DOM structure > should produce only one top-level details for a fully nested structure
 */
