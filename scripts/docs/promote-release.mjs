import assert from 'node:assert/strict';
import fs from 'node:fs';

const unreleasedSection = /^## Unreleased\s*\n([\s\S]*?)(?=^## \d|(?![\s\S]))/m;
const releaseStatus = /^### Release status\s*\n[\s\S]*?(?=^## |^### |(?![\s\S]))/m;

function promotedChangelog(source, version) {
  const match = source.match(unreleasedSection);
  if (!match) {
    if (!source.includes(`## ${version}`)) throw new Error('CHANGELOG.md: expected release-transition marker is missing');
    return source;
  }
  const body = match[1].replace(releaseStatus, '').trim()
    .replace(/^### Minor Changes$/m, '### Release highlights');
  let next = source.replace(unreleasedSection, '');
  const versionHeading = `## ${version}`;
  if (next.includes(versionHeading)) {
    if (body) next = next.replace(`${versionHeading}\n`, `${versionHeading}\n\n${body}\n`);
  } else {
    const titleEnd = next.indexOf('\n');
    next = `${next.slice(0, titleEnd + 1)}\n${versionHeading}${body ? `\n\n${body}` : ''}\n${next.slice(titleEnd + 1).replace(/^\n+/, '\n')}`;
  }
  return next;
}

function reopenedChangelog(source) {
  if (unreleasedSection.test(source)) return source;
  const titleEnd = source.indexOf('\n');
  if (titleEnd === -1 || !source.startsWith('# ')) throw new Error('CHANGELOG.md: expected release-transition marker is missing');
  return `${source.slice(0, titleEnd + 1)}\n## Unreleased\n\n${source.slice(titleEnd + 1).replace(/^\n+/, '')}`;
}

export function promotedDocuments(files, version) {
  const required = (file, pattern, replacement) => {
    const source = files.get(file);
    if (typeof source !== 'string' || !pattern.test(source)) {
      throw new Error(`${file}: expected release-transition marker is missing`);
    }
    files.set(file, source.replace(pattern, replacement));
  };

  const readme = files.get('README.md');
  if (typeof readme !== 'string') throw new Error('README.md: expected release-transition marker is missing');

  const changelog = files.get('CHANGELOG.md');
  if (typeof changelog !== 'string') throw new Error('CHANGELOG.md: expected release-transition marker is missing');
  files.set('CHANGELOG.md', promotedChangelog(changelog, version));

  if (readme.includes('> **Current release:**')) {
    required('README.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Current release:** This branch documents npm \`${version}\`.\n`);
    required('docs/api.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Current release:** API for npm \`${version}\`.\n`);
    required('docs/plugins.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Current release:** Plugin entry points for npm \`${version}\`.\n`);
    return files;
  }

  required('README.md', /> \*\*Published versus next release:[^\n]*\n/, `> **Current release:** This branch documents npm \`${version}\`.\n`);
  required(
    'README.md',
    /## Published npm [^\n]+[\s\S]*?## Unreleased \/ next release\n\n/,
    `## Install\n\n\`\`\`bash\nnpm install streamdown-native\n\`\`\`\n\n`
  );
  required(
    'README.md',
    /(?:The source package requires React 19 and React Native `\^0\.81\.0 \|\| \^0\.85\.0`\.(?: Its `Streamdown`, mode, capabilities, and plugin-subpath APIs are not in npm `[^`]+`\.| Its APIs currently match npm `[^`]+`; new Changesets must describe any divergence\.)|The package requires React 19 and React Native `\^0\.81\.0 \|\| \^0\.85\.0`\.)/,
    'The package requires React 19 and React Native `^0.81.0 || ^0.85.0`.'
  );
  required('README.md', /`StreamdownRN` and the default export are aliases of `Streamdown`(?: in the next release)?\./, '`StreamdownRN` and the default export are aliases of `Streamdown`.');
  required('README.md', /## Next-release features/, '## Features');
  required('README.md', /The following pages describe unreleased main-branch source unless they explicitly say otherwise\./, 'The following pages document the current release.');
  required('docs/api.md', /> \*\*Unreleased \/ next release:[^\n]*\n/, `> **Current release:** API for npm \`${version}\`.\n`);
  required('docs/plugins.md', /> \*\*Unreleased \/ next release:[^\n]*\n/, `> **Current release:** Plugin entry points for npm \`${version}\`.\n`);
  return files;
}

export function reopenedDocuments(files, version) {
  const required = (file, pattern, replacement) => {
    const source = files.get(file);
    if (typeof source !== 'string' || !pattern.test(source)) {
      throw new Error(`${file}: expected release-transition marker is missing`);
    }
    files.set(file, source.replace(pattern, replacement));
  };
  const readme = files.get('README.md');
  if (typeof readme !== 'string') throw new Error('README.md: expected release-transition marker is missing');
  const changelog = files.get('CHANGELOG.md');
  if (typeof changelog !== 'string') throw new Error('CHANGELOG.md: expected release-transition marker is missing');
  files.set('CHANGELOG.md', reopenedChangelog(changelog));
  if (readme.includes('> **Published versus next release:**')) return files;
  const example = readme.match(/```tsx? verify\n[\s\S]*?```/)?.[0];
  if (!example) throw new Error('README.md: current release example is missing');

  required('README.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Published versus next release:** This main branch documents the next release. npm \`${version}\` is the current published package.\n`);
  required(
    'README.md',
    /## Install\n\n```bash\nnpm install streamdown-native\n```\n\n/,
    `## Published npm ${version}\n\n\`\`\`bash\nnpm install streamdown-native\n\`\`\`\n\n${example.replace(' verify\n', ' verify-published\n')}\n\n## Unreleased / next release\n\n`
  );
  required('README.md', /The package requires React 19 and React Native `\^0\.81\.0 \|\| \^0\.85\.0`\./, `The source package requires React 19 and React Native \`^0.81.0 || ^0.85.0\`. Its APIs currently match npm \`${version}\`; new Changesets must describe any divergence.`);
  required('README.md', /`StreamdownRN` and the default export are aliases of `Streamdown`\./, '`StreamdownRN` and the default export are aliases of `Streamdown` in the next release.');
  required('README.md', /## Features/, '## Next-release features');
  required('README.md', /The following pages document the current release\./, 'The following pages describe unreleased main-branch source unless they explicitly say otherwise.');
  required('docs/api.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Unreleased / next release:** This is the main-branch API after npm \`${version}\`.\n`);
  required('docs/plugins.md', /> \*\*Current release:\*\*[^\n]*\n/, `> **Unreleased / next release:** These entry points describe main-branch source after npm \`${version}\`.\n`);
  return files;
}

const paths = ['README.md', 'CHANGELOG.md', 'docs/api.md', 'docs/plugins.md'];
if (process.argv.includes('--self-test')) {
  const fixture = () => new Map([
    ['README.md', '> **Published versus next release:** old\n\n## Published npm 0.2.1\n\n```bash\nnpm install streamdown-native\n```\n\n```tsx verify-published\nold\n```\n\n## Unreleased / next release\n\nThe source package requires React 19 and React Native `^0.81.0 || ^0.85.0`. Its `Streamdown`, mode, capabilities, and plugin-subpath APIs are not in npm `0.2.1`.\n\n```tsx verify\nnewApi();\n```\n\n`StreamdownRN` and the default export are aliases of `Streamdown` in the next release.\n\n## Next-release features\n\nThe following pages describe unreleased main-branch source unless they explicitly say otherwise.\n'],
    ['docs/api.md', '> **Unreleased / next release:** old\n'],
    ['docs/plugins.md', '> **Unreleased / next release:** old\n'],
    ['CHANGELOG.md', '# streamdown-native\n\n## Unreleased\n\n### Minor Changes\n\n- New API.\n\n### Release status\n\n- Publishing remains blocked.\n\n## 0.2.1\n\n- Old release.\n'],
  ]);
  const promoted = promotedDocuments(fixture(), '0.3.0');
  assert.match(promoted.get('README.md'), /npm install streamdown-native/);
  assert.doesNotMatch(promoted.get('README.md'), /next release|Next-release|unreleased|verify-published/i);
  assert.match(promoted.get('docs/api.md'), /npm `0\.3\.0`/);
  assert.match(promoted.get('CHANGELOG.md'), /## 0\.3\.0/);
  assert.doesNotMatch(promoted.get('CHANGELOG.md'), /Unreleased|Publishing remains blocked|Release status/);
  const promotedSnapshot = JSON.stringify([...promoted]);
  promotedDocuments(promoted, '0.3.0');
  assert.equal(JSON.stringify([...promoted]), promotedSnapshot);
  const reopened = reopenedDocuments(promoted, '0.3.0');
  assert.match(reopened.get('README.md'), /Published npm 0\.3\.0/);
  assert.match(reopened.get('README.md'), /verify-published/);
  assert.match(reopened.get('README.md'), /Unreleased \/ next release/);
  assert.match(reopened.get('CHANGELOG.md'), /## Unreleased/);
  const reopenedSnapshot = JSON.stringify([...reopened]);
  reopenedDocuments(reopened, '0.3.0');
  assert.equal(JSON.stringify([...reopened]), reopenedSnapshot);
  const repromoted = promotedDocuments(reopened, '0.4.0');
  assert.match(repromoted.get('README.md'), /npm `0\.4\.0`/);
  assert.match(repromoted.get('docs/api.md'), /npm `0\.4\.0`/);
  assert.match(repromoted.get('docs/plugins.md'), /npm `0\.4\.0`/);
  assert.doesNotMatch(repromoted.get('README.md'), /0\.3\.0/);
  assert.doesNotMatch(repromoted.get('CHANGELOG.md'), /## Unreleased/);
  const afterChangesets = fixture();
  afterChangesets.set('CHANGELOG.md', afterChangesets.get('CHANGELOG.md').replace('## 0.2.1', '## 0.3.0\n\n### Minor Changes\n\n- Generated Changeset.\n\n## 0.2.1'));
  const merged = promotedDocuments(afterChangesets, '0.3.0').get('CHANGELOG.md');
  assert.equal([...merged.matchAll(/^## 0\.3\.0$/gm)].length, 1);
  assert.match(merged, /Generated Changeset/);
  assert.match(merged, /Release highlights/);
  assert.doesNotMatch(merged, /publishing remains blocked/i);
  const incomplete = fixture();
  incomplete.set('README.md', '# missing markers\n');
  assert.throws(() => promotedDocuments(incomplete, '0.3.0'), /expected release-transition marker/);
  console.log('Release documentation promotion self-test passed.');
} else {
  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  const files = new Map(paths.map((file) => [file, fs.readFileSync(file, 'utf8')]));
  if (process.argv.includes('--reopen-next')) reopenedDocuments(files, version);
  else promotedDocuments(files, version);
  // All transformations succeed before any file is written.
  for (const [file, source] of files) fs.writeFileSync(file, source);
}
