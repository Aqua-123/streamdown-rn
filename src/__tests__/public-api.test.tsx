import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import StreamdownDefault, {
  Streamdown,
  StreamdownRN,
  darkTheme as publicDarkTheme,
  darkThemePrimitives as publicDarkThemePrimitives,
  getTheme as publicGetTheme,
  lightTheme as publicLightTheme,
  lightThemePrimitives as publicLightThemePrimitives,
  resolveThemePrimitives as publicResolveThemePrimitives,
} from '../index';
import { lightTheme } from '../themes';

describe('Streamdown-compatible native API', () => {
  it('exports semantic themes and their resolver from the package root', () => {
    expect(publicGetTheme('light')).toBe(publicLightTheme);
    expect(publicGetTheme('dark')).toBe(publicDarkTheme);
    expect(publicResolveThemePrimitives(publicLightTheme)).toEqual(publicLightThemePrimitives);
    expect(publicResolveThemePrimitives(publicDarkTheme)).toEqual(publicDarkThemePrimitives);
  });

  it('exports Streamdown as the preferred/default component and keeps the alias', () => {
    expect(StreamdownDefault).toBe(Streamdown);
    expect(StreamdownRN).toBe(Streamdown);

    for (const Component of [StreamdownDefault, Streamdown, StreamdownRN]) {
      expect(render(<Component mode="static">same output</Component>).getByText('same output')).toBeTruthy();
    }
  });

  it('renders every sibling and has no default flex layout ownership', () => {
    const screen = render(<Streamdown mode="static">{'first\n\nsecond'}</Streamdown>);
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
    expect(screen.toJSON()).not.toEqual(expect.objectContaining({ props: expect.objectContaining({ style: expect.objectContaining({ flex: 1 }) }) }));
  });

  it('preserves document-wide siblings in completed streaming blocks', () => {
    const screen = render(
      <Streamdown isComplete>{'Body[^note]\n\n[^note]: Footnote body'}</Streamdown>
    );
    expect(screen.UNSAFE_getAllByType(Text).some((node) =>
      Array.isArray(node.props.children) && node.props.children[0] === 'Body'
    )).toBe(true);
    expect(screen.getByLabelText('Footnote note')).toBeTruthy();
    expect(screen.getByText('Footnote body')).toBeTruthy();
  });

  it('applies filtering and URL policy before native overrides render', () => {
    const seen: Array<Record<string, unknown>> = [];
    const Link = (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      seen.push(props);
      return <Text>{props.children}</Text>;
    };
    const screen = render(
      <Streamdown
        mode="static"
        components={{ a: Link }}
        urlTransform={() => 'javascript:alert(1)'}
      >
        {'[safe text](https://example.com)'}
      </Streamdown>
    );
    expect(screen.getByText('safe text')).toBeTruthy();
    expect(seen).toHaveLength(0);
  });

  it('rerenders when renderer-bearing props change with unchanged markdown', () => {
    const First = ({ children }: { children?: React.ReactNode }) => <Text>first:{children}</Text>;
    const Second = ({ children }: { children?: React.ReactNode }) => <Text>second:{children}</Text>;
    const screen = render(
      <Streamdown mode="static" theme="dark" components={{ p: First }}>same</Streamdown>
    );
    expect(screen.getByText('first:same')).toBeTruthy();
    screen.rerender(
      <Streamdown mode="static" theme={lightTheme} components={{ p: Second }} style={{ padding: 3 }}>same</Streamdown>
    );
    expect(screen.getByText('second:same')).toBeTruthy();
  });

  it('renders declared custom and literal tags through native semantic overrides', () => {
    const Widget = ({ children, semantic }: { children?: React.ReactNode; semantic: { attributes?: Readonly<Record<string, unknown>> } }) => (
      <Text>{String(semantic.attributes?.user_id)}:{children}</Text>
    );
    const screen = render(
      <Streamdown
        mode="static"
        allowedTags={{ mention: ['user_id'] }}
        literalTagContent={['mention']}
        components={{ mention: Widget as never }}
      >
        {'<mention user_id="123">@_literal_ **label**</mention>'}
      </Streamdown>
    );
    expect(screen.getByText('123:@_literal_ **label**')).toBeTruthy();
  });

  it('keeps the existing component registry additive in static mode', () => {
    const registry = {
      get: () => ({ component: ({ title }: { title?: string }) => <Text>{title}</Text> }),
      has: () => true,
      validate: () => ({ valid: true, errors: [] }),
    };
    const screen = render(
      <Streamdown mode="static" componentRegistry={registry}>
        {'[{c:"Card",p:{"title":"registered"}}]'}
      </Streamdown>
    );
    expect(screen.getByText('registered')).toBeTruthy();
  });

  it('reparses completed blocks when remark plugins change', () => {
    const replaceText = () => (tree: { children?: Array<{ children?: Array<{ value?: string }> }> }) => {
      const text = tree.children?.[0]?.children?.[0];
      if (text) text.value = 'plugin output';
    };
    const screen = render(
      <Streamdown isComplete remarkPlugins={[replaceText]}>source</Streamdown>
    );
    expect(screen.getByText('plugin output')).toBeTruthy();
    screen.rerender(<Streamdown isComplete remarkPlugins={[]}>source</Streamdown>);
    expect(screen.getByText('source')).toBeTruthy();
  });

  it('rejects DOM-only props at runtime when JavaScript bypasses the types', () => {
    expect(() => render(React.createElement(Streamdown, {
      children: 'text',
      mode: 'static',
      className: 'web-only',
    } as never))).toThrow(/className.*React Native/i);
  });
});
