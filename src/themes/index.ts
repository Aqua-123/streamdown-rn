/**
 * Theme Configurations for Streamdown-RN
 * 
 * Dark and light themes with consistent styling.
 * Optimized for readability and streaming performance.
 * 
 * Font-agnostic: Uses platform defaults for text, allowing host apps
 * to set their own fonts. Only monospace is specified for code blocks.
 */

import { Platform } from 'react-native';
import type { ThemeConfig, ThemeColors } from '../core/types';

// ============================================================================
// Color Palettes
// ============================================================================

const darkColors: ThemeColors = {
  background: '#020817',
  foreground: '#f8fafc',
  muted: '#94a3b8',
  accent: '#f8fafc',
  codeBackground: '#1e293b',
  codeForeground: '#f8fafc',
  border: '#1e293b',
  link: '#f8fafc',
  // Syntax highlighting (GitHub Dark style)
  syntaxDefault: '#c9d1d9',
  syntaxKeyword: '#ff7b72',
  syntaxString: '#a5d6ff',
  syntaxNumber: '#79c0ff',
  syntaxComment: '#8b949e',
  syntaxFunction: '#d2a8ff',
  syntaxClass: '#ffa657',
  syntaxOperator: '#ff7b72',
};

const lightColors: ThemeColors = {
  background: '#ffffff',
  foreground: '#09090b',
  muted: '#71717a',
  accent: '#0f172a',
  codeBackground: '#fafafa',
  codeForeground: '#09090b',
  border: '#e4e4e7',
  link: '#0f172a',
  // Syntax highlighting (GitHub Light style)
  syntaxDefault: '#24292e',
  syntaxKeyword: '#d73a49',
  syntaxString: '#032f62',
  syntaxNumber: '#005cc5',
  syntaxComment: '#6a737d',
  syntaxFunction: '#6f42c1',
  syntaxClass: '#e36209',
  syntaxOperator: '#d73a49',
};

// ============================================================================
// Font Configuration
// ============================================================================

// Font-agnostic: undefined lets React Native use platform defaults
// This allows host apps to set fonts at the root level and have them inherited
// Only monospace is specified for code blocks
const fonts = {
  regular: undefined as string | undefined,
  bold: undefined as string | undefined,
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) as string,
};

// ============================================================================
// Spacing
// ============================================================================

const spacing = {
  block: 16,    // Streamdown's my-4 block rhythm
  inline: 4,    // Inline element spacing
  indent: 24,   // Streamdown's nested-list indentation
};

// ============================================================================
// Theme Exports
// ============================================================================

export const darkTheme: ThemeConfig = {
  colors: darkColors,
  fonts,
  spacing,
};

export const lightTheme: ThemeConfig = {
  colors: lightColors,
  fonts,
  spacing,
};

/**
 * Get theme by name or return custom theme
 */
export function getTheme(theme: 'dark' | 'light' | ThemeConfig): ThemeConfig {
  if (typeof theme === 'object') return theme;
  return theme === 'light' ? lightTheme : darkTheme;
}

// ============================================================================
// Style Generators (used by block renderers)
// ============================================================================

/**
 * Generate text styles for a theme
 * 
 * Font-agnostic: Only applies fontFamily when explicitly set in theme.
 * This allows host apps to set fonts at the root level and have them inherited.
 */
export function getTextStyles(theme: ThemeConfig) {
  // Helper to conditionally include fontFamily
  const withFont = (fontKey: 'regular' | 'bold' | 'mono') => 
    theme.fonts[fontKey] ? { fontFamily: theme.fonts[fontKey] } : {};

  return {
    body: {
      color: theme.colors.foreground,
      ...withFont('regular'),
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading2: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading3: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading4: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading5: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading6: {
      color: theme.colors.foreground,
      ...withFont('bold'),
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    paragraph: {
      color: theme.colors.foreground,
      ...withFont('regular'),
      fontSize: 16,
      lineHeight: 24,
      marginBottom: theme.spacing.block,
    },
    bold: {
      ...withFont('bold'),
      fontWeight: '600' as const,
    },
    italic: {
      fontStyle: 'italic' as const,
      // No fontFamily - inherits from parent, allowing platform italic to work
    },
    code: {
      ...withFont('mono'),
      fontSize: 14,
      color: theme.colors.codeForeground,
      backgroundColor: theme.colors.codeBackground,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    link: {
      color: theme.colors.link,
      fontWeight: '500' as const,
      textDecorationLine: 'underline' as const,
    },
    strikethrough: {
      textDecorationLine: 'line-through' as const,
    },
  };
}

/**
 * Generate block container styles for a theme
 */
export function getBlockStyles(theme: ThemeConfig) {
  return {
    codeBlock: {
      backgroundColor: theme.colors.codeBackground,
      borderRadius: 12,
      padding: 8,
      marginVertical: theme.spacing.block,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.border,
      paddingLeft: 16,
      marginVertical: theme.spacing.block,
    },
    list: {
      marginBottom: theme.spacing.block,
    },
    listItem: {
      paddingLeft: theme.spacing.indent,
      marginBottom: theme.spacing.inline,
    },
    horizontalRule: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 24,
    },
    tableHeader: {
      backgroundColor: theme.colors.codeBackground,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tableCell: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
  };
}
