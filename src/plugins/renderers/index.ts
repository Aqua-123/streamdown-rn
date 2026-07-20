import type { ComponentType } from 'react';
import type { CjkPlugin } from '../cjk';
import type { CodeHighlighterPlugin, ThemeInput } from '../code';
import type { MathPlugin } from '../math';
import type { DiagramPlugin } from '../mermaid';

export interface CustomRendererProps {
  code: string;
  language: string;
  isIncomplete: boolean;
  meta?: string;
}

export interface CustomRenderer {
  component: ComponentType<CustomRendererProps>;
  language: string | readonly string[];
}

export interface RendererPlugin {
  name: 'renderers';
  type: 'custom-renderers';
  renderers: readonly CustomRenderer[];
}

export interface PluginConfig {
  cjk?: CjkPlugin;
  code?: CodeHighlighterPlugin;
  /** Accept upstream's renderer array or the optional-subpath plugin wrapper. */
  renderers?: RendererPlugin | readonly CustomRenderer[];
  math?: MathPlugin;
  mermaid?: DiagramPlugin;
}

export interface CodeRenderConfig {
  lineNumbers?: boolean;
  themes?: [ThemeInput, ThemeInput];
}

export function createRendererPlugin(renderers: readonly CustomRenderer[]): RendererPlugin {
  return { name: 'renderers', type: 'custom-renderers', renderers: [...renderers] };
}

export function findCustomRenderer(
  plugin: RendererPlugin | readonly CustomRenderer[] | undefined,
  language: string
): CustomRenderer | undefined {
  const normalized = language.toLowerCase();
  const renderers = Array.isArray(plugin)
    ? plugin as readonly CustomRenderer[]
    : (plugin as RendererPlugin | undefined)?.renderers;
  return renderers?.find(({ language: candidate }) =>
    (Array.isArray(candidate) ? candidate : [candidate]).some((value) => value.toLowerCase() === normalized)
  );
}
