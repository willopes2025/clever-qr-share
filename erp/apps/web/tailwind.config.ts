import type { Config } from 'tailwindcss';
import { soulPreset } from '../../packages/ui/src/tailwind-preset';

export default {
  presets: [soulPreset as Config],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
