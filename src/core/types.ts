/**
 * Core Types for Streamdown-RN
 * 
 * Block-based streaming markdown architecture.
 * Optimized for append-only AI response streams.
 */

import type { ComponentType, ReactNode } from 'react';
import type { Content, Node } from 'mdast';
import type { StyleProp, ViewStyle } from 'react-native';
import type { PluggableList } from 'unified';
import type { SecurityPolicyOptions } from './security';
import type { AnimationConfig, StreamingInstrumentation } from './streaming';
import type { ControlsConfig, IconMap, StreamdownTranslations } from '../controls';
import type { NativeCapabilities } from '../platform/capabilities';
import type { PluginConfig } from '../plugins/renderers';
import type { ThemeInput } from '../plugins/code';

// ============================================================================
// Block Types
// ============================================================================

/**
 * All supported block types in GitHub Flavored Markdown
 */
export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'codeBlock'
  | 'list'
  | 'table'
  | 'blockquote'
  | 'horizontalRule'
  | 'image'
  | 'footnote'
  | 'component';  // Custom {{c:...}} syntax

/**
 * Heading levels (H1-H6)
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ============================================================================
// Block Interfaces
// ============================================================================

/**
 * Base block properties shared by all blocks
 */
interface BaseBlock {
  /** Unique stable identifier (e.g., "h-0", "p-1") */
  id: string;
  /** Block type for rendering dispatch */
  type: BlockType;
  /** Raw markdown content of this block */
  content: string;
  /** Fast hash of content for React.memo comparison */
  contentHash: number;
  /** Start position in the full text */
  startPos: number;
  /** End position in the full text */
  endPos: number;
}

/**
 * A completed, immutable block that will never change.
 * These are memoized and never re-render.
 */
export interface StableBlock extends BaseBlock {
  /** Block-specific metadata */
  meta: BlockMeta;
  /** Parsed MDAST node (cached for performance) */
  ast?: Content;
}

/**
 * The currently streaming block (only one at a time).
 * Re-renders on each new token.
 */
export interface ActiveBlock {
  /** Type hint (may change as more content arrives) */
  type: BlockType | null;
  /** Current content being streamed */
  content: string;
  /** Start position in the full text */
  startPos: number;
}

/**
 * Block-specific metadata
 */
export type BlockMeta =
  | { type: 'heading'; level: HeadingLevel }
  | { type: 'codeBlock'; language: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'component'; name: string; props: Record<string, unknown> }
  | { type: 'paragraph' | 'blockquote' | 'horizontalRule' | 'image' | 'footnote' };

// ============================================================================
// Block Registry (State Management)
// ============================================================================

// Forward declare for circular dependency avoidance
export interface IncompleteTagState {
  stack: Array<{ type: string; position: number; marker: string }>;
  tagCounts: Record<string, number>;
  previousTextLength: number;
  earliestPosition: number;
  inCodeBlock: boolean;
  inInlineCode: boolean;
}

/**
 * Central state for the streaming renderer.
 * Immutable updates — each token creates a new registry.
 */
export interface BlockRegistry {
  /** Exact source snapshot used to distinguish append from replacement updates. */
  source?: string;
  /** Completed blocks (never change after finalization) */
  blocks: readonly StableBlock[];
  /** Currently streaming block (null if between blocks) */
  activeBlock: ActiveBlock | null;
  /** Tag state for active block (tracks incomplete markdown) */
  activeTagState: IncompleteTagState;
  /** Cursor position — how much of the full text we've processed */
  cursor: number;
  /** Counter for generating unique block IDs */
  blockCounter: number;
}

/**
 * Initial empty registry state
 * Note: activeTagState is set to a literal to avoid circular dependency
 */
export const INITIAL_REGISTRY: BlockRegistry = {
  source: '',
  blocks: [],
  activeBlock: null,
  activeTagState: {
    stack: [],
    tagCounts: {},
    previousTextLength: 0,
    earliestPosition: 0,
    inCodeBlock: false,
    inInlineCode: false,
  },
  cursor: 0,
  blockCounter: 0,
};

// ============================================================================
// Component Injection
// ============================================================================

/**
 * Definition of a component that can be injected via [{c:...}] syntax
 */
export interface ComponentDefinition<P = Record<string, unknown>> {
  /** The React component to render */
  component: ComponentType<P & { _isStreaming?: boolean; children?: ReactNode }>;
  /** 
   * Skeleton component to render while streaming.
   * Receives partial props available so far.
   * Should render skeleton placeholders for missing props.
   */
  skeletonComponent?: ComponentType<Partial<P> & { _isStreaming?: boolean; children?: ReactNode }>;
  /** JSON schema for props validation (optional) */
  schema?: JSONSchema;
}

/**
 * Registry of injectable components
 */
export interface ComponentRegistry {
  /** Get a component by name */
  get(name: string): ComponentDefinition | undefined;
  /** Check if a component exists */
  has(name: string): boolean;
  /** Validate props against schema */
  validate(name: string, props: unknown): ValidationResult;
}

/**
 * Simple JSON Schema subset for prop validation
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, { type: string; required?: boolean }>;
  required?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Theme Configuration
// ============================================================================

/**
 * Theme colors
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  codeBackground: string;
  codeForeground: string;
  border: string;
  link: string;
  // Syntax highlighting colors (Prism-compatible)
  syntaxDefault: string;
  syntaxKeyword: string;
  syntaxString: string;
  syntaxNumber: string;
  syntaxComment: string;
  syntaxFunction: string;
  syntaxClass: string;
  syntaxOperator: string;
}

/**
 * Theme configuration
 * 
 * Font-agnostic: regular and bold fonts are optional (undefined uses platform defaults).
 * Only mono is required for code blocks.
 */
export interface ThemeConfig {
  /** Active palette used by scheme-aware code highlighters. Defaults to dark. */
  colorScheme?: 'light' | 'dark';
  colors: ThemeColors;
  fonts: {
    regular?: string;   // Optional - uses platform default if undefined
    bold?: string;      // Optional - uses platform default if undefined
    mono: string;       // Required for code blocks
  };
  spacing: {
    block: number;      // Space between blocks
    inline: number;     // Inline element spacing
    indent: number;     // List/blockquote indent
  };
}

// ============================================================================
// Debug/Observability
// ============================================================================

/**
 * Snapshot of the streaming state at a specific moment.
 * Emitted via onDebug callback for observability.
 */
export interface DebugSnapshot {
  /** Current position in the stream (cursor) */
  position: number;
  /** Total length of content processed so far */
  totalLength: number;
  /** New characters added in this update */
  newChars: string;
  /** Number of characters added */
  newCharsCount: number;
  /** Current block registry state (deep copy for safety) */
  registry: {
    /** Number of stable blocks */
    stableBlockCount: number;
    /** Stable blocks with preview content */
    stableBlocks: Array<{
      id: string;
      type: BlockType;
      contentLength: number;
      content: string;
    }>;
    /** Active block info */
    activeBlock: {
      type: BlockType | null;
      contentLength: number;
      content: string;
    } | null;
    /** Current tag state for incomplete markdown tracking */
    tagState: IncompleteTagState;
  };
  /** Fixed markdown content (after auto-closing incomplete tags) */
  fixedContent: string | null;
  /** Timestamp (high-resolution) */
  timestamp: number;
  /** Time since last update in milliseconds */
  deltaMs: number;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the main StreamdownRN component
 */
export interface NativeSemanticData {
  type: string;
  node: Readonly<Node>;
  inline: boolean;
  value?: string;
  url?: string;
  alt?: string;
  depth?: HeadingLevel;
  ordered?: boolean;
  checked?: boolean | null;
  language?: string;
  metadata?: string;
  identifier?: string;
  attributes?: Readonly<Record<string, unknown>>;
}

export interface NativeComponentProps {
  children?: ReactNode;
  semantic: NativeSemanticData;
}

export type NativeComponents = Record<
  string,
  ComponentType<NativeComponentProps> | undefined
> & {
  inlineCode?: ComponentType<NativeComponentProps>;
  unknown?: ComponentType<NativeComponentProps>;
};

/** Platform-neutral Streamdown options with explicit native substitutions. */
export interface StreamdownProps extends SecurityPolicyOptions {
  /** Markdown content (streaming or complete) */
  children?: string;
  /** Component registry for {{c:...}} syntax */
  componentRegistry?: ComponentRegistry;
  /** Theme name or custom config */
  theme?: 'dark' | 'light' | ThemeConfig;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Native semantic component overrides (never DOM intrinsic strings). */
  components?: NativeComponents;
  /** Additional remark plugins, applied after the built-in GFM parser. */
  remarkPlugins?: PluggableList;
  /** Optional code, CJK, and custom-renderer plugins. */
  plugins?: PluginConfig;
  /** Light and dark themes supplied to a configured code token provider. */
  shikiTheme?: [ThemeInput, ThemeInput];
  /** Show code line numbers unless a fence includes `noLineNumbers`. */
  lineNumbers?: boolean;
  mode?: 'static' | 'streaming';
  dir?: 'auto' | 'ltr' | 'rtl';
  parseIncompleteMarkdown?: boolean;
  /** Normalize 4+ space indentation before tags in an HTML-led document. */
  normalizeHtmlIndentation?: boolean;
  /** Whether the host is currently delivering streamed content. */
  isAnimating?: boolean;
  /** Animate only content that became visible in the current append. */
  animated?: boolean | AnimationConfig;
  /** Native caret shown while streaming. */
  caret?: 'block' | 'circle';
  /** Explicit seam for tests or hosts that already observe reduced motion. */
  reducedMotion?: boolean;
  /** Called once for each false-to-true streaming transition. */
  onAnimationStart?: () => void;
  /** Called once for each true-to-false streaming transition. */
  onAnimationEnd?: () => void;
  /** Optional bounded counters for benchmarks and regression tests. */
  instrumentation?: StreamingInstrumentation;
  /** Native action adapters. Clipboard, files, gestures, and focus are opt-in. */
  capabilities?: NativeCapabilities;
  /** Show all controls, hide all controls, or configure each renderer family. */
  controls?: ControlsConfig;
  /** Partial labels merged with the built-in English labels. */
  translations?: Partial<StreamdownTranslations>;
  /** Optional visual replacements; accessible labels remain unchanged. */
  icons?: IconMap;
  /** Coalesced screen-reader announcements; disabled by default. */
  announceStreaming?: boolean | { delayMs?: number };
  /** Custom tag names and the attributes exposed to native overrides. */
  allowedTags?: Readonly<Record<string, readonly string[]>>;
  literalTagContent?: readonly string[];
  /** Error callback for component failures */
  onError?: (error: Error, componentName?: string) => void;
  /** 
   * Debug callback — called on every content update.
   * Use for observability, debugging, or testing.
   * Only enable in development to avoid performance overhead.
   */
  onDebug?: (snapshot: DebugSnapshot) => void;
  /**
   * Signal that streaming is complete.
   * When true, finalizes the active block into a stable block.
   * This ensures the last block is properly memoized and components
   * transition from skeleton to final state.
   */
  isComplete?: boolean;
  /** DOM-only Streamdown options are rejected instead of silently ignored. */
  className?: never;
  prefix?: never;
  rehypePlugins?: never;
  remarkRehypeOptions?: never;
}

export type StreamdownRNProps = StreamdownProps;

/**
 * Props passed to block renderers
 */
export interface BlockRendererProps {
  /** The block to render */
  block: StableBlock;
  /** Current theme configuration */
  theme: ThemeConfig;
  /** Component registry (for component blocks) */
  componentRegistry?: ComponentRegistry;
}

/**
 * Props for the active block renderer
 */
export interface ActiveBlockRendererProps {
  /** The active block content */
  block: ActiveBlock;
  /** Current theme configuration */
  theme: ThemeConfig;
  /** Component registry (for streaming components) */
  componentRegistry?: ComponentRegistry;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Fast hash function (djb2) for content comparison.
 * Used in React.memo to avoid deep equality checks.
 */
export function hashContent(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Ensure unsigned
}

/**
 * Generate a unique block ID
 */
export function generateBlockId(type: BlockType, counter: number): string {
  const prefix = type === 'heading' ? 'h' :
                 type === 'paragraph' ? 'p' :
                 type === 'codeBlock' ? 'c' :
                 type === 'list' ? 'l' :
                 type === 'table' ? 't' :
                 type === 'blockquote' ? 'q' :
                 type === 'horizontalRule' ? 'hr' :
                 type === 'image' ? 'img' :
                 type === 'component' ? 'cmp' : 'b';
  return `${prefix}-${counter}`;
}
