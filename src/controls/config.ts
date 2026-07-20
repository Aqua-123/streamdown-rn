export type ControlsConfig = boolean | {
  table?: boolean | { copy?: boolean; download?: boolean; fullscreen?: boolean };
  code?: boolean | { copy?: boolean; download?: boolean };
  image?: boolean | { download?: boolean };
  mermaid?: boolean | { copy?: boolean; download?: boolean; fullscreen?: boolean; panZoom?: boolean };
};

type Family = 'table' | 'code' | 'image' | 'mermaid';

export function controlEnabled(
  controls: ControlsConfig | undefined,
  family: Family,
  action: string
): boolean {
  if (controls === false) return false;
  if (controls === true || controls === undefined) return true;
  const value = controls[family];
  if (value === false) return false;
  if (value === true || value === undefined) return true;
  return value[action as keyof typeof value] !== false;
}
