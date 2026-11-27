/**
 * One-off backfill for issue #742: links the gift copies an owner's family lists already share (a
 * permanent list extracted into an occasion list of the same recipient), which the app never
 * offers to link. Two steps:
 *
 *   propose  Read-only. Pairs the owner's permanent → occasion wishlists of one recipient (or the
 *            given pairs), matches their gifts by name (case, whitespace and diacritics ignored),
 *            flags shared links and writes a JSON plan plus a summary. Repeated names, gifts that
 *            share only a link and copies in two different link groups stay ambiguous; gifts
 *            already linked to each other are left out.
 *   apply    Dry run unless --execute. For each pair with `"confirmed": true`, one transaction
 *            links its matches: the occasion copy's synced values win, received on either copy
 *            makes both received, reservations are reported and never cancelled, and likes,
 *            priority and order stay per copy. Gifts changed since propose are skipped.
 *
 * Review the plan before apply: delete wrong entries from `matches`, add an ambiguous candidate as
 * `{ "occasion": <gift>, "permanent": <gift> }` copied from `ambiguous`, and set `"confirmed": true`
 * on each reviewed pair. Plans hold personal data: write them outside the repository.
 *
 * Usage:
 *   pnpm.cmd exec tsx scripts/link-existing-gift-copies.ts propose --owner <email|user id> --out <plan.json>
 *       [--pair <permanent wishlist id|short id>:<occasion wishlist id|short id>]... [--prod]
 *   pnpm.cmd exec tsx scripts/link-existing-gift-copies.ts apply --plan <plan.json> [--execute [--yes]] [--prod]
 *
 * Local runs use DATABASE_URL from the environment or `.env` and must target a local host; --prod
 * uses the pinned production database from `.env.production`. Executing against production asks
 * for the owner's email unless --yes is passed.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { validateProductionDatabaseUrl } from './migrate-prod.js';
import { formatPlanSummary, parseReviewedPlan } from './lib/linked-copies-plan.js';

const COMMAND = { propose: 'propose', apply: 'apply' } as const;

interface CommandOptions {
	command: (typeof COMMAND)[keyof typeof COMMAND];
	production: boolean;
	owner?: string;
	outPath?: string;
	planPath?: string;
	pairs: { permanent: string; occasion: string }[];
	execute: boolean;
	yes: boolean;
}

function parseCommandOptions(args: readonly string[]): CommandOptions {
	const [command, ...rest] = args;
	if (command !== COMMAND.propose && command !== COMMAND.apply) {
		throw new Error('First argument must be "propose" or "apply"');
	}
	const options: CommandOptions = {
		command,
		production: false,
		pairs: [],
		execute: false,
		yes: false,
	};
	for (let index = 0; index < rest.length; index += 1) {
		const argument = rest[index];
		const nextValue = () => {
			const value = rest[(index += 1)];
			if (value === undefined || value.startsWith('--')) {
				throw new Error(`${argument} needs a value`);
			}
			return value;
		};
		if (argument === '--prod') {
			options.production = true;
		} else if (argument === '--owner') {
			options.owner = nextValue();
		} else if (argument === '--out') {
			options.outPath = nextValue();
		} else if (argument === '--plan') {
			options.planPath = nextValue();
		} else if (argument === '--pair') {
			const [permanent, occasion, ...extra] = nextValue().split(':');
			if (!permanent || !occasion || extra.length > 0) {
				throw new Error('--pair takes <permanent wishlist>:<occasion wishlist>');
			}
			options.pairs.push({ permanent, occasion });
		} else if (argument === '--execute') {
			options.execute = true;
		} else if (argument === '--dry-run') {
			options.execute = false;
		} else if (argument === '--yes') {
			options.yes = true;
		} else if (argument !== '--') {
			throw new Error(`Unknown option: ${argument}`);
		}
	}
	if (
		command === COMMAND.propose &&
		(options.owner === undefined || options.outPath === undefined)
	) {
		throw new Error('propose needs --owner and --out');
	}
	if (command === COMMAND.apply && options.planPath === undefined) {
		throw new Error('apply needs --plan');
	}
	return options;
}

function readEnvFile(path: string): Record<string, string | undefined> {
	return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function isLocalHost(databaseUrl: string): boolean {
	const hostname = new URL(databaseUrl).hostname.toLowerCase();
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function resolveDatabaseUrl(production: boolean): string {
	if (production) {
		const productionUrl = readEnvFile('.env.production').DATABASE_URL;
		if (!productionUrl) {
			throw new Error('DATABASE_URL not found in .env.production');
		}
		return validateProductionDatabaseUrl(productionUrl);
	}
	const localUrl = process.env.DATABASE_URL || readEnvFile('.env').DATABASE_URL;
	if (!localUrl) {
		throw new Error('DATABASE_URL not found in the environment or .env');
	}
	if (!isLocalHost(localUrl)) {
		throw new Error('Without --prod, DATABASE_URL must point at a local database');
	}
	return localUrl;
}

/** Host and database name, never credentials. */
function databaseLabel(databaseUrl: string): string {
	const url = new URL(databaseUrl);
	return `${url.host}${decodeURIComponent(url.pathname)}`;
}

/**
 * The app's server modules import SvelteKit's virtual modules, which exist only inside Vite. The
 * backfill passes its own connection everywhere, so environment reads fall back to the process and
 * request-scoped lookups report that there is no request.
 */
function registerSvelteKitModuleShims(): void {
	const shimSources: Record<string, string> = {
		'$env/dynamic/private': 'export const env = process.env;',
		'$env/dynamic/public': 'export const env = process.env;',
		'$app/server':
			'export function getRequestEvent() { throw new Error("No request outside SvelteKit"); }',
	};
	registerHooks({
		resolve(specifier, context, nextResolve) {
			const shimSource = shimSources[specifier];
			if (shimSource === undefined) {
				return nextResolve(specifier, context);
			}
			return {
				url: `data:text/javascript,${encodeURIComponent(shimSource)}`,
				shortCircuit: true,
			};
		},
	});
}

async function confirmProductionExecution(ownerEmail: string): Promise<boolean> {
	if (!process.stdin.isTTY) {
		console.error('Not executed: confirm interactively or pass --yes.');
		return false;
	}
	const prompt = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await prompt.question(
			`Type ${ownerEmail} to link these copies in production: `,
		);
		return answer.trim().toLowerCase() === ownerEmail.toLowerCase();
	} finally {
		prompt.close();
	}
}

async function main(): Promise<number> {
	const options = parseCommandOptions(process.argv.slice(2));
	const databaseUrl = resolveDatabaseUrl(options.production);
	const label = databaseLabel(databaseUrl);
	registerSvelteKitModuleShims();
	const backfill = await import('./lib/linked-copies-backfill.js');
	const client = postgres(databaseUrl, { max: 1, fetch_types: false });
	const database = drizzle(client);
	console.log(`Database: ${label} (${options.production ? 'production' : 'local'})`);
	try {
		if (options.command === COMMAND.propose) {
			const owner = await backfill.findOwner(database, options.owner ?? '');
			if (owner === undefined) {
				console.error(`No user ${options.owner}`);
				return 1;
			}
			const plan = await backfill.proposeLinkedCopiesPlan(database, {
				owner,
				pairs: options.pairs,
				databaseLabel: label,
			});
			writeFileSync(options.outPath ?? '', `${JSON.stringify(plan, null, '\t')}\n`);
			console.log(formatPlanSummary(plan));
			console.log(
				`\nPlan written to ${options.outPath}. Review it and confirm pairs before apply.`,
			);
			return 0;
		}
		const plan = parseReviewedPlan(JSON.parse(readFileSync(options.planPath ?? '', 'utf8')));
		if (plan.database !== label) {
			console.error(`The plan was proposed against ${plan.database}, not ${label}.`);
			return 1;
		}
		if (
			options.execute &&
			options.production &&
			!options.yes &&
			!(await confirmProductionExecution(plan.owner.email))
		) {
			return 1;
		}
		const report = await backfill.applyLinkedCopiesPlan(database, plan, {
			execute: options.execute,
		});
		console.log(backfill.formatApplyReport(report));
		return report.pairs.some((pair) => pair.outcome === backfill.PAIR_OUTCOME.failed) ? 1 : 0;
	} finally {
		await client.end();
	}
}

main().then(
	(exitCode) => {
		process.exitCode = exitCode;
	},
	(thrown: unknown) => {
		console.error(thrown instanceof Error ? thrown.message : thrown);
		process.exitCode = 1;
	},
);
