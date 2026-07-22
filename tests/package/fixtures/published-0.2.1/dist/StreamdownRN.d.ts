/**
 * StreamdownRN - Streaming Markdown Renderer for React Native
 *
 * High-performance streaming markdown renderer optimized for AI responses.
 * Uses block-level stability to minimize re-renders during streaming.
 *
 * Architecture:
 * - Completed blocks are memoized and NEVER re-render
 * - Only the active (currently streaming) block re-renders on new tokens
 * - Block boundaries are detected incrementally
 */
import React from 'react';
import type { StreamdownRNProps } from './core/types';
/**
 * StreamdownRN Component
 *
 * Main entry point for streaming markdown rendering.
 *
 * @example
 * ```tsx
 * <StreamdownRN theme="dark">
 *   {streamingMarkdownContent}
 * </StreamdownRN>
 * ```
 */
export declare const StreamdownRN: React.FC<StreamdownRNProps>;
export default StreamdownRN;
//# sourceMappingURL=StreamdownRN.d.ts.map
