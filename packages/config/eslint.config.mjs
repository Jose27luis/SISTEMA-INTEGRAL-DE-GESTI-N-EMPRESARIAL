import tseslint from 'typescript-eslint';

export function crearConfiguracionEslint(directorioRaiz) {
  return [
    {
      ignores: ['dist/**', '.next/**', 'node_modules/**', 'next-env.d.ts', '*.config.mjs'],
    },
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: directorioRaiz,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-expect-error': true,
            'ts-ignore': true,
            'ts-nocheck': true,
            'ts-check': false,
          },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
        '@typescript-eslint/consistent-type-imports': 'error',
        'no-warning-comments': 'error',
        'no-restricted-syntax': [
          'error',
          {
            selector: "JSXAttribute[name.name='placeholder']",
            message: 'Prohibido placeholder: use una etiqueta visible y un texto de ayuda.',
          },
        ],
      },
    },
  ];
}
