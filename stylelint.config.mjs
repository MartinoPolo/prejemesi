export default {
	extends: ['stylelint-config-standard', 'stylelint-config-html/svelte'],
	rules: {
		'at-rule-no-unknown': [
			true,
			{ ignoreAtRules: ['custom-variant', 'theme', 'utility', 'plugin', 'source'] },
		],
		'declaration-property-value-disallowed-list': [
			{ '/^(border|outline|stroke|box-shadow|column-rule)/': ['/var\\(--ink\\)/'] },
			{ message: 'Outlines use var(--edge); --ink is for text and fills.' },
		],
		'import-notation': 'string',
		'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
	},
};
