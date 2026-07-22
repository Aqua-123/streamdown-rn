import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256Evidence } from './hermes-metrics.mjs';

const GENERATOR = 'streamdown-rn-trace-export/v1';
const PREFIX = 'streamdown-rn:';
const IOS_SUBSYSTEM = 'ai.futurix.streamdown-rn';
const IOS_CATEGORY = 'hermes-benchmark';
const FRAME_BUDGET_NS = 16_666_667;

function fail(message) { throw new Error(message); }
function csvRows(csv) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"' && quoted && csv[index + 1] === '"') { field += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function makeExport(rawTrace, platform, appends, jsFrames, uiFrames) {
  if (!appends.length || !jsFrames.length || !uiFrames.length) fail(`${platform} trace lacks required appends or JS/UI frame intervals`);
  return {
    schemaVersion: 1, generator: GENERATOR, sourceTraceSha256: sha256Evidence(rawTrace), platform, appends,
    frames: {
      js: jsFrames.map((durationNs) => ({ durationNs, budgetNs: FRAME_BUDGET_NS })),
      ui: uiFrames.map((durationNs) => ({ durationNs, budgetNs: FRAME_BUDGET_NS })),
    },
  };
}

export function parseAndroidTraceProcessorCsv(csv, rawTrace) {
  const [header, ...rows] = csvRows(csv);
  if (header?.join(',') !== 'name,ts,dur') fail('unexpected trace_processor_shell CSV schema');
  const appends = [], jsFrames = [], uiFrames = [];
  for (const [name, start, duration] of rows) {
    const startNs = Number(start), durationNs = Number(duration);
    if (!Number.isSafeInteger(startNs) || !Number.isSafeInteger(durationNs) || durationNs < 0) fail('Android trace contains invalid timestamps');
    if (name.startsWith(`${PREFIX}append:`)) appends.push({ appendId: name.slice(`${PREFIX}append:`.length), startNs, commitNs: startNs + durationNs });
    else if (name === `${PREFIX}js-frame`) jsFrames.push(durationNs);
    else if (name === `${PREFIX}ui-frame`) uiFrames.push(durationNs);
  }
  return makeExport(rawTrace, 'android', appends, jsFrames, uiFrames);
}

function decodeXml(value) {
  return value.replace(/<[^>]+>/g, '').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&').trim();
}
export function parseXctraceSignposts(xml, rawTrace) {
  const values = new Map();
  for (const match of xml.matchAll(/<([\w-]+)\b([^>]*\bid="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/g)) values.set(match[3], decodeXml(match[4]));
  const field = (row, tag) => {
    const match = row.match(new RegExp(`<${tag}\\b([^>]*)(?:>([\\s\\S]*?)<\\/${tag}>|\\/>)`));
    if (!match) return '';
    const ref = match[1].match(/\bref="(\d+)"/); return ref ? values.get(ref[1]) ?? '' : decodeXml(match[2] ?? '');
  };
  const open = new Map(), appends = [], jsFrames = [], uiFrames = [];
  for (const match of xml.matchAll(/<row>([\s\S]*?)<\/row>/g)) {
    const row = match[1];
    if (field(row, 'subsystem') !== IOS_SUBSYSTEM || field(row, 'category') !== IOS_CATEGORY) continue;
    const name = field(row, 'signpost-name');
    if (!['streamdown.append', 'streamdown.js-frame', 'streamdown.ui-frame'].includes(name)) continue;
    const timestamp = Number(field(row, 'event-time'));
    const identifier = field(row, 'os-signpost-identifier');
    const eventType = field(row, 'event-type').toLowerCase();
    if (!Number.isSafeInteger(timestamp) || !identifier) fail('iOS signpost contains invalid identity or timestamp');
    const key = `${identifier}:${name}`;
    if (eventType.includes('begin')) {
      if (open.has(key)) fail(`duplicate iOS signpost begin: ${name}`);
      let appendId;
      if (name === 'streamdown.append') {
        try { appendId = JSON.parse(field(row, 'os-log-metadata')).appendId; } catch { fail('iOS append signpost message must be JSON'); }
        if (typeof appendId !== 'string' || !appendId) fail('iOS append signpost lacks appendId');
      }
      open.set(key, { timestamp, appendId });
    } else if (eventType.includes('end')) {
      const begin = open.get(key);
      if (!begin || timestamp < begin.timestamp) fail(`unpaired iOS signpost end: ${name}`);
      open.delete(key);
      const duration = timestamp - begin.timestamp;
      if (name === 'streamdown.append') appends.push({ appendId: begin.appendId, startNs: begin.timestamp, commitNs: timestamp });
      else if (name === 'streamdown.js-frame') jsFrames.push(duration);
      else uiFrames.push(duration);
    }
  }
  if (open.size) fail('iOS trace contains unpaired benchmark signposts');
  return makeExport(rawTrace, 'ios', appends, jsFrames, uiFrames);
}

export function extractHermesTrace(rawTrace, platform) {
  if (platform === 'android') {
    const query = `select name, ts, dur from slice where name glob '${PREFIX}append:*' or name in ('${PREFIX}js-frame','${PREFIX}ui-frame') order by ts`;
    const csv = execFileSync('trace_processor_shell', [rawTrace, '-q', query, '--csv'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    return parseAndroidTraceProcessorCsv(csv, rawTrace);
  }
  if (platform !== 'ios') fail(`unsupported trace platform: ${platform}`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-xctrace-'));
  try {
    const output = path.join(directory, 'signposts.xml');
    execFileSync('xcrun', ['xctrace', 'export', '--input', rawTrace, '--xpath', '//trace-toc[1]/run[1]/data[1]/table[@schema="os-signpost"]', '--output', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
    if (fs.statSync(output).size > 32 * 1024 * 1024) fail('iOS signpost export exceeds 32 MiB');
    return parseXctraceSignposts(fs.readFileSync(output, 'utf8'), rawTrace);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function selfTest() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdown-trace-self-test-'));
  try {
    const raw = path.join(directory, 'raw.trace-data');
    fs.writeFileSync(raw, 'raw trace bytes');
    const android = parseAndroidTraceProcessorCsv('name,ts,dur\nstreamdown-rn:append:1,100,10\nstreamdown-rn:js-frame,200,8\nstreamdown-rn:ui-frame,300,9\n', raw);
    if (android.appends[0]?.commitNs !== 110 || android.frames.js[0]?.durationNs !== 8) fail('Android parser self-test failed');
    const row = (time, type, id, name, message = '') => `<row><event-time>${time}</event-time><event-type>${type}</event-type><os-signpost-identifier>${id}</os-signpost-identifier><signpost-name>${name}</signpost-name><subsystem>${IOS_SUBSYSTEM}</subsystem><category>${IOS_CATEGORY}</category><os-log-metadata>${message}</os-log-metadata></row>`;
    const xml = `<trace-query-result>${row(100, 'Begin', '1', 'streamdown.append', '{&quot;appendId&quot;:&quot;1&quot;}')}${row(110, 'End', '1', 'streamdown.append')}${row(200, 'Begin', '2', 'streamdown.js-frame')}${row(208, 'End', '2', 'streamdown.js-frame')}${row(300, 'Begin', '3', 'streamdown.ui-frame')}${row(309, 'End', '3', 'streamdown.ui-frame')}</trace-query-result>`;
    const ios = parseXctraceSignposts(xml, raw);
    if (ios.appends[0]?.commitNs !== 110 || ios.frames.ui[0]?.durationNs !== 9) fail('iOS parser self-test failed');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    console.log('Hermes platform-trace extractor self-test passed.');
    process.exit(0);
  }
  const [rawTrace, platform, output] = process.argv.slice(2);
  if (!rawTrace || !['android', 'ios'].includes(platform) || !output) {
    console.error('Usage: node scripts/benchmarks/extract-hermes-trace.mjs <raw-trace> <android|ios> <trace-export.json>');
    process.exit(2);
  }
  try { fs.writeFileSync(output, `${JSON.stringify(extractHermesTrace(rawTrace, platform), null, 2)}\n`, { flag: 'wx' }); }
  catch (error) { console.error(`Hermes trace extraction blocked: ${error.message}`); process.exit(1); }
}
