import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ApiError, createApiClient, type ApiClient, type FetchFunction } from './api_client.js';
import {
	DEFAULT_BASE_URL,
	readConfig,
	removeConfig,
	writeConfig,
	type CliConfig,
} from './config.js';

export const EXIT_CODE = { success: 0, failure: 1, usage: 2 } as const;

type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

/** Everything the CLI touches outside itself, so tests can run it in memory. */
export interface CliEnvironment {
	fetch: FetchFunction;
	configPath: string;
	variables: Readonly<Record<string, string | undefined>>;
	/** Reads a secret without echoing it: hidden terminal input, or standard input when piped. */
	readSecret(prompt: string): Promise<string>;
	readStandardInput(): Promise<string>;
	writeOutput(text: string): void;
	writeError(text: string): void;
}

const USAGE = `Usage: prejemesi <command> [options]

Commands:
  login                                   Store an access token, read from standard input
  logout                                  Forget the stored token
  whoami                                  The token user and the token's scopes
  wishlists                               Wishlists the token reaches
  read <operation> [--input <json>]       Any agent read, such as readGiftCategories
  gifts list --wishlist <shortId>
  gifts create --wishlist <shortId> (--name <name> | --input <json>)
  gifts update <giftId> --wishlist <shortId> --input <json>
  gifts delete <giftId> --wishlist <shortId>
  gifts reorder <giftId>... --wishlist <shortId>
  images add --wishlist <shortId> --url <url>
                                          Stores an image for a gift; prints its reference
  proposals submit --input <json>         A proposal body as POST /api/v1/proposals takes it
  proposals show <proposalId>
  proposals apply <proposalId>            Fast-forward tokens only; otherwise prints the reviewLink

Options:
  --input <json|@file|->                  JSON, a file to read it from, or standard input
  --idempotency-key <key>                 Makes a retried change safe
  --base-url <url>                        Server; default the stored login's or ${DEFAULT_BASE_URL}
  --help

Changes become proposals the user reviews at the printed reviewLink, unless the token has
fast-forward. \`gifts create\` takes an array as --input to propose several gifts at once.
A gift takes a stored image as \`"imageReference": "<reference>"\` in its --input.
Output is JSON. PREJEMESI_TOKEN and PREJEMESI_URL override the stored login.
API reference: ${DEFAULT_BASE_URL}/api/v1/openapi.json`;

const TOKEN_PATTERN = /^pjs_[A-Za-z0-9_-]+$/;

class UsageError extends Error {}

interface ParsedCommand {
	positionals: string[];
	options: {
		wishlist?: string;
		name?: string;
		url?: string;
		input?: string;
		'idempotency-key'?: string;
		'base-url'?: string;
		help?: boolean;
	};
}

interface CommandContext {
	command: ParsedCommand;
	environment: CliEnvironment;
	config: CliConfig | null;
	/** `--base-url`, else `PREJEMESI_URL`, else the stored login's, else the public server. */
	baseUrl: string;
}

interface ConnectedContext extends CommandContext {
	request: ApiClient;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCommand(argumentList: readonly string[]): ParsedCommand {
	try {
		const { values, positionals } = parseArgs({
			args: [...argumentList],
			allowPositionals: true,
			strict: true,
			options: {
				wishlist: { type: 'string' },
				name: { type: 'string' },
				url: { type: 'string' },
				input: { type: 'string' },
				'idempotency-key': { type: 'string' },
				'base-url': { type: 'string' },
				help: { type: 'boolean', short: 'h' },
			},
		});
		return { positionals, options: values };
	} catch (thrown) {
		throw new UsageError(thrown instanceof Error ? thrown.message : String(thrown));
	}
}

function printJson(write: (text: string) => void, value: unknown): void {
	write(`${JSON.stringify(value, null, 2)}\n`);
}

function normalizedBaseUrl(candidate: string): string {
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		throw new UsageError(`Not a URL: ${candidate}`);
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new UsageError(`Not an HTTP URL: ${candidate}`);
	}
	return url.origin;
}

/** The review page as an absolute link, beside the API's path, wherever a body names one. */
function withReviewLink(body: unknown, baseUrl: string): unknown {
	if (!isJsonObject(body)) {
		return body;
	}
	const holder = isJsonObject(body.proposal) ? body.proposal : body.error;
	const reviewUrl = isJsonObject(holder) ? holder.reviewUrl : undefined;
	return typeof reviewUrl === 'string'
		? { ...body, reviewLink: new URL(reviewUrl, baseUrl).href }
		: body;
}

async function readInput(context: CommandContext): Promise<unknown> {
	const source = context.command.options.input;
	if (source === undefined) {
		return undefined;
	}
	let text = source;
	if (source === '-') {
		text = await context.environment.readStandardInput();
	} else if (source.startsWith('@')) {
		text = await readFile(source.slice(1), 'utf8');
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new UsageError('--input is not valid JSON');
	}
}

async function readObjectInput(context: CommandContext): Promise<JsonObject> {
	const input = await readInput(context);
	if (input === undefined) {
		return {};
	}
	if (!isJsonObject(input)) {
		throw new UsageError('--input must be a JSON object');
	}
	return input;
}

function requiredOption(context: CommandContext, name: 'wishlist' | 'url'): string {
	const value = context.command.options[name];
	if (value === undefined || value === '') {
		throw new UsageError(`--${name} is required`);
	}
	return value;
}

function positionalAt(context: CommandContext, index: number, label: string): string {
	const value = context.command.positionals[index];
	if (value === undefined || value === '') {
		throw new UsageError(`${label} is required`);
	}
	return value;
}

interface WishlistAddress {
	id: string;
	shortId: string;
}

function wishlistAddressesOf(body: unknown): WishlistAddress[] {
	if (!isJsonObject(body) || !Array.isArray(body.wishlists)) {
		return [];
	}
	return body.wishlists.filter(
		(entry): entry is WishlistAddress =>
			isJsonObject(entry) &&
			typeof entry.id === 'string' &&
			typeof entry.shortId === 'string',
	);
}

/** Gift operations take the wishlist id; people know the short id from the wishlist's link. */
async function resolveWishlist(context: ConnectedContext) {
	const wanted = requiredOption(context, 'wishlist');
	const wishlists = wishlistAddressesOf(
		await context.request({ method: 'GET', path: '/wishlists' }),
	);
	const found = wishlists.find((entry) => entry.shortId === wanted || entry.id === wanted);
	if (found === undefined) {
		throw new UsageError(`The token reaches no wishlist ${wanted}`);
	}
	return found;
}

async function submitRows(
	context: ConnectedContext,
	wishlistId: string,
	operations: { operation: string; input: unknown }[],
) {
	return context.request({
		method: 'POST',
		path: '/proposals',
		body: { wishlistId, operations },
		idempotencyKey: context.command.options['idempotency-key'],
	});
}

async function createGifts(context: ConnectedContext) {
	const wishlist = await resolveWishlist(context);
	const input = await readInput(context);
	const name = context.command.options.name;
	let gifts: unknown[];
	if (input === undefined) {
		if (name === undefined) {
			throw new UsageError('gifts create needs --name or --input');
		}
		gifts = [{ name }];
	} else {
		gifts = Array.isArray(input) ? input : [input];
	}
	if (gifts.length === 0 || !gifts.every(isJsonObject)) {
		throw new UsageError('--input must be a gift object or a non-empty array of them');
	}
	return submitRows(
		context,
		wishlist.id,
		gifts.map((gift) => ({
			operation: 'createGift',
			input: { wishlistId: wishlist.id, ...(name === undefined ? {} : { name }), ...gift },
		})),
	);
}

const GIFT_COMMANDS = {
	list: async (context) =>
		context.request({
			method: 'POST',
			path: '/operations/readWishlistGifts',
			body: { wishlistShortId: (await resolveWishlist(context)).shortId },
		}),
	create: createGifts,
	update: async (context) => {
		const giftId = positionalAt(context, 2, 'The gift id');
		const wishlist = await resolveWishlist(context);
		const input = await readObjectInput(context);
		return submitRows(context, wishlist.id, [
			{ operation: 'updateGift', input: { ...input, id: giftId } },
		]);
	},
	delete: async (context) => {
		const giftId = positionalAt(context, 2, 'The gift id');
		const wishlist = await resolveWishlist(context);
		return submitRows(context, wishlist.id, [{ operation: 'deleteGift', input: { giftId } }]);
	},
	reorder: async (context) => {
		const orderedGiftIds = context.command.positionals.slice(2);
		if (orderedGiftIds.length === 0) {
			throw new UsageError('gifts reorder needs the gift ids in their new order');
		}
		const wishlist = await resolveWishlist(context);
		return submitRows(context, wishlist.id, [
			{ operation: 'reorderGifts', input: { wishlistId: wishlist.id, orderedGiftIds } },
		]);
	},
} satisfies Record<string, (context: ConnectedContext) => Promise<unknown>>;

const IMAGE_COMMANDS = {
	add: async (context) => {
		const url = requiredOption(context, 'url');
		const wishlist = await resolveWishlist(context);
		return context.request({
			method: 'POST',
			path: '/images',
			body: { wishlistId: wishlist.id, url },
			idempotencyKey: context.command.options['idempotency-key'],
		});
	},
} satisfies Record<string, (context: ConnectedContext) => Promise<unknown>>;

const PROPOSAL_COMMANDS = {
	submit: async (context) => {
		const body = await readInput(context);
		if (!isJsonObject(body)) {
			throw new UsageError('proposals submit needs the proposal as --input');
		}
		return context.request({
			method: 'POST',
			path: '/proposals',
			body,
			idempotencyKey: context.command.options['idempotency-key'],
		});
	},
	show: async (context) =>
		context.request({
			method: 'GET',
			path: `/proposals/${encodeURIComponent(positionalAt(context, 2, 'The proposal id'))}`,
		}),
	apply: async (context) =>
		context.request({
			method: 'POST',
			path: `/proposals/${encodeURIComponent(positionalAt(context, 2, 'The proposal id'))}/apply`,
		}),
} satisfies Record<string, (context: ConnectedContext) => Promise<unknown>>;

function hasCommand<TCommands extends object>(
	commands: TCommands,
	name: string | undefined,
): name is Extract<keyof TCommands, string> {
	return name !== undefined && Object.hasOwn(commands, name);
}

function subcommandOf<TCommands extends Record<string, unknown>>(
	commands: TCommands,
	group: string,
	name: string | undefined,
): TCommands[keyof TCommands] {
	if (!hasCommand(commands, name)) {
		throw new UsageError(`${group} takes one of: ${Object.keys(commands).join(', ')}`);
	}
	return commands[name];
}

const CONNECTED_COMMANDS = {
	whoami: (context) => context.request({ method: 'GET', path: '/me' }),
	wishlists: (context) => context.request({ method: 'GET', path: '/wishlists' }),
	read: async (context) =>
		context.request({
			method: 'POST',
			path: `/operations/${encodeURIComponent(positionalAt(context, 1, 'The operation name'))}`,
			body: await readObjectInput(context),
		}),
	gifts: (context) =>
		subcommandOf(GIFT_COMMANDS, 'gifts', context.command.positionals[1])(context),
	images: (context) =>
		subcommandOf(IMAGE_COMMANDS, 'images', context.command.positionals[1])(context),
	proposals: (context) =>
		subcommandOf(PROPOSAL_COMMANDS, 'proposals', context.command.positionals[1])(context),
} satisfies Record<string, (context: ConnectedContext) => Promise<unknown>>;

async function connect(context: CommandContext): Promise<ConnectedContext> {
	const token = context.environment.variables.PREJEMESI_TOKEN ?? context.config?.token;
	if (token === undefined || token === '') {
		throw new ApiError(0, {
			error: { code: 'NOT_LOGGED_IN', message: 'Run `prejemesi login` first.' },
		});
	}
	return {
		...context,
		request: createApiClient({
			baseUrl: context.baseUrl,
			token,
			fetch: context.environment.fetch,
		}),
	};
}

/** Checks the token against the server before storing it; prints what the server says about it. */
async function login(context: CommandContext) {
	const { environment, baseUrl } = context;
	const token = (await environment.readSecret('Access token: ')).trim();
	if (!TOKEN_PATTERN.test(token)) {
		throw new UsageError('That is not a Přejeme si access token (pjs_…).');
	}
	const request = createApiClient({ baseUrl, token, fetch: environment.fetch });
	const me = await request({ method: 'GET', path: '/me' });
	await writeConfig(environment.configPath, { baseUrl, token });
	return {
		loggedIn: true,
		baseUrl,
		configPath: environment.configPath,
		...(isJsonObject(me) ? me : {}),
	};
}

async function logout(context: CommandContext) {
	await removeConfig(context.environment.configPath);
	return { loggedOut: true, configPath: context.environment.configPath };
}

async function runCommand(context: CommandContext): Promise<unknown> {
	const [commandName] = context.command.positionals;
	if (commandName === 'login') {
		return login(context);
	}
	if (commandName === 'logout') {
		return logout(context);
	}
	if (!hasCommand(CONNECTED_COMMANDS, commandName)) {
		throw new UsageError(
			commandName === undefined ? 'No command given' : `Unknown command ${commandName}`,
		);
	}
	return CONNECTED_COMMANDS[commandName](await connect(context));
}

function failureBody(thrown: ApiError, baseUrl: string): JsonObject {
	const body = withReviewLink(thrown.body, baseUrl);
	const details = isJsonObject(body) ? body : { body };
	// Status 0 marks a failure before any HTTP answer, such as a network error or no login.
	return thrown.status === 0 ? details : { status: thrown.status, ...details };
}

/** Runs one command, printing JSON: the result on standard output, a failure on standard error. */
export async function runCli(
	argumentList: readonly string[],
	environment: CliEnvironment,
): Promise<ExitCode> {
	let baseUrl = DEFAULT_BASE_URL;
	try {
		const command = parseCommand(argumentList);
		if (command.options.help === true || command.positionals[0] === 'help') {
			environment.writeOutput(`${USAGE}\n`);
			return EXIT_CODE.success;
		}
		const config = await readConfig(environment.configPath);
		baseUrl = normalizedBaseUrl(
			command.options['base-url'] ??
				environment.variables.PREJEMESI_URL ??
				config?.baseUrl ??
				DEFAULT_BASE_URL,
		);
		const body = await runCommand({ command, environment, config, baseUrl });
		printJson(environment.writeOutput, withReviewLink(body, baseUrl));
		return EXIT_CODE.success;
	} catch (thrown) {
		if (thrown instanceof UsageError) {
			printJson(environment.writeError, {
				error: { code: 'USAGE', message: thrown.message },
			});
			environment.writeError(`${USAGE}\n`);
			return EXIT_CODE.usage;
		}
		if (thrown instanceof ApiError) {
			printJson(environment.writeError, failureBody(thrown, baseUrl));
			return EXIT_CODE.failure;
		}
		throw thrown;
	}
}
