# Test guide

Run the smallest gate that answers the question:

```bash
bun run test                         # all Jest semantic and unit suites
bun run test:parity                  # implemented pinned mappings
bun run test:device-contract         # evidence schema, not device execution
bun run type-check
bun run docs:verify
bun run pack:verify                  # packed Expo 54 + core isolation
bun run pack:verify-optional-renderers
```

`src/__tests__` covers core parsing, security, components, streaming invariance, and the public API. Renderer, control, streaming, and plugin tests live beside their source. `tests/parity` contains executable upstream mappings. `tests/device` and `tests/visual` distinguish recorded evidence from required-but-blocked evidence.

Do not describe a Jest accessibility assertion as VoiceOver/TalkBack proof, a Metro export as native rendering, a simulator timing as a physical-device budget pass, or an unreviewed screenshot as a visual baseline.
