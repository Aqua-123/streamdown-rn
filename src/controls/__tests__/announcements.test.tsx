import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Streamdown } from '../../StreamdownRN';

describe('stream announcements', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is opt-in and coalesces rapid updates', () => {
    const announce = jest.fn();
    const capabilities = { announcements: { announce } };
    const screen = render(<Streamdown isAnimating capabilities={capabilities}>One</Streamdown>);
    screen.rerender(<Streamdown isAnimating capabilities={capabilities}>One two</Streamdown>);
    act(() => jest.advanceTimersByTime(500));
    expect(announce).not.toHaveBeenCalled();

    screen.rerender(<Streamdown isAnimating announceStreaming capabilities={capabilities}>One two</Streamdown>);
    screen.rerender(<Streamdown isAnimating announceStreaming capabilities={capabilities}>One two three</Streamdown>);
    screen.rerender(<Streamdown isAnimating announceStreaming capabilities={capabilities}>One two three four</Streamdown>);
    act(() => jest.advanceTimersByTime(500));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('One two three four');
  });

  it('suppresses static announcements and enforces a coalescing floor', () => {
    const announce = jest.fn();
    const capabilities = { announcements: { announce } };
    const screen = render(
      <Streamdown mode="static" isAnimating announceStreaming={{ delayMs: 0 }} capabilities={capabilities}>Static</Streamdown>
    );
    act(() => jest.advanceTimersByTime(500));
    expect(announce).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar')).toBeNull();

    screen.rerender(
      <Streamdown isAnimating announceStreaming={{ delayMs: 0 }} capabilities={capabilities}>Streaming</Streamdown>
    );
    act(() => jest.advanceTimersByTime(249));
    expect(announce).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(announce).toHaveBeenCalledWith('Streaming');
  });
});
