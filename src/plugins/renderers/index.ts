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
  renderers?: RendererPlugin;
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

export function findCustomRenderer(plugin: RendererPlugin | undefined, language: string): CustomRenderer | undefined {
  const normalized = language.toLowerCase();
  return plugin?.renderers.find(({ language: candidate }) =>
    (Array.isArray(candidate) ? candidate : [candidate]).some((value) => value.toLowerCase() === normalized)
  );
}
