import './show-controls.native';
import { controlEnabled } from '../../../../src/controls/config';

describe('case-specific controls policy proof', () => {
  // parity:249a3a43279e5333b171590718bfeae993194beab2cb2668fe9f5f8cbc0db039
  it('shows all native controls by default/true and none for false', () => {
    expect(controlEnabled(undefined, 'table', 'copy')).toBe(true);
    expect(controlEnabled(true, 'code', 'download')).toBe(true);
    expect(controlEnabled(false, 'mermaid', 'fullscreen')).toBe(false);
  });

  // parity:1b3ac6781a63518af42df7160763b509f821ed0d860610a4352b6791e946562d
  it('exposes Mermaid pan/zoom policy for the optional renderer', () => {
    expect(controlEnabled({ mermaid: { panZoom: false } }, 'mermaid', 'panZoom')).toBe(false);
    expect(controlEnabled({ mermaid: { panZoom: true } }, 'mermaid', 'panZoom')).toBe(true);
  });

  it.each([
    /* parity:7b4dd99b76d3ffa21d2acf01ee1653c9b649115aa592a58342c0815f237a23aa */ /* parity:bc658a82bbf88807c1cc6709aff3a972955c439f5b23537cbe9e3e09fad586ff */ ['shows all controls by default', undefined, 'table', 'copy', true],
    /* parity:c894b5a94ec6e5422bf7aa1fee94caffa271986c566d6628789ba7d3639391c2 */ ['shows all controls when controls is true', true, 'code', 'copy', true],
    /* parity:6d08fce2b01cc8426de7ce02645b048a9033a4c9d94a246bc88497b501bc44a8 */ ['hides all controls when controls is false', false, 'table', 'download', false],
    /* parity:9ab71354cbc065313d701c232483a22795f73e8b5ae823ccc5a845214289701b */ ['shows table controls when table is true', { table: true }, 'table', 'fullscreen', true],
    /* parity:b615c591c99e6c5fbcd1dacaa8201e8cb73ec6796bc7aa53df3172c55ebf391b */ ['hides only code controls when code is false', { code: false }, 'code', 'copy', false],
    /* parity:edc2060d32e1ac97378f36f243afbc5419035135a240b7ee1b2c3965ee125bec */ ['shows code controls when code is true', { code: true }, 'code', 'download', true],
    /* parity:cb6187bc3b3616cf0ccbfe29ac2a3011354392ea339ec973f66c76013fcb2a64 */ ['hides only mermaid controls when mermaid is false', { mermaid: false }, 'mermaid', 'fullscreen', false],
    /* parity:91736f952e0c35300836327e7a02aff20eb5e261bdb899a636ff29d1764567bb */ ['allows mixed family configuration', { table: true, code: false }, 'table', 'copy', true],
    /* parity:b2a5ca4179bb505a39f391591b4c63ace2cb05c0e9194ba3c5ce31b1270bc032 */ ['hides Mermaid pan zoom when configured', { mermaid: { panZoom: false } }, 'mermaid', 'panZoom', false],
    /* parity:bffdc1fb16df79b5e9e53edc4a70756c52563d58add3aa065e770eba6c77c65d */ ['shows only table copy when siblings are false', { table: { copy: true, download: false, fullscreen: false } }, 'table', 'copy', true],
    /* parity:da919c566ea57f40900a858ad9b52aa4ea6c5efe4704dde52c1962d69fb8de31 */ ['shows table controls for an empty object', { table: {} }, 'table', 'download', true],
    /* parity:67dc92c17307229c5d71839cd101daf4fa0b9faebff728a0ac335362be540129 */ ['hides every table sub-control when each is false', { table: { copy: false, download: false, fullscreen: false } }, 'table', 'fullscreen', false],
    /* parity:7d2d84087d13a8fc1d81bc239200e2a82a7255711123fa00a7cfb1cdbe8c50a5 */ ['hides only code copy when code copy is false', { code: { copy: false } }, 'code', 'copy', false],
    /* parity:2cdd6cbfdbb29365f29c21a876182b3e2a15997a3bb8c059932db766bd63debb */ ['shows code controls for an empty object', { code: {} }, 'code', 'download', true],
    /* parity:f76e61b964c09d5e607c702319496d69b57855be84ebf6dc89504011cf9f251d */ ['hides both code buttons when both are false', { code: { copy: false, download: false } }, 'code', 'download', false],
    /* parity:5d3b2099e92eb7e5fd8ad89de514ace19eca0e795f111fc0addd9ccdf66ffb62 */ ['preserves controls policy with component overrides', { table: { copy: true } }, 'table', 'copy', true],
  ] as const)('%s', (_title, config, family, action, expected) => {
    expect(controlEnabled(config, family, action)).toBe(expected);
  });
});
