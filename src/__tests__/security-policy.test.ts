import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { parseSemanticDocument } from '../core/parser';
import {
  applySecurityPolicy,
  sanitizeResourceURL,
} from '../core/security';
import { sanitizeProps, sanitizeURL } from '../core/sanitize';
import { extractComponentData } from '../core/componentParser';
import { ASTRenderer, ComponentBlock } from '../renderers/ASTRenderer';
import { lightTheme } from '../themes';
import { StreamdownRN } from '../StreamdownRN';

describe('native resource security policy', () => {
  it('allows declared link schemes and rejects dangerous or obfuscated schemes', () => {
    for (const url of [
      'https://example.com',
      'https://example.com/100%25',
      'http://example.com',
      'mailto:a@example.com',
      'tel:+1234',
      'sms:+1234',
    ]) {
      expect(sanitizeResourceURL(url, 'link')).toBe(url);
    }

    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'content://contacts/1',
      'java\nscript:alert(1)',
      'java%0ascript:alert(1)',
      '%6aavascript%3aalert(1)',
      '&#999999999999;:alert(1)',
      'myapp://open',
    ]) {
      expect(sanitizeResourceURL(url, 'link')).toBeNull();
    }

    expect(
      sanitizeResourceURL('myapp://open', 'link', {
        allowedLinkSchemes: ['myapp'],
      })
    ).toBe('myapp://open');
    expect(
      sanitizeResourceURL('file:///etc/passwd', 'link', {
        allowedLinkSchemes: ['file'],
      })
    ).toBeNull();
  });

  it('keeps relative links inert until a host resolves them', () => {
    expect(sanitizeURL('/docs')).toBeNull();
    expect(
      sanitizeResourceURL('/docs', 'link', {
        resolveRelativeUrl: (url) => `https://example.com${url}`,
      })
    ).toBe('https://example.com/docs');
    expect(
      sanitizeResourceURL('/docs', 'link', {
        resolveRelativeUrl: () => 'javascript:alert(1)',
      })
    ).toBeNull();
  });

  it('allows only HTTPS images unless bounded data images are opted in', () => {
    expect(sanitizeResourceURL('https://example.com/a.png', 'image')).toBe(
      'https://example.com/a.png'
    );
    expect(sanitizeResourceURL('http://example.com/a.png', 'image')).toBeNull();
    expect(sanitizeResourceURL('data:image/png;base64,YQ==', 'image')).toBeNull();
    expect(
      sanitizeResourceURL('data:image/png;base64,YQ==', 'image', {
        dataImages: { mimeTypes: ['image/png'], maxBytes: 1 },
      })
    ).toBe('data:image/png;base64,YQ==');
    expect(
      sanitizeResourceURL('data:image/png;base64,YWI=', 'image', {
        dataImages: { mimeTypes: ['image/png'], maxBytes: 1 },
      })
    ).toBeNull();
    expect(
      sanitizeResourceURL('data:image/svg+xml;base64,PHN2Zy8+', 'image', {
        dataImages: { mimeTypes: ['image/svg+xml'], maxBytes: 100 },
      })
    ).toBeNull();
    expect(
      sanitizeResourceURL('data:text/html;base64,YQ==', 'image', {
        dataImages: { mimeTypes: ['text/html'], maxBytes: 1 },
      })
    ).toBeNull();
  });

  it('enforces the image sink at the renderer integration point', () => {
    const insecure = render(
      React.createElement(ASTRenderer, {
        node: { type: 'image', url: 'http://example.com/a.png', alt: 'unsafe' },
        theme: lightTheme,
      })
    );
    expect(insecure.queryByLabelText('unsafe')).toBeNull();
    expect(insecure.getByText('[Image: unsafe]')).toBeTruthy();

    const secure = render(
      React.createElement(ASTRenderer, {
        node: { type: 'image', url: 'https://example.com/a.png', alt: 'safe' },
        theme: lightTheme,
      })
    );
    expect(secure.getByLabelText('safe')).toBeTruthy();
  });

  it('revalidates transformed values for their sink', () => {
    const tree = parseSemanticDocument(
      '[safe](https://example.com) ![image](https://example.com/a.png)'
    );
    const filtered = applySecurityPolicy(tree, {
      urlTransform: (_url, sink) =>
        sink === 'link' ? 'javascript:alert(1)' : 'http://example.com/a.png',
    });
    const paragraph = filtered.children[0] as { children: Array<{ url?: string }> };
    expect(paragraph.children[0].url).toBeUndefined();
    expect(paragraph.children[2].url).toBeUndefined();
  });

  it('recursively sanitizes registry props, including nested arrays', () => {
    expect(
      sanitizeProps({
        href: '/unresolved',
        nested: [{ imageUrl: 'http://example.com/a.png' }],
        safe: 'plain text',
      })
    ).toEqual({ href: '', nested: [{ imageUrl: '' }], safe: 'plain text' });

    expect(
      extractComponentData('[{c:"Link",p:{"href":"/docs"}}]', {
        resolveRelativeUrl: (url) => `https://example.com${url}`,
      }).props.href
    ).toBe('https://example.com/docs');
  });

  it('preserves ordinary text and native style values that resemble fragments or paths', () => {
    expect(
      sanitizeProps({
        title: '# release',
        command: '/usr/bin/example',
        style: { color: '#ff00aa' },
        href: '#section',
      })
    ).toEqual({
      title: '# release',
      command: '/usr/bin/example',
      style: { color: '#ff00aa' },
      href: '',
    });
  });
});

describe('semantic filtering boundary', () => {
  it('backs the documented p/a allowlist and additive versus restrictive URL policies', () => {
    const source = parseSemanticDocument(
      '**removed** [HTTP](http://example.com) [HTTPS](https://example.com)'
    );
    const additive = applySecurityPolicy(source, {
      allowedElements: ['p', 'a'],
      allowedLinkSchemes: ['https'],
    });
    const additiveParagraph = additive.children[0] as {
      type: string;
      children: Array<{ type: string; url?: string }>;
    };
    expect(additiveParagraph.type).toBe('paragraph');
    expect(additiveParagraph.children.map((node) => node.type)).toEqual([
      'text',
      'link',
      'text',
      'link',
    ]);
    expect(JSON.stringify(additive)).not.toContain('removed');
    expect(additiveParagraph.children.filter((node) => node.type === 'link').map((node) => node.url))
      .toEqual(['http://example.com', 'https://example.com']);

    const unwrapped = applySecurityPolicy(source, {
      allowedElements: ['p', 'a'],
      unwrapDisallowed: true,
    });
    expect(JSON.stringify(unwrapped)).toContain('removed');

    const httpsOnly = applySecurityPolicy(source, {
      allowedElements: ['p', 'a'],
      urlTransform: (url) => {
        try {
          return new URL(url).protocol === 'https:' ? url : null;
        } catch {
          return null;
        }
      },
    });
    const httpsOnlyParagraph = httpsOnly.children[0] as {
      children: Array<{ type: string; url?: string }>;
    };
    expect(httpsOnlyParagraph.children.filter((node) => node.type === 'link').map((node) => node.url))
      .toEqual([undefined, 'https://example.com']);
  });

  it('drops or unwraps semantic nodes exactly as configured', () => {
    const source = parseSemanticDocument('**bold** and *italic*');
    const dropped = applySecurityPolicy(source, {
      allowedElements: ['p', 'strong'],
    });
    const droppedChildren = (dropped.children[0] as { children: Array<{ type: string }> }).children;
    expect(droppedChildren.map((node) => node.type)).toEqual(['strong', 'text']);

    const unwrapped = applySecurityPolicy(source, {
      disallowedElements: ['strong'],
      unwrapDisallowed: true,
    });
    const unwrappedChildren = (unwrapped.children[0] as { children: Array<{ type: string }> }).children;
    expect(unwrappedChildren.map((node) => node.type)).toEqual([
      'text',
      'text',
      'emphasis',
    ]);
  });

  it('keeps raw HTML inert and strips it when requested', () => {
    const source = parseSemanticDocument('before <script>alert(1)</script> after');
    const inert = applySecurityPolicy(source);
    const children = (inert.children[0] as { children: Array<{ type: string; value?: string }> }).children;
    expect(children.some((node) => node.type === 'html')).toBe(false);
    expect(children.map((node) => node.value ?? '').join('')).toContain('<script>');

    const stripped = applySecurityPolicy(source, { skipHtml: true });
    expect(JSON.stringify(stripped)).not.toContain('<script>');
  });

  it('does not let allowed custom or literal tag names activate raw HTML', () => {
    const source = parseSemanticDocument('<widget url="javascript:alert(1)">x</widget>');
    const filtered = applySecurityPolicy(source, { allowedElements: ['widget', 'p'] });
    expect(JSON.stringify(filtered)).not.toContain('"type":"html"');
    expect(JSON.stringify(filtered)).toContain('<widget');
  });

  it('filters plugin-created custom and literal semantic nodes by their tag name', () => {
    const customTree = {
      type: 'root',
      children: [{
        type: 'customNode',
        data: { hName: 'widget' },
        children: [{ type: 'text', value: 'readable' }],
      }],
    } as unknown as ReturnType<typeof parseSemanticDocument>;

    expect(applySecurityPolicy(customTree, { disallowedElements: ['widget'] }).children)
      .toEqual([]);
    expect(applySecurityPolicy(customTree, {
      disallowedElements: ['widget'],
      unwrapDisallowed: true,
    }).children).toEqual([{ type: 'text', value: 'readable' }]);
  });

  it('filters table headers and body cells by contextual semantics without mutating input', () => {
    const source = parseSemanticDocument('| Head |\n| --- |\n| Body |');
    const original = JSON.stringify(source);

    const withoutHeaders = applySecurityPolicy(source, { disallowedElements: ['th'] });
    expect(JSON.stringify(withoutHeaders)).not.toContain('Head');
    expect(JSON.stringify(withoutHeaders)).toContain('Body');

    const withoutBody = applySecurityPolicy(source, { disallowedElements: ['td'] });
    expect(JSON.stringify(withoutBody)).toContain('Head');
    expect(JSON.stringify(withoutBody)).not.toContain('Body');

    const allowed = applySecurityPolicy(source, { allowedElements: ['table', 'tr', 'th', 'td'] });
    expect(JSON.stringify(allowed)).toContain('Head');
    expect(JSON.stringify(allowed)).toContain('Body');
    expect(JSON.stringify(source)).toBe(original);
  });
});

describe('custom registry trust boundary', () => {
  it('sanitizes before registry validation and rendering', () => {
    const validate = jest.fn(() => ({ valid: true, errors: [] }));
    const registry = {
      get: () => ({
        component: (props: { href?: string }) =>
          React.createElement(Text, { testID: 'custom' }, props.href),
      }),
      has: () => true,
      validate,
    };

    const result = render(React.createElement(ComponentBlock, {
      componentName: 'LinkCard',
      props: { href: 'javascript:alert(1)' },
      componentRegistry: registry,
      theme: lightTheme,
    }));

    expect(validate).toHaveBeenCalledWith('LinkCard', { href: '' });
    expect(result.getByTestId('custom').props.children).toBe('');
  });

  it('reports validation rejection through the configured callback', async () => {
    const onError = jest.fn();
    const registry = {
      get: () => ({ component: () => React.createElement(Text, null, 'never') }),
      has: () => true,
      validate: () => ({ valid: false, errors: ['href is invalid'] }),
    };
    const result = render(React.createElement(ComponentBlock, {
      componentName: 'LinkCard',
      props: { href: 'https://example.com' },
      componentRegistry: registry,
      theme: lightTheme,
      onError,
    }));

    expect(result.getByText('⚠️ Invalid component: LinkCard')).toBeTruthy();
    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid props for LinkCard: href is invalid' }),
      'LinkCard'
    ));
  });

  it('plumbs the public onError callback to streamed registry validation', async () => {
    const onError = jest.fn();
    const registry = {
      get: () => ({ component: () => React.createElement(Text, null, 'never') }),
      has: () => true,
      validate: () => ({ valid: false, errors: ['blocked'] }),
    };
    render(React.createElement(StreamdownRN, {
      children: '[{c:"LinkCard",p:{"href":"javascript:alert(1)"}}]',
      componentRegistry: registry,
      onError,
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid props for LinkCard: blocked' }),
      'LinkCard'
    ));
  });

  it('catches component render errors and reports the component name', async () => {
    const onError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const registry = {
      get: () => ({ component: () => { throw new Error('render failed'); } }),
      has: () => true,
      validate: () => ({ valid: true, errors: [] }),
    };
    const result = render(React.createElement(ComponentBlock, {
      componentName: 'BrokenCard',
      props: {},
      componentRegistry: registry,
      theme: lightTheme,
      onError,
    }));

    expect(result.getByText('⚠️ Invalid component: BrokenCard')).toBeTruthy();
    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'render failed' }),
      'BrokenCard'
    ));
    consoleError.mockRestore();
  });

  it('retries a failed component only after its inputs change', async () => {
    const onError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = ({ status, style, _isStreaming, children }: {
      status?: string;
      style?: { opacity?: number };
      _isStreaming?: boolean;
      children?: React.ReactNode;
    }) => {
      if (
        status === 'partial' ||
        (status === 'styled' && style?.opacity !== 1) ||
        (status === 'streaming' && _isStreaming) ||
        (status === 'nested' && !children) ||
        status === 'definition'
      ) throw new Error('not ready');
      return React.createElement(View, null, React.createElement(Text, null, status), children);
    };
    let definition = { component };
    const registry = {
      get: (name: string) => name === 'Child'
        ? { component: ({ label }: { label?: string }) => React.createElement(Text, null, label) }
        : definition,
      has: () => true,
      validate: () => ({ valid: true, errors: [] }),
    };
    const renderCard = (
      status: string,
      inputs: Pick<React.ComponentProps<typeof ComponentBlock>, 'style' | 'children' | 'isStreaming'> = {}
    ) => React.createElement(ComponentBlock, {
      componentName: 'RetryCard',
      props: { status },
      componentRegistry: registry,
      theme: lightTheme,
      onError,
      ...inputs,
    });
    const result = render(renderCard('partial'));

    expect(result.getByText('⚠️ Invalid component: RetryCard')).toBeTruthy();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    result.rerender(renderCard('partial'));
    expect(result.getByText('⚠️ Invalid component: RetryCard')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);

    result.rerender(renderCard('ready'));
    expect(result.getByText('ready')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);

    result.rerender(renderCard('styled'));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    result.rerender(renderCard('styled', { style: { opacity: 1 } }));
    expect(result.getByText('styled')).toBeTruthy();

    result.rerender(renderCard('streaming', { isStreaming: true }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(3));
    result.rerender(renderCard('streaming'));
    expect(result.getByText('streaming')).toBeTruthy();

    result.rerender(renderCard('nested'));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(4));
    result.rerender(renderCard('nested', {
      children: [{ name: 'Child', props: { label: 'child' } }],
    }));
    expect(result.getByText('nested')).toBeTruthy();
    expect(result.getByText('child')).toBeTruthy();

    result.rerender(renderCard('definition'));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(5));
    definition = { component: () => React.createElement(Text, null, 'replacement') };
    result.rerender(renderCard('definition'));
    expect(result.getByText('replacement')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(5);
    consoleError.mockRestore();
  });
});
