import type {
  NativeComponentProps,
  StreamdownProps,
  StreamdownRNProps,
  NativeCapabilities,
} from '../../src';
import { createCodePlugin, type TokenProvider } from '../../src/plugins/code';
import { createCjkPlugin } from '../../src/plugins/cjk';
import { createRendererPlugin } from '../../src/plugins/renderers';

const nativeProps: StreamdownProps = {
  children: '# native',
  mode: 'static',
  components: {
    p: (_props: NativeComponentProps) => null,
  },
  capabilities: {
    clipboard: { writeText: async () => ({ status: 'success' }) },
  } satisfies NativeCapabilities,
  controls: { code: { copy: true, download: false } },
  translations: { copyCode: 'Copy' },
  announceStreaming: { delayMs: 500 },
  lineNumbers: false,
  plugins: {
    code: createCodePlugin({
      provider: {
        languages: ['text'],
        highlight: ({ code }) => ({ tokens: [[{ content: code }]] }),
      } satisfies TokenProvider,
    }),
    cjk: createCjkPlugin(),
    renderers: createRendererPlugin([]),
  },
};
const aliasProps: StreamdownRNProps = nativeProps;
void aliasProps;

// @ts-expect-error DOM class names have no native contract.
const domClassName: StreamdownProps = { children: 'text', className: 'prose' };
// @ts-expect-error HAST/DOM plugins cannot run in the native semantic pipeline.
const domRehype: StreamdownProps = { children: 'text', rehypePlugins: [] };
// @ts-expect-error Tailwind prefixes are a web-only styling concept.
const domPrefix: StreamdownProps = { children: 'text', prefix: 'tw' };
void domClassName;
void domRehype;
void domPrefix;
