import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { cimd } from '@better-auth/cimd';
import * as schema from './schema.js';

/**
 * A database that has none of the tables yet, as the plugins see it at startup: they defer
 * seeding when a table is missing, so the check below sees only the Drizzle schema.
 */
const databaseWithoutTables = new Proxy(
	{},
	{
		get: (_target, property) =>
			property === '_'
				? undefined
				: () => {
						throw new Error('relation "oauth_resource" does not exist');
					},
	},
);

describe('auth schema', () => {
	// Since 1.7.3 BetterAuth refuses requests while the Drizzle schema lacks a table or column an
	// enabled plugin writes, so the OAuth tables must ship before the plugins are enabled.
	it('holds every table and column BetterAuth writes with the OAuth plugins enabled', async () => {
		const auth = betterAuth({
			baseURL: 'http://localhost:5173',
			secret: 'schema-coverage-test-secret-0123456789',
			logger: { disabled: true },
			database: drizzleAdapter(databaseWithoutTables, { provider: 'pg', schema }),
			plugins: [
				jwt(),
				mcp({
					loginPage: '/login',
					consentPage: '/oauth/consent',
					resource: 'http://localhost:5173/mcp',
				}),
				cimd({ fetchClientMetadataResource: fetch, metadataProfile: 'mcp-2026-07-28' }),
			],
		});
		const context = await auth.$context;

		expect(context.checkSchema).toBeDefined();
		await expect(context.checkSchema?.() ?? Promise.resolve()).resolves.toBeUndefined();
	});
});
