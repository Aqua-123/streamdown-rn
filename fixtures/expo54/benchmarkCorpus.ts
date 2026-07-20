const SOURCE = `# Native streaming benchmark

This corpus mixes **emphasis**, _style_, [safe links](https://example.com), inline \`code\`, and an image fallback.

- [x] completed task
- [ ] pending task
- nested
  - list

| Package | Platform | Status |
|---|---|---:|
| streamdown-rn | iOS | ready |
| streamdown-rn | Android | ready |

\`\`\`typescript title="stream.ts"
export function append(previous: string, chunk: string) {
  return previous + chunk;
}
\`\`\`

> Stable blocks must not rerender while the active tail grows.

Inline math $x^2 + y^2$ remains readable without an adapter.

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

\`\`\`mermaid
flowchart LR
  Input --> Parse --> Native
\`\`\`

中文**强调**，日本語の文章、한국어 문장입니다。

مرحبا بالعالم، هذا نص من اليمين إلى اليسار.

<widget>{"state":"safe"}</widget>

The final construct is intentionally incomplete for streaming repair: [reference](https://example.com
`;

export function buildBenchmarkCorpus(targetBytes = 10_240): string {
  const bytes = (value: string) => {
    let total = 0;
    for (const character of value) {
      const point = character.codePointAt(0)!;
      total += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    }
    return total;
  };
  const sourceBytes = bytes(SOURCE);
  let text = SOURCE.repeat(Math.floor(targetBytes / sourceBytes));
  let remaining = targetBytes - bytes(text);
  for (const character of SOURCE) {
    const size = bytes(character);
    if (size > remaining) break;
    text += character;
    remaining -= size;
  }
  return text + ' '.repeat(remaining);
}
