import { processColor } from 'react-native';
import type { ThemeConfig, ThemePrimitives } from '../../core/types';
import {
  darkTheme,
  darkThemePrimitives,
  getTheme,
  lightTheme,
  lightThemePrimitives,
  resolveThemePrimitives,
} from '..';

const light: ThemePrimitives = {
  background: '#ffffff', foreground: '#0a0a0a', card: '#ffffff', cardForeground: '#0a0a0a',
  popover: '#ffffff', popoverForeground: '#0a0a0a', primary: '#171717', primaryForeground: '#fafafa',
  secondary: '#f5f5f5', secondaryForeground: '#171717', muted: '#f5f5f5', mutedForeground: '#737373',
  accent: '#f5f5f5', accentForeground: '#171717', destructive: '#e7000b', border: '#e5e5e5',
  input: '#e5e5e5', ring: '#a1a1a1', chart1: '#d4d4d4', chart2: '#737373', chart3: '#525252',
  chart4: '#404040', chart5: '#262626', sidebar: '#fafafa', sidebarForeground: '#0a0a0a',
  sidebarPrimary: '#171717', sidebarPrimaryForeground: '#fafafa', sidebarAccent: '#f5f5f5',
  sidebarAccentForeground: '#171717', sidebarBorder: '#e5e5e5', sidebarRing: '#a1a1a1', radius: 10,
};

const dark: ThemePrimitives = {
  background: '#0a0a0a', foreground: '#fafafa', card: '#171717', cardForeground: '#fafafa',
  popover: '#171717', popoverForeground: '#fafafa', primary: '#e5e5e5', primaryForeground: '#171717',
  secondary: '#262626', secondaryForeground: '#fafafa', muted: '#262626', mutedForeground: '#a1a1a1',
  accent: '#262626', accentForeground: '#fafafa', destructive: '#ff6467',
  border: 'rgba(255, 255, 255, 0.1)', input: 'rgba(255, 255, 255, 0.15)', ring: '#737373',
  chart1: '#d4d4d4', chart2: '#737373', chart3: '#525252', chart4: '#404040', chart5: '#262626',
  sidebar: '#171717', sidebarForeground: '#fafafa', sidebarPrimary: '#1447e6',
  sidebarPrimaryForeground: '#fafafa', sidebarAccent: '#262626', sidebarAccentForeground: '#fafafa',
  sidebarBorder: 'rgba(255, 255, 255, 0.1)', sidebarRing: '#737373', radius: 10,
};

describe('semantic theme primitives', () => {
  it('exports the exact complete native light and dark palettes', () => {
    expect(lightThemePrimitives).toEqual(light);
    expect(darkThemePrimitives).toEqual(dark);
    expect(Object.keys(lightThemePrimitives)).toEqual(Object.keys(light));
    expect(Object.keys(darkThemePrimitives)).toEqual(Object.keys(dark));

    for (const palette of [lightThemePrimitives, darkThemePrimitives]) {
      for (const [name, value] of Object.entries(palette)) {
        if (name !== 'radius') expect(processColor(value)).not.toBeNull();
      }
    }
  });

  it('keeps built-in themes stable and attached to their complete palettes', () => {
    expect(getTheme('light')).toBe(lightTheme);
    expect(getTheme('dark')).toBe(darkTheme);
    expect(lightTheme.primitives).toBe(lightThemePrimitives);
    expect(darkTheme.primitives).toBe(darkThemePrimitives);
  });

  it('normalizes a frozen legacy theme with no primitives without mutation', () => {
    const colors = Object.freeze({ ...lightTheme.colors });
    const legacy = Object.freeze<ThemeConfig>({
      colorScheme: lightTheme.colorScheme,
      colors,
      fonts: Object.freeze({ ...lightTheme.fonts }),
      spacing: Object.freeze({ ...lightTheme.spacing }),
    });

    const normalized = getTheme(legacy);

    expect(normalized).not.toBe(legacy);
    expect('primitives' in legacy).toBe(false);
    expect(Object.keys(normalized.primitives ?? {})).toEqual(Object.keys(lightThemePrimitives));
    expect(normalized.primitives).toEqual(expect.objectContaining({
      background: colors.background,
      foreground: colors.foreground,
      card: colors.codeBackground,
      cardForeground: colors.codeForeground,
      mutedForeground: colors.muted,
      primary: colors.accent,
      accent: colors.link,
      border: colors.border,
      input: colors.border,
      ring: colors.border,
      sidebarBorder: colors.border,
      radius: 10,
      chart1: colors.syntaxKeyword,
    }));
  });

  it('merges partial overrides without mutation', () => {
    const colors = Object.freeze({ ...lightTheme.colors });
    const custom = Object.freeze<ThemeConfig>({
      ...lightTheme,
      colors,
      primitives: Object.freeze({ primary: '#123456', radius: 16 }),
    });

    const resolved = resolveThemePrimitives(custom);
    const normalized = getTheme(custom);

    expect(resolved.primary).toBe('#123456');
    expect(resolved.radius).toBe(16);
    expect(resolved.background).toBe(colors.background);
    expect(resolved.card).toBe(colors.codeBackground);
    expect(resolved.mutedForeground).toBe(colors.muted);
    expect(resolved.sidebarBorder).toBe(colors.border);
    expect(normalized).not.toBe(custom);
    expect(normalized.primitives).toEqual(resolved);
    expect(custom.primitives).toEqual({ primary: '#123456', radius: 16 });
  });
});
