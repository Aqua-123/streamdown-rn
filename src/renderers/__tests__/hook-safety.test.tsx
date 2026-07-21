import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ComponentRegistry } from '../../core/types';
import { lightTheme } from '../../themes';
import { ASTRenderer, ComponentBlock } from '../ASTRenderer';

const validRegistry: ComponentRegistry = {
  get: () => ({ component: () => <Text>rendered</Text> }),
  has: () => true,
  validate: () => ({ valid: true, errors: [] }),
};

describe('registry component hook safety', () => {
  it('supports callback changes across rerenders and prefers a direct callback', async () => {
    const directOnError = jest.fn();
    const contextualOnError = jest.fn();
    const props = {
      componentName: 'Card',
      componentRegistry: validRegistry,
      props: {},
      theme: lightTheme,
    };

    const withCallback = render(<ComponentBlock {...props} onError={directOnError} />);
    expect(() => withCallback.rerender(<ComponentBlock {...props} />)).not.toThrow();

    const withoutCallback = render(<ComponentBlock {...props} />);
    expect(() => withoutCallback.rerender(
      <ComponentBlock {...props} onError={directOnError} />
    )).not.toThrow();

    const nestedRegistry: ComponentRegistry = {
      get: (name) => name === 'Outer'
        ? { component: () => (
          <ComponentBlock
            componentName="Inner"
            componentRegistry={nestedRegistry}
            props={{}}
            theme={lightTheme}
            onError={directOnError}
          />
        ) }
        : { component: () => <Text>never</Text> },
      has: () => true,
      validate: (name) => name === 'Inner'
        ? { valid: false, errors: ['invalid'] }
        : { valid: true, errors: [] },
    };

    render(
      <ASTRenderer
        node={{ type: 'paragraph', children: [{ type: 'text', value: '[{c:"Outer",p:{}}]' }] }}
        theme={lightTheme}
        componentRegistry={nestedRegistry}
        onError={contextualOnError}
      />
    );

    await waitFor(() => expect(directOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid props for Inner: invalid' }),
      'Inner'
    ));
    expect(contextualOnError).not.toHaveBeenCalled();
  });
});
