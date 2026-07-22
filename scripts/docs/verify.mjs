import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const published = JSON.parse(fs.readFileSync(path.join(root, 'tests/package/published-0.2.1.json'), 'utf8'));
const sourcePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const promotionSelfTest = spawnSync(process.execPath, [path.join(root, 'scripts/docs/promote-release.mjs'), '--self-test'], { cwd: root, encoding: 'utf8' });
if (promotionSelfTest.status !== 0) throw new Error(`${promotionSelfTest.stdout}${promotionSelfTest.stderr}`);
const publicDocs = ['README.md', 'ARCHITECTURE.md', 'CHANGELOG.md', 'SECURITY.md', 'src/__tests__/README.md'];
const packagedDocs = new Set(sourcePackage.files.filter((file) => file.endsWith('.md')));
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
  for (const match of source.matchAll(/\bimport\s+([^;]+?)\s+from\s+['"](streamdown-(?:rn|native)(?:\/[^'"]+)?)['"]/g)) {
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
    } else if (marker === 'verify') snippets.push({ relative, language, source, target: 'source' });
    else if (marker === 'verify-published') {
      if (relative !== 'README.md') errors.push(`${relative}: published examples belong in README.md`);
      errors.push(...publishedImportErrors(source).map((error) => `${relative}: ${error}`));
      snippets.push({ relative, language, source, target: 'published' });
    } else if (marker !== 'noverify') errors.push(`${relative}: ${language} fence must be marked verify, verify-published, or noverify`);
  }
  return { errors, snippets };
};

const transitionErrors = (relative, markdown, sourceVersion, promotedMode) => {
  if (sourceVersion === published.version || !promotedMode || !packagedDocs.has(relative)) return [];
  const stale = ['Unreleased / next release', `npm \`${published.version}\``, `Published npm ${published.version}`]
    .filter((marker) => markdown.includes(marker));
  return stale.map((marker) => `${relative}: package ${sourceVersion} cannot publish with stale marker ${marker}`);
};

const lifecycleErrors = (readme, changelog) => {
  const errors = [];
  const development = readme.includes('> **Published versus next release:**');
  const promoted = readme.includes('> **Current release:**');
  if (development === promoted) errors.push('README.md: exactly one documentation lifecycle marker is required');
  const unreleased = [...changelog.matchAll(/^## Unreleased\s*$/gm)].length;
  if (development && unreleased !== 1) errors.push('CHANGELOG.md: development mode requires exactly one Unreleased section');
  if (promoted && unreleased) errors.push('CHANGELOG.md: promoted release must not contain an Unreleased section');
  for (const match of changelog.matchAll(/^## (\d+\.\d+\.\d+)\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
    if (/^### Release status\s*$/m.test(match[2]) || /publishing remains blocked/i.test(match[2])) {
      errors.push(`CHANGELOG.md: version ${match[1]} contains a development-only release status`);
    }
  }
  return errors;
};

if (process.argv.includes('--self-test')) {
  assert.deepEqual(publishedImportErrors("import { StreamdownRN } from 'streamdown-rn';"), []);
  assert.match(publishedImportErrors("import { Streamdown } from 'streamdown-rn';")[0], /Streamdown is not exported/);
  assert.match(collectFences('README.md', "```tsx\nimport { Streamdown } from 'streamdown-rn';\n```").errors[0], /must be marked/);
  assert.match(transitionErrors('README.md', `npm \`${published.version}\``, '0.3.0', true)[0], /stale marker/);
  assert.deepEqual(transitionErrors('README.md', 'Unreleased / next release', '0.3.0', false), []);
  assert.match(lifecycleErrors('> **Current release:**', '# package\n\n## Unreleased\n')[0], /must not contain/);
  assert.match(lifecycleErrors('> **Current release:**', '# package\n\n## 0.3.0\n\n### Release status\n\nPublishing remains blocked.\n')[0], /development-only/);
  console.log(`Published ${published.package}@${published.version} documentation checks reject unreleased and unlabeled imports.`);
  process.exit(0);
}

const errors = [];
const snippets = [];
let publishedSnippets = 0;
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const promotedMode = readmeSource.includes('> **Current release:**');
for (const relative of [...new Set(publicDocs)].sort()) {
  const file = path.join(root, relative);
  const markdown = fs.readFileSync(file, 'utf8');
  for (const forbidden of ['Prism-based', 'Full Mermaid support', 'Stable blocks never re-render']) {
    if (markdown.includes(forbidden)) errors.push(`${relative}: stale or absolute claim: ${forbidden}`);
  }
  const fences = collectFences(relative, markdown);
  errors.push(...fences.errors);
  errors.push(...transitionErrors(relative, markdown, sourcePackage.version, promotedMode));
  snippets.push(...fences.snippets);
  publishedSnippets += [...markdown.matchAll(/```tsx?\s+verify-published\n/g)].length;
  if (relative === 'README.md') {
    if (sourcePackage.version === published.version) {
      if (!markdown.includes(`npm \`${published.version}\``)) errors.push(`${relative}: missing published version ${published.version}`);
      for (const range of Object.values(published.peerDependencies)) {
        if (!markdown.includes(`\`${range}\``)) errors.push(`${relative}: missing published peer range ${range}`);
      }
    }
  }
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1].split('#', 1)[0];
    if (!link || /^(?:https?:|mailto:)/.test(link)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(link));
    if (!fs.existsSync(target)) errors.push(`${relative}: broken local link ${match[1]}`);
  }
}
errors.push(...lifecycleErrors(readmeSource, fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')));

if (!snippets.length) errors.push('No verified TypeScript documentation examples found');
if (!publishedSnippets && sourcePackage.version === published.version) errors.push('No verified published-package README example found');
if (sourcePackage.version !== published.version) {
  if (promotedMode && readmeSource.includes('verify-published')) errors.push('README.md: promoted release examples must use verify rather than verify-published');
}
if (!fs.readFileSync(path.join(root, 'README.md'), 'utf8').includes('npm install streamdown-native')) {
  errors.push('README.md: missing npm install command');
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const temporary = fs.mkdtempSync(path.join(root, '.docs-verify-'));
const compileFailures = [];
try {
  let sourceDeclarationsRoot = root;
  if (process.env.STREAMDOWN_RELEASE_TARBALL) {
    const tarball = path.resolve(root, process.env.STREAMDOWN_RELEASE_TARBALL);
    assert(fs.existsSync(tarball), `Missing release tarball ${tarball}`);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'), process.env.STREAMDOWN_RELEASE_PACKAGE_SHA256, 'Release tarball SHA-256 mismatch');
    sourceDeclarationsRoot = path.join(temporary, 'candidate', 'package');
    fs.mkdirSync(path.dirname(sourceDeclarationsRoot), { recursive: true });
    const extracted = spawnSync('tar', ['-xzf', tarball, '-C', path.dirname(sourceDeclarationsRoot)], { cwd: root, encoding: 'utf8' });
    if (extracted.status !== 0) throw new Error(`${extracted.stdout}${extracted.stderr}`);
  }
  for (const target of ['source', 'published']) {
    const selected = snippets.filter((snippet) => snippet.target === target);
    if (!selected.length) continue;
    const directory = path.join(temporary, target);
    fs.mkdirSync(directory);
    selected.forEach(({ relative, language, source }, index) => {
      fs.writeFileSync(path.join(directory, `example-${index}.${language}`), `// ${relative}\n${source}\n`);
    });
    const paths = target === 'published'
      ? { 'streamdown-rn': [path.join(root, 'tests/package/fixtures/published-0.2.1/dist/index.d.ts')] }
      : {
          'streamdown-native': [path.join(sourceDeclarationsRoot, 'dist/index.d.ts')],
          'streamdown-native/ui': [path.join(sourceDeclarationsRoot, 'dist/components/ui/index.d.ts')],
          'streamdown-native/*': [path.join(sourceDeclarationsRoot, 'dist/plugins/*/index.d.ts')],
        };
    fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020', module: 'CommonJS', moduleResolution: 'Node', jsx: 'react-jsx',
        strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
        baseUrl: root, paths,
      }, include: ['./*.ts', './*.tsx'],
    }));
    const result = spawnSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', path.join(directory, 'tsconfig.json')], {
      cwd: root, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') },
    });
    if (result.status !== 0) {
      compileFailures.push({ status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    } else {
      console.log(`Verified ${selected.length} ${target} TypeScript documentation example${selected.length === 1 ? '' : 's'}.`);
    }
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
for (const failure of compileFailures) {
  process.stderr.write(failure.stdout); process.stderr.write(failure.stderr); process.exitCode = failure.status;
}
