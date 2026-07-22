import React, { type ReactNode, useContext, useEffect } from 'react';
import { Text, View } from 'react-native';
import type { ComponentRegistry, StableBlock, ThemeConfig } from '../core/types';
import { hashContent } from '../core/types';
import { extractComponentData, type ComponentData } from '../core/componentParser';
import { sanitizeProps } from '../core/sanitize';
import type { ResourcePolicy } from '../core/security';
import type { ComponentErrorHandler } from './rendererTypes';

export const ComponentErrorContext = React.createContext<ComponentErrorHandler | undefined>(undefined);

class RegistryErrorBoundary extends React.Component<{
  children: ReactNode;
  componentName: string;
  retryKey: number;
  retryComponent: React.ElementType;
  fallback: ReactNode;
  onError?: ComponentErrorHandler;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError?.(error, this.props.componentName); }
  componentDidUpdate(previous: Readonly<typeof this.props>, previousState: Readonly<typeof this.state>) {
    if (previousState.failed && this.state.failed && (
      previous.componentName !== this.props.componentName ||
      previous.retryKey !== this.props.retryKey ||
      previous.retryComponent !== this.props.retryComponent
    )) {
      this.setState({ failed: false });
    }
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export interface ComponentBlockProps {
  theme: ThemeConfig;
  componentRegistry?: ComponentRegistry;
  block?: StableBlock;
  componentName?: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ComponentData[];
  isStreaming?: boolean;
  onError?: ComponentErrorHandler;
  resourcePolicy?: ResourcePolicy;
}

function componentError(theme: ThemeConfig, message: string): ReactNode {
  return <View style={{ padding: 12, backgroundColor: theme.colors.codeBackground, marginBottom: theme.spacing.block }}><Text style={{ color: theme.colors.muted }}>{message}</Text></View>;
}

function ValidatedRegistryComponent({
  componentName, componentRegistry, props, style, children, childrenKey, isStreaming, theme,
  onError: directOnError, resourcePolicy,
}: {
  componentName: string;
  componentRegistry: ComponentRegistry;
  props: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ReactNode;
  childrenKey: number;
  isStreaming: boolean;
  theme: ThemeConfig;
  onError?: ComponentErrorHandler;
  resourcePolicy?: ResourcePolicy;
}) {
  const contextualOnError = useContext(ComponentErrorContext);
  const onError = directOnError ?? contextualOnError;
  const definition = componentRegistry.get(componentName);
  const safeProps = sanitizeProps(props, resourcePolicy);
  const safeStyle = style ? sanitizeProps(style, resourcePolicy) : undefined;
  let validationError: Error | null = null;
  try {
    const result = componentRegistry.validate(componentName, safeProps);
    if (!result.valid) validationError = new Error(`Invalid props for ${componentName}: ${result.errors.join(', ')}`);
  } catch (error) {
    validationError = error instanceof Error ? error : new Error(String(error));
  }
  useEffect(() => {
    if (validationError) onError?.(validationError, componentName);
  }, [componentName, onError, validationError?.message]);
  const fallback = componentError(theme, `⚠️ Invalid component: ${componentName}`);
  if (!definition || validationError) return fallback;
  const Component = isStreaming && definition.skeletonComponent
    ? definition.skeletonComponent
    : definition.component;
  const retryKey = hashContent(JSON.stringify([safeProps, safeStyle, childrenKey, isStreaming]));
  return (
    <RegistryErrorBoundary componentName={componentName} retryKey={retryKey} retryComponent={Component} fallback={fallback} onError={onError}>
      <Component {...safeProps} style={{ ...(safeProps.style as object), ...safeStyle }} _isStreaming={isStreaming}>{children}</Component>
    </RegistryErrorBoundary>
  );
}

export const ComponentBlock: React.FC<ComponentBlockProps> = ({
  theme, componentRegistry, block, componentName: directName, props: directProps,
  style: directStyle, children: directChildren, isStreaming = false, onError,
  resourcePolicy,
}) => {
  const extracted = block ? extractComponentData(block.content, resourcePolicy) : undefined;
  const name = directName ?? extracted?.name ?? '';
  const props = directProps ?? extracted?.props ?? {};
  const style = directStyle ?? extracted?.style;
  const children = directChildren ?? extracted?.children;
  if (!name) return null;
  if (!componentRegistry) return componentError(theme, '⚠️ No component registry provided');
  if (!componentRegistry.get(name)) return componentError(theme, `⚠️ Unknown component: ${name}`);
  const childrenKey = hashContent(JSON.stringify(children ?? null));
  const renderedChildren = children?.map((child, index) => (
    <ComponentBlock key={index} theme={theme} componentRegistry={componentRegistry} componentName={child.name} props={child.props} style={child.style} children={child.children} isStreaming={isStreaming} onError={onError} resourcePolicy={resourcePolicy} />
  ));
  return (
    <View style={{ marginBottom: theme.spacing.block }}>
      <ValidatedRegistryComponent componentName={name} componentRegistry={componentRegistry} props={props} style={style} childrenKey={childrenKey} isStreaming={isStreaming} theme={theme} onError={onError} resourcePolicy={resourcePolicy}>{renderedChildren}</ValidatedRegistryComponent>
    </View>
  );
};

export { extractComponentData, type ComponentData };
