import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Manifest,
  UPSTREAM_COMMIT,
  buildInventory,
  buildManifest,
  inventoryFile,
  inventorySha256,
  stableJson,
} from "../../scripts/parity/inventory";
import { compareInventories } from "../../scripts/parity/check-drift";
import { validateParity } from "../../scripts/parity/validate";

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture(source = 'describe("suite", () => { it("case", () => {}); });') {
  const root = mkdtempSync(join(tmpdir(), "parity-test-"));
  temporary.push(root);
  for (const name of ["streamdown", "remend", "streamdown-code", "streamdown-cjk", "streamdown-math", "streamdown-mermaid"])
    mkdirSync(join(root, "packages", name, "__tests__"), { recursive: true });
  const file = join(root, "packages", "streamdown", "__tests__", "sample.test.ts");
  writeFileSync(file, source);
  return { root, file };
}

function validFixture() {
  const { root } = fixture();
  const inventory = buildInventory(root);
  const manifest = buildManifest(inventory);
  return { root, inventory, manifest };
}

describe("pinned parity inventory", () => {
  it("captures nested identities, stable IDs, source lines, and file hashes", () => {
    const { root, file } = fixture('describe("outer", () => { describe("inner", () => { test("works", () => {}); }); });');
    const first = buildInventory(root);
    const second = buildInventory(root);
    expect(stableJson(first)).toBe(stableJson(second));
    expect(first.files[0].cases[0]).toMatchObject({ fullName: "outer > inner > works", line: 1, ordinal: 1 });
    expect(first.files[0].sha256).toBe(createHash("sha256").update(readFileSync(file, "utf8")).digest("hex"));
  });

  it("rejects unsupported dynamic registration", () => {
    const { root, file } = fixture('test.each([[1]])("case %s", () => {});');
    expect(() => inventoryFile(file, "streamdown", root)).toThrow("Unsupported dynamic test registration .each");
  });

  it("keeps the committed pin unchanged during refresh", () => {
    const { inventory } = validFixture();
    const first = buildManifest(inventory);
    const edited = { ...first, entries: [{ ...first.entries[0], target: { ...first.entries[0].target, assertion: "Reviewed assertion." } }] };
    const refreshed = buildManifest(inventory, edited);
    expect(inventory.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(refreshed.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(refreshed.entries[0].target.assertion).toBe("Reviewed assertion.");
  });
});

describe("parity manifest validation", () => {
  it("reports a missing mapping and duplicate mapping", () => {
    const { inventory, manifest } = validFixture();
    const entry = manifest.entries[0];
    expect(validateParity(inventory, { ...manifest, entries: [] }, { verifySource: false })[0]).toContain("missing mapping");
    expect(validateParity(inventory, { ...manifest, entries: [entry, entry] }, { verifySource: false })).toContain(`${entry.upstreamId}: duplicate mapping (2 entries)`);
  });

  it("rejects bare N/A and non-exact classifications without evidence", () => {
    const { inventory, manifest } = validFixture();
    const entry = manifest.entries[0];
    const invalid = (classification: string, evidence?: object): Manifest => ({
      ...manifest,
      entries: [{ ...entry, classification: classification as never, evidence }],
    });
    expect(validateParity(inventory, invalid("N/A"), { verifySource: false }).join("\n")).toContain("invalid or bare N/A");
    expect(validateParity(inventory, invalid("adapted"), { verifySource: false }).join("\n")).toContain("adaptation evidence");
    expect(validateParity(inventory, invalid("browser-only"), { verifySource: false }).join("\n")).toContain("platform evidence");
    expect(validateParity(inventory, invalid("known-upstream-bug", { upstreamBug: "upstream issue" }), { verifySource: false }).join("\n")).toContain("corrected regression evidence");
  });

  it("requires implemented mappings to contain their evidence marker", () => {
    const { root, inventory, manifest } = validFixture();
    const entry = manifest.entries[0];
    mkdirSync(join(root, "tests"), { recursive: true });
    writeFileSync(join(root, "tests", "port.test.ts"), "test('port', () => {});");
    const implemented: Manifest = { ...manifest, entries: [{ ...entry, status: "implemented", target: { ...entry.target, path: "tests/port.test.ts" } }] };
    expect(validateParity(inventory, implemented, { projectRoot: root, verifySource: false }).join("\n")).toContain("missing marker");
  });

  it("detects a changed source hash against the pinned inventory", () => {
    const { root, inventory, manifest } = validFixture();
    writeFileSync(join(root, "packages", "streamdown", "__tests__", "sample.test.ts"), 'describe("suite", () => { it("case", () => { expect(2).toBe(2); }); });');
    expect(validateParity(inventory, manifest, { sourceRoot: root }).join("\n")).toContain("source snapshot does not match");
  });
});

describe("advisory upstream drift", () => {
  it("reports unchanged and advanced candidates without changing the pinned inventory", () => {
    const { root, inventory } = validFixture();
    expect(compareInventories(inventory, buildInventory(root))).toEqual({ added: [], removed: [], changedFiles: [] });
    const before = inventorySha256(inventory);
    writeFileSync(join(root, "packages", "streamdown", "__tests__", "sample.test.ts"), '\n\ndescribe("suite", () => { it("case", () => {}); });');
    expect(compareInventories(inventory, buildInventory(root))).toEqual({
      added: [], removed: [], changedFiles: ["packages/streamdown/__tests__/sample.test.ts"],
    });
    writeFileSync(join(root, "packages", "streamdown", "__tests__", "sample.test.ts"), 'describe("suite", () => { it("new case", () => {}); });');
    const report = compareInventories(inventory, buildInventory(root, "candidate-main"));
    expect(report.added).toHaveLength(1);
    expect(report.removed).toHaveLength(1);
    expect(report.changedFiles).toEqual(["packages/streamdown/__tests__/sample.test.ts"]);
    expect(inventorySha256(inventory)).toBe(before);
  });
});
