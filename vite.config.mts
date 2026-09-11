/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  // Relativan base: isti build se u Fazi 3 učitava iz Capacitor WebView-a.
  base: './',
  // host: true → dev server sluša na lokalnoj mreži, pa se igra otvara i na telefonu.
  server: { host: true },
  preview: { host: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Dnevni poklon zavisi od lokalnog kalendarskog dana — testovi rade u fiksnoj zoni.
    env: { TZ: 'Europe/Belgrade' },
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
