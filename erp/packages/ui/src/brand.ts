/**
 * Identidade visual da Soul Muscle, extraída da apresentação institucional.
 * Fonte única de verdade de cor para PDV, retaguarda e materiais impressos.
 */
export const brand = {
  violet: '#6147DE',
  violetDark: '#4B34C4',
  violetSoft: '#8B79E8',
  indigo: '#241463',
  indigoInk: '#2A1863',
  magenta: '#D6338F',
  pink: '#FEA7E1',
  lavender: '#F4F1FF',
  lavender200: '#EAE2FF',
  lavender400: '#C9BCF0',
  slate: '#5A4A9E',
  slateSoft: '#9385C7',
  ink: '#121212',
  white: '#FFFFFF',
} as const;

/** Cores semânticas — separadas da paleta da marca de propósito. */
export const semantic = {
  success: '#0E8F5E',
  successSoft: '#E3F5EE',
  warning: '#B4700A',
  warningSoft: '#FDF0DC',
  danger: '#C42B34',
  dangerSoft: '#FBE8E9',
  info: brand.violet,
  infoSoft: brand.lavender200,
} as const;

export const fonts = {
  display: "'Poppins', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const googleFontsHref =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Poppins:wght@600;700&display=swap';
