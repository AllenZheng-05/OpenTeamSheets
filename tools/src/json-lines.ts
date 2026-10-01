/**
 * JSON with one entry per line, so changing one record changes one line in
 * a diff. Arrays put each element on its own line; objects put each key on
 * its own line.
 */
export function stringifyByLine(value: unknown[] | object): string {
  const lines = Array.isArray(value)
    ? value.map((entry) => `  ${JSON.stringify(entry)}`)
    : Object.entries(value).map(
        ([key, entry]) => `  ${JSON.stringify(key)}: ${JSON.stringify(entry)}`,
      );
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return lines.length === 0
    ? `${open}${close}\n`
    : `${open}\n${lines.join(",\n")}\n${close}\n`;
}
