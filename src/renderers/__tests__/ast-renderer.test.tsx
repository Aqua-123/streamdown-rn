import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Streamdown } from '../../StreamdownRN';
import type { NativeSlotProps, NativeSlots } from '../types';

describe('composable semantic slots', () => {
  afterEach(() => jest.restoreAllMocks());

  it('wraps and styles representative defaults without replacing their semantics', () => {
    const elements: string[] = [];
    const Slot = ({ semantic, renderDefault }: NativeSlotProps) => {
      elements.push(semantic.element);
      const replacement: Partial<Record<string, React.ReactNode>> = {
        code: <Text>inline child</Text>,
        pre: <Text>block child</Text>,
        th: <Text>header child</Text>,
        td: <Text>cell child</Text>,
        li: <Text>item child</Text>,
      };
      const children = replacement[semantic.element];
      return <View testID={`slot-${semantic.element}`}>{renderDefault({
        style: { opacity: 0.7 },
        ...(children === undefined ? {} : { children }),
      })}</View>;
    };
    const slots = {
      h2: Slot,
      p: Slot,
      code: Slot,
      pre: Slot,
      th: Slot,
      td: Slot,
      li: Slot,
    } satisfies NativeSlots;
    const screen = render(
      <Streamdown mode="static" slots={slots}>
        {'## Heading\n\nParagraph with `inline`.\n\n- [x] checked\n\n```txt\nblock\n```\n\n| Head |\n| --- |\n| Cell |'}
      </Streamdown>
    );

    expect(screen.getByRole('header', { name: 'Heading' })).toBeTruthy();
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({ checked: true });
    for (const name of ['h2', 'p', 'code', 'pre', 'th', 'td', 'li']) {
      expect(elements).toContain(name);
      const wrappers = screen.getAllByTestId(`slot-${name}`);
      expect(wrappers.length).toBeGreaterThan(0);
      expect(wrappers.flatMap((wrapper) => wrapper.findAll((node) =>
        StyleSheet.flatten(node.props.style)?.opacity === 0.7
      )).length).toBeGreaterThan(0);
    }
    expect(StyleSheet.flatten(screen.getByRole('header').props.style).opacity).toBe(0.7);
    for (const text of ['inline child', 'block child', 'header child', 'cell child', 'item child']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    const paragraph = render(
      <Streamdown mode="static" slots={{
        p: ({ renderDefault }) => <View testID="paragraph-wrapper">{renderDefault({ style: { opacity: 0.5 }, children: <Text>paragraph child</Text> })}</View>,
      }}>plain paragraph</Streamdown>
    );
    expect(paragraph.getByText('paragraph child')).toBeTruthy();
    expect(paragraph.getByTestId('paragraph-wrapper').findAll((node) =>
      StyleSheet.flatten(node.props.style)?.opacity === 0.5
    ).length).toBeGreaterThan(0);
  });

  it('keeps NativeLink approval inside a wrapped link default', async () => {
    const calls: string[] = [];
    const seen: Array<Record<string, unknown>> = [];
    const screen = render(
      <Streamdown
        mode="static"
        capabilities={{ links: {
          approve: async () => { calls.push('approve'); return { status: 'success' }; },
          open: async () => { calls.push('open'); return { status: 'success' }; },
        } }}
        slots={{
          a: ({ semantic, renderDefault }) => {
            seen.push(semantic as unknown as Record<string, unknown>);
            return <View testID="link-wrapper">{renderDefault({ style: { opacity: 0.6 }, children: <Text>Wrapped link</Text> })}</View>;
          },
        }}
      >
        {'[Docs](https://example.com/docs)'}
      </Streamdown>
    );

    expect(seen).toEqual([expect.objectContaining({ element: 'a', url: 'https://example.com/docs' })]);
    expect(seen[0]).not.toHaveProperty('node');
    expect(seen[0]).not.toHaveProperty('attributes');
    fireEvent.press(screen.getByRole('link', { name: 'Wrapped link' }));
    await waitFor(() => expect(calls).toEqual(['approve', 'open']));
  });

  it('keeps SafeImage loading, retry, and download behavior inside an image slot', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => success(100, 50));
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const download = jest.fn().mockResolvedValue({
      basename: 'chart', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]),
    });
    const screen = render(
      <Streamdown
        mode="static"
        capabilities={{ files: { save }, imageDownloads: { download } }}
        slots={{ img: ({ renderDefault }) => <View testID="image-wrapper">{renderDefault({ style: { padding: 7 } })}</View> }}
      >
        {'![Chart](https://example.com/chart.png)'}
      </Streamdown>
    );

    const image = screen.getByRole('image', { name: 'Chart' });
    expect(screen.getByTestId('image-wrapper').findAll((node) =>
      StyleSheet.flatten(node.props.style)?.padding === 7
    ).length).toBeGreaterThan(0);
    fireEvent(image, 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    fireEvent(image, 'error');
    expect(screen.getByText('Image not available')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry image' }));
    expect(screen.getByRole('image', { name: 'Chart' })).toBeTruthy();
  });

  it('never invokes link or image slots with rejected direct or reference URLs', () => {
    const link = jest.fn(({ renderDefault }: NativeSlotProps<'a'>) => renderDefault());
    const image = jest.fn(({ renderDefault }: NativeSlotProps<'img'>) => renderDefault());
    const markdown = '[direct](https://example.com) [reference][bad]\n\n![direct image](https://example.com/a.png) ![reference image][bad-image]\n\n[bad]: https://example.com\n[bad-image]: https://example.com/a.png';
    const screen = render(
      <Streamdown mode="static" slots={{ a: link, img: image }} urlTransform={() => 'javascript:alert(1)'}>
        {markdown}
      </Streamdown>
    );

    expect(link).not.toHaveBeenCalled();
    expect(image).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('passes each direct and reference URL through its actual sink exactly once', () => {
    const seen: Array<[string, string | undefined, string]> = [];
    const transform = jest.fn((url: string, sink: 'link' | 'image') =>
      `https://${sink}.cdn.example.com${new URL(url).pathname}`
    );
    const slots: NativeSlots = {
      a: ({ semantic, renderDefault }) => {
        seen.push(['a', semantic.url, semantic.type]);
        return renderDefault();
      },
      img: ({ semantic, renderDefault }) => {
        seen.push(['img', semantic.url, semantic.type]);
        return renderDefault();
      },
    };
    render(
      <Streamdown mode="static" slots={slots} urlTransform={transform}>
        {'[direct](https://origin.example/direct) [reference][link]\n\n![direct image](https://origin.example/direct.png)\n\n![reference image][image]\n\n[link]: https://origin.example/reference\n[image]: https://origin.example/reference.png'}
      </Streamdown>
    );

    expect(seen).toEqual(expect.arrayContaining([
      ['a', 'https://link.cdn.example.com/direct', 'link'],
      ['a', 'https://link.cdn.example.com/reference', 'linkReference'],
      ['img', 'https://image.cdn.example.com/direct.png', 'image'],
      ['img', 'https://image.cdn.example.com/reference.png', 'imageReference'],
    ]));
    expect(transform.mock.calls.map(([, sink]) => sink)).toEqual([
      'link', 'image', 'link', 'image',
    ]);
  });

  it('passes the renderer image policy to the download redirect validator', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation(() => undefined);
    const save = jest.fn().mockResolvedValue({ status: 'success' });
    const download = jest.fn().mockImplementation(async (request) => {
      expect(request.uri).toBe('https://images.example.com/chart.png');
      expect(request.validateUrl('https://images.example.com/next.png')).toBe(true);
      expect(request.validateUrl('https://attacker.example/next.png')).toBe(false);
      return { basename: 'chart', extension: 'png', mimeType: 'image/png', content: new Uint8Array([1]) };
    });
    const screen = render(
      <Streamdown
        mode="static"
        controls={{ image: { download: true } }}
        capabilities={{ files: { save }, imageDownloads: { download } }}
        urlTransform={(url, sink) => sink === 'image'
          ? `https://images.example.com${new URL(url).pathname}`
          : url}
      >
        {'![Chart][chart]\n\n[chart]: https://origin.example/chart.png'}
      </Streamdown>
    );

    fireEvent(screen.getByRole('image', { name: 'Chart' }), 'load');
    fireEvent.press(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('preserves the no-slot renderer output', () => {
    const markdown = '# Heading\n\nParagraph with [link](https://example.com), `code`, and **bold**.\n\n- [x] task';
    const baseline = render(<Streamdown mode="static">{markdown}</Streamdown>).toJSON();
    const emptySlots = render(<Streamdown mode="static" slots={{}}>{markdown}</Streamdown>).toJSON();
    expect(JSON.stringify(emptySlots)).toBe(JSON.stringify(baseline));
  });

  it('gives legacy replacements precedence and keeps registry components separate', () => {
    const slot = jest.fn(({ renderDefault }: NativeSlotProps<'p'>) => renderDefault());
    const replacement = jest.fn(({ children }: { children?: React.ReactNode }) => <Text>legacy:{children}</Text>);
    const registry = {
      get: () => ({ component: ({ title }: { title?: string }) => <Text>{title}</Text> }),
      has: () => true,
      validate: () => ({ valid: true, errors: [] }),
    };
    const legacy = render(
      <Streamdown mode="static" components={{ p: replacement }} slots={{ p: slot }}>plain</Streamdown>
    );
    expect(legacy.getByText('legacy:plain')).toBeTruthy();
    expect(replacement).toHaveBeenCalled();
    expect(slot).not.toHaveBeenCalled();

    const registered = render(
      <Streamdown mode="static" componentRegistry={registry} slots={{ p: slot }}>
        {'[{c:"Card",p:{"title":"registered"}}]'}
      </Streamdown>
    );
    expect(registered.getByText('registered')).toBeTruthy();
    expect(slot).not.toHaveBeenCalled();
  });
});
