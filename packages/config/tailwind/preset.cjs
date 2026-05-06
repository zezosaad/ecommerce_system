/**
 * Shared Tailwind preset for VendorHub apps (dashboard, website).
 *
 * - RTL-aware via Tailwind's logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`)
 *   plus the official `tailwindcss-rtl` plugin so legacy directional utilities
 *   (`ml-*`, `mr-*`, `pl-*`, `pr-*`) flip automatically when `dir="rtl"`.
 * - shadcn/ui-compatible color tokens (driven by CSS variables defined in each
 *   app's `globals.css`).
 * - Inter for English; IBM Plex Sans Arabic for Arabic, with system fallbacks.
 */

const animatePlugin = require('tailwindcss-animate');
const rtlPlugin = require('tailwindcss-rtl');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Apps extend `content` with their own globs — we don't presume a layout here.
  content: [],
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'var(--font-sans, Inter)',
          'IBM Plex Sans Arabic',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--font-mono, ui-monospace)', 'SFMono-Regular', 'monospace'],
      },
      // shadcn/ui token mapping (variables defined per-app in globals.css)
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animatePlugin, rtlPlugin],
};
