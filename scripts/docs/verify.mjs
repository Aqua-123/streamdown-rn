import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const published = JSON.parse(fs.readFileSync(path.join(root, 'tests/package/published-0.2.1.json'), 'utf8'));
const publicDocs = ['README.md', 'ARCHITECTURE.md', 'CHANGELOG.md', 'src/__tests__/README.md'];
const visit = (directory) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'plans' ? [] : visit(target);
    return entry.name.endsWith('.md') ? [path.relative(root, target)] : [];
  });
};
publicDocs.push(...visit(path.join(root, 'docs')));

const publishedImportErrors = (source) => {
  const errors = [];
  let imports = 0;
  for (const match of source.matchAll(/\bimport\s+([^;]+?)\s+from\s+['"](streamdown-rn(?:\/[^'"]+)?)['"]/g)) {
    imports += 1;
    const [, clause, module] = match;
    if (module !== published.package) {
      errors.push(`${module} is not published in ${published.package}@${published.version}`);
      continue;
    }
    const normalized = clause.trim().replace(/^type\s+/, '');
    if (!normalized.startsWith('{') && !normalized.startsWith('*') && !published.topLevelExports.includes('default')) {
      errors.push(`default is not exported by ${published.package}@${published.version}`);
    }
    const named = normalized.match(/\{([\s\S]*?)\}/)?.[1] ?? '';
    for (const item of named.split(',').map((value) => value.trim()).filter(Boolean)) {
      const name = item.replace(/^type\s+/, '').split(/\s+as\s+/, 1)[0];
      if (!published.topLevelExports.includes(name)) errors.push(`${name} is not exported by ${published.package}@${published.version}`);
    }
  }
  if (!imports) errors.push(`published example must import ${published.package}`);
  return errors;
};

const collectFences = (relative, markdown) => {
  const errors = [];
  const snippets = [];
  for (const match of markdown.matchAll(/```(tsx?|json)(?:\s+([a-z-]+))?\n([\s\S]*?)```/g)) {
    const [, language, marker, source] = match;
    if (language === 'json') {
      try { JSON.parse(source); } catch (error) { errors.push(`${relative}: invalid JSON fence: ${error.message}`); }
    } else if (marker === 'verify') snippets.push({ relative, language, source });
    else if (marker === 'verify-published') {
      if (relative !== 'README.md') errors.push(`${relative}: published examples belong in README.md`);
      errors.push(...publishedImportErrors(source).map((error) => `${relative}: ${error}`));
      snippets.push({ relative, language, source });
    } else if (marker !== 'noverify') errors.push(`${relative}: ${language} fence must be marked verify, verify-published, or noverify`);
  }
  return { errors, snippets };
};

if (process.argv.includes('--self-test')) {
  assert.deepEqual(publishedImportErrors("import { StreamdownRN } from 'streamdown-rn';"), []);
  assert.match(publishedImportErrors("import { Streamdown } from 'streamdown-rn';")[0], /Streamdown is not exported/);
  assert.match(collectFences('README.md', "```tsx\nimport { Streamdown } from 'streamdown-rn';\n```").errors[0], /must be marked/);
  console.log(`Published ${published.package}@${published.version} documentation checks reject unreleased and unlabeled imports.`);
  process.exit(0);
}

const errors = [];
const snippets = [];
let publishedSnippets = 0;
for (const relative of [...new Set(publicDocs)].sort()) {
  const file = path.join(root, relative);
  const markdown = fs.readFileSync(file, 'utf8');
  for (const forbidden of ['Prism-based', 'Full Mermaid support', 'Stable blocks never re-render']) {
    if (markdown.includes(forbidden)) errors.push(`${relative}: stale or absolute claim: ${forbidden}`);
  }
  const fences = collectFences(relative, markdown);
  errors.push(...fences.errors);
  snippets.push(...fences.snippets);
  publishedSnippets += [...markdown.matchAll(/```tsx?\s+verify-published\n/g)].length;
  if (relative === 'README.md') {
    if (!markdown.includes(`npm \`${published.version}\``)) errors.push(`${relative}: missing published version ${published.version}`);
    for (const range of Object.values(published.peerDependencies)) {
      if (!markdown.includes(`\`${range}\``)) errors.push(`${relative}: missing published peer range ${range}`);
    }
  }
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1].split('#', 1)[0];
    if (!link || /^(?:https?:|mailto:)/.test(link)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(link));
    if (!fs.existsSync(target)) errors.push(`${relative}: broken local link ${match[1]}`);
  }
}

if (!snippets.length) errors.push('No verified TypeScript documentation examples found');
if (!publishedSnippets) errors.push('No verified published-package README example found');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const temporary = fs.mkdtempSync(path.join(root, '.docs-verify-'));
let compileFailure;
try {
  snippets.forEach(({ relative, language, source }, index) => {
    fs.writeFileSync(path.join(temporary, `example-${index}.${language}`), `// ${relative}\n${source}\n`);
  });
  fs.writeFileSync(path.join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020', module: 'CommonJS', moduleResolution: 'Node', jsx: 'react-jsx',
      strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
      baseUrl: root,
      paths: {
        'streamdown-rn': ['dist/index.d.ts'],
        'streamdown-rn/ui': ['dist/components/ui/index.d.ts'],
        'streamdown-rn/*': ['dist/plugins/*/index.d.ts'],
      },
    }, include: ['./*.ts', './*.tsx'],
  }));
  const result = spawnSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', path.join(temporary, 'tsconfig.json')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') },
  });
  if (result.status !== 0) {
    compileFailure = { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } else {
    console.log(`Verified ${snippets.length} TypeScript examples across ${publicDocs.length} documentation files.`);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
if (compileFailure) {
  process.stderr.write(compileFailure.stdout); process.stderr.write(compileFailure.stderr); process.exitCode = compileFailure.status;
}
