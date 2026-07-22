# Third-party notices

## Design and lineage credits

- [darkresearch/generative-ui](https://github.com/darkresearch/generative-ui) provided the original `streamdown-rn` package used as this project's base.
- [shadcn/ui](https://ui.shadcn.com) informed the open-code primitive patterns and semantic theme vocabulary.
- [Base UI](https://base-ui.com) informed the headless, composable primitive APIs.
- [Vercel Streamdown](https://github.com/vercel/streamdown) is the pinned feature and parity baseline described in `parity/upstream.json`.
- [Software Mansion react-native-enriched-markdown](https://github.com/software-mansion/react-native-enriched-markdown) is MIT licensed. Its native tail fade animator implementations informed the `CADisplayLink`/`Choreographer` architecture; streamdown-native's implementation is independently integrated with its Fabric text surface and semantic range model.

These are credits, not claims that their browser implementations are bundled into this React Native package.

The published runtime directly depends on:

| Package | Pinned installed version | License | Purpose |
| --- | ---: | --- | --- |
| remark | 15.0.1 | MIT | Markdown processor |
| remark-gfm | 4.0.1 | MIT | GFM syntax |
| remark-math | 6.0.0 | MIT | Portable math syntax |
| remend | 1.3.0 | Apache-2.0 | Incomplete Markdown repair |
| unified | 11.0.5 | MIT | Plugin pipeline types/runtime |

The core requires the host's `react-native-svg` peer to render Streamdown's exact control icons and task checkmark. Keeping that native module host-owned prevents a second incompatible native copy; Expo applications should select it with `npx expo install react-native-svg`. Optional examples mention Shiki, RaTeX, beautiful-mermaid, and react-native-webview; streamdown-native does not install or re-export those renderer engines. Applications must audit the optional versions they choose.

The parity metadata derives test names and source layout from Vercel Streamdown under Apache-2.0 at commit `e5deed330aa4231751a106445d93d62e4716a22f`. See [NOTICE](../NOTICE). `bun run licenses:verify` checks package provenance files and direct installed runtime licenses; it is not legal advice or a transitive SBOM.
