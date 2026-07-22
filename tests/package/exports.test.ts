import fs from 'node:fs';
import path from 'node:path';

describe('packed package', () => {
  it('loads every current runtime export from built files', () => {
    const packageRoot = process.env.PACKED_PACKAGE_PATH;
    expect(packageRoot).toBeTruthy();

    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot as string, 'package.json'), 'utf8')
    );
    const rootExport = manifest.exports['.'];

    expect(rootExport.types).toBe('./dist/index.d.ts');
    expect(rootExport['react-native']).toBe('./dist/index.js');
    expect(rootExport.default).toBe('./dist/index.js');

    for (const target of Object.values(rootExport) as string[]) {
      expect(fs.existsSync(path.join(packageRoot as string, target))).toBe(true);
    }

    const api = require(path.join(packageRoot as string, rootExport.default));
    expect(api.default).toBe(api.Streamdown);
    expect(api.StreamdownRN).toBe(api.Streamdown);
    for (const exportName of [
      'StreamdownRN',
      'Streamdown',
      'Skeleton',
      'SkeletonText',
      'SkeletonRect',
      'SkeletonCircle',
      'SkeletonNumber',
      'Button',
      'Dropdown',
      'DropdownRoot',
      'DropdownTrigger',
      'DropdownPopup',
      'DropdownItem',
      'ActionButton',
      'FullscreenModal',
      'NativeLink',
      'PanZoomSurface',
      'defaultIcons',
      'defaultTranslations',
      'defaultNativeCapabilities',
    ]) {
      expect(api[exportName]).toBeDefined();
    }
    expect(typeof api.sanitizeURL).toBe('function');
    expect(typeof api.sanitizeProps).toBe('function');
    expect(typeof api.serializeTable).toBe('function');
    expect(typeof api.resolveCapabilities).toBe('function');

    const uiExport = manifest.exports['./ui'];
    expect(uiExport.types).toBe('./dist/components/ui/index.d.ts');
    expect(uiExport['react-native']).toBe('./dist/components/ui/index.js');
    expect(uiExport.require).toBe('./dist/components/ui/index.js');
    expect(uiExport.default).toBe('./dist/components/ui/index.js');
    for (const target of Object.values(uiExport) as string[]) {
      expect(fs.existsSync(path.join(packageRoot as string, target))).toBe(true);
    }
    const ui = require(path.join(packageRoot as string, uiExport.default));
    expect(Object.keys(ui).sort()).toEqual([
      'ActionButton',
      'Button',
      'Dropdown',
      'DropdownItem',
      'DropdownPopup',
      'DropdownRoot',
      'DropdownTrigger',
      'FullscreenModal',
      'NativeLink',
      'PanZoomSurface',
    ]);
    for (const name of Object.keys(ui)) expect(api[name]).toBe(ui[name]);
    expect(ui).not.toHaveProperty('CodeControls');
    expect(ui).not.toHaveProperty('TableControls');
    expect(ui).not.toHaveProperty('SafeImage');

    for (const [subpath, expected] of [
      ['./code', 'createCodePlugin'],
      ['./cjk', 'createCjkPlugin'],
      ['./renderers', 'createRendererPlugin'],
      ['./math', 'createMathPlugin'],
      ['./mermaid', 'createMermaidPlugin'],
      ['./mermaid/webview', 'createOfflineWebViewAdapter'],
    ] as const) {
      const entry = manifest.exports[subpath];
      expect(entry.types).toBe(`./dist/plugins/${subpath.slice(2)}/index.d.ts`);
      expect(fs.existsSync(path.join(packageRoot as string, entry.default))).toBe(true);
      expect(require(path.join(packageRoot as string, entry.default))[expected]).toBeDefined();
    }
  });

  it('keeps optional plugin implementations out of core runtime files', () => {
    const packageRoot = process.env.PACKED_PACKAGE_PATH as string;
    const dist = path.join(packageRoot, 'dist');
    const coreSources: string[] = [];
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (target !== path.join(dist, 'plugins')) visit(target);
        } else if (entry.name.endsWith('.js')) {
          coreSources.push(fs.readFileSync(target, 'utf8'));
        }
      }
    };
    visit(dist);
    const core = coreSources.join('\n');
    expect(core).not.toMatch(/require\(["'][^"']*plugins\//);
    expect(core).not.toContain('remark-cjk-friendly');
    expect(core).not.toMatch(/require\(["']shiki(?:\/|["'])/);
    expect(core).not.toMatch(/require\(["']remark-math["']\)/);
    expect(core).toContain('react-native-svg');
    expect(core).not.toContain('react-native-webview');
  });
});
