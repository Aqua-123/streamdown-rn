import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

/** Standard semantic fallbacks that ASTRenderer can safely compose. */
export const NATIVE_ELEMENT_NAMES = [
  'a', 'blockquote', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'img', 'li', 'ol', 'p', 'pre', 'strong', 'sup', 'table', 'td', 'th',
  'tr', 'ul',
] as const;

export type NativeElementName = typeof NATIVE_ELEMENT_NAMES[number];

/** Post-policy semantic values. Raw syntax trees and custom attributes are excluded. */
export interface NativeSlotSemanticData<Name extends NativeElementName = NativeElementName> {
  readonly element: Name;
  readonly type: string;
  readonly inline: boolean;
  readonly value?: string;
  readonly url?: string;
  readonly alt?: string;
  readonly depth?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly ordered?: boolean;
  readonly checked?: boolean | null;
  readonly language?: string;
  readonly metadata?: string;
  readonly identifier?: string;
}

export type NativeDefaultOverrides<Name extends NativeElementName> = {
  style?: StyleProp<TextStyle | ViewStyle>;
} & (Name extends 'img' ? object : { children?: ReactNode });

export interface NativeSlotProps<Name extends NativeElementName = NativeElementName> {
  children?: ReactNode;
  semantic: NativeSlotSemanticData<Name>;
  renderDefault: (overrides?: NativeDefaultOverrides<Name>) => ReactNode;
}

/** Exact standard-element composition map. Custom tags remain in `components`. */
export type NativeSlots = {
  [Name in NativeElementName]?: ComponentType<NativeSlotProps<Name>>;
};
