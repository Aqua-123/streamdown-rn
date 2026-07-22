import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';
import { defaultTranslations, resolveTranslations } from '../../../../src/controls';

describe('adapted explicit native translations', () => {
  // parity:f4227ca1b640d9ea8af0751b21c0de7000740c8866c31fffe4156269941c9b4c
  it('uses a custom translation for the code block download button', () => {
    const screen = render(React.createElement(Streamdown, {
      mode: 'static', translations: { downloadFile: 'Datei herunterladen' },
      capabilities: { files: { save: jest.fn() } }, children: '```js\ncode\n```',
    }));
    expect(screen.getByRole('button', { name: 'Datei herunterladen' })).toBeTruthy();
  });

  it('resolves a partial translation while retaining defaults for omitted keys', () => {
    expect(resolveTranslations({ copyCode: 'Kopieren' })).toMatchObject({
      copyCode: 'Kopieren', downloadFile: defaultTranslations.downloadFile,
    });
  });

  // parity:42987c7e9722fea2f51dcbe3acd27fc30ff46e18f084531aff841be50d12ec84
  it('provides custom values through the native translations provider contract', () => {
    const translations = resolveTranslations({ retryImage: 'Erneut versuchen' });
    expect(translations.retryImage).toBe('Erneut versuchen');
    expect(translations.copyCode).toBe(defaultTranslations.copyCode);
  });

  // parity:b20c3eef525f1ec3386ba12eeaa0d4336bb46781736bb55f85dd0b61a7b7010a
  it('applies custom labels to code and table native controls', () => {
    const code = render(React.createElement(Streamdown, {
      mode: 'static', translations: { downloadFile: 'Datei herunterladen' },
      capabilities: { files: { save: jest.fn() } },
      children: '```js\ncode\n```',
    }));
    expect(code.getByRole('button', { name: 'Datei herunterladen' })).toBeTruthy();

    const table = render(React.createElement(Streamdown, {
      mode: 'static', translations: { copyTableAsMarkdown: 'Tabelle kopieren' },
      capabilities: { clipboard: { writeText: jest.fn() } },
      children: '| A |\n| - |\n| B |',
    }));
    fireEvent.press(table.getByRole('button', { name: 'Copy table' }));
    expect(table.getByRole('menuitem', { name: 'Tabelle kopieren' })).toBeTruthy();
  });

  // parity:64afc5ac1551f329b479216f2562c07fc88fdb0ef7379010e66fa52dc509a00d
  it('uses the custom image failure label', () => {
    const result = render(React.createElement(Streamdown, {
      mode: 'static', translations: { imageNotAvailable: 'Bild nicht verfügbar' },
      children: '![test](https://example.com/image.png)',
    }));
    fireEvent(result.getByRole('image', { name: 'test' }), 'error');
    expect(result.getByText('Bild nicht verfügbar')).toBeTruthy();
  });

  // parity:594c4d0549c19a86b5d51e59b1862cad3e1bb86d0724856693ef98f9636fbf1a
  it('exposes defaults directly and resolves partial host values without context', () => {
    expect(resolveTranslations()).toBeTruthy();
    expect(resolveTranslations().copyCode).toBe(defaultTranslations.copyCode);
    expect(resolveTranslations({ copyCode: 'Custom Copy' })).toMatchObject({
      copyCode: 'Custom Copy',
      downloadFile: defaultTranslations.downloadFile,
    });
  });
});
