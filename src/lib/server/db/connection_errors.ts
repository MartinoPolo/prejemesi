import { DrizzleQueryError } from 'drizzle-orm';

const POSTGRES_CONNECTION_CLOSED_CODE = 'CONNECTION_CLOSED';

function hasConnectionClosedCode(error: unknown): boolean {
	return (
		error instanceof Error && 'code' in error && error.code === POSTGRES_CONNECTION_CLOSED_CODE
	);
}

/** Whether a query failed because postgres.js lost its socket, directly or wrapped by Drizzle. */
export function isDatabaseConnectionClosed(error: unknown): boolean {
	if (error instanceof DrizzleQueryError) {
		return hasConnectionClosedCode(error.cause);
	}
	return hasConnectionClosedCode(error);
}
