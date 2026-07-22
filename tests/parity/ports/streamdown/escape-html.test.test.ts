import { renderedText } from './native-cluster-helpers';

describe('raw HTML policy', () => {
  // parity:a283ab98634e923fe15a52412ea3037994b93e7606b8d0f56e3bc400c62adc89
  it('renders raw HTML as inert readable text by default', () => {
    expect(renderedText('<div>Hello</div>')).toContain('<div>Hello</div>');
  });
});

/* pinned parity markers
 *  — remarkEscapeHtml > should escape HTML when rehypeRaw is not in plugins
 * parity:158c411c5cbd9e0c1b68bf76465edc03ca565428059b65b5fa183c928d6fc9b6 — remarkEscapeHtml > should render HTML normally when rehypeRaw is present
 */
