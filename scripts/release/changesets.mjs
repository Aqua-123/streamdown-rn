import fs from 'node:fs';
import path from 'node:path';

const directory = path.resolve('.changeset');
const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
const errors = [];
if (config.baseBranch !== 'main') errors.push('Changesets baseBranch must be main');
if (config.access !== 'public') errors.push('Changesets access must be public');
const files = fs.readdirSync(directory).filter((name) => name.endsWith('.md') && name !== 'README.md');
for (const name of files) {
  const source = fs.readFileSync(path.join(directory, name), 'utf8').trimEnd();
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n\n(.+)$/);
  if (!frontmatter) { errors.push(`${name}: invalid frontmatter or missing summary`); continue; }
  if (!/^"streamdown-rn": (?:patch|minor|major)$/m.test(frontmatter[1])) errors.push(`${name}: missing streamdown-rn release type`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Verified Changesets configuration and ${files.length} pending release changeset(s).`);
