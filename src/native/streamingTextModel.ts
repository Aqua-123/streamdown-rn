import {
  processColor,
  StyleSheet,
  type ProcessedColorValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { sanitizeResourceURL } from '../core/security';
import { transformResourceURL } from '../core/security/treePolicy';
import type { RenderContext, SemanticNode } from '../renderers/rendererTypes';

export interface NativeTextRun {
  start: number;
  end: number;
  color?: ProcessedColorValue;
  backgroundColor?: ProcessedColorValue;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  underline?: boolean;
  strikethrough?: boolean;
  url?: string;
}

export interface NativeAnimationRange {
  start: number;
  end: number;
  delay: number;
}

export interface NativeStreamingTextModel {
  text: string;
  runs: NativeTextRun[];
  animationRanges: NativeAnimationRange[];
}

type SegmenterLike = {
  segment(value: string): Iterable<{ segment: string; index: number }>;
};

function fallbackGraphemes(value: string): Array<{ segment: string; index: number }> {
  const output: Array<{ segment: string; index: number }> = [];
  let offset = 0;
  let regionalCount = 0;
  for (const point of value) {
    const mark = /\p{Mark}/u.test(point);
    const code = point.codePointAt(0) ?? 0;
    const variation = code >= 0xfe00 && code <= 0xfe0f;
    const modifier = code >= 0x1f3fb && code <= 0x1f3ff;
    const regional = code >= 0x1f1e6 && code <= 0x1f1ff;
    const previous = output[output.length - 1];
    const joins = Boolean(previous && (mark || variation || modifier || point === '\u200d' || previous.segment.endsWith('\u200d') || (regional && regionalCount % 2 === 1)));
    if (joins) previous!.segment += point;
    else output.push({ segment: point, index: offset });
    regionalCount = regional ? regionalCount + 1 : 0;
    offset += point.length;
  }
  return output;
}

export function segmentAnimationText(value: string, separator: 'word' | 'char'): Array<{ start: number; end: number }> {
  if (separator === 'word') {
    return Array.from(value.matchAll(/\S+/gu), (match) => ({ start: match.index, end: match.index + match[0].length }));
  }
  const IntlWithSegmenter = Intl as typeof Intl & {
    Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => SegmenterLike;
  };
  const segments = IntlWithSegmenter.Segmenter
    ? Array.from(new IntlWithSegmenter.Segmenter(undefined, { granularity: 'grapheme' }).segment(value))
    : fallbackGraphemes(value);
  return segments
    .filter(({ segment }) => !/^\s+$/u.test(segment))
    .map(({ segment, index }) => ({ start: index, end: index + segment.length }));
}

export function clampToGraphemeBoundary(value: string, offset: number): number {
  if (offset <= 0) return 0;
  if (offset >= value.length) return value.length;
  const containing = segmentAnimationText(value, 'char').find(({ start, end }) => start < offset && end > offset);
  return containing?.start ?? offset;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function colorValue(value: TextStyle['color']): ProcessedColorValue | null | undefined {
  if (value === undefined) return undefined;
  return processColor(value) ?? null;
}

export function serializeTextStyle(style: StyleProp<TextStyle>): Omit<NativeTextRun, 'start' | 'end'> | null {
  const flat = StyleSheet.flatten(style) ?? {};
  const color = colorValue(flat.color);
  const backgroundColor = colorValue(flat.backgroundColor);
  if (color === null || backgroundColor === null) return null;
  const decoration = typeof flat.textDecorationLine === 'string' ? flat.textDecorationLine : '';
  return {
    color,
    backgroundColor,
    fontFamily: stringValue(flat.fontFamily),
    fontSize: numberValue(flat.fontSize),
    fontWeight: flat.fontWeight === undefined ? undefined : String(flat.fontWeight),
    fontStyle: flat.fontStyle === 'italic' ? 'italic' : flat.fontStyle === 'normal' ? 'normal' : undefined,
    lineHeight: numberValue(flat.lineHeight),
    textAlign: flat.textAlign,
    underline: decoration.includes('underline') || undefined,
    strikethrough: decoration.includes('line-through') || undefined,
  };
}

export function nativeLayoutStyle(style: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  return {
    alignSelf: 'stretch',
    marginTop: flat.marginTop,
    marginRight: flat.marginRight,
    marginBottom: flat.marginBottom,
    marginLeft: flat.marginLeft,
    marginVertical: flat.marginVertical,
    marginHorizontal: flat.marginHorizontal,
    width: flat.width,
    maxWidth: flat.maxWidth,
    minWidth: flat.minWidth,
  };
}

const ELEMENT_FOR_NODE: Readonly<Record<string, string>> = {
  paragraph: 'p', strong: 'strong', emphasis: 'em', delete: 'del', inlineCode: 'code',
  link: 'a', linkReference: 'a', break: 'br', image: 'img', imageReference: 'img',
  footnoteReference: 'sup',
};

function hasOverride(node: SemanticNode, context: RenderContext): boolean {
  const element = node.type === 'heading' ? `h${node.depth}` : ELEMENT_FOR_NODE[node.type];
  return Boolean(
    (node.type === 'inlineCode' && context.components?.inlineCode)
    || (element && (context.components?.[element] || context.slots?.[element as keyof typeof context.slots]))
    || (node.data?.hName && context.components?.[node.data.hName])
    || (!element && context.components?.unknown)
  );
}

function appendRun(runs: NativeTextRun[], start: number, end: number, style: Omit<NativeTextRun, 'start' | 'end'> | null): boolean {
  if (!style) return false;
  if (end > start) runs.push({ start, end, ...style });
  return true;
}

export function createNativeStreamingTextModel(
  node: SemanticNode,
  context: RenderContext,
  baseStyle: StyleProp<TextStyle>
): NativeStreamingTextModel | null {
  if (hasOverride(node, context)) return null;
  const base = serializeTextStyle(baseStyle);
  if (!base) return null;
  let text = '';
  const runs: NativeTextRun[] = [];
  const animationRanges: NativeAnimationRange[] = [];
  let animationOrdinal = 0;

  const visit = (current: SemanticNode, inheritedSkipAnimation = false): boolean => {
    if (hasOverride(current, context)) return false;
    const start = text.length;
    if (current.type === 'text') {
      const value = current.value ?? '';
      text += value;
      const sourceStart = current.position?.start.offset;
      const from = context.animation?.from;
      if (!inheritedSkipAnimation && sourceStart !== undefined && from !== undefined && sourceStart + value.length > from) {
        const localFrom = clampToGraphemeBoundary(value, Math.max(0, from - sourceStart));
        const suffix = value.slice(localFrom);
        for (const segment of segmentAnimationText(suffix, context.animation!.sep)) {
          animationRanges.push({
            start: start + localFrom + segment.start,
            end: start + localFrom + segment.end,
            delay: animationOrdinal++ * context.animation!.stagger,
          });
        }
      }
      return true;
    }
    if (current.type === 'break') {
      text += '\n';
      return true;
    }
    if (current.type === 'inlineCode') {
      text += current.value ?? '';
      return appendRun(runs, start, text.length, serializeTextStyle(context.textStyles.code));
    }
    if (current.type === 'footnoteReference') {
      if (!(context.suppressEmptyFootnotes && current.identifier && context.emptyFootnotes.has(current.identifier))) {
        text += `[${current.identifier}]`;
      }
      return true;
    }
    if (current.type === 'image' || current.type === 'imageReference') {
      text += current.alt ? `[Image: ${current.alt}]` : '';
      return true;
    }
    if (current.type === 'inlineMath' || current.type === 'customTag' || (!current.children && current.type !== 'root')) return false;

    const skipAnimation = inheritedSkipAnimation;
    for (const child of current.children ?? []) {
      if (!visit(child, skipAnimation)) return false;
    }
    const end = text.length;
    if (current.type === 'strong' && !appendRun(runs, start, end, serializeTextStyle(context.textStyles.bold))) return false;
    if (current.type === 'emphasis' && !appendRun(runs, start, end, serializeTextStyle(context.textStyles.italic))) return false;
    if (current.type === 'delete' && !appendRun(runs, start, end, serializeTextStyle(context.textStyles.strikethrough))) return false;
    if (current.type === 'link' || current.type === 'linkReference') {
      const definition = current.type === 'linkReference' && current.identifier ? context.definitions.get(current.identifier) : undefined;
      const raw = current.type === 'link' ? current.url : definition?.url;
      const safe = raw
        ? current.type === 'link'
          ? sanitizeResourceURL(raw, 'link', context.securityPolicy)
          : transformResourceURL(raw, 'link', context.securityPolicy ?? {}, current)
        : null;
      if (safe) {
        const linkStyle = serializeTextStyle(context.textStyles.link);
        if (!linkStyle) return false;
        runs.push({ start, end, ...linkStyle, url: safe });
      }
    }
    return true;
  };

  if (!visit(node)) return null;
  if (text.length) runs.unshift({ start: 0, end: text.length, ...base });
  return { text, runs, animationRanges };
}
