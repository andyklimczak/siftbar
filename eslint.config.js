import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist/**', 'site-dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'tests/browser/fixtures/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } }, rules: { '@typescript-eslint/no-explicit-any': 'error' } }
);
