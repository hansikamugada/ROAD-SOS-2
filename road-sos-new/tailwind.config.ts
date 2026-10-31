import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#142333', orange: '#ed6b32', paper: '#f7f6f2' }, boxShadow: { soft: '0 8px 28px rgba(20,35,51,.07)' } } }, plugins: [] } satisfies Config;
