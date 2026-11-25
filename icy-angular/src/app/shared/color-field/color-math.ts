/** Conversions de couleurs pour le sélecteur : HEX #rrggbb ⇄ TSV (teinte 0–360, saturation et valeur 0–1). */
export interface Hsv { h: number; s: number; v: number; }

const HEX = /^#?([\da-f]{3}|[\da-f]{6})$/i;

/** Normalise une saisie (#abc, abc, #AABBCC) en #aabbcc ; null si ce n'est pas une couleur hexadécimale. */
export function normalizeHex(value: string | null | undefined): string | null {
  const match = HEX.exec((value ?? '').trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1];
  return '#' + digits.toLowerCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? '#000000';
  return [1, 3, 5].map(i => parseInt(n.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map(c => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
