import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { defaultIcons } from '../../../../src/controls';

const markdown = '```txt\nhello\n```';
const capabilities = { clipboard: { writeText: jest.fn() }, files: { save: jest.fn() } };

describe('adapted native icon props', () => {
  // parity:e6050ffd777db1f6cddd713334d753aa03c97ea1b5b7b1682d1883013f19aa87
  // parity:15beb43cfce8edefe6d24a9af291a7a8f92a184beeb01ab32520bd0f48c22643
  it('uses exported defaults when no icon map is supplied', () => {
    expect(React.isValidElement(defaultIcons.copy)).toBe(true);
    expect(React.isValidElement(defaultIcons.download)).toBe(true);
    const result = render(React.createElement(Streamdown, { mode: 'static', children: markdown, capabilities }));
    expect(result.queryByText('⧉')).toBeNull();
    expect(result.queryByText('↓')).toBeNull();
    expect(result.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Download file' })).toBeTruthy();
  });

  // parity:9077847ae2db8e4b02b6ff877fd5812541b92e111d035e22d1433ca32a514203
  // parity:1800793f5b977186616b0f249bf0eb91aa0ebc0f48e382963138fca86840a1f0
  it('recalculates native icons when the prop changes to or from undefined', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static', children: markdown,
      capabilities,
      icons: { copy: React.createElement(Text, { testID: 'custom-copy' }, 'C') },
    }));
    expect(result.getByTestId('custom-copy')).toBeTruthy();
    result.rerender(React.createElement(Streamdown, { mode: 'static', children: markdown, capabilities }));
    expect(result.queryByTestId('custom-copy')).toBeNull();
    expect(result.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
    result.rerender(React.createElement(Streamdown, {
      mode: 'static', children: markdown,
      capabilities,
      icons: { copy: React.createElement(Text, { testID: 'next-copy' }, 'N') },
    }));
    expect(result.getByTestId('next-copy')).toBeTruthy();
  });

  // parity:e5cfb30874db240fbf5ec53205c2190350c6c2bd6becfcbc44b21d5d16389abf
  // parity:e76aa73987da4e6abbeb9fd4da680fa4ef41dca1b5fbc0e0f73fc46aa89b47ff
  it('handles icon key-count changes and stable references without losing defaults', () => {
    const icons = { copy: React.createElement(Text, { testID: 'copy' }, 'C') };
    const result = render(React.createElement(Streamdown, { mode: 'static', children: markdown, icons, capabilities }));
    result.rerender(React.createElement(Streamdown, { mode: 'static', children: markdown, icons, capabilities }));
    expect(result.getByTestId('copy')).toBeTruthy();
    result.rerender(React.createElement(Streamdown, {
      mode: 'static', children: markdown,
      capabilities,
      icons: { ...icons, download: React.createElement(Text, { testID: 'download' }, 'D') },
    }));
    expect(result.getByTestId('copy')).toBeTruthy();
    expect(result.getByTestId('download')).toBeTruthy();
  });
});
