import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  pluginJs.configs.recommended,
  {
    files: ['src/**/*.js', 'prisma/**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      semi: 'error',
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
      'no-undef': 'error',
    },
  },
];
