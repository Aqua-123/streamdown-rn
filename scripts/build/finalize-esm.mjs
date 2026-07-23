import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

const nativeComponentSource = path.join('src', 'native', 'StreamdownTextNativeComponent.ts');
const nativeComponentOutput = path.join('dist', 'native', 'StreamdownTextNativeComponent.js');
const transformedNativeComponent = babel.transformFileSync(nativeComponentSource, {
  filename: nativeComponentSource,
  presets: [require.resolve('@react-native/babel-preset')],
  sourceMaps: true,
  sourceFileName: nativeComponentSource,
});
if (!transformedNativeComponent?.code) {
  throw new Error(`${nativeComponentSource}: React Native Babel transform produced no static view config`);
}
fs.writeFileSync(nativeComponentOutput, `${transformedNativeComponent.code}\n`);
if (transformedNativeComponent.map) {
  fs.writeFileSync(`${nativeComponentOutput}.map`, JSON.stringify(transformedNativeComponent.map));
}

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const entries = Object.values(manifest.exports).flatMap((conditions) => {
  if (typeof conditions === 'string') return [];
  const cjs = conditions.require?.default ?? conditions.default;
  const esm = conditions.import?.default;
  if (typeof cjs !== 'string' || typeof esm !== 'string') throw new Error('Every package export requires import and CommonJS targets');
  return [{
    cjsPath: cjs.replace(/^\.\//, ''),
    declarationPath: conditions.require?.types.replace(/^\.\//, ''),
    wrapperPath: esm.replace(/^\.\//, ''),
    esmDeclarationPath: conditions.import?.types.replace(/^\.\//, ''),
  }];
});

const relativeModule = (from, to) => {
  const relative = path.relative(path.dirname(from), to).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
};

for (const { cjsPath, declarationPath, wrapperPath, esmDeclarationPath } of entries) {
  const modulePath = relativeModule(wrapperPath, cjsPath);
  const source = fs.readFileSync(cjsPath, 'utf8');
  if (/\b__exportStar\s*\(/.test(source)) {
    throw new Error(`${cjsPath}: package entrypoints must use explicit exports so ESM wrappers cannot silently omit names`);
  }
  if (!declarationPath || !fs.statSync(declarationPath).isFile() || fs.statSync(declarationPath).size === 0) {
    throw new Error(`${cjsPath}: missing CommonJS declarations`);
  }
  const names = [
    ...source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g),
    ...source.matchAll(/Object\.defineProperty\(exports,\s*["']([A-Za-z_$][\w$]*)["']/g),
  ]
    .map((match) => match[1])
    .filter((name, index, values) => !['default', '__esModule'].includes(name) && values.indexOf(name) === index)
    .sort();
  const hasDefault = /exports\.default\s*=|Object\.defineProperty\(exports,\s*["']default["']/.test(source);
  const lines = names.length ? [`export { ${names.join(', ')} } from '${modulePath}';`] : [];
  if (hasDefault) {
    lines.push(
      `import cjsModule from '${modulePath}';`,
      "const resolvedDefault = cjsModule && typeof cjsModule === 'object' && 'default' in cjsModule ? cjsModule.default : cjsModule;",
      'export default resolvedDefault;'
    );
  }
  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
  fs.writeFileSync(wrapperPath, `${lines.join('\n')}\n`);

  const declarationModule = relativeModule(esmDeclarationPath, cjsPath);
  const declarationLines = [`export * from '${declarationModule}';`];
  if (hasDefault) declarationLines.push(`export { default } from '${declarationModule}';`);
  fs.writeFileSync(esmDeclarationPath, `${declarationLines.join('\n')}\n`);
}

fs.writeFileSync(path.join('dist', 'esm', 'package.json'), '{"type":"module"}\n');
