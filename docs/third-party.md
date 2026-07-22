# Third-party notices

The published runtime directly depends on:

| Package | Pinned installed version | License | Purpose |
| --- | ---: | --- | --- |
| remark | 15.0.1 | MIT | Markdown processor |
| remark-gfm | 4.0.1 | MIT | GFM syntax |
| remark-math | 6.0.0 | MIT | Portable math syntax |
| remend | 1.3.0 | Apache-2.0 | Incomplete Markdown repair |
| unified | 11.0.5 | MIT | Plugin pipeline types/runtime |

The core requires the host's `react-native-svg` peer to render Streamdown's exact control icons and task checkmark. Keeping that native module host-owned prevents a second incompatible native copy; Expo applications should select it with `npx expo install react-native-svg`. Optional examples mention Shiki, RaTeX, beautiful-mermaid, and react-native-webview; streamdown-rn does not install or re-export those renderer engines. Applications must audit the optional versions they choose.

The parity metadata derives test names and source layout from Vercel Streamdown under Apache-2.0 at commit `e5deed330aa4231751a106445d93d62e4716a22f`. See [NOTICE](../NOTICE). `bun run licenses:verify` checks package provenance files and direct installed runtime licenses; it is not legal advice or a transitive SBOM.
