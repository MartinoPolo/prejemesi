import { DrizzleQueryError } from 'drizzle-orm';

/** Shaped like the connection errors postgres.js raises, such as when its socket closes. */
export function postgresConnectionError(code: string): Error {
	return Object.assign(new Error(`write ${code} db.example.com:5432`), {
		code,
		errno: code,
		address: 'db.example.com',
		port: 5432,
	});
}

/** A query Drizzle failed, wrapping the driver error that caused it. */
export function failedDatabaseQuery(cause: Error): DrizzleQueryError {
	return new DrizzleQueryError(
		'update "chat_runner_job" set "status" = $1 where "chat_runner_job"."id" = $2',
		['running', 'job'],
		cause,
	);
}
