import React from 'react';
import { Image, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';

describe('native component memo behavior', () => {
  // parity:857444d1ab25a38fd4f5411f637ead8da7f6eb2d39edfc62519466312bb1eea6
  it('keeps block code outside paragraph text', () => {
    const screen = render(React.createElement(Streamdown, { mode: 'static' }, '```ts\nconst n = 1\n```'));
    expect(screen.getByText('const n = 1')).toBeTruthy();
  });

  // parity:1fb7476f354141e9b6baed917abb23fe459db74cc3a19bb19b5e7e1aba16dcf1
  it('updates inline code when the native override changes', () => {
    const First = () => React.createElement(Text, null, 'first');
    const Second = () => React.createElement(Text, null, 'second');
    const screen = render(React.createElement(Streamdown, { mode: 'static', components: { inlineCode: First } }, '`value`'));
    expect(screen.getByText('first')).toBeTruthy();
    screen.rerender(React.createElement(Streamdown, { mode: 'static', components: { inlineCode: Second } }, '`value`'));
    expect(screen.getByText('second')).toBeTruthy();
  });

  // parity:9d9ebe5be54f72f0fa5b0f6bded8f0c2e6399d74f4f17b246efe68d2419b1df0
  it('updates the native image source', () => {
    const screen = render(React.createElement(Streamdown, { mode: 'static' }, '![alt](https://example.com/a.png)'));
    expect(screen.UNSAFE_getByType(Image).props.source.uri).toContain('/a.png');
    screen.rerender(React.createElement(Streamdown, { mode: 'static' }, '![alt](https://example.com/b.png)'));
    expect(screen.UNSAFE_getByType(Image).props.source.uri).toContain('/b.png');
  });

  // parity:fd839ba8b0169a1ed4258b2179f9dbe8e2642b43b36b4b1071f3cb8073703cda
  it('keeps code readable when native controls are disabled', () => {
    const screen = render(React.createElement(Streamdown, { controls: false, mode: 'static' }, '```\nreadable\n```'));
    expect(screen.getByText('readable')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
