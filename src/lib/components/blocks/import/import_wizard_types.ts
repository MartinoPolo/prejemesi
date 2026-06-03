import type { ColumnRole } from '$lib/modules/import/detect_columns.js';

export const WIZARD_STEP = {
	source: 'source',
	review: 'review',
	confirm: 'confirm',
} as const;

export type WizardStep = (typeof WIZARD_STEP)[keyof typeof WIZARD_STEP];

export const WIZARD_STEPS: readonly WizardStep[] = [
	WIZARD_STEP.source,
	WIZARD_STEP.review,
	WIZARD_STEP.confirm,
];

export const WIZARD_MODE = {
	newList: 'new-list',
	append: 'append',
} as const;

export type WizardMode = (typeof WIZARD_MODE)[keyof typeof WIZARD_MODE];

export const SOURCE_METHOD = {
	file: 'file',
	paste: 'paste',
	sheets: 'sheets',
} as const;

export type SourceMethod = (typeof SOURCE_METHOD)[keyof typeof SOURCE_METHOD];

export const PARSE_STATUS = {
	idle: 'idle',
	parsing: 'parsing',
	parsed: 'parsed',
	error: 'error',
} as const;

export type ParseStatus = (typeof PARSE_STATUS)[keyof typeof PARSE_STATUS];

export const COMMIT_STATUS = {
	idle: 'idle',
	committing: 'committing',
	success: 'success',
	error: 'error',
} as const;

export type CommitStatus = (typeof COMMIT_STATUS)[keyof typeof COMMIT_STATUS];

/** Options for the column-role Select dropdowns in the review step. */
export interface ColumnRoleOption {
	value: ColumnRole;
	/** i18n message key for the label. */
	labelKey: string;
}

export const COLUMN_ROLE_OPTIONS: readonly ColumnRoleOption[] = [
	{ value: 'name', labelKey: 'import_wizard_role_name' },
	{ value: 'notes', labelKey: 'import_wizard_role_notes' },
	{ value: 'url', labelKey: 'import_wizard_role_url' },
	{ value: 'price', labelKey: 'import_wizard_role_price' },
	{ value: 'bool', labelKey: 'import_wizard_role_bool' },
	{ value: 'ignore', labelKey: 'import_wizard_role_ignore' },
] as const;
