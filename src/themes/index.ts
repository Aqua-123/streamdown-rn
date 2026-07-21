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
import type { ThemeConfig, ThemeColors, ThemePrimitives } from '../core/types';

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

export const darkThemePrimitives: Readonly<ThemePrimitives> = Object.freeze({
  background: '#0a0a0a',
  foreground: '#fafafa',
  card: '#171717',
  cardForeground: '#fafafa',
  popover: '#171717',
  popoverForeground: '#fafafa',
  primary: '#e5e5e5',
  primaryForeground: '#171717',
  secondary: '#262626',
  secondaryForeground: '#fafafa',
  muted: '#262626',
  mutedForeground: '#a1a1a1',
  accent: '#262626',
  accentForeground: '#fafafa',
  destructive: '#ff6467',
  border: 'rgba(255, 255, 255, 0.1)',
  input: 'rgba(255, 255, 255, 0.15)',
  ring: '#737373',
  chart1: '#d4d4d4',
  chart2: '#737373',
  chart3: '#525252',
  chart4: '#404040',
  chart5: '#262626',
  sidebar: '#171717',
  sidebarForeground: '#fafafa',
  sidebarPrimary: '#1447e6',
  sidebarPrimaryForeground: '#fafafa',
  sidebarAccent: '#262626',
  sidebarAccentForeground: '#fafafa',
  sidebarBorder: 'rgba(255, 255, 255, 0.1)',
  sidebarRing: '#737373',
  radius: 10,
});

export const lightThemePrimitives: Readonly<ThemePrimitives> = Object.freeze({
  background: '#ffffff',
  foreground: '#0a0a0a',
  card: '#ffffff',
  cardForeground: '#0a0a0a',
  popover: '#ffffff',
  popoverForeground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  secondary: '#f5f5f5',
  secondaryForeground: '#171717',
  muted: '#f5f5f5',
  mutedForeground: '#737373',
  accent: '#f5f5f5',
  accentForeground: '#171717',
  destructive: '#e7000b',
  border: '#e5e5e5',
  input: '#e5e5e5',
  ring: '#a1a1a1',
  chart1: '#d4d4d4',
  chart2: '#737373',
  chart3: '#525252',
  chart4: '#404040',
  chart5: '#262626',
  sidebar: '#fafafa',
  sidebarForeground: '#0a0a0a',
  sidebarPrimary: '#171717',
  sidebarPrimaryForeground: '#fafafa',
  sidebarAccent: '#f5f5f5',
  sidebarAccentForeground: '#171717',
  sidebarBorder: '#e5e5e5',
  sidebarRing: '#a1a1a1',
  radius: 10,
});

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
  colorScheme: 'dark',
  colors: darkColors,
  primitives: darkThemePrimitives,
  fonts,
  spacing,
};

export const lightTheme: ThemeConfig = {
  colorScheme: 'light',
  colors: lightColors,
  primitives: lightThemePrimitives,
  fonts,
  spacing,
};

/**
 * Get theme by name or return custom theme
 */
export function getTheme(theme: 'dark' | 'light' | ThemeConfig): ThemeConfig {
  if (theme === 'light') return lightTheme;
  if (theme === 'dark') return darkTheme;
  return { ...theme, primitives: resolveThemePrimitives(theme) };
}

/** Resolve a complete semantic palette without mutating the supplied theme. */
export function resolveThemePrimitives(theme: ThemeConfig): ThemePrimitives {
  const { colors } = theme;
  return {
    background: colors.background,
    foreground: colors.foreground,
    card: colors.codeBackground,
    cardForeground: colors.codeForeground,
    popover: colors.codeBackground,
    popoverForeground: colors.codeForeground,
    primary: colors.accent,
    primaryForeground: colors.background,
    secondary: colors.codeBackground,
    secondaryForeground: colors.codeForeground,
    muted: colors.codeBackground,
    mutedForeground: colors.muted,
    accent: colors.link,
    accentForeground: colors.background,
    destructive: colors.syntaxKeyword,
    border: colors.border,
    input: colors.border,
    ring: colors.border,
    chart1: colors.syntaxKeyword,
    chart2: colors.syntaxString,
    chart3: colors.syntaxNumber,
    chart4: colors.syntaxFunction,
    chart5: colors.muted,
    sidebar: colors.codeBackground,
    sidebarForeground: colors.codeForeground,
    sidebarPrimary: colors.link,
    sidebarPrimaryForeground: colors.background,
    sidebarAccent: colors.accent,
    sidebarAccentForeground: colors.background,
    sidebarBorder: colors.border,
    sidebarRing: colors.border,
    radius: 10,
    ...theme.primitives,
  };
}

export const inlineRadius = (radius: number) => Math.max(0, radius - 6);
export const innerRadius = (radius: number) => Math.max(0, radius - 4);
export const controlRadius = (radius: number) => Math.max(0, radius - 2);
export const outerRadius = (radius: number) => radius + 2;

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
  const primitives = resolveThemePrimitives(theme);
  // Helper to conditionally include fontFamily
  const withFont = (fontKey: 'regular' | 'bold' | 'mono') => 
    theme.fonts[fontKey] ? { fontFamily: theme.fonts[fontKey] } : {};

  return {
    body: {
      color: primitives.foreground,
      ...withFont('regular'),
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading2: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading3: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading4: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading5: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    heading6: {
      color: primitives.foreground,
      ...withFont('bold'),
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '600' as const,
      marginTop: 24,
      marginBottom: 8,
    },
    paragraph: {
      color: primitives.foreground,
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
      color: primitives.foreground,
      backgroundColor: primitives.muted,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: inlineRadius(primitives.radius),
    },
    codeBlock: {
      ...withFont('mono'),
      fontSize: 14,
      color: primitives.foreground,
    },
    codeLineNumber: {
      ...withFont('mono'),
      fontSize: 14,
      color: primitives.mutedForeground,
      minWidth: 32,
    },
    link: {
      color: primitives.primary,
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
  const primitives = resolveThemePrimitives(theme);
  return {
    codeBlock: {
      backgroundColor: primitives.sidebar,
      borderRadius: outerRadius(primitives.radius),
      padding: 8,
      marginVertical: theme.spacing.block,
      borderWidth: 1,
      borderColor: primitives.sidebarBorder,
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
      backgroundColor: primitives.muted,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tableCell: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
  };
}
