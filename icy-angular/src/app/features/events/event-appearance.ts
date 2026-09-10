/** Event types own their accent and label colors; incomplete models use the ice palette. */
export function eventColor(value: string | null | undefined, fallback = '#27647c'): string {
  return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value?.trim() || '')
    ? value!.trim() : fallback;
}

export function eventImage(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim(), 'https://iceforge.fr');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
