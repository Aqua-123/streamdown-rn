import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { Root } from 'mdast';
import { ASTRenderer } from '../ASTRenderer';
import { lightTheme } from '../../themes';

describe('native semantic renderer', () => {
  it('renders every portable node family without dropping siblings', () => {
    const tree: Root = {
      type: 'root',
      children: [
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Heading' }] },
        {
          type: 'paragraph',
          children: [
            { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
            { type: 'text', value: ' ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
            { type: 'text', value: ' ' },
            { type: 'delete', children: [{ type: 'text', value: 'deleted' }] },
            { type: 'break' },
            { type: 'inlineCode', value: 'inline()' },
          ],
        },
        { type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'quote' }] }] },
        {
          type: 'list', ordered: true, start: 3, spread: false, children: [{
            type: 'listItem', checked: true, spread: false,
            children: [{ type: 'paragraph', children: [{ type: 'text', value: 'task' }] }],
          }],
        },
        { type: 'thematicBreak' },
        { type: 'code', lang: 'ts', meta: 'title=demo', value: 'const n = 1;' },
        {
          type: 'table', align: ['left'], children: [
            { type: 'tableRow', children: [{ type: 'tableCell', children: [{ type: 'text', value: 'Column' }] }] },
            { type: 'tableRow', children: [{ type: 'tableCell', children: [{ type: 'text', value: 'Cell' }] }] },
          ],
        },
        { type: 'footnoteDefinition', identifier: 'note', label: 'note', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Footnote body' }] }] },
      ],
    };

    const screen = render(<ASTRenderer node={tree} theme={lightTheme} />);
    for (const text of ['Heading', 'bold', 'italic', 'deleted', 'inline()', 'quote', 'task', 'const n = 1;', 'Column', 'Cell', 'Footnote body']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('passes native semantic data to block, inline-code, custom, and unknown overrides', () => {
    const seen: Array<Record<string, unknown>> = [];
    const Override = (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      seen.push(props);
      return <Text>{props.children ?? String((props.semantic as { value?: string }).value ?? '')}</Text>;
    };
    const tree = {
      type: 'root',
      children: [
        { type: 'heading', depth: 3, children: [{ type: 'text', value: 'override heading' }] },
        { type: 'paragraph', children: [{ type: 'inlineCode', value: 'override code' }] },
        { type: 'customNode', data: { hName: 'widget', hProperties: { id: 'safe' } }, children: [{ type: 'text', value: 'custom child' }] },
        { type: 'futureNode', children: [{ type: 'text', value: 'unknown child' }] },
      ],
    } as unknown as Root;

    const screen = render(
      <ASTRenderer
        node={tree}
        theme={lightTheme}
        components={{ h3: Override, inlineCode: Override, widget: Override, unknown: Override }}
      />
    );

    for (const text of ['override heading', 'override code', 'custom child', 'unknown child']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(seen.map((props) => (props.semantic as { type: string }).type)).toEqual([
      'heading', 'inlineCode', 'customNode', 'futureNode',
    ]);
    expect(seen.every((props) => !('className' in props) && !('href' in props))).toBe(true);
  });

  it('keeps raw strings beneath Text and block children beneath View', () => {
    const screen = render(
      <ASTRenderer
        node={{ type: 'root', children: [
          { type: 'paragraph', children: [{ type: 'text', value: 'plain' }] },
          { type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'block' }] }] },
        ] }}
        theme={lightTheme}
      />
    );
    const root = screen.toJSON();
    const walk = (value: unknown, parentType?: string): void => {
      if (typeof value === 'string') expect(parentType).toBe('Text');
      if (!value || typeof value !== 'object') return;
      const item = value as { type?: string; children?: unknown[] };
      item.children?.forEach((child) => walk(child, item.type));
    };
    walk(root);
    expect(screen.UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
  });

  it('resolves reference links and images through sanitized definitions', () => {
    const screen = render(
      <ASTRenderer
        node={{ type: 'root', children: [
          { type: 'paragraph', children: [
            { type: 'linkReference', identifier: 'docs', label: 'docs', referenceType: 'full', children: [{ type: 'text', value: 'Docs' }] },
            { type: 'text', value: ' ' },
            { type: 'imageReference', identifier: 'logo', label: 'logo', referenceType: 'full', alt: 'Logo' },
          ] },
          { type: 'definition', identifier: 'docs', label: 'docs', url: 'https://example.com/docs' },
          { type: 'definition', identifier: 'logo', label: 'logo', url: 'https://example.com/logo.png' },
        ] }}
        theme={lightTheme}
      />
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toBeTruthy();
    expect(screen.getByLabelText('Logo')).toBeTruthy();
  });
});
