import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXIT_CODE, runCli, type CliEnvironment } from './cli.js';
import { defaultConfigPath } from './config.js';

const TOKEN = 'pjs_SECRETsecretSECRETsecretSECRETsecret12345';
const OTHER_TOKEN = 'pjs_ENVIRONMENTenvironmentENVIRONMENT123456';
const BASE_URL = 'https://prejemesi.cz';
const WISHLIST = { id: 'wishlist-id-1', shortId: 'narozky', title: 'Narozeniny', role: 'owner' };
const PROPOSAL_ID = 'proposal-1';
const REVIEW_PATH = `/w/${WISHLIST.shortId}/changes/${PROPOSAL_ID}`;

interface RecordedRequest {
	method: string;
	url: string;
	headers: Headers;
	body: unknown;
}

interface FakeServer {
	requests: RecordedRequest[];
	/** Answers by `METHOD /path`; unknown routes answer 404. */
	routes: Record<string, (request: RecordedRequest) => { status?: number; body: unknown }>;
}

function proposalBody(status: string) {
	return {
		proposal: { id: PROPOSAL_ID, status, reviewUrl: REVIEW_PATH, rows: [] },
	};
}

function defaultRoutes(): FakeServer['routes'] {
	return {
		'GET /api/v1/me': ({ headers }) =>
			headers.get('authorization') === `Bearer ${TOKEN}` ||
			headers.get('authorization') === `Bearer ${OTHER_TOKEN}`
				? {
						body: {
							user: { name: 'Martin' },
							token: { name: 'CLI', prefix: TOKEN.slice(0, 12), scopes: ['read'] },
						},
					}
				: {
						status: 401,
						body: { error: { code: 'AGENT_TOKEN_INVALID', message: 'Unknown token.' } },
					},
		'GET /api/v1/wishlists': () => ({ body: { wishlists: [WISHLIST] } }),
		'POST /api/v1/operations/readWishlistGifts': () => ({
			body: { result: { gifts: [{ id: 'gift-1', name: 'Kolo' }] } },
		}),
		'POST /api/v1/proposals': () => ({ status: 201, body: proposalBody('pending') }),
		[`GET /api/v1/proposals/${PROPOSAL_ID}`]: () => ({ body: proposalBody('pending') }),
		[`POST /api/v1/proposals/${PROPOSAL_ID}/apply`]: () => ({
			status: 409,
			body: {
				error: {
					code: 'AGENT_PROPOSAL_REVIEW_REQUIRED',
					message: 'Review it.',
					reviewUrl: REVIEW_PATH,
				},
			},
		}),
	};
}

let configDirectory: string;
let server: FakeServer;
let output: string[];
let errors: string[];

function environment(overrides: Partial<CliEnvironment> = {}): CliEnvironment {
	return {
		configPath: path.join(configDirectory, 'prejemesi', 'config.json'),
		variables: {},
		fetch: async (input, init) => {
			const recorded: RecordedRequest = {
				method: init.method ?? 'GET',
				url: input.href,
				headers: new Headers(init.headers),
				body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
			};
			server.requests.push(recorded);
			const route = server.routes[`${recorded.method} ${input.pathname}`];
			const answer = route?.(recorded) ?? {
				status: 404,
				body: { error: { code: 'NOT_FOUND' } },
			};
			return Response.json(answer.body, { status: answer.status ?? 200 });
		},
		readSecret: async () => `${TOKEN}\n`,
		readStandardInput: async () => '',
		writeOutput: (text) => output.push(text),
		writeError: (text) => errors.push(text),
		...overrides,
	};
}

async function run(argumentList: string[], overrides: Partial<CliEnvironment> = {}) {
	output = [];
	errors = [];
	const exitCode = await runCli(argumentList, environment(overrides));
	return { exitCode, stdout: output.join(''), stderr: errors.join('') };
}

function lastSubmission() {
	const submissions = server.requests.filter(
		(request) => request.method === 'POST' && request.url.endsWith('/api/v1/proposals'),
	);
	return submissions.at(-1);
}

describe('prejemesi CLI', () => {
	beforeEach(async () => {
		configDirectory = await mkdtemp(path.join(tmpdir(), 'prejemesi-cli-'));
		server = { requests: [], routes: defaultRoutes() };
	});

	afterEach(async () => {
		await rm(configDirectory, { recursive: true, force: true });
	});

	describe('login', () => {
		it('checks the token, stores it in the user config and prints only its prefix', async () => {
			const result = await run(['login']);

			expect(result.exitCode).toBe(EXIT_CODE.success);
			expect(JSON.parse(result.stdout)).toMatchObject({
				loggedIn: true,
				baseUrl: BASE_URL,
				token: { prefix: TOKEN.slice(0, 12) },
			});
			expect(result.stdout + result.stderr).not.toContain(TOKEN);
			const stored = JSON.parse(
				await readFile(path.join(configDirectory, 'prejemesi', 'config.json'), 'utf8'),
			);
			expect(stored).toEqual({ baseUrl: BASE_URL, token: TOKEN });
			expect(server.requests[0]?.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
		});

		// Windows has no POSIX modes; the per-user %APPDATA% directory keeps the file private there.
		it.skipIf(process.platform === 'win32')(
			'keeps the config readable by the user only',
			async () => {
				await run(['login']);

				const configStat = await stat(
					path.join(configDirectory, 'prejemesi', 'config.json'),
				);
				expect(configStat.mode & 0o077).toBe(0);
			},
		);

		it('stores nothing and prints no token when the server refuses it', async () => {
			const rejected = 'pjs_REJECTEDrejectedREJECTEDrejected12345';

			const result = await run(['login'], { readSecret: async () => rejected });

			expect(result.exitCode).toBe(EXIT_CODE.failure);
			expect(JSON.parse(result.stderr)).toMatchObject({
				status: 401,
				error: { code: 'AGENT_TOKEN_INVALID' },
			});
			expect(result.stdout + result.stderr).not.toContain(rejected);
			await expect(
				stat(path.join(configDirectory, 'prejemesi', 'config.json')),
			).rejects.toThrow();
		});

		it('refuses input that is not an access token without echoing it', async () => {
			const result = await run(['login'], { readSecret: async () => 'my password 123' });

			expect(result.exitCode).toBe(EXIT_CODE.usage);
			expect(result.stdout + result.stderr).not.toContain('my password 123');
			expect(server.requests).toHaveLength(0);
		});

		it('logs in to another server with --base-url and uses it afterwards', async () => {
			await run(['login', '--base-url', 'http://localhost:5191/ignored/path']);
			await run(['wishlists']);

			expect(server.requests.map((request) => request.url)).toEqual([
				'http://localhost:5191/api/v1/me',
				'http://localhost:5191/api/v1/wishlists',
			]);
		});
	});

	describe('never prints the token after login', () => {
		const commands = [
			['whoami'],
			['wishlists'],
			['gifts', 'list', '--wishlist', WISHLIST.shortId],
			['gifts', 'create', '--wishlist', WISHLIST.shortId, '--name', 'Kolo'],
			[
				'gifts',
				'update',
				'gift-1',
				'--wishlist',
				WISHLIST.shortId,
				'--input',
				'{"price":100}',
			],
			['gifts', 'delete', 'gift-1', '--wishlist', WISHLIST.shortId],
			['gifts', 'reorder', 'gift-2', 'gift-1', '--wishlist', WISHLIST.shortId],
			['proposals', 'show', PROPOSAL_ID],
			['proposals', 'apply', PROPOSAL_ID],
			['proposals', 'show', 'missing'],
			['gifts', 'list', '--wishlist', 'unknown'],
			['gifts', 'bogus'],
			['help'],
			['logout'],
		];

		it.each(commands)(
			'`%s …` keeps it out of standard output and error',
			async (...command) => {
				await run(['login']);

				const result = await run(command);

				expect(result.stdout + result.stderr).not.toContain(TOKEN);
				expect(result.stdout + result.stderr).not.toContain(TOKEN.slice(12));
			},
		);
	});

	it('answers in JSON a script can parse', async () => {
		await run(['login']);

		const wishlists = await run(['wishlists']);
		const gifts = await run(['gifts', 'list', '--wishlist', WISHLIST.shortId]);

		expect(JSON.parse(wishlists.stdout)).toEqual({ wishlists: [WISHLIST] });
		expect(JSON.parse(gifts.stdout)).toEqual({
			result: { gifts: [{ id: 'gift-1', name: 'Kolo' }] },
		});
		expect(server.requests.at(-1)?.body).toEqual({ wishlistShortId: WISHLIST.shortId });
	});

	describe('gift changes', () => {
		beforeEach(async () => {
			await run(['login']);
		});

		it('submits a created gift as a proposal and prints its absolute review link', async () => {
			const result = await run([
				'gifts',
				'create',
				'--wishlist',
				WISHLIST.shortId,
				'--name',
				'Kolo',
				'--idempotency-key',
				'add-kolo-1',
			]);

			expect(result.exitCode).toBe(EXIT_CODE.success);
			expect(lastSubmission()?.body).toEqual({
				wishlistId: WISHLIST.id,
				operations: [
					{ operation: 'createGift', input: { wishlistId: WISHLIST.id, name: 'Kolo' } },
				],
			});
			expect(lastSubmission()?.headers.get('idempotency-key')).toBe('add-kolo-1');
			expect(JSON.parse(result.stdout)).toMatchObject({
				proposal: { id: PROPOSAL_ID, status: 'pending' },
				reviewLink: `${BASE_URL}${REVIEW_PATH}`,
			});
		});

		it('proposes several gifts at once from an array, read from a file', async () => {
			const inputPath = path.join(configDirectory, 'gifts.json');
			await writeFile(
				inputPath,
				JSON.stringify([{ name: 'Kolo' }, { name: 'Helma', price: 900 }]),
			);

			await run(['gifts', 'create', '--wishlist', WISHLIST.id, '--input', `@${inputPath}`]);

			expect(lastSubmission()?.body).toEqual({
				wishlistId: WISHLIST.id,
				operations: [
					{ operation: 'createGift', input: { wishlistId: WISHLIST.id, name: 'Kolo' } },
					{
						operation: 'createGift',
						input: { wishlistId: WISHLIST.id, name: 'Helma', price: 900 },
					},
				],
			});
		});

		it('proposes an update, a deletion and a new order of existing gifts', async () => {
			await run(
				['gifts', 'update', 'gift-1', '--wishlist', WISHLIST.shortId, '--input', '-'],
				{ readStandardInput: async () => '{"description":"Recenze: 4,5/5"}' },
			);
			const update = lastSubmission()?.body;
			await run(['gifts', 'delete', 'gift-1', '--wishlist', WISHLIST.shortId]);
			const deletion = lastSubmission()?.body;
			await run(['gifts', 'reorder', 'gift-2', 'gift-1', '--wishlist', WISHLIST.shortId]);
			const reorder = lastSubmission()?.body;

			expect(update).toEqual({
				wishlistId: WISHLIST.id,
				operations: [
					{
						operation: 'updateGift',
						input: { description: 'Recenze: 4,5/5', id: 'gift-1' },
					},
				],
			});
			expect(deletion).toEqual({
				wishlistId: WISHLIST.id,
				operations: [{ operation: 'deleteGift', input: { giftId: 'gift-1' } }],
			});
			expect(reorder).toEqual({
				wishlistId: WISHLIST.id,
				operations: [
					{
						operation: 'reorderGifts',
						input: { wishlistId: WISHLIST.id, orderedGiftIds: ['gift-2', 'gift-1'] },
					},
				],
			});
		});

		it('passes a whole proposal body through `proposals submit`', async () => {
			const body = {
				wishlistShortId: WISHLIST.shortId,
				operations: [
					{ operation: 'createGift', input: { wishlistId: WISHLIST.id, name: 'A' } },
				],
			};

			await run(['proposals', 'submit', '--input', JSON.stringify(body)]);

			expect(lastSubmission()?.body).toEqual(body);
		});

		it('fails with exit code 2 and usage on a wishlist the token does not reach', async () => {
			const result = await run([
				'gifts',
				'create',
				'--wishlist',
				'unknown',
				'--name',
				'Kolo',
			]);

			expect(result.exitCode).toBe(EXIT_CODE.usage);
			expect(JSON.parse(result.stderr.split('\nUsage:')[0] ?? '')).toMatchObject({
				error: { code: 'USAGE' },
			});
			expect(lastSubmission()).toBeUndefined();
		});
	});

	describe('proposals', () => {
		beforeEach(async () => {
			await run(['login']);
		});

		it('shows a proposal with its review link', async () => {
			const result = await run(['proposals', 'show', PROPOSAL_ID]);

			expect(JSON.parse(result.stdout)).toMatchObject({
				proposal: { id: PROPOSAL_ID },
				reviewLink: `${BASE_URL}${REVIEW_PATH}`,
			});
		});

		it('applies through the API and, when the user must review, prints where', async () => {
			const result = await run(['proposals', 'apply', PROPOSAL_ID]);

			expect(server.requests.at(-1)).toMatchObject({
				method: 'POST',
				url: `${BASE_URL}/api/v1/proposals/${PROPOSAL_ID}/apply`,
			});
			expect(result.exitCode).toBe(EXIT_CODE.failure);
			expect(JSON.parse(result.stderr)).toMatchObject({
				status: 409,
				error: { code: 'AGENT_PROPOSAL_REVIEW_REQUIRED' },
				reviewLink: `${BASE_URL}${REVIEW_PATH}`,
			});
		});
	});

	it('uses PREJEMESI_TOKEN and PREJEMESI_URL without a stored login', async () => {
		const result = await run(['whoami'], {
			variables: { PREJEMESI_TOKEN: OTHER_TOKEN, PREJEMESI_URL: 'http://localhost:5191' },
		});

		expect(result.exitCode).toBe(EXIT_CODE.success);
		expect(server.requests[0]).toMatchObject({ url: 'http://localhost:5191/api/v1/me' });
		expect(server.requests[0]?.headers.get('authorization')).toBe(`Bearer ${OTHER_TOKEN}`);
		expect(result.stdout + result.stderr).not.toContain(OTHER_TOKEN);
	});

	it('asks for a login when there is no token', async () => {
		const result = await run(['wishlists']);

		expect(result.exitCode).toBe(EXIT_CODE.failure);
		expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'NOT_LOGGED_IN' } });
		expect(server.requests).toHaveLength(0);
	});

	it('forgets the token on logout', async () => {
		await run(['login']);

		await run(['logout']);
		const after = await run(['wishlists']);

		expect(JSON.parse(after.stderr)).toMatchObject({ error: { code: 'NOT_LOGGED_IN' } });
	});

	it('keeps its config in the platform’s user config directory', () => {
		expect(
			defaultConfigPath(
				{ APPDATA: 'C:\\Users\\jana\\AppData\\Roaming' },
				'win32',
				'C:\\Users\\jana',
			),
		).toBe('C:\\Users\\jana\\AppData\\Roaming\\prejemesi\\config.json');
		expect(defaultConfigPath({}, 'linux', '/home/jana')).toBe(
			'/home/jana/.config/prejemesi/config.json',
		);
		expect(defaultConfigPath({ XDG_CONFIG_HOME: '/xdg' }, 'darwin', '/Users/jana')).toBe(
			'/xdg/prejemesi/config.json',
		);
	});
});
