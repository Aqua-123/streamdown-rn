import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import {
  type Inventory,
  type Manifest,
  type ManifestEntry,
  UPSTREAM_COMMIT,
  assertPinnedSource,
  buildInventory,
  inventorySha256,
} from "./inventory";

export interface JestAssertionResult {
  fullName: string;
  numPassingAsserts: number;
  status: string;
}

export interface JestTestResult {
  assertionResults: JestAssertionResult[];
  name: string;
}

export interface JestResults { testResults: JestTestResult[] }

export interface ValidationOptions {
  jestResults?: JestResults;
  projectRoot?: string;
  sourceRoot?: string;
  verifySource?: boolean;
}

export interface ProofStrength {
  strong: boolean;
  reason?: string;
}

function importedTestSources(path: string, seen = new Set<string>()): Array<{ path: string; source: string }> {
  const absolute = resolve(path);
  if (seen.has(absolute) || !existsSync(absolute)) return [];
  seen.add(absolute);
  const source = readFileSync(absolute, "utf8");
  const imported = [...source.matchAll(/(?:import|export)\s+(?:[^'\"]*?from\s*)?['\"](\.[^'\"]+)['\"]/g)]
    .flatMap((match) => {
      const base = resolve(dirname(absolute), match[1]);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.native.ts`, `${base}.native.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")];
      const target = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      return target ? importedTestSources(target, seen) : [];
    });
  return [{ path: absolute, source }, ...imported];
}

function registration(call: ts.CallExpression): { title: ts.Expression; body: ts.Node; table?: ts.Expression } | undefined {
  const direct = ts.isIdentifier(call.expression) && ["it", "test"].includes(call.expression.text);
  const each = ts.isCallExpression(call.expression)
    && ts.isPropertyAccessExpression(call.expression.expression)
    && call.expression.expression.name.text === "each"
    && ts.isIdentifier(call.expression.expression.expression)
    && ["it", "test"].includes(call.expression.expression.expression.text);
  if (!direct && !each) return undefined;
  const title = call.arguments[0];
  const body = call.arguments[call.arguments.length - 1];
  if (!title || !body) return undefined;
  return { title, body, table: each ? call.expression.arguments[0] : undefined };
}

function titlePattern(title: ts.Expression): RegExp | undefined {
  let value: string;
  if (ts.isStringLiteralLike(title)) value = title.text;
  else if (ts.isTemplateExpression(title)) value = title.head.text + title.templateSpans.map((span) => `__DYNAMIC__${span.literal.text}`).join("");
  else return undefined;
  const escaped = value.replace(/__DYNAMIC__|%[sdifjop#]|\$[A-Za-z_][\w.]*/g, "__WILDCARD__")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/__WILDCARD__/g, "[\\s\\S]+?");
  return new RegExp(`${escaped}$`);
}

function resolveTable(table: ts.Expression | undefined, file: ts.SourceFile): ts.Expression | undefined {
  if (!table) return undefined;
  let value = table;
  while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value)) value = value.expression;
  if (ts.isIdentifier(value)) {
    let declaration: ts.VariableDeclaration | undefined;
    const name = value.text;
    const visit = (node: ts.Node): void => {
      if (!declaration && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) declaration = node;
      if (!declaration) ts.forEachChild(node, visit);
    };
    visit(file);
    if (declaration?.initializer) return resolveTable(declaration.initializer, file);
  }
  return value;
}

function hasConcreteAssertion(source: string): boolean {
  const file = ts.createSourceFile("proof.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let concrete = false;
  const visit = (node: ts.Node): void => {
    if (concrete) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      let receiver: ts.Expression = node.expression.expression;
      while (ts.isPropertyAccessExpression(receiver)) receiver = receiver.expression;
      if (ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression) && receiver.expression.text === "expect") {
        const actual = receiver.arguments[0];
        const expected = node.arguments[0];
        const matcher = node.expression.name.text;
        const actualText = actual?.getText(file).trim();
        const expectedText = expected?.getText(file).trim();
        const markerOnly = !!actualText && /^[A-Za-z_$][\w$]*$/.test(actualText) && /(?:marker|label)/i.test(actualText);
        const literal = !!actual && (ts.isStringLiteralLike(actual) || ts.isNumericLiteral(actual)
          || actual.kind === ts.SyntaxKind.TrueKeyword || actual.kind === ts.SyntaxKind.FalseKeyword);
        const selfComparison = ["toBe", "toEqual", "toContain"].includes(matcher) && actualText === expectedText && (markerOnly || literal);
        const literalTruthiness = literal && ["toBeTruthy", "toBeFalsy", "toBeDefined"].includes(matcher);
        if (!markerOnly && !selfComparison && !literalTruthiness) concrete = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return concrete;
}

function hasConcreteHelperAssertion(row: ts.Node, file: ts.SourceFile): boolean {
  let valid = false;
  const visit = (node: ts.Node): void => {
    if (valid || !ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name) || node.name.text !== "run" || !ts.isCallExpression(node.initializer)) {
      if (!valid) ts.forEachChild(node, visit);
      return;
    }
    const options = node.initializer.arguments.find(ts.isObjectLiteralExpression);
    const expectedKeys = options?.properties.flatMap((property) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text.startsWith("expected") ? [property.name.text] : []) ?? [];
    if (expectedKeys.length === 0 || !ts.isIdentifier(node.initializer.expression)) return;
    const helperName = node.initializer.expression.text;
    let helper: ts.Node | undefined;
    const find = (candidate: ts.Node): void => {
      if (!helper && ts.isFunctionDeclaration(candidate) && candidate.name?.text === helperName) helper = candidate;
      if (!helper && ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === helperName) helper = candidate.initializer;
      if (!helper) ts.forEachChild(candidate, find);
    };
    find(file);
    const helperSource = helper?.getText(file) ?? "";
    valid = hasConcreteAssertion(helperSource) && expectedKeys.some((key) => helperSource.includes(key));
  };
  visit(row);
  return valid;
}

function rowAttestation(table: ts.Expression | undefined, body: ts.Node, marker: string, fullName: string, file: ts.SourceFile): ProofStrength | undefined {
  if (!table) return undefined;
  const value = resolveTable(table, file);
  if (!value || !ts.isArrayLiteralExpression(value)) return { strong: false, reason: "table-driven proof data could not be source-attested" };
  const row = value.elements.find((candidate) => candidate.getFullText(file).includes(marker));
  if (!row) return { strong: false, reason: "marker is not local to the exact parameterized row" };
  const rowSource = row.getFullText(file);
  const literals: Array<{ numeric: boolean; value: string }> = [];
  const collect = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) literals.push({ numeric: false, value: node.text });
    if (ts.isNumericLiteral(node)) literals.push({ numeric: true, value: node.text });
    ts.forEachChild(node, collect);
  };
  collect(row);
  if (!literals.some(({ numeric, value: literal }) => (literal.length > 2 && fullName.includes(literal))
    || (!numeric && fullName.includes(JSON.stringify(literal)))
    || (!numeric && /^[A-Za-z0-9_-]+$/.test(literal) && new RegExp(`(?:^|\\s)${literal}(?:$|\\s)`).test(fullName))
    || (numeric && new RegExp(`(?:^|\\D)${literal}(?:$|\\D)`).test(fullName))))
    return { strong: false, reason: "parameterized row fixture/title does not identify the named runtime case" };
  const shaped = (ts.isArrayLiteralExpression(row) && row.elements.length >= 2)
    || (ts.isObjectLiteralExpression(row) && row.properties.length >= 2);
  if (!shaped) return { strong: false, reason: "table-driven proof row must contain its own fixture and expected value or concrete run assertion" };
  if (!hasConcreteAssertion(rowSource) && !hasConcreteAssertion(body.getText(file)) && !hasConcreteHelperAssertion(row, file))
    return { strong: false, reason: "parameterized row has no concrete expected value or run assertion" };
  return { strong: true };
}

export function inspectProofStrength(root: string, proof: NonNullable<ManifestEntry["target"]["proof"]>, marker: string): ProofStrength {
  const files = importedTestSources(resolve(root, proof.testFile));
  let fallback: ProofStrength | undefined;
  for (const candidate of files) {
    const file = ts.createSourceFile(candidate.path, candidate.source, ts.ScriptTarget.Latest, true, candidate.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    let matched: ProofStrength | undefined;
    let weak: ProofStrength | undefined;
    const visit = (node: ts.Node): void => {
      if (matched || !ts.isCallExpression(node)) { if (!matched) ts.forEachChild(node, visit); return; }
      const test = registration(node);
      const pattern = test && titlePattern(test.title);
      if (test && pattern?.test(proof.fullName)) {
        const row = rowAttestation(test.table, test.body, marker, proof.fullName, file);
        const result = row
          ?? (!node.getFullText(file).includes(marker)
            ? { strong: false, reason: "marker is not associated with the named proof case" }
            : !hasConcreteAssertion(test.body.getText(file))
              ? { strong: false, reason: "proof source is label-only, marker-only, or tautological" }
              : { strong: true });
        if (result.strong) matched = result;
        else weak ??= result;
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    if (matched) return matched;
    fallback ??= weak;
  }
  return fallback ?? { strong: false, reason: "named proof case could not be source-attested" };
}

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
  if (entry.status === "implemented" && ["exact", "adapted"].includes(entry.classification)) {
    required(entry.target?.proof?.testFile, `${prefix}: executable mapping needs a proof test file`, errors);
    required(entry.target?.proof?.fullName, `${prefix}: executable mapping needs a proof full name`, errors);
    if (entry.target?.proof?.testFile && entry.target.proof.testFile !== entry.target.path)
      errors.push(`${prefix}: proof test file must match target path`);
  }
  if (entry.status === "implemented" && entry.target?.path) {
    const target = resolve(root, entry.target.path);
    if (!existsSync(target)) errors.push(`${prefix}: implemented target does not exist: ${entry.target.path}`);
    else if (entry.target.marker) {
      const markerSource = entry.target.proof
        ? importedTestSources(resolve(root, entry.target.proof.testFile)).map((file) => file.source).join("\n")
        : readFileSync(target, "utf8");
      if (!markerSource.includes(entry.target.marker)) errors.push(`${prefix}: implemented target/import closure is missing marker ${entry.target.marker}`);
    }
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
  const proofOwners = new Map<string, string>();
  const results = new Map<string, JestAssertionResult>();
  for (const suite of options.jestResults?.testResults ?? []) {
    const testFile = resolve(suite.name);
    for (const assertion of suite.assertionResults) {
      const key = `${testFile}\0${assertion.fullName}`;
      if (results.has(key)) errors.push(`Jest results contain duplicate case: ${suite.name} :: ${assertion.fullName}`);
      results.set(key, assertion);
    }
  }
  for (const entry of manifest.entries) {
    mapped.set(entry.upstreamId, (mapped.get(entry.upstreamId) ?? 0) + 1);
    validateEntry(entry, root, errors);
    const markerCount = markers.get(entry.target.marker) ?? 0;
    if (markerCount !== 1)
      errors.push(`${entry.upstreamId}: target marker must occur exactly once in executable source; found ${markerCount}`);
    if (!expected.has(entry.upstreamId)) errors.push(`${entry.upstreamId}: mapping does not exist in pinned inventory`);
    const upstreamCase = expected.get(entry.upstreamId);
    if (upstreamCase && ["exact", "adapted"].includes(entry.classification) && !entry.target.assertion.includes(upstreamCase.fullName))
      errors.push(`${entry.upstreamId}: executable assertion must name pinned case “${upstreamCase.fullName}”`);
    const proof = entry.target?.proof;
    if (proof) {
      const proofKey = `${resolve(root, proof.testFile)}\0${proof.fullName}`;
      const owner = proofOwners.get(proofKey);
      if (owner) errors.push(`${entry.upstreamId}: proof case is already used by ${owner}`);
      else proofOwners.set(proofKey, entry.upstreamId);
      const strength = inspectProofStrength(root, proof, entry.target.marker);
      if (!strength.strong) errors.push(`${entry.upstreamId}: weak executable proof: ${strength.reason}`);
      if (options.jestResults) {
        const result = results.get(proofKey);
        if (!result) errors.push(`${entry.upstreamId}: proof case did not execute: ${proof.testFile} :: ${proof.fullName}`);
        else if (result.status !== "passed") errors.push(`${entry.upstreamId}: proof case status is ${result.status}, expected passed`);
        else if (result.numPassingAsserts < 1) errors.push(`${entry.upstreamId}: proof case has no passing observable assertion`);
      }
    }
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
  const resultIndex = process.argv.indexOf("--jest-results");
  const jestResults = resultIndex === -1
    ? undefined
    : JSON.parse(readFileSync(process.argv[resultIndex + 1], "utf8")) as JestResults;
  const errors = validateParity(inventory, manifest, {
    jestResults,
    projectRoot: ".",
    sourceRoot: ".reference/streamdown",
  });
  try { assertPinnedSource(".reference/streamdown"); }
  catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  const executable = manifest.entries.filter((entry) => ["exact", "adapted"].includes(entry.classification)).length;
  const browserOnly = manifest.entries.filter((entry) => entry.classification === "browser-only").length;
  const upstreamBugs = manifest.entries.filter((entry) => entry.classification === "known-upstream-bug").length;
  const runtime = jestResults ? ", all executable proofs passed" : "";
  console.log(`Parity ledger valid: ${inventory.caseCount} pinned cases, ${manifest.entries.length} unique mappings, ${executable} executable proofs${runtime}.`);
  const strengths = manifest.entries.flatMap((entry) => entry.target.proof ? [inspectProofStrength(resolve("."), entry.target.proof, entry.target.marker)] : []);
  const strong = strengths.filter((strength) => strength.strong).length;
  const weak = strengths.length - strong;
  console.log(`Proof strength: ${strong} strong executable, ${weak} weak executable, ${browserOnly} browser-only, ${upstreamBugs} known-upstream-bug.`);
}
