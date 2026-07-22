import type { ReactNode } from 'react';

export type CapabilityStatus = 'success' | 'unavailable' | 'denied' | 'cancelled' | 'failed';

export interface CapabilityResult {
  status: CapabilityStatus;
  error?: Error;
}

export interface NativeFileRequest {
  basename: string;
  extension: string;
  mimeType: string;
  content: string | Uint8Array;
}

export interface NativeImageDownloadRequest {
  /** Final transformed image URL. Validate it and every redirect before issuing that request. */
  uri: string;
  basename: string;
  maxBytes: number;
  timeoutMs: number;
  mimeTypes: readonly string[];
  /** The library's image URL policy. Call before the initial request and every redirect. */
  validateUrl: (url: string) => boolean;
}

export interface NativeImageDownloadCapability {
  /** Must stop after maxBytes and return only a fully validated, bounded image. */
  download: (request: NativeImageDownloadRequest) => Promise<NativeFileRequest> | NativeFileRequest;
}

export interface LinkApprovalLabels {
  title: string;
  message: string;
  cancel: string;
  open: string;
}

export interface PanZoomRenderProps {
  children: ReactNode;
  scale: number;
  onScaleChange: (scale: number) => void;
}

export interface NativeCapabilities {
  links?: false | {
    approve: (url: string, labels?: LinkApprovalLabels) => Promise<CapabilityResult> | CapabilityResult;
    open: (url: string) => Promise<CapabilityResult> | CapabilityResult;
  };
  clipboard?: {
    writeText: (text: string) => Promise<CapabilityResult> | CapabilityResult;
  };
  files?: {
    /** The adapter owns unique sandbox paths and native save/share UI. */
    save: (request: NativeFileRequest) => Promise<CapabilityResult> | CapabilityResult;
  };
  imageDownloads?: NativeImageDownloadCapability;
  share?: {
    shareText: (text: string, title?: string) => Promise<CapabilityResult> | CapabilityResult;
  };
  gestures?: {
    /** Host-owned two-axis pan and pinch surface; core owns bounded scale and actions. */
    renderPanZoom: (props: PanZoomRenderProps) => ReactNode;
  };
  announcements?: {
    announce: (message: string) => void;
  };
  focus?: {
    restore: (target?: unknown) => void;
  };
}

export function failedCapability(error: unknown): CapabilityResult {
  return { status: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
}
