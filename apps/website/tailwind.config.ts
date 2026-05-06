import type { Config } from 'tailwindcss';

const sharedPreset = require('@vendorhub/config-tailwind/preset.cjs');

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [sharedPreset],
};

export default config;
