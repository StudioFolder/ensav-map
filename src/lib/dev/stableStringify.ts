/**
 * Deterministic JSON stringify for derivation fixtures.
 *
 * Sorts object keys recursively and serialises Map and Set into sorted plain
 * structures so the same input always produces byte-identical output. Array
 * order is preserved (it's meaningful in our derivation outputs — continent
 * groups are sorted by count, person groups by name, etc.).
 *
 * Used only by src/routes/dev/snapshot/+server.ts.
 */
export function stableStringify(value: unknown, indent = 2): string {
  return (
    JSON.stringify(
      value,
      (_key, val) => {
        if (val instanceof Map) {
          return Object.fromEntries(
            [...val.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))
          )
        }
        if (val instanceof Set) {
          return [...val].sort()
        }
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const sortedKeys = Object.keys(val).sort()
          const out: Record<string, unknown> = {}
          for (const k of sortedKeys) out[k] = (val as Record<string, unknown>)[k]
          return out
        }
        return val
      },
      indent
    ) + '\n'
  )
}
