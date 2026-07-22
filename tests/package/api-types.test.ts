import type {
  NativeComponentProps,
  StreamdownProps,
  StreamdownRNProps,
  NativeCapabilities,
  NativeImageDownloadRequest,
} from '../../src';
import { createCodePlugin, type TokenProvider } from '../../src/plugins/code';
import { createCjkPlugin } from '../../src/plugins/cjk';
import { createRendererPlugin } from '../../src/plugins/renderers';
import { createMathPlugin, type MathNativeAdapter } from '../../src/plugins/math';
import { createMermaidPlugin, type MermaidAdapter } from '../../src/plugins/mermaid';
import { createOfflineWebViewAdapter, type OfflineWebViewTransport } from '../../src/plugins/mermaid/webview';
import type { ButtonProps, ButtonState } from '../../src/components/ui';

const buttonState: ButtonState = { pressed: false, focused: false, hovered: false, disabled: false };
const callbackButton: ButtonProps = {
  children: (state) => state.pressed ? 'Pressed' : 'Idle',
  style: (state) => ({ opacity: state.disabled ? 0.5 : 1 }),
};
// @ts-expect-error Button children callbacks must return a React node.
const invalidButtonChildren: ButtonProps = { children: () => Symbol('invalid') };
// @ts-expect-error Button style callbacks must return a native view style.
const invalidButtonStyle: ButtonProps = { children: 'Invalid', style: () => 'invalid' };
void buttonState;
void callbackButton;
void invalidButtonChildren;
void invalidButtonStyle;

const nativeProps: StreamdownProps = {
  children: '# native',
  mode: 'static',
  components: {
    p: (_props: NativeComponentProps) => null,
  },
  capabilities: {
    clipboard: { writeText: async () => ({ status: 'success' }) },
    imageDownloads: {
      download: async (request: NativeImageDownloadRequest) => ({
        basename: request.basename,
        extension: 'png',
        mimeType: 'image/png',
        content: new Uint8Array(),
      }),
    },
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
    math: createMathPlugin({ adapter: { render: ({ source }) => source } satisfies MathNativeAdapter }),
    mermaid: createMermaidPlugin({ adapter: { families: ['flowchart'], render: async () => ({ kind: 'native', content: null }) } satisfies MermaidAdapter }),
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

const transport: OfflineWebViewTransport = {
  render: async ({ id }) => JSON.stringify({ id, type: 'rendered', surfaceId: id }),
  release: () => undefined,
  dispose: () => undefined,
};
createOfflineWebViewAdapter({ assets: { mermaidJs: 'bundled' }, transport, renderSurface: () => null });
