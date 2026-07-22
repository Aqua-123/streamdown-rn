#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { deriveDeviceAssertions, deviceEvidenceUrl, validDeviceCaptureCommand, validDeviceLaunchCommand } from './device-evidence.mjs';

const args = process.argv.slice(2);
const options = Object.fromEntries(args.reduce((pairs, value, index, values) => {
  if (value.startsWith('--') && values[index + 1] && !values[index + 1].startsWith('--')) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const required = ['coverage-id', 'host', 'platform', 'scenario', 'commit', 'package-sha256', 'matrix-sha256', 'raw', 'result'];
if (required.some((name) => !options[name])) throw new Error(`usage: device-capture.mjs ${required.map((name) => `--${name} VALUE`).join(' ')} [--interaction-timeout-ms 120000]`);
if (!/^[a-f0-9]{40}$/.test(options.commit) || !/^[a-f0-9]{64}$/.test(options['package-sha256']) || !/^[a-f0-9]{64}$/.test(options['matrix-sha256'])) throw new Error('invalid source or matrix digest');
if (![options.raw, options.result].every((value) => /^tests\/device\/results\/[A-Za-z0-9._-]+$/.test(value))) throw new Error('capture outputs must be direct files under tests/device/results');
const interactionTimeoutMs = options['interaction-timeout-ms'] === undefined ? 120_000 : Number(options['interaction-timeout-ms']);
if (!Number.isSafeInteger(interactionTimeoutMs) || interactionTimeoutMs < 1_000 || interactionTimeoutMs > 120_000) throw new Error('--interaction-timeout-ms must be an integer from 1000 to 120000');
const source = { commit: options.commit, packageSha256: options['package-sha256'] };
const identity = { coverageId: options['coverage-id'], host: options.host, platform: options.platform, scenario: options.scenario, buildType: 'release', engine: 'hermes', source, captureId: crypto.randomUUID() };
const url = deviceEvidenceUrl(identity);
const appId = options.host === 'expo54' ? 'ai.darkresearch.streamdownrn.expo54' : 'ai.darkresearch.streamdownrn.expo56';
const launch = options.platform === 'android'
  ? ['adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, `${appId}/.MainActivity`]
  : ['xcrun', 'simctl', 'openurl', 'booted', url];
const command = options.platform === 'android'
  ? ['adb', 'logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I']
  : ['xcrun', 'simctl', 'spawn', 'booted', 'log', 'show', '--style', 'compact', '--last', '5m', '--predicate', `process == "streamdown-rn-${options.host}-fixture"`];
if (!validDeviceLaunchCommand(identity, launch) || !validDeviceCaptureCommand(options.platform, command, options.host)) throw new Error('unsupported platform or invalid checked-in device evidence command');

const startedAt = new Date().toISOString();
const launched = spawnSync(launch[0], launch.slice(1), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (launched.error) throw launched.error;
if (launched.status !== 0) throw new Error(`device launch exited ${launched.status}`);
let execution;
let raw = '';
for (let attempt = 0; attempt < Math.ceil(interactionTimeoutMs / 500); attempt += 1) {
  execution = spawnSync(command[0], command.slice(1), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  raw = `${execution.stdout ?? ''}${execution.stderr ?? ''}`;
  if (raw.includes(identity.captureId)) break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
}
const completedAt = new Date().toISOString();
fs.writeFileSync(options.raw, raw);
if (execution.error) throw execution.error;
if (execution.status !== 0) throw new Error(`device command exited ${execution.status}`);
const rawSha256 = crypto.createHash('sha256').update(raw).digest('hex');
const assertions = deriveDeviceAssertions(identity, raw, [rawSha256]);
if (!assertions) throw new Error('device output did not contain the required deterministic runtime markers');
fs.writeFileSync(options.result, `${JSON.stringify({
  schemaVersion: 1, coverageId: identity.coverageId, host: identity.host, platform: identity.platform, scenario: identity.scenario, buildType: identity.buildType, engine: identity.engine, source, status: 'passed', evidenceType: 'device-runtime',
  retainedArtifacts: [{ path: options.raw, sha256: rawSha256 }],
  receipt: { schemaVersion: 1, producer: 'streamdown-device-capture/v1', matrixSha256: options['matrix-sha256'], coverageId: identity.coverageId, captureId: identity.captureId, source, launch: { argv: launch, exitCode: 0 }, command: { argv: command, exitCode: 0 }, startedAt, completedAt, rawArtifactSha256: [rawSha256] },
  assertions,
}, null, 2)}\n`);
