export type IngestionErrorCode =
	| 'target_not_found'
	| 'target_archived'
	| 'target_mismatch'
	| 'idempotency_conflict'
	| 'ambiguity'
	| 'category_unknown';

const CONFLICT_CODES: ReadonlySet<IngestionErrorCode> = new Set([
	'target_not_found',
	'target_archived',
	'target_mismatch',
	'idempotency_conflict',
	'ambiguity',
	'category_unknown',
]);

export class IngestionError extends Error {
	constructor(
		readonly code: IngestionErrorCode,
		message: string,
	) {
		super(message);
		this.name = 'IngestionError';
	}
}

export function ingestionErrorStatus(error: IngestionError): number {
	return CONFLICT_CODES.has(error.code) ? 409 : 400;
}
