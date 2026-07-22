import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { defaultTranslations } from '../controls';
import { resolveCapabilities } from '../platform/defaults';
import { NativeStreamingText } from '../native/NativeStreamingText';
import { createNativeStreamingTextModel } from '../native/streamingTextModel';
import type { RenderContext, SemanticNode } from './rendererTypes';

export function renderNativeText(
  node: SemanticNode,
  context: RenderContext,
  style: StyleProp<TextStyle>,
  fallback: React.ReactNode,
  key?: React.Key,
  accessibilityRole?: 'header'
) {
  const model = createNativeStreamingTextModel(node, context, style);
  if (!model) return <Text key={key} accessibilityRole={accessibilityRole} style={style}>{fallback}</Text>;
  return (
    <NativeStreamingText
      key={key}
      model={model}
      textStyle={style}
      fallback={fallback}
      animation={context.animation}
      direction={context.direction}
      capabilities={context.capabilities ?? resolveCapabilities()}
      resourcePolicy={context.securityPolicy}
      translations={context.translations ?? defaultTranslations}
      accessibilityRole={accessibilityRole}
    />
  );
}
