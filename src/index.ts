/**
 * StreamdownRN - Streaming Markdown Renderer for React Native
 * 
 * High-performance streaming markdown renderer optimized for AI responses.
 * 
 * @packageDocumentation
 */

// ============================================================================
// Main Component
// ============================================================================

export { Streamdown, StreamdownRN, default } from './StreamdownRN';

// ============================================================================
// Skeleton Primitives (for building component skeletons)
// ============================================================================

export {
  Skeleton,
  SkeletonText,
  SkeletonRect,
  SkeletonCircle,
  SkeletonNumber,
  type SkeletonProps,
  type SkeletonTextProps,
} from './components';

export {
  Button,
  Action,
  ActionRoot,
  ActionTrigger,
  ActionStatus,
  Toolbar,
  ToolbarRoot,
  ToolbarButton,
  Dropdown,
  DropdownRoot,
  DropdownTrigger,
  DropdownPopup,
  DropdownItem,
  ActionButton,
  FullscreenModal,
  NativeLink,
  PanZoomSurface,
  type ButtonProps,
  type ButtonState,
  type ButtonVariant,
  type ActionRootProps,
  type ActionTriggerProps,
  type ActionStatusProps,
  type ActionState,
  type ToolbarRootProps,
  type ToolbarButtonProps,
  type ToolbarOrientation,
  type ToolbarState,
  type DropdownRootProps,
  type DropdownTriggerProps,
  type DropdownPopupProps,
  type DropdownItemProps,
  type DropdownOpenReason,
  type ActionButtonProps,
  type FullscreenModalProps,
  type NativeLinkProps,
  type PanZoomSurfaceProps,
} from './components/ui';

// ============================================================================
// Security Utilities
// ============================================================================

export {
  sanitizeURL,
  sanitizeProps,
} from './core/sanitize';

// ============================================================================
// Public Types
// ============================================================================

export type {
  // Component props
  StreamdownProps,
  StreamdownRNProps,
  NativeComponents,
  NativeComponentProps,
  NativeSemanticData,
  
  // Component injection (for custom component registries)
  ComponentDefinition,
  ComponentRegistry,
  
  // Debug/Observability
  DebugSnapshot,

  // Theme configuration
  ThemeConfig,
  ThemeColors,
  ThemePrimitives,
} from './core/types';

export type {
  NativeDefaultOverrides,
  NativeElementName,
  NativeSlotProps,
  NativeSlotSemanticData,
  NativeSlots,
} from './renderers/types';

export { NATIVE_ELEMENT_NAMES } from './renderers/types';

export {
  darkTheme,
  darkThemePrimitives,
  getTheme,
  lightTheme,
  lightThemePrimitives,
  resolveThemePrimitives,
} from './themes';

export { normalizeHtmlIndentation } from './core/parser';

export type {
  SecurityPolicyOptions,
  ResourcePolicy,
  DataImagePolicy,
  SemanticElementPredicate,
} from './core/security';

export {
  createStreamingInstrumentation,
  type AnimationConfig,
  type StreamingInstrumentation,
  type StreamingMetrics,
} from './core/streaming';

export {
  defaultTranslations,
  defaultIcons,
  resolveTranslations,
  codeFileRequest,
  fetchImageFileRequest,
  imageFileRequest,
  sanitizeBasename,
  serializeTable,
  tableFileRequest,
  type ControlsConfig,
  type IconMap,
  type IconName,
  type StreamdownTranslations,
  type TableFormat,
} from './controls';

export type {
  CapabilityResult,
  CapabilityStatus,
  LinkApprovalLabels,
  NativeCapabilities,
  NativeFileRequest,
  NativeImageDownloadCapability,
  NativeImageDownloadRequest,
  PanZoomRenderProps,
} from './platform/capabilities';

export { defaultNativeCapabilities, resolveCapabilities } from './platform/defaults';
