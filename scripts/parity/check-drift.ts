import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Inventory, UPSTREAM_REPOSITORY, buildInventory } from "./inventory";

export interface DriftReport { added: string[]; removed: string[]; changedFiles: string[] }

export function compareInventories(pinned: Inventory, candidate: Inventory): DriftReport {
  const pinnedCases = new Set(pinned.files.flatMap((file) => file.cases.map((testCase) => testCase.id)));
  const candidateCases = new Set(candidate.files.flatMap((file) => file.cases.map((testCase) => testCase.id)));
  const pinnedFiles = new Map(pinned.files.map((file) => [file.path, file.sha256]));
  const candidateFiles = new Map(candidate.files.map((file) => [file.path, file.sha256]));
  return {
    added: [...candidateCases].filter((id) => !pinnedCases.has(id)).sort(),
    removed: [...pinnedCases].filter((id) => !candidateCases.has(id)).sort(),
    changedFiles: [...new Set([...pinnedFiles.keys(), ...candidateFiles.keys()])]
      .filter((path) => pinnedFiles.get(path) !== candidateFiles.get(path)).sort(),
  };
}

if (process.argv[1]?.endsWith("scripts/parity/check-drift.ts")) {
  const pinned: Inventory = JSON.parse(readFileSync("parity/upstream.json", "utf8"));
  const candidateArg = process.argv.indexOf("--candidate-root");
  let temporary: string | undefined;
  let candidateRoot: string;
  if (candidateArg !== -1) candidateRoot = resolve(process.argv[candidateArg + 1]);
  else {
    temporary = mkdtempSync(join(tmpdir(), "streamdown-drift-"));
    const clone = spawnSync("git", ["clone", "--depth=1", UPSTREAM_REPOSITORY, temporary], { encoding: "utf8" });
    if (clone.status !== 0) throw new Error(clone.stderr);
    candidateRoot = temporary;
  }
  try {
    const report = compareInventories(pinned, buildInventory(candidateRoot, "candidate-main"));
    const drift = report.added.length || report.removed.length || report.changedFiles.length;
    console.log(JSON.stringify({ drift: Boolean(drift), ...report }, null, 2));
    // Advisory by design: drift never mutates the committed pin or fails normal CI.
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
