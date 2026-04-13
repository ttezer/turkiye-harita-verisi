import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'strip-shebang',
      transform(code, id) {
        if (code.startsWith('#!')) {
          return { code: '//' + code.slice(2), map: null };
        }
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
});
