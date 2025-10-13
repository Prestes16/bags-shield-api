export function firstString(x: unknown): string | undefined {
  if (typeof x === "string") return x;
  if (Array.isArray(x) && typeof x[0] === "string") return x[0];
  return undefined;
}

export function safeStartsWith(value: unknown, prefix: string): boolean {
  const s = firstString(value);
  return typeof s === "string" && s.startsWith(prefix);
}
