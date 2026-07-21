# Accessibility

Native controls expose roles, labels, disabled/busy state, 44-point targets, adjustable zoom actions, modal semantics, system-back handling, and focus restoration after fullscreen dismissal completes. Streaming announcements are off by default and coalesced when enabled. Reduced motion disables suffix/caret animation through either the platform preference or the explicit test seam.

```tsx verify
import React from 'react';
import { Streamdown, type NativeCapabilities } from 'streamdown-rn';

const capabilities: NativeCapabilities = {
  announcements: { announce: (message) => { void message; } },
  focus: { restore: (target) => { void target; } },
};

export function AccessibleStream({ content }: { content: string }) {
  return <Streamdown mode="streaming" isAnimating announceStreaming={{ delayMs: 400 }} reducedMotion capabilities={capabilities}>{content}</Streamdown>;
}
```

Jest verifies semantic props, not VoiceOver or TalkBack behavior. Manual reading order, role/name/state, focus, live announcements, large text, reduced motion, and gesture alternatives remain release hardware gates on both platforms.
