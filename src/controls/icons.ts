import type { ReactNode } from 'react';

export type IconName = 'copy' | 'download' | 'fullscreen' | 'close' | 'retry' | 'zoomIn' | 'zoomOut' | 'zoomReset';
export type IconMap = Partial<Record<IconName, ReactNode>>;

export const defaultIcons: Readonly<Record<IconName, ReactNode>> = {
  copy: '⧉', download: '↓', fullscreen: '⤢', close: '×', retry: '↻',
  zoomIn: '+', zoomOut: '−', zoomReset: '1×',
};
