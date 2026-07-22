// parity:1ed14227f8cefe27261b5c2475b6b3a8c1f7d74bcc24ca9e1d96ada382f312da
// parity:b046b22c97b58b8378883d5a14b0d5ef7bfc173f724972e876cdf38f00335229
// parity:e938404a5f28618101e7c21edcde63464002fb3fc36754e59274616c5efa29f6
// parity:4c0c9f4954a0f5b28e696f11bcc0da8df77e6bbedc704e1287bfb6d9a972af95
import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src';
import './image.native';

describe('case-specific native image semantics', () => {
  // parity:2c94a2fe6236b1afebb8f7cbf886309c66a58044fc718aac5b56974b6ea83e6b
  it('renders the supplied image source with its accessible alt label', () => {
    const screen = render(React.createElement(Streamdown, { mode: 'static' }, '![diagram alt](https://example.com/diagram.png)'));
    expect(screen.getByRole('image', { name: 'diagram alt' }).props.source).toEqual({ uri: 'https://example.com/diagram.png' });
  });
});
