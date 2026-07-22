import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import ts from "typescript";

export const UPSTREAM_REPOSITORY = "https://github.com/vercel/streamdown.git";
export const UPSTREAM_COMMIT = "e5deed330aa4231751a106445d93d62e4716a22f";

const PACKAGES = [
  "streamdown",
  "remend",
  "streamdown-code",
  "streamdown-cjk",
  "streamdown-math",
  "streamdown-mermaid",
] as const;

export type UpstreamPackage = (typeof PACKAGES)[number];
export type TestMode = "run" | "skip" | "only" | "todo";

export interface InventoryCase {
  id: string;
  package: UpstreamPackage;
  path: string;
  line: number;
  column: number;
  suite: string[];
  title: string;
  fullName: string;
  kind: "it" | "test";
  mode: TestMode;
  ordinal: number;
}

export interface InventoryFile {
  package: UpstreamPackage;
  path: string;
  sha256: string;
  cases: InventoryCase[];
}

export interface Inventory {
  schemaVersion: 1;
  upstream: { repository: string; commit: string };
  fileCount: number;
  caseCount: number;
  packageCounts: Record<UpstreamPackage, number>;
  files: InventoryFile[];
}

export interface ManifestEntry {
  upstreamId: string;
  classification: "exact" | "adapted" | "browser-only" | "known-upstream-bug";
  status: "planned" | "implemented";
  target: {
    path: string;
    assertion: string;
    marker: string;
    proof?: { testFile: string; fullName: string };
  };
  evidence?: {
    adaptation?: string;
    platform?: string;
    upstreamBug?: string;
    correctedRegression?: string;
  };
}

export interface Manifest {
  schemaVersion: 1;
  upstream: { repository: string; commit: string };
  inventorySha256: string;
  entries: ManifestEntry[];
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const inventorySha256 = (inventory: Inventory) => sha256(stableJson(inventory));

export function sourceCommit(repositoryRoot: string): string {
  const result = spawnSync("git", ["-C", resolve(repositoryRoot), "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Cannot read upstream commit: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function assertPinnedSource(repositoryRoot: string): void {
  const actualCommit = sourceCommit(repositoryRoot);
  if (actualCommit !== UPSTREAM_COMMIT)
    throw new Error(`Upstream checkout is ${actualCommit}; expected pinned commit ${UPSTREAM_COMMIT}`);
  const status = spawnSync("git", ["-C", resolve(repositoryRoot), "status", "--porcelain"], { encoding: "utf8" });
  if (status.status !== 0) throw new Error(`Cannot inspect upstream checkout: ${status.stderr.trim()}`);
  if (status.stdout.trim()) throw new Error("Upstream checkout has local changes; inventory only the clean pinned commit");
}

function testFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...testFiles(path));
    else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry)) files.push(path);
  }
  return files;
}

function staticTitle(node: ts.Expression | undefined, source: ts.SourceFile): string {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  const location = node ? source.getLineAndCharacterOfPosition(node.getStart(source)) : { line: 0, character: 0 };
  throw new Error(
    `Unsupported dynamic test registration at ${source.fileName}:${location.line + 1}:${location.character + 1}; use a static string title`
  );
}

function registration(expression: ts.Expression): { name: "describe" | "it" | "test"; mode: TestMode } | null {
  const modifiers: string[] = [];
  let current = expression;
  while (ts.isPropertyAccessExpression(current)) {
    modifiers.unshift(current.name.text);
    current = current.expression;
  }
  if (!ts.isIdentifier(current) || !["describe", "it", "test"].includes(current.text)) return null;
  const unsupported = modifiers.find((modifier) => !["skip", "only", "todo", "concurrent"].includes(modifier));
  if (unsupported) throw new Error(`Unsupported dynamic test registration .${unsupported}`);
  return {
    name: current.text as "describe" | "it" | "test",
    mode: modifiers.includes("skip") || modifiers.includes("todo")
      ? (modifiers.includes("todo") ? "todo" : "skip")
      : modifiers.includes("only") ? "only" : "run",
  };
}

export function inventoryFile(
  absolutePath: string,
  packageName: UpstreamPackage,
  repositoryRoot: string
): InventoryFile {
  const content = readFileSync(absolutePath, "utf8");
  const source = ts.createSourceFile(absolutePath, content, ts.ScriptTarget.Latest, true,
    absolutePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const path = relative(repositoryRoot, absolutePath).replace(/\\/g, "/");
  const cases: InventoryCase[] = [];
  const duplicateOrdinals = new Map<string, number>();

  const visit = (node: ts.Node, suites: string[]): void => {
    if (ts.isCallExpression(node)) {
      const registered = registration(node.expression);
      if (registered) {
        const title = staticTitle(node.arguments[0], source);
        if (registered.name === "describe") {
          const callback = node.arguments[1];
          if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
            const position = source.getLineAndCharacterOfPosition(node.getStart(source));
            throw new Error(`Unsupported dynamic suite callback at ${path}:${position.line + 1}`);
          }
          visit(callback.body, [...suites, title]);
          return;
        }
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        const fullName = [...suites, title].join(" > ");
        const duplicateKey = `${packageName}\0${path}\0${fullName}`;
        const ordinal = (duplicateOrdinals.get(duplicateKey) ?? 0) + 1;
        duplicateOrdinals.set(duplicateKey, ordinal);
        cases.push({
          id: sha256(`${duplicateKey}\0${ordinal}`),
          package: packageName,
          path,
          line: position.line + 1,
          column: position.character + 1,
          suite: suites,
          title,
          fullName,
          kind: registered.name,
          mode: registered.mode,
          ordinal,
        });
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, suites));
  };

  visit(source, []);
  return { package: packageName, path, sha256: sha256(content), cases };
}

export function buildInventory(repositoryRoot: string, commit = UPSTREAM_COMMIT): Inventory {
  const root = resolve(repositoryRoot);
  const files = PACKAGES.flatMap((packageName) => {
    const directory = join(root, "packages", packageName, "__tests__");
    return testFiles(directory).map((path) => inventoryFile(path, packageName, root));
  }).sort((a, b) => a.path.localeCompare(b.path));
  const packageCounts = Object.fromEntries(PACKAGES.map((name) => [name, 0])) as Record<UpstreamPackage, number>;
  for (const file of files) packageCounts[file.package] += file.cases.length;
  return {
    schemaVersion: 1,
    upstream: { repository: UPSTREAM_REPOSITORY, commit },
    fileCount: files.length,
    caseCount: files.reduce((count, file) => count + file.cases.length, 0),
    packageCounts,
    files,
  };
}

function plannedTarget(testCase: InventoryCase): ManifestEntry {
  const file = basename(testCase.path).replace(/\.tsx?$/, ".test.ts");
  const exact = testCase.package === "remend" || testCase.package === "streamdown-cjk";
  const marker = `parity:${testCase.id}`;
  return {
    upstreamId: testCase.id,
    classification: exact ? "exact" : "adapted",
    status: "planned",
    target: {
      path: `tests/parity/ports/${testCase.package}/${file}`,
      assertion: exact
        ? `Preserve the observable behavior asserted by upstream case “${testCase.fullName}”.`
        : `Assert the React Native semantic equivalent of upstream case “${testCase.fullName}” without relying on DOM output.`,
      marker,
    },
    ...(exact ? {} : { evidence: {
      adaptation: `Upstream ${testCase.package} case ${testCase.path}:${testCase.line} exercises web-facing behavior; the planned target asserts its platform-neutral contract through native semantics.`,
    } }),
  };
}

export function buildManifest(inventory: Inventory, previous?: Manifest): Manifest {
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.upstreamId, entry]));
  const entries = inventory.files.flatMap((file) => file.cases).map((testCase) =>
    previousEntries.get(testCase.id) ?? plannedTarget(testCase));
  return {
    schemaVersion: 1,
    upstream: inventory.upstream,
    inventorySha256: inventorySha256(inventory),
    entries,
  };
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

if (process.argv[1]?.endsWith("scripts/parity/inventory.ts")) {
  const sourceRoot = resolve(argument("--source", ".reference/streamdown"));
  const inventoryPath = resolve(argument("--inventory", "parity/upstream.json"));
  const manifestPath = resolve(argument("--manifest", "parity/manifest.json"));
  assertPinnedSource(sourceRoot);
  const inventory = buildInventory(sourceRoot);
  let previous: Manifest | undefined;
  try { previous = JSON.parse(readFileSync(manifestPath, "utf8")); } catch {}
  writeFileSync(inventoryPath, stableJson(inventory));
  writeFileSync(manifestPath, stableJson(buildManifest(inventory, previous)));
  console.log(`Inventoried ${inventory.caseCount} cases in ${inventory.fileCount} files at ${UPSTREAM_COMMIT}.`);
  for (const [name, count] of Object.entries(inventory.packageCounts)) console.log(`${name}: ${count}`);
}
