import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { renderedText } from './native-cluster-helpers';

const Tag = ({ children, semantic }: { children?: React.ReactNode; semantic: { attributes?: Readonly<Record<string, unknown>> } }) =>
  React.createElement(Text, { testID: 'tag' }, `${String(semantic.attributes?.allowed ?? semantic.attributes?.note_id ?? '')}:${children}`);

describe('adapted native custom tags', () => {
  // parity:e883f2cb2d2121d2a74af1c0a54b6b98de31c37ea908e25f70c13629201cff78
  it('renders custom tags when allowedTags is provided', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { custom: [] }, components: { custom: Tag as never }, children: '<custom>visible</custom>',
    }));
    expect(result.getByTestId('tag')).toHaveTextContent(/visible/);
  });

  // parity:9611692806b942d584d51c063f136a5a3f0f1ba31c0b8a18dae7b82d03fc1c06
  it('handles an empty allowedTags object without activating custom HTML', () => {
    const result = render(React.createElement(Streamdown, { mode: 'static', allowedTags: {}, children: 'safe text' }));
    expect(result.getByText('safe text')).toBeTruthy();
  });

  // parity:ea2a80f3a67420eacaaf42d12456eab24bdc27b827d1332cdfbee7b02c0cf0d4
  it('strips attributes not listed for the declared custom tag', () => {
    let attributes: Readonly<Record<string, unknown>> | undefined;
    const Capture = ({ children, semantic }: Parameters<typeof Tag>[0]) => {
      attributes = semantic.attributes;
      return React.createElement(Text, null, children);
    };
    render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { custom: ['allowed'] }, components: { custom: Capture as never },
      children: '<custom allowed="yes" blocked="no">world</custom>',
    }));
    expect(attributes).toEqual({ allowed: 'yes' });
  });

  // parity:07f5cfb50f49a5e7689e3a4b5300236304f225cb9181b42e0d0e7ed146221897
  it('renders declared custom tags in streaming mode', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'streaming', allowedTags: { custom: [] }, components: { custom: Tag as never },
      children: '<custom>streamed</custom>',
    }));
    expect(result.getByTestId('tag')).toHaveTextContent(':streamed');
  });

  // parity:f18500f10378eb63e6027cacca8ca574f9e992903a682f511ba07177bac4811b
  it('renders multiple declared custom tags independently', () => {
    const First = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'first-only' }, children);
    const Second = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'second-only' }, children);
    const result = render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { first: [], second: [] }, components: { first: First as never, second: Second as never },
      children: '<first>one</first><second>two</second>',
    }));
    expect(result.getByTestId('first-only')).toHaveTextContent('one');
    expect(result.getByTestId('second-only')).toHaveTextContent('two');
  });

  // parity:24b9e720b0c488578903328310bf93025e24d6d312caaa42bbb4ed25ef0239b9
  it('preserves blank lines inside declared custom tags', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { custom: [] }, components: { custom: Tag as never },
      children: '<custom>first\n\nsecond</custom>',
    }));
    expect(JSON.stringify(result.toJSON())).toMatch(/first.*second/s);
  });

  // parity:fafa776c852bf14853de5e084a99ddaf239cd0f9afdc8491286dd6890e5500f7
  it('leaves parsed tag content unchanged when literalTagContent is empty', () => {
    expect(renderedText('<custom>_parsed_</custom>', {
      allowedTags: { custom: [] }, literalTagContent: [],
    })).toContain('parsed');
  });

  // parity:890b718f590732a317206a9f85e9afe1f656e059feeb0949f5d3719b082f2e42
  it('applies literal tag content while streaming', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'streaming', allowedTags: { custom: [] }, literalTagContent: ['custom'],
      components: { custom: Tag as never }, children: '<custom>_literal_</custom>',
    }));
    expect(result.getByTestId('tag')).toHaveTextContent(/_literal_/);
  });

  // parity:6d3379b598eceb1e9f548c0856544b1d65ead922918b86ce4c810b643d6cd1da
  it('materializes declared tags and exposes only declared attributes', () => {
    const seen: Array<Readonly<Record<string, unknown>> | undefined> = [];
    const Capture = ({ children, semantic }: Parameters<typeof Tag>[0]) => {
      seen.push(semantic.attributes);
      return React.createElement(Text, { testID: 'custom' }, children);
    };
    const result = render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { custom: ['allowed'] }, components: { custom: Capture as never },
      children: '<custom allowed="yes" blocked="no">world</custom>',
    }));
    expect(result.getByTestId('custom')).toHaveTextContent('world');
    expect(seen).toEqual([{ allowed: 'yes' }]);
  });

  // parity:e5e9806138f9dd90c1d3cd35c30be168294ee167863427c4fa9821b460df2910
  it('keeps undeclared HTML inert and an empty declaration harmless', () => {
    const Undeclared = () => React.createElement(Text, { testID: 'unexpected' }, 'bad');
    const inert = render(React.createElement(Streamdown, {
      mode: 'static', components: { custom: Undeclared as never }, children: 'Hello <custom>world</custom>',
    }));
    expect(inert.queryByTestId('unexpected')).toBeNull();
    expect(JSON.stringify(inert.toJSON())).toContain('world');
    expect(render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: {}, children: 'Hello world',
    })).getByText('Hello world')).toBeTruthy();
  });

  it('supports streaming, multiple tags, and blank-line tag content', () => {
    const First = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'first' }, children);
    const Second = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'second' }, children);
    const result = render(React.createElement(Streamdown, {
      mode: 'streaming', allowedTags: { first: [], second: [] },
      components: { first: First as never, second: Second as never },
      children: '<first>one\n\nmore</first>\n\n<second>two</second>',
    }));
    expect(result.getByTestId('first')).toBeTruthy();
    expect(JSON.stringify(result.toJSON())).toMatch(/one.*more/s);
    expect(result.getByTestId('second')).toHaveTextContent('two');
  });

  // parity:a0b136bb9f126ed3f3b4df5fd9fed5f9369598be98a8e54074a0ed47023b66ca
  it('applies literal parsing only to selected tags in static and streaming modes', () => {
    const Literal = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'literal' }, children);
    const Parsed = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'parsed' }, children);
    const Em = ({ children }: { children?: React.ReactNode }) => React.createElement(Text, { testID: 'emphasis' }, children);
    const selected = render(React.createElement(Streamdown, {
      mode: 'static', allowedTags: { literal: [], parsed: [] }, literalTagContent: ['literal'],
      components: { literal: Literal as never, parsed: Parsed as never, em: Em as never },
      children: '<literal>_raw_</literal> <parsed>_formatted_</parsed>',
    }));
    expect(selected.getByTestId('literal')).toHaveTextContent('_raw_');
    expect(selected.getByTestId('emphasis')).toHaveTextContent('formatted');

    const empty = render(React.createElement(Streamdown, {
      mode: 'streaming', allowedTags: { parsed: [] }, literalTagContent: [],
      components: { parsed: Parsed as never, em: Em as never }, children: '<parsed>_formatted_</parsed>',
    }));
    expect(empty.getByTestId('emphasis')).toBeTruthy();
  });

  // parity:07558f3119c06dd61e9094d43e818e14732223b85a3f0d347f918d36ed04bc45
  it('rejects DOM rehype plugins rather than bypassing the native policy', () => {
    expect(() => render(React.createElement(Streamdown, {
      mode: 'static', children: 'text', rehypePlugins: [() => undefined],
    } as never))).toThrow(/rehypePlugins.*DOM-only.*React Native/i);
  });
});
