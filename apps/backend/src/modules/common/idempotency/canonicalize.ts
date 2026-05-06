export function canonicalizeJson(body: unknown): string {
  return JSON.stringify(body, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = value[key as keyof typeof value];
          return sorted;
        }, {});
    }
    return value;
  });
}

export async function computeBodyHash(body: unknown): Promise<string> {
  const canonical = canonicalizeJson(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical.normalize('NFC'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
