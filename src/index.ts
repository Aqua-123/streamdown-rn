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
} from './core/types';

export type {
  SecurityPolicyOptions,
  ResourcePolicy,
  DataImagePolicy,
  SemanticElementPredicate,
} from './core/security';
