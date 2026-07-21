import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Button, type ButtonProps } from './Button';

export type DropdownOpenReason = 'trigger' | 'outside-press' | 'system-dismiss' | 'selection';

interface AnchorRect { x: number; y: number; width: number; height: number }
interface DropdownContextValue {
  open: boolean;
  anchor: AnchorRect;
  triggerRef: React.MutableRefObject<View | null>;
  toggle: () => void;
  measureTrigger: () => void;
  setOpen: (open: boolean, reason: DropdownOpenReason) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown(): DropdownContextValue {
  const value = useContext(DropdownContext);
  if (!value) throw new Error('Dropdown parts must be rendered inside Dropdown.Root');
  return value;
}

export interface DropdownRootProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: { reason: DropdownOpenReason }) => void;
}

export function DropdownRoot({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: DropdownRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [anchor, setAnchor] = useState<AnchorRect>({ x: 0, y: 0, width: 44, height: 44 });
  const triggerRef = useRef<View>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const previousOpen = useRef(open);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setOpen = useCallback((next: boolean, reason: DropdownOpenReason) => {
    if (next === open) return;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next, { reason });
  }, [controlledOpen, onOpenChange, open]);
  const measureTrigger = useCallback(() => {
    triggerRef.current?.measureInWindow?.((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, []);
  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next, 'trigger');
    if (next) measureTrigger();
  }, [measureTrigger, open, setOpen]);
  useEffect(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    if (previousOpen.current && !open) {
      focusTimer.current = setTimeout(() => {
      const handle = findNodeHandle(triggerRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }, 0);
    }
    previousOpen.current = open;
  }, [open]);
  useEffect(() => () => { if (focusTimer.current) clearTimeout(focusTimer.current); }, []);
  const value = useMemo(() => ({ open, anchor, triggerRef, toggle, measureTrigger, setOpen }), [anchor, measureTrigger, open, setOpen, toggle]);
  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>;
}

export interface DropdownTriggerProps extends Omit<ButtonProps, 'onPress'> {}

export const DropdownTrigger = forwardRef<View, DropdownTriggerProps>(function DropdownTrigger(props, forwardedRef) {
  const { open, toggle, triggerRef } = useDropdown();
  const assignRef = (node: View | null) => {
    triggerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
  return <Button
    {...props}
    ref={assignRef}
    accessibilityState={{ ...props.accessibilityState, expanded: open }}
    onPress={toggle}
  />;
});

export interface DropdownPopupProps {
  children: React.ReactNode;
  align?: 'start' | 'end';
  sideOffset?: number;
  collisionPadding?: number;
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function DropdownPopup({ children, align = 'end', sideOffset = 4, collisionPadding = 8, minWidth = 120, style, accessibilityLabel }: DropdownPopupProps) {
  const { open, anchor, measureTrigger, setOpen } = useDropdown();
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: minWidth, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => setSize(event.nativeEvent.layout);
  useEffect(() => { if (open) measureTrigger(); }, [measureTrigger, open, window.height, window.width]);
  const availableWidth = Math.max(0, window.width - collisionPadding * 2);
  const availableHeight = Math.max(0, window.height - collisionPadding * 2);
  const popupWidth = Math.min(size.width, availableWidth);
  const popupHeight = Math.min(size.height, availableHeight);
  const preferredLeft = align === 'end' ? anchor.x + anchor.width - popupWidth : anchor.x;
  const left = Math.max(collisionPadding, Math.min(preferredLeft, window.width - popupWidth - collisionPadding));
  const below = anchor.y + anchor.height + sideOffset;
  const preferredTop = popupHeight > 0 && below + popupHeight > window.height - collisionPadding
    ? anchor.y - popupHeight - sideOffset
    : below;
  const top = Math.max(collisionPadding, Math.min(preferredTop, window.height - popupHeight - collisionPadding));
  return <Modal
    visible={open}
    transparent
    animationType="none"
    presentationStyle="overFullScreen"
    statusBarTranslucent
    navigationBarTranslucent
    onRequestClose={() => setOpen(false, 'system-dismiss')}
  >
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable testID="dropdown-dismiss" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={() => setOpen(false, 'outside-press')} />
      <View
        testID="dropdown-popup"
        accessibilityRole="menu"
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        onLayout={onLayout}
        style={[styles.popup, { left, top, minWidth: Math.min(minWidth, availableWidth), maxWidth: availableWidth, maxHeight: availableHeight }, style]}
      >{children}</View>
    </View>
  </Modal>;
}

export interface DropdownItemProps extends Omit<ButtonProps, 'onPress' | 'variant'> {
  onSelect: () => void | Promise<void>;
}

export const DropdownItem = forwardRef<View, DropdownItemProps>(function DropdownItem({ onSelect, disabled, children, foregroundColor, ...props }, ref) {
  const { open, setOpen } = useDropdown();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = async () => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSelect();
      setOpen(false, 'selection');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { if (!open) setError(null); }, [open]);
  return <View>
    <Button {...props} ref={ref} variant="menu" accessibilityRole="menuitem" accessibilityState={{ ...props.accessibilityState, busy }} disabled={disabled || busy} foregroundColor={foregroundColor} onPress={select}>{children}</Button>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: foregroundColor, paddingHorizontal: 12, paddingBottom: 8 }}>{error}</Text> : null}
  </View>;
});

export const Dropdown = {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Popup: DropdownPopup,
  Item: DropdownItem,
};

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    zIndex: 1000,
    padding: 4,
    borderWidth: 1,
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
});
