import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import {
  type Inventory,
  type Manifest,
  type ManifestEntry,
  UPSTREAM_COMMIT,
  assertPinnedSource,
  buildInventory,
  inventorySha256,
} from "./inventory";

export interface ValidationOptions { projectRoot?: string; sourceRoot?: string; verifySource?: boolean }

function required(value: unknown, message: string, errors: string[]): value is string {
  if (typeof value !== "string" || value.trim() === "") { errors.push(message); return false; }
  return true;
}

function executableFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => executableFiles(resolve(path, entry)));
}

function markerCounts(root: string, manifest: Manifest): Map<string, number> {
  const extensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
  const files = [resolve(root, "src"), resolve(root, "tests")]
    .flatMap(executableFiles)
    .filter((path) => extensions.has(extname(path)));
  const source = files.map((path) => readFileSync(path, "utf8")).join("\n");
  return new Map(manifest.entries.map((entry) => [
    entry.target.marker,
    source.split(entry.target.marker).length - 1,
  ]));
}

function validateEntry(entry: ManifestEntry, root: string, errors: string[]): void {
  const prefix = entry.upstreamId || "<missing upstreamId>";
  if (!["exact", "adapted", "browser-only", "known-upstream-bug"].includes(entry.classification))
    errors.push(`${prefix}: invalid or bare N/A classification “${String(entry.classification)}”`);
  if (!["planned", "implemented"].includes(entry.status)) errors.push(`${prefix}: invalid status`);
  required(entry.target?.path, `${prefix}: missing target path`, errors);
  required(entry.target?.assertion, `${prefix}: missing target semantic assertion`, errors);
  required(entry.target?.marker, `${prefix}: missing target marker`, errors);
  if (entry.classification === "adapted")
    required(entry.evidence?.adaptation, `${prefix}: adapted mapping needs platform adaptation evidence`, errors);
  if (entry.classification === "browser-only")
    required(entry.evidence?.platform, `${prefix}: browser-only mapping needs case-specific platform evidence`, errors);
  if (entry.classification === "known-upstream-bug") {
    required(entry.evidence?.upstreamBug, `${prefix}: known-upstream-bug needs upstream evidence`, errors);
    required(entry.evidence?.correctedRegression, `${prefix}: known-upstream-bug needs corrected regression evidence`, errors);
  }
  if (entry.status === "implemented" && entry.target?.path) {
    const target = resolve(root, entry.target.path);
    if (!existsSync(target)) errors.push(`${prefix}: implemented target does not exist: ${entry.target.path}`);
    else if (entry.target.marker && !readFileSync(target, "utf8").includes(entry.target.marker))
      errors.push(`${prefix}: implemented target is missing marker ${entry.target.marker}`);
  }
}

export function validateParity(inventory: Inventory, manifest: Manifest, options: ValidationOptions = {}): string[] {
  const errors: string[] = [];
  const root = resolve(options.projectRoot ?? ".");
  if (inventory.upstream.commit !== UPSTREAM_COMMIT || manifest.upstream.commit !== UPSTREAM_COMMIT)
    errors.push(`pin mismatch: expected ${UPSTREAM_COMMIT}`);
  if (manifest.inventorySha256 !== inventorySha256(inventory)) errors.push("manifest inventorySha256 does not match parity/upstream.json");
  if (inventory.caseCount !== inventory.files.reduce((total, file) => total + file.cases.length, 0))
    errors.push("inventory caseCount is inconsistent");
  const inventoryCases = inventory.files.flatMap((file) => file.cases);
  const expected = new Map(inventoryCases.map((testCase) => [testCase.id, testCase]));
  if (expected.size !== inventoryCases.length) errors.push("inventory contains duplicate case IDs");
  for (const [packageName, declared] of Object.entries(inventory.packageCounts)) {
    const actual = inventoryCases.filter((testCase) => testCase.package === packageName).length;
    if (actual !== declared) errors.push(`inventory packageCounts.${packageName} is ${declared}; expected ${actual}`);
  }
  const mapped = new Map<string, number>();
  const markers = markerCounts(root, manifest);
  for (const entry of manifest.entries) {
    mapped.set(entry.upstreamId, (mapped.get(entry.upstreamId) ?? 0) + 1);
    validateEntry(entry, root, errors);
    const markerCount = markers.get(entry.target.marker) ?? 0;
    if (markerCount !== 1)
      errors.push(`${entry.upstreamId}: target marker must occur exactly once in executable source; found ${markerCount}`);
    if (!expected.has(entry.upstreamId)) errors.push(`${entry.upstreamId}: mapping does not exist in pinned inventory`);
  }
  for (const [id, testCase] of expected) {
    const count = mapped.get(id) ?? 0;
    if (count === 0) errors.push(`${id}: missing mapping for ${testCase.path} :: ${testCase.fullName}`);
    else if (count > 1) errors.push(`${id}: duplicate mapping (${count} entries)`);
  }
  if (options.verifySource !== false && options.sourceRoot) {
    const actual = buildInventory(options.sourceRoot);
    if (inventorySha256(actual) !== inventorySha256(inventory)) errors.push("pinned source snapshot does not match committed inventory (paths, cases, or file hashes changed)");
  }
  return errors;
}

if (process.argv[1]?.endsWith("scripts/parity/validate.ts")) {
  const inventory: Inventory = JSON.parse(readFileSync("parity/upstream.json", "utf8"));
  const manifest: Manifest = JSON.parse(readFileSync("parity/manifest.json", "utf8"));
  const errors = validateParity(inventory, manifest, { projectRoot: ".", sourceRoot: ".reference/streamdown" });
  try { assertPinnedSource(".reference/streamdown"); }
  catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`Parity ledger valid: ${inventory.caseCount} pinned cases, ${manifest.entries.length} unique mappings.`);
}
