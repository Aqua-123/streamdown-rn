import { fileURLToPath } from 'node:url';
import { deriveHermesMetricsFromFiles } from './hermes-metrics.mjs';

export function derive(eventsFile, traceExportFile, rawTraceFile, platform) {
  return deriveHermesMetricsFromFiles(eventsFile, traceExportFile, rawTraceFile, platform);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [eventsFile, traceExportFile, rawTraceFile, platform] = process.argv.slice(2);
  if (!eventsFile || !traceExportFile || !rawTraceFile || !['android', 'ios'].includes(platform)) {
    console.error('Usage: node scripts/benchmarks/derive-hermes.mjs <events.jsonl> <trace-export.json> <raw-trace-file> <android|ios>');
    process.exit(2);
  }
  try { console.log(JSON.stringify(derive(eventsFile, traceExportFile, rawTraceFile, platform), null, 2)); }
  catch (error) { console.error(`Hermes metric derivation blocked: ${error.message}`); process.exit(1); }
}
