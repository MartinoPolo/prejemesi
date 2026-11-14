import { describe, expect, it } from 'vitest';
import { isDatabaseConnectionClosed } from './connection_errors.js';
import { failedDatabaseQuery, postgresConnectionError } from './connection_errors.test-setup.js';

describe('isDatabaseConnectionClosed', () => {
	it('recognizes a query Drizzle failed because the connection closed', () => {
		expect(
			isDatabaseConnectionClosed(
				failedDatabaseQuery(postgresConnectionError('CONNECTION_CLOSED')),
			),
		).toBe(true);
	});

	it('recognizes the closed connection error postgres.js raises itself', () => {
		expect(isDatabaseConnectionClosed(postgresConnectionError('CONNECTION_CLOSED'))).toBe(true);
	});

	it('rejects a query Drizzle failed for another reason', () => {
		const statementTimeout = Object.assign(
			new Error('canceling statement due to statement timeout'),
			{
				code: '57014',
			},
		);
		expect(isDatabaseConnectionClosed(failedDatabaseQuery(statementTimeout))).toBe(false);
	});

	it.each(['CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'CONNECT_TIMEOUT'])(
		'rejects the other connection failure %s',
		(code) => {
			expect(isDatabaseConnectionClosed(postgresConnectionError(code))).toBe(false);
			expect(
				isDatabaseConnectionClosed(failedDatabaseQuery(postgresConnectionError(code))),
			).toBe(false);
		},
	);

	it('rejects plain errors and values that are not errors', () => {
		expect(isDatabaseConnectionClosed(new Error('CONNECTION_CLOSED'))).toBe(false);
		expect(isDatabaseConnectionClosed({ code: 'CONNECTION_CLOSED' })).toBe(false);
		expect(isDatabaseConnectionClosed('CONNECTION_CLOSED')).toBe(false);
		expect(isDatabaseConnectionClosed(null)).toBe(false);
		expect(isDatabaseConnectionClosed(undefined)).toBe(false);
	});
});
