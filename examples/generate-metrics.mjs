import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'examples/performance');
const colors = ['#7c3aed', '#0891b2', '#16a34a', '#ea580c', '#dc2626'];
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const parseRun = (file) => JSON.parse(execFileSync('bun', [file], { cwd: root, encoding: 'utf8' }).trim().split('\n').at(-1));

export function barChart(title, subtitle, entries, unit = 'ms') {
  const width = 960;
  const height = 110 + entries.length * 58;
  const max = Math.max(...entries.map(([, value]) => value), 0.001);
  const bars = entries.map(([label, value], index) => {
    const y = 92 + index * 58;
    const barWidth = Math.max(2, (value / max) * 590);
    return `<text x="24" y="${y + 19}" class="label">${escape(label)}</text><rect x="230" y="${y}" width="${barWidth.toFixed(1)}" height="28" rx="7" fill="${colors[index % colors.length]}"/><text x="${Math.min(860, 242 + barWidth).toFixed(1)}" y="${y + 19}" class="value">${value.toFixed(value < 1 ? 3 : 2)} ${unit}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escape(title)}</title><desc id="desc">${escape(subtitle)}</desc><rect width="100%" height="100%" rx="18" fill="#fafafa"/><style>.title{font:700 24px system-ui;fill:#18181b}.subtitle{font:14px system-ui;fill:#71717a}.label{font:600 14px system-ui;fill:#3f3f46}.value{font:600 13px ui-monospace,monospace;fill:#27272a}</style><text x="24" y="38" class="title">${escape(title)}</text><text x="24" y="64" class="subtitle">${escape(subtitle)}</text>${bars}</svg>\n`;
}

if (process.argv.includes('--self-test')) {
  const svg = barChart('A & B', 'Host only', [['p95', 1.25]]);
  assert.match(svg, /A &amp; B/);
  assert.match(svg, /1\.25 ms/);
  process.stdout.write('examples metrics self-test passed\n');
  process.exit(0);
}

const parser = parseRun('benchmarks/parser.bench.ts');
const streaming = parseRun('benchmarks/streaming.bench.ts');
const metadata = {
  generatedAt: new Date().toISOString(),
  scope: 'Host Node characterization; not release-Hermes or physical-device evidence.',
  testedCeilings: {
    wholeBlockBytes: Math.max(...Object.keys(streaming.metrics.longBlockWholeAppendMs).map(Number)),
    incrementalBlockBytes: Math.max(...Object.keys(streaming.metrics.incrementalLongBlockMs.paragraph).map(Number)),
    markdownBlocks: Math.max(...Object.keys(streaming.metrics.manyBlockWholeAppendMs).map(Number)),
  },
  parser,
  streaming,
};

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'host-metrics.json'), `${JSON.stringify(metadata, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'parser-latency.svg'), barChart(
  '10 KiB parse latency',
  `${parser.environment.engine} on ${parser.environment.host}; lower is better`,
  [['p50', parser.metrics.parserP50Ms], ['p95', parser.metrics.parserP95Ms], ['max', parser.metrics.parserMaxMs]],
));
fs.writeFileSync(path.join(output, 'streaming-latency.svg'), barChart(
  '32-character streaming append latency',
  `${streaming.corpus.bytes.toLocaleString()} byte mixed Markdown corpus; lower is better`,
  [['p50', streaming.metrics.splitterP50Ms], ['p95', streaming.metrics.splitterP95Ms], ['max', streaming.metrics.splitterMaxMs]],
));
fs.writeFileSync(path.join(output, 'content-stress.svg'), barChart(
  'Whole-block stress characterization',
  `Largest tested block: ${(metadata.testedCeilings.wholeBlockBytes / 1024).toLocaleString()} KiB (tested ceiling, not a maximum)`,
  Object.entries(streaming.metrics.longBlockWholeAppendMs).map(([bytes, ms]) => [`${Number(bytes) / 1024} KiB`, ms]),
));
fs.writeFileSync(path.join(output, 'block-count-stress.svg'), barChart(
  'Many-block stress characterization',
  `Largest tested document: ${metadata.testedCeilings.markdownBlocks.toLocaleString()} Markdown blocks (tested ceiling, not a maximum)`,
  Object.entries(streaming.metrics.manyBlockWholeAppendMs).map(([blocks, ms]) => [`${Number(blocks).toLocaleString()} blocks`, ms]),
));
process.stdout.write(`Wrote metrics and four graphs to ${output}\n`);
