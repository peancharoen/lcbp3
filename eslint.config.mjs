import backendConfig from './backend/eslint.config.mjs';
import frontendConfig from './frontend/eslint.config.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/temp/**',
      '**/tmp/**',
      'specs/**',
      'backend/documentation/**',
      'backend/scripts/**',
      'frontend/public/**',
      '**/test/**',
    ],
  },
  ...backendConfig.map((config) => ({
    ...config,
    files: config.files
      ? config.files.map((f) => (f.startsWith('backend/') ? f : `backend/${f}`))
      : ['backend/**/*.{ts,tsx,js,jsx}'],
  })),
  ...frontendConfig.map((config) => ({
    ...config,
    files: config.files
      ? config.files.map((f) => (f.startsWith('frontend/') ? f : `frontend/${f}`))
      : ['frontend/**/*.{ts,tsx,js,jsx}'],
  })),
];
