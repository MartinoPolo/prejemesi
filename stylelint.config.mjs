export default {
	extends: ['stylelint-config-standard', 'stylelint-config-html/svelte'],
	rules: {
		'at-rule-no-unknown': [
			true,
			{ ignoreAtRules: ['custom-variant', 'theme', 'utility', 'plugin', 'source'] },
		],
		'import-notation': 'string',
		'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
	},
};
