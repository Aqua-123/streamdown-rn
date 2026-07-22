import React, { useCallback, useMemo } from 'react';
import { Text, type NativeSyntheticEvent, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import type { ResourcePolicy } from '../core/security';
import type { NormalizedAnimationConfig } from '../core/streaming';
import type { NativeCapabilities } from '../platform/capabilities';
import type { StreamdownTranslations } from '../controls';
import { useLinkAction } from '../controls/useLinkAction';
import NativeText, { type LinkPressEvent } from './StreamdownTextNativeComponent';
import { nativeLayoutStyle, type NativeStreamingTextModel } from './streamingTextModel';

interface NativeStreamingTextProps {
  model: NativeStreamingTextModel;
  textStyle: StyleProp<TextStyle>;
  fallback: React.ReactNode;
  animation?: NormalizedAnimationConfig & { from: number };
  direction?: 'ltr' | 'rtl';
  reducedMotion?: boolean;
  capabilities: NativeCapabilities;
  resourcePolicy?: ResourcePolicy;
  translations: StreamdownTranslations;
  accessibilityRole?: 'header';
}

export function NativeStreamingText({
  model,
  textStyle,
  fallback,
  animation,
  direction,
  reducedMotion = false,
  capabilities,
  resourcePolicy,
  translations,
  accessibilityRole,
}: NativeStreamingTextProps) {
  const { busy, error, press } = useLinkAction(capabilities, resourcePolicy, translations);
  const onLinkPress = useCallback((event: NativeSyntheticEvent<LinkPressEvent>) => {
    void press(event.nativeEvent.url);
  }, [press]);
  const runs = useMemo(() => JSON.stringify(model.runs), [model.runs]);
  const ranges = useMemo(() => JSON.stringify(model.animationRanges), [model.animationRanges]);

  if (process.env.NODE_ENV === 'test') {
    const testProps = {
      testID: 'streamdown-native-text',
      animationRanges: ranges,
      animationName: animation?.animation ?? 'none',
      animationText: model.text,
    } as unknown as TextProps;
    return (
      <Text
        accessibilityRole={accessibilityRole}
        style={textStyle}
        {...testProps}
      >{fallback}</Text>
    );
  }

  return (
    <>
      <NativeText
        accessibilityRole={accessibilityRole}
        accessibilityState={{ busy }}
        text={model.text}
        runs={runs}
        animationRanges={ranges}
        animation={animation?.animation ?? 'none'}
        duration={animation?.duration ?? 0}
        easing={animation?.easing ?? 'linear'}
        revision={animation?.from ?? model.text.length}
        reducedMotion={reducedMotion}
        selectable={false}
        direction={direction ?? 'auto'}
        onLinkPress={onLinkPress}
        style={nativeLayoutStyle(textStyle)}
        testID="streamdown-native-text"
      />
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </>
  );
}
