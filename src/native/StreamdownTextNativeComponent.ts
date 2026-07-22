import {
  codegenNativeComponent,
  type CodegenTypes,
  type ViewProps,
} from 'react-native';

export interface LinkPressEvent {
  url: string;
}

export interface NativeProps extends ViewProps {
  text: string;
  runs: string;
  animationRanges: string;
  animation: string;
  duration: CodegenTypes.Float;
  easing: string;
  revision: CodegenTypes.Int32;
  reducedMotion: boolean;
  selectable: boolean;
  direction: string;
  onLinkPress?: CodegenTypes.DirectEventHandler<LinkPressEvent>;
}

export default codegenNativeComponent<NativeProps>('StreamdownText');
