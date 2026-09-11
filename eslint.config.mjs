import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  { ignores: ['dist', 'coverage', 'moja-farma-v3.html', 'referenca-sim.jsdom.js'] },
  tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // ── Core granica (CLAUDE.md, pravilo 1) ─────────────────────────────────────────
  // core/ i config/ moraju da rade u Node-u bez DOM-a: vreme i nasumičnost stižu kao
  // argumenti (now, rng), a sve što dodiruje browser živi iza adaptera u platform/.
  {
    files: ['src/core/**/*.ts', 'src/config/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Core prima vreme kao argument (now: ms).' },
        { name: 'performance', message: 'Core prima vreme kao argument (now: ms).' },
        { name: 'document', message: 'Core ne sme da dodiruje DOM.' },
        { name: 'window', message: 'Core ne sme da dodiruje DOM.' },
        { name: 'navigator', message: 'Platformski API-ji žive u src/platform.' },
        { name: 'localStorage', message: 'Skladište je iza adaptera u src/platform.' },
        { name: 'setTimeout', message: 'Core je sinhron i bez tajmera.' },
        { name: 'setInterval', message: 'Core je sinhron i bez tajmera.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Core koristi ubrizgani rng.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui', '**/ui/**', '**/platform', '**/platform/**'],
              message: 'Zavisnosti idu samo ka unutra: core ne zna za ui ni platform.',
            },
            {
              group: ['**/art', '**/art/**', '**/i18n', '**/i18n/**'],
              message: 'Core emituje događaje sa ID-jevima; tekst i grafiku bira ui.',
            },
          ],
        },
      ],
    },
  },
  prettier,
)
