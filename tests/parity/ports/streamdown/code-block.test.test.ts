import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { createCodePlugin, plainCodeResult } from '../../../../src/plugins/code';

const clipboard = (writeText = jest.fn(() => ({ status: 'success' as const }))) => ({ writeText });
const stream = (props: React.ComponentProps<typeof Streamdown>, children: string) =>
  React.createElement(Streamdown, { ...props, children });

describe('CodeBlockCopyButton native parity', () => {
  // parity:97405ea996e5ed46a5b9afbfe0a400d46b2ec62bfabad04bb2e8d2d87163512f
  it('shows copied feedback after copying', async () => {
    render(stream({ mode: 'static', capabilities: { clipboard: clipboard() } }, '```javascript\nconst x = 1;\n```'));
    fireEvent.press(screen.getByLabelText('Copy Code'));
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
  });

  // parity:53fbd79993b2634780760732b544e23cf9cb2092bf8b6e5d941a74befe3e7b20
  it('resets copied feedback after the configured timeout', async () => {
    jest.useFakeTimers();
    render(stream({ mode: 'static', capabilities: { clipboard: clipboard() } }, '```javascript\nconst x = 1;\n```'));
    fireEvent.press(screen.getByLabelText('Copy Code'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Copied')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.queryByText('Copied')).toBeNull();
    jest.useRealTimers();
  });
});

describe('CodeBlock trailing newline native parity', () => {
  // parity:f41f8ba9de74b22c24d657c2b8de53ced7f17d36e40d0fe76f5212ce11b12427
  it('does not render a trailing empty row for one terminal newline', () => {
    const plugin = createCodePlugin({ provider: { languages: ['javascript'], highlight: ({ code }) => plainCodeResult(code) } });
    render(stream({ mode: 'static', controls: false, plugins: { code: plugin } }, '```javascript\nconst x = 1;\nconst y = 2;\n\n```'));
    expect(screen.getAllByLabelText(/^Line \d+$/)).toHaveLength(2);
  });

  // parity:a1381313b5e4b0ab0d8f7bba3c9f95e5fc2eebf65d30e51bd9dd0f971d9425ec
  it('does not render trailing empty rows for multiple terminal newlines', () => {
    const plugin = createCodePlugin({ provider: { languages: ['text'], highlight: ({ code }) => plainCodeResult(code) } });
    render(stream({ mode: 'static', controls: false, plugins: { code: plugin } }, '```text\nline1\nline2\n\n\n\n```'));
    expect(screen.getAllByLabelText(/^Line \d+$/)).toHaveLength(2);
  });
});

describe('CodeBlock multi-language native parity', () => {
  // parity:7de188da1b85fbdf91b50cd675a0b30f727db8065e869d48b2113f9848675765
  it('renders different languages simultaneously', () => {
    render(stream({ mode: 'static', controls: false }, '```python\nprint(\'hello\')\n```\n\n```javascript\nconsole.log(\'hello\');\n```'));
    expect(screen.getByText('python')).toBeTruthy();
    expect(screen.getByText('javascript')).toBeTruthy();
    expect(screen.getByText("print('hello')")).toBeTruthy();
    expect(screen.getByText("console.log('hello');")).toBeTruthy();
  });

  // parity:ff0806aecc393c39bbca12d99db9220156db139f12b533d927c21392ee38ebc4
  it('renders multiple instances of the same language independently', () => {
    render(stream({ mode: 'static', controls: false }, '```javascript\nconst x = 1;\n```\n\n```javascript\nconst y = 2;\n```'));
    expect(screen.getAllByText('javascript')).toHaveLength(2);
    expect(screen.getByText('const x = 1;')).toBeTruthy();
    expect(screen.getByText('const y = 2;')).toBeTruthy();
  });

  // parity:d5f8bffffcce332e1b9a4956aff1e885f34529b015786f077048f7f19431f58f
  it('handles rapid sequential language changes without stale tokens', () => {
    const plugin = createCodePlugin({ provider: { languages: ['python', 'javascript', 'typescript'], highlight: ({ code }) => plainCodeResult(code) } });
    const props = { mode: 'static' as const, controls: false, plugins: { code: plugin } };
    const { rerender } = render(stream(props, '```python\nprint(\'Python\')\n```'));
    rerender(stream(props, '```javascript\nconsole.log(\'JS\')\n```'));
    rerender(stream(props, '```typescript\nconst x: string = \'TS\'\n```'));
    expect(screen.getByText('typescript')).toBeTruthy();
    expect(screen.getByText("const x: string = 'TS'")).toBeTruthy();
    expect(screen.queryByText("print('Python')")).toBeNull();
  });

  // parity:17302f388f9efe8c37426456705e8b5f999531602356049a252fd9e1bf84bcf4
  it('exposes native code-block semantics through language labels and controls', () => {
    render(stream({ mode: 'static', capabilities: { clipboard: clipboard(), files: { save: jest.fn() } } }, '```javascript\nconst x = 1;\n```'));
    expect(screen.getByText('javascript')).toBeTruthy();
    expect(screen.getByLabelText('Copy Code')).toBeTruthy();
    expect(screen.getByLabelText('Download file')).toBeTruthy();
  });

  // parity:e10d8715e75beb566dc04455b29c182f7e3412e1aafe89848c6105ca748d51a0
  it('keeps a large streamed block readable through repeated updates', () => {
    const final = '<section>' + 'streamed native code '.repeat(1000) + '</section>';
    const props = { isAnimating: true, controls: false };
    const { rerender } = render(stream(props, '```html\n' + final.slice(0, 2000)));
    for (let end = 4000; end < final.length; end += 4000) {
      rerender(stream(props, '```html\n' + final.slice(0, end)));
    }
    rerender(stream(props, '```html\n' + final + '\n```'));
    expect(screen.getByText(final)).toBeTruthy();
  });
});
