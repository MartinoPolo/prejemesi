import type { ColumnRole, DetectedColumn } from '$lib/modules/import/detect_columns.js';
import { COLUMN_ROLE } from '$lib/modules/import/detect_columns.js';
import * as m from '$lib/paraglide/messages.js';

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

/** A target gift field, shown as one row in the column mapping. */
export interface MappingFieldDef {
	/** The column role a source column takes when assigned to this field. */
	role: ColumnRole;
	label: () => string;
	/** Whether several source columns may feed this field (links aggregate into an array). */
	multi: boolean;
	required: boolean;
}

/**
 * The mapping is field-oriented: one row per destination gift field, each
 * picking the source column(s) that fill it. Fields are fixed (the gift schema),
 * so the layout never widens with the spreadsheet. `bool`/`ignore` are not fields
 * — columns assigned to neither field are simply left out of the import.
 */
export const MAPPING_FIELDS: readonly MappingFieldDef[] = [
	{
		role: COLUMN_ROLE.name,
		label: () => m.import_wizard_role_name(),
		multi: false,
		required: true,
	},
	{
		role: COLUMN_ROLE.notes,
		label: () => m.import_wizard_role_notes(),
		multi: false,
		required: false,
	},
	{
		role: COLUMN_ROLE.url,
		label: () => m.import_wizard_role_url(),
		multi: true,
		required: false,
	},
	{
		role: COLUMN_ROLE.price,
		label: () => m.import_wizard_role_price(),
		multi: false,
		required: false,
	},
];

/**
 * Roles that fill exactly one draft field. buildDraftRows is last-write-wins for
 * these, so two columns sharing one can't be shown by a single-select field.
 */
const SINGLE_USE_COLUMN_ROLES: ReadonlySet<ColumnRole> = new Set([
	COLUMN_ROLE.name,
	COLUMN_ROLE.notes,
	COLUMN_ROLE.price,
]);

/**
 * Reconcile detected roles with the single-field mapping: detection may assign a
 * single-use role (e.g. `notes`) to several columns, which buildDraftRows would
 * silently collapse. Keep the first such column and demote the rest to `ignore`
 * so the displayed mapping matches exactly what gets imported.
 */
export function normalizeColumnRoles(columns: readonly DetectedColumn[]): DetectedColumn[] {
	const taken = new Set<ColumnRole>();
	return columns.map((column) => {
		if (!SINGLE_USE_COLUMN_ROLES.has(column.role)) {
			return column;
		}
		if (taken.has(column.role)) {
			return { ...column, role: COLUMN_ROLE.ignore };
		}
		taken.add(column.role);
		return column;
	});
}
