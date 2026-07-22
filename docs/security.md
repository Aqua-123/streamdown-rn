# Security

Untrusted input crosses several independent boundaries:

- Markdown elements are filtered by `allowedElements`, `disallowedElements`, `allowElement`, `unwrapDisallowed`, and `skipHtml`.
- Link and image URLs use scheme allowlists, optional relative resolution, and a `urlTransform` hook. External links require an approval capability before opening.
- Data images are off by default and, when enabled, remain MIME/size bounded.
- Dynamic component props and custom-tag attributes are recursively sanitized before trusted host components receive them.
- CSV and TSV exports are human, spreadsheet-oriented formats. Cells beginning with common formula prefixes (`=`, `+`, `-`, `@`, tab, carriage return, line feed, or their full-width equivalents) receive a leading single quote; CSV also quotes those cells, while TSV escapes delimiter controls. This can change literal exported text and reduces spreadsheet formula interpretation and field breakout, but is not a universal mitigation across every spreadsheet importer. Markdown serialization remains literal and unchanged.
- Network image rendering remains HTTPS-only (separately bounded data images can be enabled explicitly). Image downloading is fail-closed unless the host supplies `capabilities.imageDownloads`; React Native 0.81.5 and 0.85.3 both use an XHR-backed `whatwg-fetch` without incremental response bodies or manual redirect control, so the default JavaScript downloader cannot truthfully enforce a byte ceiling or inspect redirects before following them.
- Mermaid SVG is size/structure bounded and rejects scripts, external resources, event/style execution, dangerous entities, animation/filter bombs, extreme geometry, and oversized paths. The beautiful-mermaid adapter removes its browser-only style/import block, resolves known CSS variables to inert native colors, and then passes the result through the same generic sanitizer; only local fragment marker references receive a narrow exception.
- The offline WebView subpath requires trusted host enforcement of CSP, pinned local assets, navigation/network/file denial, strict message schema, timeouts, retries, and per-surface teardown.

```tsx verify
import React from 'react';
import { Streamdown, sanitizeURL } from 'streamdown-rn';

const safe = sanitizeURL('https://example.com');
const blocked = sanitizeURL('javascript:alert(1)');
void safe; void blocked;

const httpsOnly = (url: string) => {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

export function Restricted({ markdown }: { markdown: string }) {
  return <Streamdown mode="static" allowedElements={['p', 'a']} urlTransform={httpsOnly}>{markdown}</Streamdown>;
}
```

Element filters use native semantic names, not MDAST `semantic.type` values:

| Markdown construct | Filter name | Typical `semantic.type` |
| --- | --- | --- |
| Heading | `h1`-`h6` | `heading` |
| Inline code / code block | `code` / `pre` | `inlineCode` / `code` |
| Unordered / ordered list; item | `ul` / `ol`; `li` | `list`; `listItem` |
| Table; row; header / body cell | `table`; `tr`; `th` / `td` | `table`; `tableRow`; `tableCell` |
| Link / reference | `a` | `link` / `linkReference` |
| Image / reference | `img` | `image` / `imageReference` |
| Footnote reference | `sup` | `footnoteReference` |
| Paragraph | `p` | `paragraph` |
| Blockquote; line break; thematic break | `blockquote`; `br`; `hr` | `blockquote`; `break`; `thematicBreak` |
| Strong; emphasis; strikethrough | `strong`; `em`; `del` | `strong`; `emphasis`; `delete` |
| Custom or literal element | its `data.hName` value | plugin-defined |

Text nodes have no element filter name and remain readable when their containing element is allowed or unwrapped. Elements omitted from `allowedElements` are dropped by default; set `unwrapDisallowed` to retain their children instead.

`allowedLinkSchemes` is additive: built-in `http`, `https`, `mailto`, `tel`, and `sms` links stay enabled, while listed application schemes are added. Use a `urlTransform` such as `httpsOnly` above when links must be HTTPS-only; transformed URLs are validated again before rendering.

Host components, native capabilities, token/math/diagram providers, and the WebView transport are trusted application code. Do not treat the sanitizer as a permission boundary inside trusted adapters. Report vulnerabilities through the repository security channel before public disclosure.

The image-download capability owns the network request. It must call the supplied `validateUrl` before the initial request and before every redirect request, stop reading once `maxBytes` would be exceeded even when `Content-Length` is missing or false, reject MIME types outside `mimeTypes`, and cancel the native request at `timeoutMs`. Streamdown rechecks the returned MIME and byte length before passing the file to `capabilities.files.save`, but that postcondition is not a substitute for bounded native reads. Streamdown supplies no cookies, credentials, or authorization headers; any authentication attached by the host remains the host's security responsibility. `urlTransform` runs once in the renderer, and the capability receives that final transformed URL rather than transforming it again.
