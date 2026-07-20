# Security

Untrusted input crosses several independent boundaries:

- Markdown elements are filtered by `allowedElements`, `disallowedElements`, `allowElement`, `unwrapDisallowed`, and `skipHtml`.
- Link and image URLs use scheme allowlists, optional relative resolution, and a `urlTransform` hook. External links require an approval capability before opening.
- Data images are off by default and, when enabled, remain MIME/size bounded.
- Dynamic component props and custom-tag attributes are recursively sanitized before trusted host components receive them.
- Image downloads validate initial and redirect URLs, MIME, declared and actual size, and timeout.
- Mermaid SVG is size/structure bounded and rejects scripts, external resources, event/style execution, dangerous entities, animation/filter bombs, extreme geometry, and oversized paths.
- The offline WebView subpath requires trusted host enforcement of CSP, pinned local assets, navigation/network/file denial, strict message schema, timeouts, retries, and per-surface teardown.

```tsx verify
import React from 'react';
import { Streamdown, sanitizeURL } from 'streamdown-rn';

const safe = sanitizeURL('https://example.com');
const blocked = sanitizeURL('javascript:alert(1)');
void safe; void blocked;

export function Restricted({ markdown }: { markdown: string }) {
  return <Streamdown mode="static" allowedElements={['paragraph', 'text', 'link']} allowedLinkSchemes={['https']}>{markdown}</Streamdown>;
}
```

Host components, native capabilities, token/math/diagram providers, and the WebView transport are trusted application code. Do not treat the sanitizer as a permission boundary inside trusted adapters. Report vulnerabilities through the repository security channel before public disclosure.
