import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "streamdown-rn-parity-"));
const results = join(directory, "jest-results.json");

try {
  const test = spawnSync("bun", ["run", "test", "--silent", "--json", `--outputFile=${results}`], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (test.status !== 0) process.exit(test.status ?? 1);

  const validation = spawnSync("bun", ["scripts/parity/validate.ts", "--jest-results", results], {
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exitCode = validation.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
