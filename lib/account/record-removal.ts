// Call only on schema-validated boards. Membership-free saves may remove
// records, but cannot edit survivors, move them, or change group metadata.
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
const same = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export function removesOnlyRecords(before: unknown, after: unknown, field: "items" | "tasks"): boolean {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return false;
  let removed = 0;
  for (let index = 0; index < before.length; index++) {
    const old = before[index], next = after[index];
    if (!old || !next || !Array.isArray(old[field]) || !Array.isArray(next[field])) return false;
    if (!same({ ...old, [field]: null }, { ...next, [field]: null })) return false;
    let cursor = 0;
    for (const survivor of next[field]) {
      while (cursor < old[field].length && !same(old[field][cursor], survivor)) cursor++;
      if (cursor === old[field].length) return false;
      cursor++;
    }
    removed += old[field].length - next[field].length;
  }
  return removed > 0;
}
