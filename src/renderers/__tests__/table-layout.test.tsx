import React from 'react';
import { render } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import type { Root } from 'mdast';
import { ASTRenderer } from '../ASTRenderer';
import { lightTheme } from '../../themes';

const cell = (value: string) => ({ type: 'tableCell', children: [{ type: 'text', value }] });

describe('native table layout', () => {
  it('shares bounded column widths, GFM alignment, and separators across rows', () => {
    const tree = {
      type: 'root',
      children: [{
        type: 'table',
        align: ['left', 'center', 'right'],
        children: [
          { type: 'tableRow', children: [cell('A'), cell('Centered title'), cell('R')] },
          { type: 'tableRow', children: [cell('short'), cell('  fourteen   chars  '), cell('x'.repeat(50))] },
        ],
      }],
    } as unknown as Root;
    const screen = render(<ASTRenderer node={tree} theme={lightTheme} />);

    const styleForCell = (text: string) => {
      let current = screen.getByText(text).parent;
      while (current && typeof StyleSheet.flatten(current.props.style)?.width !== 'number') current = current.parent;
      return StyleSheet.flatten(current!.props.style);
    };
    const styleForText = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style);
    const headerWidths = ['A', 'Centered title', 'R'].map((text) => styleForCell(text).width);
    const bodyWidths = ['short', '  fourteen   chars  ', 'x'.repeat(50)].map((text) => styleForCell(text).width);

    expect(headerWidths).toEqual([120, 144, 320]);
    expect(bodyWidths).toEqual(headerWidths);
    expect(new Set(headerWidths).size).toBe(3);
    expect(['A', 'short'].map((text) => styleForCell(text).alignItems)).toEqual(['flex-start', 'flex-start']);
    expect(['Centered title', '  fourteen   chars  '].map((text) => styleForCell(text).alignItems)).toEqual(['center', 'center']);
    expect(['R', 'x'.repeat(50)].map((text) => styleForCell(text).alignItems)).toEqual(['flex-end', 'flex-end']);
    expect(['A', 'Centered title', 'R'].map((text) => styleForText(text).textAlign)).toEqual(['left', 'center', 'right']);
    expect(styleForCell('A').borderRightWidth).toBe(1);
    expect(styleForCell('Centered title').borderRightWidth).toBe(1);
    expect(styleForCell('R').borderRightWidth).toBe(0);
    expect(styleForText('A').fontWeight).toBe('600');
    expect(styleForCell('A').backgroundColor).toBe(lightTheme.primitives!.muted);
    const tableSurface = screen.UNSAFE_getAllByType(ScrollView).find(({ props }) => StyleSheet.flatten(props.style)?.borderWidth === 1)!;
    expect(StyleSheet.flatten(tableSurface.props.style)).toMatchObject({ backgroundColor: lightTheme.primitives!.background, borderColor: lightTheme.primitives!.border, borderRadius: 6 });
  });

  it('defaults missing alignment to left', () => {
    const tree = {
      type: 'table', align: [null], children: [
        { type: 'tableRow', children: [cell('Header')] },
        { type: 'tableRow', children: [cell('Body')] },
      ],
    } as unknown as Root;
    const screen = render(<ASTRenderer node={tree} theme={lightTheme} />);
    expect(StyleSheet.flatten(screen.getByText('Body').props.style).textAlign).toBe('left');
  });
});
