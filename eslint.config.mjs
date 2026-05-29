import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import checkFile from 'eslint-plugin-check-file';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default [
	{
		ignores: [
			'.svelte-kit',
			'.storybook',
			'build',
			'node_modules',
			'src/lib/paraglide',
			'**/*.config.*',
			'*.d.ts',
		],
	},
	...tseslint.configs.recommended,
	...storybook.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// typescript-eslint recommends disabling no-undef for TS projects
			// https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Gap rules not covered by OxLint
			'@typescript-eslint/strict-boolean-expressions': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true },
			],
			'@typescript-eslint/require-array-sort-compare': 'error',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: 'variableLike',
					format: ['camelCase', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'variable',
					format: ['UPPER_CASE', 'camelCase', 'PascalCase'],
					modifiers: ['global', 'const'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'typeLike',
					format: ['PascalCase'],
				},
			],
			'@typescript-eslint/consistent-type-definitions': 'warn',
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ fixStyle: 'inline-type-imports' },
			],
			'@typescript-eslint/no-import-type-side-effects': 'warn',
		},
	},
	...sveltePlugin.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: '@typescript-eslint/parser',
				extraFileExtensions: ['.svelte'],
				project: true,
				svelteConfig,
				svelteFeatures: {
					experimentalGenerics: true,
				},
			},
		},
	},
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['src/**/*.ts'],
		ignores: ['src/routes/**/+*'],
		plugins: { 'check-file': checkFile },
		rules: {
			'check-file/filename-naming-convention': [
				'error',
				{ '**/*.ts': 'SNAKE_CASE' },
				{ ignoreMiddleExtensions: true },
			],
		},
	},
	{
		files: ['src/lib/**/*.svelte'],
		ignores: ['src/lib/components/ui/**'],
		plugins: { 'check-file': checkFile },
		rules: {
			'check-file/filename-naming-convention': ['error', { '**/*.svelte': 'PASCAL_CASE' }],
		},
	},
];
