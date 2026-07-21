import { SHOWCASE_SAMPLE } from './showcase-sample';

export const HARNESS_SAMPLES = [
  {
    id: 'overview',
    label: 'Everything',
    eyebrow: 'Full surface',
    description: 'A compact tour of every major renderer and interaction.',
    markdown: SHOWCASE_SAMPLE,
  },
  {
    id: 'typography',
    label: 'Typography',
    eyebrow: 'Core Markdown',
    description: 'Headings, emphasis, quotes, links, rules, and nested lists.',
    markdown: `# Heading one\n\n## Heading two\n\n### Heading three\n\nA paragraph with **bold**, *italic*, ~~strikethrough~~, \`inline code\`, and [a link](https://streamdown.ai).\n\n> A blockquote can hold **formatted text** and multiple lines.\n>\n> It should remain readable while streaming.\n\n---\n\n1. First item\n2. Second item\n   - Nested bullet\n   - Another bullet\n3. Final item`,
  },
  {
    id: 'tasks',
    label: 'Lists',
    eyebrow: 'GFM controls',
    description: 'Nested ordered lists, bullets, and interactive-looking tasks.',
    markdown: `## Release readiness\n\n- [x] API parity\n- [x] Native renderer\n- [ ] Visual review\n- [ ] Performance gate\n\n### Nested plan\n\n1. Parse the stream\n   1. Preserve incomplete syntax\n   2. Memoize stable blocks\n2. Render native views\n   - Keep semantics\n   - Respect direction\n3. Measure every append`,
  },
  {
    id: 'tables',
    label: 'Tables',
    eyebrow: 'Responsive data',
    description: 'Alignment, long values, and table controls on a narrow screen.',
    markdown: `## Model comparison\n\n| Model | Context | Input | Output |\n|:--|--:|--:|--:|\n| Swift Mini | 128k | $0.15 | $0.60 |\n| Reason Pro | 200k | $3.00 | $15.00 |\n| Local Small | 32k | Free | Free |\n\n| Feature with a deliberately long name | Support |\n|---|---|\n| Incremental block stabilization | ✅ Native |\n| Horizontal overflow behavior | ✅ Scrollable |`,
  },
  {
    id: 'code',
    label: 'Code',
    eyebrow: 'Syntax rendering',
    description: 'Line numbers, highlighted lines, inline code, and incomplete fences.',
    markdown: `Use \`createCodePlugin\` to provide a native highlighter.\n\n\`\`\`typescript showLineNumbers {3-4}
type StreamState = "idle" | "running" | "complete";

function append(chunk: string) {
  return previous + chunk;
}
\`\`\`\n\n\`\`\`json
{ "platform": "react-native", "streaming": true }
\`\`\``,
  },
  {
    id: 'math',
    label: 'Math',
    eyebrow: 'Inline + display',
    description: 'Equations powered by the configured native math adapter.',
    markdown: `## A little mathematics\n\nEuler's identity is $e^{i\\pi}+1=0$. Inline expressions should sit naturally in a sentence.\n\n$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n$$\\begin{matrix}1&2\\\\3&4\\end{matrix}$$\n\nAnd a sum: $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$.`,
  },
  {
    id: 'mermaid',
    label: 'Diagrams',
    eyebrow: 'Mermaid to SVG',
    description: 'Flowcharts rendered as responsive native SVG artwork.',
    markdown: `## Streaming architecture\n\n\`\`\`mermaid
flowchart TD
  Tokens[LLM tokens] --> Buffer
  Buffer --> Remend
  Remend --> Markdown
  Markdown --> Stable[Stable blocks]
  Markdown --> Active[Active block]
  Stable --> Native[Native components]
  Active --> Native
\`\`\``,
  },
  {
    id: 'languages',
    label: 'CJK + RTL',
    eyebrow: 'International text',
    description: 'Mixed scripts, punctuation, emphasis, and direction changes.',
    markdown: `## International content\n\n中文段落中的**粗体文字**与*斜体文字*应当正确换行。\n\n日本語の文章でも、句読点と**強調表示**が自然に見える必要があります。\n\nمرحبا بالعالم. هذا نص عربي يحتوي على **كلمات بارزة** ورابط [للمثال](https://example.com).\n\nEnglish can appear alongside 中文 and العربية in the same stream.`,
  },
  {
    id: 'incomplete',
    label: 'Incomplete',
    eyebrow: 'Streaming edges',
    description: 'Intentionally unfinished syntax for exercising remend behavior.',
    markdown: `${SHOWCASE_SAMPLE}\n\n## Still arriving\n\nThis sentence contains **emphasis that has not finished\n\n[and a link still being written](https://example.com`,
  },
  {
    id: 'performance',
    label: 'Long stream',
    eyebrow: 'Performance',
    description: 'A repeated mixed-content corpus for profiling append behavior.',
    markdown: Array.from({ length: 18 }, (_, index) => `## Segment ${index + 1}\n\nA stable paragraph with **formatting**, \`inline code\`, and a [link](https://example.com/${index + 1}).\n\n- item one\n- item two\n- item three\n\n| pass | value |\n|---|---:|\n| ${index + 1} | ${(index + 1) * 128} |`).join('\n\n'),
  },
];

export const DEFAULT_SAMPLE = HARNESS_SAMPLES[0];
