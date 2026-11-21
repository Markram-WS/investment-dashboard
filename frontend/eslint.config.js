import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    // No numeric font sizes anywhere in the source tree; token references such
    // as 'var(--fs-label)' are the sanctioned form.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='fontSize'][value.type='Literal'][value.raw=/^[\"']?[0-9]/]",
          message: 'Use a control/type token instead of a literal fontSize.',
        },
        {
          selector: "Property[key.name='fontSize'][value.type='TemplateLiteral']",
          message: 'Use a control/type token instead of a literal fontSize.',
        },
      ],
    },
  },
]
