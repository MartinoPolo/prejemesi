/** Maximum number of data rows accepted by the import wizard. */
export const MAX_IMPORT_ROWS = 200;

/** Maximum file/paste size in bytes (1 MB). */
export const MAX_IMPORT_BYTES = 1_048_576;

export type ImportLimitError = 'rows' | 'size';

/**
 * Validate that the parsed import data is within the hard limits.
 * Empty row count (0) is valid — empty-after-parse is handled separately.
 */
export function validateImportLimits(
	rowCount: number,
	byteSize: number,
): { valid: boolean; error: ImportLimitError | null } {
	if (rowCount > MAX_IMPORT_ROWS) {
		return { valid: false, error: 'rows' };
	}
	if (byteSize > MAX_IMPORT_BYTES) {
		return { valid: false, error: 'size' };
	}
	return { valid: true, error: null };
}
