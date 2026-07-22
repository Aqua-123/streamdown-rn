import type React from 'react';
import type { Node } from 'unist';
import type { ComponentRegistry, NativeComponents, ThemeConfig } from '../core/types';
import type { SecurityPolicyOptions } from '../core/security';
import type { NormalizedAnimationConfig } from '../core/streaming';
import type { NativeCapabilities } from '../platform/capabilities';
import type { ControlsConfig, IconMap, StreamdownTranslations } from '../controls';
import type { PluginConfig } from '../plugins/renderers';
import type { ThemeInput } from '../plugins/code';
import type { NativeSlots } from './types';
import type { getBlockStyles, getTextStyles, resolveThemePrimitives } from '../themes';

export type ComponentErrorHandler = (error: Error, componentName?: string) => void;

export interface ASTRendererProps {
  node: Node;
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  components?: NativeComponents;
  slots?: NativeSlots;
  isStreaming?: boolean;
  /** Internal active-root signal; independent of animation-dependent streaming UI. */
  suppressEmptyFootnotes?: boolean;
  onError?: ComponentErrorHandler;
  securityPolicy?: SecurityPolicyOptions;
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  dir?: 'auto' | 'ltr' | 'rtl';
  animation?: NormalizedAnimationConfig & { from: number };
  capabilities?: NativeCapabilities;
  controls?: ControlsConfig;
  translations?: StreamdownTranslations;
  icons?: IconMap;
  controlsDisabled?: boolean;
  plugins?: PluginConfig;
  shikiTheme?: [ThemeInput, ThemeInput];
  lineNumbers?: boolean;
  codeFenceIncomplete?: boolean;
}

export type SemanticNode = Node & {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  depth?: 1 | 2 | 3 | 4 | 5 | 6;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
  meta?: string | null;
  identifier?: string;
  align?: Array<'left' | 'center' | 'right' | null>;
  children?: SemanticNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown>; literal?: boolean };
};

export interface RenderContext extends Omit<ASTRendererProps, 'node'> {
  direction?: 'ltr' | 'rtl';
  definitions: ReadonlyMap<string, { url?: string; title?: string | null }>;
  emptyFootnotes: ReadonlySet<string>;
  textStyles: ReturnType<typeof getTextStyles>;
  blockStyles: ReturnType<typeof getBlockStyles>;
  themePrimitives: ReturnType<typeof resolveThemePrimitives>;
}

export type RenderNode = (
  node: SemanticNode,
  context: RenderContext,
  inline?: boolean,
  key?: React.Key
) => React.ReactNode;
