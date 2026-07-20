import type {
  NativeComponentProps,
  StreamdownProps,
  StreamdownRNProps,
} from '../../src';

const nativeProps: StreamdownProps = {
  children: '# native',
  mode: 'static',
  components: {
    p: (_props: NativeComponentProps) => null,
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
