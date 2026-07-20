import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown, type NativeComponentProps } from '../../../../src';

describe('native code block semantic context', () => {
  const Capture = ({ semantic }: NativeComponentProps) => React.createElement(Text, { testID: 'code-value' }, semantic.value ?? '');
  const subject = (markdown: string, capture = true) => React.createElement(Streamdown, {
    mode: 'static',
    components: capture ? { pre: Capture } : undefined,
    children: markdown,
  });

  it('provides the code value to the native code component', () => {
    // parity:6050d3793788d41a1ed6ea080f324877fc5e5b7e674fd198dfedeca1c1e0c593
    expect(render(subject('```txt\ntest code\n```')).getByTestId('code-value')).toHaveTextContent('test code');
  });

  it('renders code without requiring a host-provided context', () => {
    // parity:debc17df3307b48562062d4e6b54c44a61a0b710c454e9b898d4908cf30e8021
    expect(render(subject('```txt\ntest code\n```', false)).getByText('test code')).toBeTruthy();
  });

  it('provides an empty value for an empty code block', () => {
    // parity:2a904e3dd1c886a3c000be8d2f13731e35a1773b24d381e46e4e22153471a2b4
    expect(render(subject('```txt\n```')).getByTestId('code-value')).toHaveTextContent('');
  });

  it('updates the code value when markdown changes', () => {
    // parity:97b64926fa809b14cdae5cd9c8960082471e08fd68486414aac46d35b936cc78
    const screen = render(subject('```txt\ninitial\n```'));
    expect(screen.getByTestId('code-value')).toHaveTextContent('initial');
    screen.rerender(subject('```txt\nupdated\n```'));
    expect(screen.getByTestId('code-value')).toHaveTextContent('updated');
  });
});
