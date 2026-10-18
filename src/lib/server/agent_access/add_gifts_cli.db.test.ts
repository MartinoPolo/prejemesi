import {
	DB_READY,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { EXIT_CODE, runCli, type CliEnvironment } from '../../../../packages/cli/src/cli.js';
import { createAccessToken } from './access_tokens.js';
import type { AgentApiRateLimit } from './api.js';
import { applyChangeProposalRows } from './change_proposals.js';
import { GET as getMe } from '../../../routes/api/v1/me/+server.js';
import { GET as getWishlists } from '../../../routes/api/v1/wishlists/+server.js';
import { POST as postOperation } from '../../../routes/api/v1/operations/[operationName]/+server.js';
import { POST as postProposal } from '../../../routes/api/v1/proposals/+server.js';
import { GET as getProposal } from '../../../routes/api/v1/proposals/[proposalId]/+server.js';

/**
 * The add-gifts skill's CLI calls (`.agents/skills/add-gifts/SKILL.md`), run against the real API
 * routes and database: the skill creates and updates gifts on every wishlist the user's token
 * allows, as proposals with review links.
 */

const ORIGIN = 'https://prejemesi.cz';
const SOURCE_URL = 'https://shop.example/kolo-trek-marlin-5';
const REFERENCE_URL = 'https://www.heureka.cz/kolo-trek-marlin-5/';

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

type AgentRoute = (event: {
	request: Request;
	url: URL;
	params: Record<string, string>;
	cookies: { get(name: string): string | undefined };
	platform: { env: { AGENT_API_RATE_LIMIT: AgentApiRateLimit } };
}) => Promise<Response>;

/** The routes read only what this event provides. */
const ROUTES: { method: string; pattern: RegExp; handler: AgentRoute }[] = [
	{ method: 'GET', pattern: /^\/api\/v1\/me$/, handler: getMe as unknown as AgentRoute },
	{
		method: 'GET',
		pattern: /^\/api\/v1\/wishlists$/,
		handler: getWishlists as unknown as AgentRoute,
	},
	{
		method: 'POST',
		pattern: /^\/api\/v1\/operations\/(?<operationName>[^/]+)$/,
		handler: postOperation as unknown as AgentRoute,
	},
	{
		method: 'POST',
		pattern: /^\/api\/v1\/proposals$/,
		handler: postProposal as unknown as AgentRoute,
	},
	{
		method: 'GET',
		pattern: /^\/api\/v1\/proposals\/(?<proposalId>[^/]+)$/,
		handler: getProposal as unknown as AgentRoute,
	},
];

const routeFetch: CliEnvironment['fetch'] = async (input, init) => {
	const request = new Request(input, init);
	for (const route of ROUTES) {
		const match = route.pattern.exec(input.pathname);
		if (request.method === route.method && match !== null) {
			return route.handler({
				request,
				url: input,
				params: { ...match.groups },
				cookies: { get: () => undefined },
				platform: { env: { AGENT_API_RATE_LIMIT: allowingRateLimit } },
			});
		}
	}
	return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
};

const ProposalOutputSchema = v.object({
	proposal: v.object({
		id: v.string(),
		status: v.string(),
		rows: v.array(v.object({ rowId: v.string(), operation: v.string(), status: v.string() })),
	}),
	reviewLink: v.string(),
});

let configDirectory: string;
let tokenValue: string;

async function prejemesi(argumentList: string[]) {
	const output: string[] = [];
	const errors: string[] = [];
	const exitCode = await runCli(argumentList, {
		fetch: routeFetch,
		configPath: path.join(configDirectory, 'config.json'),
		variables: { PREJEMESI_TOKEN: tokenValue, PREJEMESI_URL: ORIGIN },
		readSecret: async () => '',
		readStandardInput: async () => '',
		writeOutput: (text) => output.push(text),
		writeError: (text) => errors.push(text),
	});
	return { exitCode, stdout: output.join(''), stderr: errors.join('') };
}

async function proposalFrom(argumentList: string[]) {
	const result = await prejemesi(argumentList);
	expect(result.stderr).toBe('');
	expect(result.exitCode).toBe(EXIT_CODE.success);
	return v.parse(ProposalOutputSchema, JSON.parse(result.stdout));
}

async function inputFile(name: string, content: unknown) {
	const filePath = path.join(configDirectory, name);
	await writeFile(filePath, JSON.stringify(content));
	return `@${filePath}`;
}

async function giftNames(wishlistId: string) {
	const rows = await getDb()
		.select({ name: gift.name })
		.from(gift)
		.where(eq(gift.wishlistId, wishlistId));
	return rows.map((row) => row.name);
}

describe.skipIf(!DB_READY)('add-gifts through the CLI on the user’s own token', () => {
	let firstWishlist: { id: string; shortId: string };
	let secondWishlist: { id: string; shortId: string };
	let otherWishlist: { id: string; shortId: string };

	beforeAll(async () => {
		await seedFixtureUsers();
		configDirectory = await mkdtemp(path.join(tmpdir(), 'add-gifts-cli-'));
		firstWishlist = await createWishlistFixture();
		secondWishlist = await createWishlistFixture({ sharedAt: new Date(Date.now() - 60_000) });
		otherWishlist = await createWishlistFixture();
		({ value: tokenValue } = await createAccessToken(
			MANAGER_ID,
			v.parse(CreateAccessTokenInputSchema, {
				name: 'add-gifts',
				scopes: ['gifts:write'],
				wishlistIds: [firstWishlist.id, secondWishlist.id],
			}),
		));
	});

	afterAll(async () => {
		await rm(configDirectory, { recursive: true, force: true });
		await removeFixtureRows();
	});

	it('proposes researched gifts on every allowed wishlist, with review links, and applies nothing', async () => {
		for (const target of [firstWishlist, secondWishlist]) {
			const gifts = [
				{
					name: `Kolo Trek Marlin 5 ${target.shortId}`,
					links: [{ url: SOURCE_URL }, { url: REFERENCE_URL, label: 'Heureka' }],
					price: 15990,
					priceMax: 17490,
					currency: 'CZK',
				},
				{ name: `Helma ${target.shortId}`, links: [{ url: 'https://shop.example/helma' }] },
			];

			const output = await proposalFrom([
				'gifts',
				'create',
				'--wishlist',
				target.shortId,
				'--input',
				await inputFile(`gifts-${target.shortId}.json`, gifts),
				'--idempotency-key',
				`add-gifts-${target.shortId}-1`,
			]);

			expect(output.proposal.status).toBe('pending');
			expect(output.proposal.rows).toEqual([
				expect.objectContaining({ operation: 'createGift', status: 'ready' }),
				expect.objectContaining({ operation: 'createGift', status: 'ready' }),
			]);
			expect(output.reviewLink).toBe(
				`${ORIGIN}/w/${target.shortId}/changes/${output.proposal.id}`,
			);
			expect(await giftNames(target.id)).toEqual([]);
		}
	});

	it('replays a retried batch with the same Idempotency-Key instead of proposing it twice', async () => {
		const argumentList = [
			'gifts',
			'create',
			'--wishlist',
			firstWishlist.shortId,
			'--input',
			await inputFile('retry.json', [{ name: 'Zvonek', links: [{ url: SOURCE_URL }] }]),
			'--idempotency-key',
			'add-gifts-retry-1',
		];

		const first = await proposalFrom(argumentList);
		const retried = await proposalFrom(argumentList);

		expect(retried.proposal.id).toBe(first.proposal.id);
		expect(retried.reviewLink).toBe(first.reviewLink);
	});

	it('proposes updates of existing gifts that the review applies', async () => {
		const giftId = await createGiftFixture(secondWishlist.id, {
			name: 'Batoh',
			description: 'Modrý',
			links: [{ url: SOURCE_URL }],
		});
		const listed = await prejemesi(['gifts', 'list', '--wishlist', secondWishlist.shortId]);
		expect(listed.stdout).toContain(giftId);

		const output = await proposalFrom([
			'proposals',
			'submit',
			'--input',
			await inputFile('update.json', {
				wishlistShortId: secondWishlist.shortId,
				operations: [
					{
						operation: 'appendGiftDescription',
						input: { giftId, text: 'Recenze: Heureka 4,7/5 (312 hodnocení)' },
					},
					{
						operation: 'updateGift',
						input: {
							id: giftId,
							links: [{ url: SOURCE_URL }, { url: REFERENCE_URL, label: 'Heureka' }],
							price: 1290,
							currency: 'CZK',
						},
					},
				],
			}),
			'--idempotency-key',
			'add-gifts-update-1',
		]);

		expect(output.proposal.status).toBe('pending');
		expect(output.proposal.rows.map((row) => row.status)).toEqual(['ready', 'ready']);
		expect(output.reviewLink).toBe(
			`${ORIGIN}/w/${secondWishlist.shortId}/changes/${output.proposal.id}`,
		);
		expect(await readGift(giftId)).toMatchObject({ price: null });

		const shown = await proposalFrom(['proposals', 'show', output.proposal.id]);
		expect(shown.reviewLink).toBe(output.reviewLink);
		await applyChangeProposalRows(
			{ id: MANAGER_ID, name: 'Manager' },
			output.proposal.id,
			output.proposal.rows.map((row) => row.rowId),
		);
		const updated = await readGift(giftId);
		expect(updated?.links).toEqual([
			{ url: SOURCE_URL },
			{ url: REFERENCE_URL, label: 'Heureka' },
		]);
		expect(Number(updated?.price)).toBe(1290);
		expect(JSON.stringify(updated)).toContain('Recenze: Heureka 4,7/5');
	});

	it('reads the wishlist’s categories for the gifts it proposes', async () => {
		const result = await prejemesi([
			'read',
			'readGiftCategories',
			'--input',
			JSON.stringify({ wishlistId: firstWishlist.id }),
		]);

		expect(result.exitCode).toBe(EXIT_CODE.success);
		expect(JSON.parse(result.stdout)).toMatchObject({ result: expect.any(Array) });
	});

	it('cannot propose gifts on a wishlist the token does not allow', async () => {
		const byShortId = await prejemesi([
			'gifts',
			'create',
			'--wishlist',
			otherWishlist.shortId,
			'--name',
			'Kolo',
		]);
		const byProposal = await prejemesi([
			'proposals',
			'submit',
			'--input',
			JSON.stringify({
				wishlistShortId: otherWishlist.shortId,
				operations: [
					{
						operation: 'createGift',
						input: { wishlistId: otherWishlist.id, name: 'Kolo' },
					},
				],
			}),
		]);

		expect(byShortId.exitCode).toBe(EXIT_CODE.usage);
		expect(byProposal.exitCode).toBe(EXIT_CODE.failure);
		expect(JSON.parse(byProposal.stderr)).toMatchObject({
			status: 403,
			error: { code: 'AGENT_WISHLIST_NOT_ALLOWED' },
		});
		expect(await giftNames(otherWishlist.id)).toEqual([]);
	});
});
