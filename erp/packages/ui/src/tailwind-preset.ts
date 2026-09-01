import type { Config } from 'tailwindcss';
import { brand, semantic } from './brand';

/**
 * Preset compartilhado: PDV e retaguarda herdam a mesma paleta,
 * então a marca nunca sai do lugar entre um app e outro.
 */
export const soulPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        violet: {
          DEFAULT: brand.violet,
          dark: brand.violetDark,
          soft: brand.violetSoft,
        },
        indigo: { DEFAULT: brand.indigo, ink: brand.indigoInk },
        magenta: brand.magenta,
        pink: brand.pink,
        lavender: { DEFAULT: brand.lavender, 200: brand.lavender200, 400: brand.lavender400 },
        slate: { DEFAULT: brand.slate, soft: brand.slateSoft },
        success: { DEFAULT: semantic.success, soft: semantic.successSoft },
        warning: { DEFAULT: semantic.warning, soft: semantic.warningSoft },
        danger: { DEFAULT: semantic.danger, soft: semantic.dangerSoft },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '14px', pill: '999px' },
      boxShadow: {
        card: '0 1px 2px rgba(36,20,99,.05), 0 12px 32px -20px rgba(36,20,99,.35)',
        lifted: '0 8px 28px -12px rgba(36,20,99,.30)',
      },
    },
  },
};
