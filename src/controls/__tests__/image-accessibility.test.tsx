import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Streamdown } from '../../StreamdownRN';

describe('native images and semantics', () => {
  // parity:c00225c9df84f3ccf47ca8696c01313c185736676fb43444286e78bdf00e3b9d
  // parity:60ee9eb9791bf911e0078d1222a09c532c07f9a3ef0702cfe455d38bba0ed5de
  it('loads, fails, retries, and keeps meaningful alt text', () => {
    const screen = render(<Streamdown mode="static" capabilities={{ files: { save: jest.fn() } }}>![Chart](https://example.com/chart.png)</Streamdown>);
    const image = screen.getByRole('image', { name: 'Chart' });
    expect(image.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ aspectRatio: expect.any(Number) })]));
    fireEvent(image, 'load');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    fireEvent(image, 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Retry image' }));
    expect(screen.getByRole('image', { name: 'Chart' })).toBeTruthy();

    screen.rerender(<Streamdown mode="static">![New chart](https://example.com/new.png)</Streamdown>);
    expect(screen.getByRole('image', { name: 'New chart' })).toBeTruthy();
  });

  it('marks empty-alt images decorative and unsafe images inert', () => {
    const decorative = render(<Streamdown mode="static">![](https://example.com/pixel.png)</Streamdown>);
    expect(decorative.queryByRole('image')).toBeNull();

    const unsafe = render(<Streamdown mode="static">![Bad](http://example.com/image.png)</Streamdown>);
    expect(unsafe.queryByRole('image')).toBeNull();
    expect(unsafe.getByText('[Image: Bad]')).toBeTruthy();
  });

  it('exposes headings, task state, RTL, and streaming busy state', () => {
    const screen = render(
      <Streamdown mode="streaming" isAnimating dir="rtl">{'# שלום\n\n- [x] בוצע'}</Streamdown>
    );
    expect(screen.getByRole('header', { name: 'שלום' })).toBeTruthy();
    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('progressbar', { name: 'Streaming response' }).props.accessibilityState).toMatchObject({ busy: true });
  });
});
