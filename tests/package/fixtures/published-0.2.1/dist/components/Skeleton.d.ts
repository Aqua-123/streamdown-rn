/**
 * Skeleton Primitives
 *
 * Animated placeholder components for streaming UI.
 * Used by component skeletons to show loading states.
 */
import React from 'react';
import { ViewStyle } from 'react-native';
export interface SkeletonProps {
    /** Width of the skeleton (number for pixels, percentage string like '80%') */
    width?: number | `${number}%`;
    /** Height of the skeleton */
    height?: number;
    /** Border radius */
    borderRadius?: number;
    /** Additional styles */
    style?: ViewStyle;
}
export interface SkeletonTextProps extends Omit<SkeletonProps, 'height' | 'borderRadius'> {
    /** Number of lines to render */
    lines?: number;
    /** Line height */
    lineHeight?: number;
    /** Gap between lines */
    gap?: number;
}
/**
 * Base skeleton with shimmer animation.
 * Use this for custom shapes or use the specialized variants below.
 */
export declare const Skeleton: React.FC<SkeletonProps>;
/**
 * Text skeleton - single or multi-line text placeholder.
 */
export declare const SkeletonText: React.FC<SkeletonTextProps>;
/**
 * Rectangle skeleton - for images, cards, or block content.
 */
export declare const SkeletonRect: React.FC<SkeletonProps>;
/**
 * Circle skeleton - for avatars or icons.
 */
export declare const SkeletonCircle: React.FC<{
    size?: number;
    style?: ViewStyle;
}>;
/**
 * Number skeleton - short placeholder for numeric values.
 */
export declare const SkeletonNumber: React.FC<{
    width?: number;
    style?: ViewStyle;
}>;
export default Skeleton;
//# sourceMappingURL=Skeleton.d.ts.map
