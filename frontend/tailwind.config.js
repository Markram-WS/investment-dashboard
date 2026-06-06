/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'opacity-0',
    'opacity-100',
    'group-hover:opacity-100',
    'hover:text-blue-600',
    'hover:text-gray-500',
    'text-gray-300',
  ],
  theme: {
    extend: {
      zIndex: {
        '100': '100',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: 'var(--color-primary)',
        ink: 'var(--color-ink)',
        slate: 'var(--color-slate)',
        'brand-teal': 'var(--color-brand-teal)',
        'brand-yellow': 'var(--color-brand-yellow)',
        'brand-coral': 'var(--color-brand-coral)',
        'brand-blue': 'var(--color-brand-blue)',
        'teal-light': 'var(--color-teal-light)',
        'coral-light': 'var(--color-coral-light)',
        hairline: 'var(--color-hairline)',
        'hairline-soft': 'var(--color-hairline-soft)',
        surface: 'var(--color-surface)',
        canvas: 'var(--color-canvas)',
        'surface-soft': 'var(--color-surface-soft)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        'on-primary': 'var(--color-on-primary)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        accent: 'var(--color-accent)',
      },
    },
  },
  plugins: [],
}
