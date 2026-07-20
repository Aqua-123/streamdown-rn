import { useEffect, useRef } from 'react';
import type { NativeCapabilities } from '../platform/capabilities';

export function useStreamingAnnouncement(
  content: string,
  enabled: boolean,
  capabilities: NativeCapabilities,
  delayMs: number
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled || !content.trim() || !capabilities.announcements) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => capabilities.announcements?.announce(content), delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [capabilities.announcements, content, delayMs, enabled]);
}
