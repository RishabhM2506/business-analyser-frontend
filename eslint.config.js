import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
import globals from 'globals'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default withVueTs(
  includeIgnoreFile(gitignorePath),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/config-files',
    files: ['*.config.{js,ts,mjs,cjs}', '.*.{js,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  js.configs.recommended,

  // Top tier eslint-plugin-vue offers (not the loose vue3-essential tier).
  pluginVue.configs['flat/recommended'],

  // typescript-eslint's `strict` preset, wired for .vue SFCs.
  vueTsConfigs.strict,

  // a11y linting for template markup.
  ...pluginVueA11y.configs['flat/recommended'],

  {
    name: 'app/rules',
    rules: {
      // <script setup> components are anonymous by design.
      'vue/multi-word-component-names': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      // Phase 2 intentionally stubs many signatures ahead of their Phase 3
      // implementation — an unused, underscore-prefixed param/var is that
      // stub, not a mistake.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Must be last: turns off stylistic rules that would conflict with Prettier.
  eslintConfigPrettier,
)
