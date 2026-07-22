type RendererLike = { language: string | readonly string[] };
type RendererCollection<T extends RendererLike> =
  | readonly T[]
  | { renderers: readonly T[] };

/** Dependency-free lookup shared by the runtime and optional renderers export. */
export function findCustomRendererInternal<T extends RendererLike>(
  plugin: RendererCollection<T> | undefined,
  language: string
): T | undefined {
  const renderers = Array.isArray(plugin)
    ? plugin as readonly T[]
    : (plugin as { renderers: readonly T[] } | undefined)?.renderers;
  const normalized = language.toLowerCase();
  return renderers?.find(({ language: candidate }) =>
    (Array.isArray(candidate) ? candidate : [candidate]).some(
      (value) => value.toLowerCase() === normalized
    )
  );
}
