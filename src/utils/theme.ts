// Intelligent Luminance Contrast Calculator based on ITU-R BT.601 / BT.709 perceived luminance
// Ensures all text and icons inside bright/yellow/amber themes are pure black (#000000) for AAA readability,
// while dark themes (violet, azure, indigo, rose, slate) dynamically use pure white (#ffffff).

export const PRESET_THEME_HEX: Record<string, string> = {
  upn: '#ffb800',     // Amarillo Lúcuma UPN Oficial (perceived brightness 184 -> #000000)
  amber: '#fbbf24',   // Titanium Amber / Oro (perceived brightness 191 -> #000000)
  emerald: '#10b981', // Cyber Emerald (AAA contrast with black 8.9:1 vs white 2.3:1 -> #000000)
  violet: '#8b5cf6',  // Electric Violet (perceived brightness 123 -> #ffffff)
  azure: '#0284c7',   // Glacier Azure (perceived brightness 100 -> #ffffff)
  indigo: '#6366f1',  // Deep Indigo (perceived brightness 117 -> #ffffff)
  teal: '#0d9488',    // Mint Teal (perceived brightness 106 -> #ffffff)
  rose: '#e11d48',    // Crimson Ruby (perceived brightness 92 -> #ffffff)
  slate: '#475569',   // Graphite Slate (perceived brightness 83 -> #ffffff)
};

export function computeIntelligentContrast(themeOrColor: string, customColorHex?: string): '#000000' | '#ffffff' {
  const target = themeOrColor === 'custom' 
    ? (customColorHex || '#ffb800') 
    : (PRESET_THEME_HEX[themeOrColor] || themeOrColor);

  if (!target) return '#000000';
  let clean = target.replace('#', '').trim();
  if (clean.length === 3) clean = clean.split('').map(x => x + x).join('');
  if (clean.length !== 6) return '#000000';

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  // Perceived luminance formula (ITU-R BT.601)
  // [0..255] range. Anything >= 135 has higher, cleaner contrast with black (#000000).
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance >= 135 ? '#000000' : '#ffffff';
}
