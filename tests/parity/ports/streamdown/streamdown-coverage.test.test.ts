import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Streamdown, createStreamingInstrumentation } from '../../../../src';

const h = React.createElement;

describe('Streamdown coverage native adaptations', () => {
  it('animates only active streamed content and exposes a native caret', () => {
    // parity:d482da0e7d06b24987a844e79c5ffc21e931d9a3e4daf1ad801abadb9f7358cd
    // parity:e6aaaf5453ed29a2edd5c2c283b52087d56dc11db7a423cc14173fab397450c6
    // parity:091a2758a1b8bdf3a15456e5214083119cbe766edb1123f087f6b886949dec93
    // parity:559b8e0e49f60c7d50988b68d32acb673c65f263f7c255ff34558d7ded79c30f
    // parity:0cd71bd31cc33182502a24279c4c544990a23f5d0b1a52dd1939a4baefa852d7
    // parity:5697cfdd4d34fec43b1647c8872cf5f531c1ae2c84afbf7b9f154f0ce8bf9989
    const screen = render(h(Streamdown, { animated: true, isAnimating: true, caret: 'block' }, 'Hello'));
    expect(screen.getByTestId('streamdown-new-content')).toBeTruthy();
    expect(screen.getByTestId('streamdown-caret').props.children).toBe(' ▋');
    screen.rerender(h(Streamdown, { animated: { animation: 'slideUp', duration: 300, sep: 'char' }, isAnimating: true }, 'Hello!'));
    expect(screen.getAllByTestId('streamdown-new-content')).toHaveLength(1);
    screen.rerender(h(Streamdown, { animated: true, isAnimating: false, caret: 'block' }, 'Hello!'));
    expect(screen.queryByTestId('streamdown-new-content')).toBeNull();
    expect(screen.queryByTestId('streamdown-caret')).toBeNull();
    const empty = render(h(Streamdown, { caret: 'block', isAnimating: true }, ''));
    expect(empty.getByTestId('streamdown-caret').props.children).toBe(' ▋');
    expect(empty.toJSON()).toMatchObject({
      type: 'View',
      children: [{ type: 'Text', props: { testID: 'streamdown-caret' } }],
    });
  });

  it('switches modes and updates both streaming and static output', () => {
    // parity:8267559b30ad6f5773cd4bfec529b44ab7e496a2829f7e1948df491e56016eb9
    // parity:7bd413f78acd502dbcd0e52f292a217b38b7c5e5c0773b9a12c60d4353f78a02
    // parity:cdb6b8afd4182d514e143e3677f88053ded12f65f7d02bd400cf061e9ef8b277
    const screen = render(h(Streamdown, { mode: 'streaming' }, 'First'));
    expect(screen.getByText('First')).toBeTruthy();
    screen.rerender(h(Streamdown, { mode: 'streaming' }, 'First\n\nSecond block'));
    expect(screen.getByText('Second block')).toBeTruthy();
    screen.rerender(h(Streamdown, { mode: 'static' }, 'Updated'));
    expect(screen.getByText('Updated')).toBeTruthy();
    expect(screen.queryByText('First')).toBeNull();
  });

  it('renders allowlisted custom tags through a native component', () => {
    // parity:a68f165d1e7621085a2e1d3d83ac7735b7ea40ff17d312c967a534daa620913e
    const Custom = ({ children, semantic }: any) => h(Text, { testID: 'custom', accessibilityLabel: String(semantic.attributes?.id) }, children);
    const screen = render(h(Streamdown, { mode: 'static', allowedTags: { 'custom-tag': ['id'] }, components: { 'custom-tag': Custom } }, '<custom-tag id="safe">Hello</custom-tag>'));
    expect(screen.getByTestId('custom')).toHaveTextContent('Hello');
    expect(screen.getByLabelText('safe')).toBeTruthy();
  });

  it('keeps HTML inert and does not require DOM indentation normalization', () => {
    // parity:65ee9e91bafa23ae00131833b7ea592cc9b0257ad41acba71d03eb352a67da84
    // parity:a40892c9448da496a5262f36d393aee28de84dcab129e987c39215b333b21035
    // parity:3e12454eb2bebb4c882b994472d1d3d1dab772bace46b8908449c6a3443734d6
    const html = '    <div>\n        <p>Hello</p>\n    </div>';
    expect(render(h(Streamdown, { mode: 'static' }, html)).getByText(/<div>/)).toBeTruthy();
    expect(render(h(Streamdown, { mode: 'static', skipHtml: true }, '<div>Hello</div>')).queryByText(/<div>/)).toBeNull();
  });

  it('updates content and completion state while stable blocks remain memoized', () => {
    // parity:983d1d4c9ac254aa1be65209de07cc13192bd9754d09e29a445f2f0c5c2b1bcc
    // parity:c6b6aea305cc99a111db31842303ea80e6a899f80a9948245991ce1075ae71f5
    // parity:ca31341d6069c1604912a6ac06dc6cd2b62de8361341d8d0944c564958381d21
    const instrumentation = createStreamingInstrumentation();
    const screen = render(h(Streamdown, { instrumentation }, 'first\n\nsecond'));
    const stableRenders = instrumentation.snapshot().stableRenders;
    screen.rerender(h(Streamdown, { instrumentation }, 'first\n\nsecond!'));
    expect(screen.getByText('second!')).toBeTruthy();
    expect(instrumentation.snapshot().stableRenders).toBe(stableRenders);
    screen.rerender(h(Streamdown, { instrumentation, isComplete: true }, 'first\n\nsecond!'));
    expect(screen.getByText('second!')).toBeTruthy();
  });

  it('rejects the DOM-only rehype plugin surface', () => {
    // parity:994b20248125aedaa94526c15232cb1851126121c488d45ebcc6a48c8d6decca
    expect(() => render(h(Streamdown, { rehypePlugins: [() => undefined] } as never, 'test'))).toThrow(/DOM-only/);
  });

  it('recomputes output for renderer-bearing configuration changes', () => {
    // parity:31e9fcb51927b613ccbaf8aaf93abf30f5b302ecd32470d9ee77c9269007c2ad
    // parity:2fbd071023dd7c677d740498c63a817986091f6bcfd242c688721f9096a772b6
    // parity:011edc9d7dc97a7731ded31574ea5b3d4004397940afb56a247a2ffec64a4272
    // parity:5a6c88e785c2941854768a3fcf620e94adfb885881cdfb2c0bacc18c3d833243
    const screen = render(h(Streamdown, { mode: 'static', shikiTheme: ['github-light', 'github-dark'] }, '[safe](https://example.com)'));
    expect(screen.getByRole('link')).toBeTruthy();
    screen.rerender(h(Streamdown, { mode: 'static', urlTransform: () => null, animated: true, skipHtml: true }, '[safe](https://example.com)'));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('safe')).toBeTruthy();
  });

  it('preserves the platform-neutral indentation contract', () => {
    // parity:e693b3afc8f14c568958ac9a8d31ffb176e7f5722ae5b5bc1b687545f482a577
    // parity:22de8bff314ce4f0fb9835274b2459b61e6349dea9dd6b2e13d777f1c7f51f48
    // parity:dbf011cd4223509fa79510d47bece938ea557f9678095910eff4d5679c716db1
    expect(render(h(Streamdown, { mode: 'static' }, '')).toJSON()).toBeNull();
    expect(render(h(Streamdown, { mode: 'static' }, 'Hello world')).getByText('Hello world')).toBeTruthy();
    expect(render(h(Streamdown, { mode: 'static' }, '    <div>')).getByText('<div>')).toBeTruthy();
  });
});
