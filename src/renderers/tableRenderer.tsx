import React, { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { controlRadius, getBlockStyles, getTextStyles, innerRadius, resolveThemePrimitives } from '../themes';
import { TableControls, defaultTranslations } from '../controls';
import { resolveCapabilities } from '../platform/defaults';
import type { TableData } from '../core/tableSerialization';
import type { RenderContext, RenderNode, SemanticNode } from './rendererTypes';
import {
  composedStyle,
  defaultChildren,
  renderInlineChildren,
  textValue,
  viewStyle,
  withOverride,
} from './semanticComposition';

const TABLE_MIN_COLUMN_WIDTH = 120;
const TABLE_MAX_COLUMN_WIDTH = 320;
const TABLE_CHARACTER_WIDTH = 8;
const TABLE_HORIZONTAL_PADDING = 32;

function normalizedTableText(node: SemanticNode): string {
  return textValue(node).trim().replace(/\s+/g, ' ');
}

function tableColumnWidths(node: SemanticNode, count: number): number[] {
  return Array.from({ length: count }, (_, columnIndex) => {
    const contentWidth = Math.max(0, ...(node.children ?? []).map((row) => {
      const cell = row.children?.[columnIndex];
      return cell ? Array.from(normalizedTableText(cell)).length * TABLE_CHARACTER_WIDTH : 0;
    }));
    return Math.max(TABLE_MIN_COLUMN_WIDTH, Math.min(TABLE_MAX_COLUMN_WIDTH, contentWidth + TABLE_HORIZONTAL_PADDING));
  });
}

export function renderTable(
  node: SemanticNode,
  context: RenderContext,
  renderNode: RenderNode,
  key?: React.Key
): ReactNode {
  const styles = getTextStyles(context.theme);
  const blocks = getBlockStyles(context.theme);
  const primitives = resolveThemePrimitives(context.theme);
  const columnCount = Math.max(0, ...(node.children ?? []).map((row) => row.children?.length ?? 0));
  const columnWidths = tableColumnWidths(node, columnCount);
  const rows = (node.children ?? []).map((row, rowIndex) => {
    const cells = (row.children ?? []).map((cell, cellIndex) => {
      const value = renderInlineChildren(cell, context, renderNode);
      const alignment = node.align?.[cellIndex] ?? 'left';
      const alignItems = alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start';
      return withOverride(cell, context, false, value, (overrides) => (
        <View key={cellIndex} style={composedStyle([rowIndex === 0 ? blocks.tableHeader : blocks.tableCell, {
          width: columnWidths[cellIndex],
          alignItems,
          borderRightWidth: cellIndex < columnCount - 1 ? 1 : 0,
          borderRightColor: primitives.border,
        }], viewStyle(overrides))}><Text style={[styles.body, { width: '100%', fontSize: 14, lineHeight: 20, textAlign: alignment }, rowIndex === 0 ? styles.bold : undefined]}>{defaultChildren(overrides, value)}</Text></View>
      ), cellIndex, rowIndex === 0 ? 'th' : 'td');
    });
    return withOverride(row, context, false, cells, (overrides) => (
      <View key={rowIndex} style={composedStyle({ flexDirection: 'row', borderBottomWidth: rowIndex < (node.children?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: primitives.border }, viewStyle(overrides))}>{defaultChildren(overrides, cells)}</View>
    ), rowIndex);
  });
  const table: TableData = {
    headers: (node.children?.[0]?.children ?? []).map(textValue),
    rows: (node.children ?? []).slice(1).map((row) => (row.children ?? []).map(textValue)),
  };
  return withOverride(node, context, false, rows, (overrides) => {
    const content = <ScrollView horizontal style={composedStyle({ borderWidth: 1, borderColor: primitives.border, borderRadius: innerRadius(primitives.radius), backgroundColor: primitives.background }, viewStyle(overrides))}><View key={key}>{defaultChildren(overrides, rows)}</View></ScrollView>;
    return <TableControls
      key={key}
      table={table}
      capabilities={context.capabilities ?? resolveCapabilities()}
      controls={context.controls}
      translations={context.translations ?? defaultTranslations}
      disabled={context.controlsDisabled ?? context.isStreaming}
      icons={context.icons}
      color={primitives.mutedForeground}
      backgroundColor={primitives.background}
      surfaceColor={primitives.sidebar}
      borderColor={primitives.sidebarBorder}
      popoverColor={primitives.popover}
      popoverForegroundColor={primitives.popoverForeground}
      popoverBorderColor={primitives.border}
      radius={controlRadius(primitives.radius)}
      focusRingColor={primitives.ring}
    >{content}</TableControls>;
  }, key);
}
