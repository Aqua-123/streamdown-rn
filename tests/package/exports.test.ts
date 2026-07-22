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

    expect(rootExport['react-native']).toEqual({ types: './dist/index.d.ts', default: './dist/index.js' });
    expect(rootExport.import).toEqual({ types: './dist/index.d.mts', default: './dist/esm/index.js' });
    expect(rootExport.default).toBe('./dist/index.js');

    for (const target of ['./dist/index.d.ts', './dist/index.d.mts', './dist/index.js', './dist/esm/index.js']) {
      expect(fs.existsSync(path.join(packageRoot as string, target))).toBe(true);
    }

    const api = require(path.join(packageRoot as string, rootExport.require.default));
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
      'Action',
      'ActionRoot',
      'ActionTrigger',
      'ActionStatus',
      'Toolbar',
      'ToolbarRoot',
      'ToolbarButton',
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
      'NATIVE_ELEMENT_NAMES',
    ]) {
      expect(api[exportName]).toBeDefined();
    }
    expect(typeof api.sanitizeURL).toBe('function');
    expect(typeof api.sanitizeProps).toBe('function');
    expect(typeof api.serializeTable).toBe('function');
    expect(typeof api.resolveCapabilities).toBe('function');

    const uiExport = manifest.exports['./ui'];
    expect(uiExport['react-native']).toEqual({ types: './dist/components/ui/index.d.ts', default: './dist/components/ui/index.js' });
    expect(uiExport.import).toEqual({ types: './dist/components/ui/index.d.mts', default: './dist/esm/components/ui/index.js' });
    expect(uiExport.require).toEqual({ types: './dist/components/ui/index.d.ts', default: './dist/components/ui/index.js' });
    expect(uiExport.default).toBe('./dist/components/ui/index.js');
    for (const target of ['./dist/components/ui/index.d.ts', './dist/components/ui/index.d.mts', './dist/components/ui/index.js', './dist/esm/components/ui/index.js']) {
      expect(fs.existsSync(path.join(packageRoot as string, target))).toBe(true);
    }
    const ui = require(path.join(packageRoot as string, uiExport.default));
    expect(Object.keys(ui).sort()).toEqual([
      'Action',
      'ActionButton',
      'ActionRoot',
      'ActionStatus',
      'ActionTrigger',
      'Button',
      'Dropdown',
      'DropdownItem',
      'DropdownPopup',
      'DropdownRoot',
      'DropdownTrigger',
      'FullscreenModal',
      'NativeLink',
      'PanZoomSurface',
      'Toolbar',
      'ToolbarButton',
      'ToolbarRoot',
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
      expect(entry.require.types).toBe(`./dist/plugins/${subpath.slice(2)}/index.d.ts`);
      expect(entry.import.types).toBe(`./dist/plugins/${subpath.slice(2)}/index.d.mts`);
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
