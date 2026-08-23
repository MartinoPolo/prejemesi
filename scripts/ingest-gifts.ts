import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
	parseGiftIngestionManifest,
	type GiftIngestionManifest,
} from '../src/lib/modules/ingestion/manifest.js';
import {
	downloadValidatedImage,
	type DownloadedImage,
} from '../src/lib/modules/ingestion/image_mirroring.js';

export interface CliDependencies {
	readFile(path: string): Promise<string>;
	fetch: typeof fetch;
	stdout(message: string): void;
	stderr(message: string): void;
	resolve?: (hostname: string) => Promise<string[]>;
	/** Test/system boundary only. Production image downloads use the DNS-pinned requester. */
	imageFetch?: typeof fetch;
}

interface CliArguments {
	manifestPath: string;
	baseUrl: string;
	baseUrlWasExplicit: boolean;
	envFile: string;
	apply: boolean;
}

type CliStage = 'dry-run' | 'image-download' | 'image-preparation' | 'image-upload' | 'apply';

class CliFailure extends Error {
	constructor(
		readonly stage: CliStage,
		message: string,
		readonly itemId?: string,
	) {
		super(message);
		this.name = 'CliFailure';
	}
}

const defaultDependencies: CliDependencies = {
	readFile: (path) => readFile(path, 'utf8'),
	fetch,
	stdout: (message) => console.log(message),
	stderr: (message) => console.error(message),
};

function parseEnvironment(source: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of source.split(/\r?\n/)) {
		const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
		if (match !== null) {
			values[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2');
		}
	}
	return values;
}

function normalizeProductionOrigin(input: string): string | null {
	try {
		const url = new URL(input);
		const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		const isLocal =
			hostname === 'localhost' ||
			hostname.endsWith('.localhost') ||
			hostname === '::1' ||
			/^127(?:\.\d{1,3}){3}$/.test(hostname) ||
			hostname === '0.0.0.0';
		if (
			url.protocol !== 'https:' ||
			isLocal ||
			url.username !== '' ||
			url.password !== '' ||
			url.pathname !== '/' ||
			url.search !== '' ||
			url.hash !== ''
		) {
			return null;
		}
		return url.origin;
	} catch {
		return null;
	}
}

export function parseGiftIngestionCliArguments(args: readonly string[]): CliArguments {
	const parsed: CliArguments = {
		manifestPath: '',
		baseUrl: '',
		baseUrlWasExplicit: false,
		envFile: '.env.gift-ingestion.local',
		apply: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === '--apply') {
			parsed.apply = true;
			continue;
		}
		const value = args[index + 1];
		if (value === undefined) {
			throw new Error(`Missing value for ${argument}`);
		}
		if (argument === '--manifest') {
			parsed.manifestPath = value;
		} else if (argument === '--base-url') {
			parsed.baseUrl = value;
			parsed.baseUrlWasExplicit = true;
		} else if (argument === '--env-file') {
			parsed.envFile = value;
		} else {
			throw new Error(`Unknown option ${argument}`);
		}
		index += 1;
	}
	if (parsed.manifestPath === '') {
		throw new Error('--manifest is required');
	}
	if (parsed.apply && !parsed.baseUrlWasExplicit) {
		throw new Error('--apply requires an explicit non-local HTTPS --base-url');
	}
	if (parsed.baseUrlWasExplicit && normalizeProductionOrigin(parsed.baseUrl) === null) {
		throw new Error('--base-url must be an exact non-local HTTPS origin');
	}
	return parsed;
}

async function loadCliInputs(arguments_: CliArguments, dependencies: CliDependencies) {
	const environment = parseEnvironment(await dependencies.readFile(arguments_.envFile));
	const configuredOrigin = normalizeProductionOrigin(environment.GIFT_INGESTION_BASE_URL ?? '');
	if (configuredOrigin === null) {
		throw new Error('GIFT_INGESTION_BASE_URL must be an exact non-local HTTPS origin');
	}
	const explicitOrigin = arguments_.baseUrlWasExplicit
		? normalizeProductionOrigin(arguments_.baseUrl)
		: null;
	if (arguments_.baseUrlWasExplicit && explicitOrigin !== configuredOrigin) {
		throw new Error('--base-url does not match GIFT_INGESTION_BASE_URL');
	}
	const token = environment.GIFT_INGESTION_TOKEN ?? '';
	if (token === '') {
		throw new Error('GIFT_INGESTION_TOKEN is missing from the local env file');
	}
	return {
		manifest: parseGiftIngestionManifest(await dependencies.readFile(arguments_.manifestPath)),
		endpoint: new URL('/api/internal/v1/gift-ingestion', configuredOrigin).toString(),
		token,
	};
}

function createIngestionTransport(endpoint: string, token: string, dependencies: CliDependencies) {
	return async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
		const response = await dependencies.fetch(endpoint, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
		const payload = (await response.json()) as Record<string, unknown>;
		if (!response.ok) {
			dependencies.stdout(JSON.stringify(payload));
			throw new Error(
				typeof payload.error === 'string'
					? payload.error
					: `Ingestion API failed (${response.status})`,
			);
		}
		return payload;
	};
}

type CallApi = ReturnType<typeof createIngestionTransport>;

function withoutUploadUrls(prepared: readonly Record<string, unknown>[]) {
	return prepared.map((capability) => {
		const reference = { ...capability };
		delete reference.uploadUrl;
		return reference;
	});
}

async function bestEffortCleanup(
	callApi: CallApi,
	manifest: GiftIngestionManifest,
	references: readonly Record<string, unknown>[],
): Promise<void> {
	if (references.length === 0) {
		return;
	}
	try {
		await callApi({ action: 'cleanup-images', manifest, preparedImages: references });
	} catch {
		/* server records cleanup failures */
	}
}

async function executeImageWorkflow(
	manifest: GiftIngestionManifest,
	dryRun: Record<string, unknown>,
	callApi: CallApi,
	dependencies: CliDependencies,
): Promise<Record<string, unknown>[]> {
	const creatableIds = new Set(
		Array.isArray(dryRun.wouldCreate)
			? dryRun.wouldCreate.map((entry) => (entry as { itemId: string }).itemId)
			: [],
	);
	const selected = manifest.items.filter(
		(item) => creatableIds.has(item.itemId) && item.gift.imageUrl != null,
	);
	const downloaded: { itemId: string; image: DownloadedImage }[] = [];
	for (const item of selected) {
		try {
			downloaded.push({
				itemId: item.itemId,
				image: await downloadValidatedImage(item.gift.imageUrl!, {
					fetch: dependencies.imageFetch,
					resolve: dependencies.resolve,
				}),
			});
		} catch (caught) {
			throw new CliFailure(
				'image-download',
				caught instanceof Error ? caught.message : 'failed',
				item.itemId,
			);
		}
	}
	if (downloaded.length === 0) {
		return [];
	}

	let preparation: Record<string, unknown>;
	try {
		preparation = await callApi({
			action: 'prepare-images',
			manifest,
			images: downloaded.map(({ itemId, image }) => ({
				itemId,
				sha256: image.sha256,
				contentType: image.contentType,
				byteLength: image.byteLength,
				width: image.width,
				height: image.height,
			})),
		});
	} catch (caught) {
		throw new CliFailure(
			'image-preparation',
			caught instanceof Error ? caught.message : 'Image preparation failed',
		);
	}
	const prepared = Array.isArray(preparation.prepared)
		? (preparation.prepared as Record<string, unknown>[])
		: [];
	if (prepared.length !== downloaded.length) {
		throw new CliFailure('image-preparation', 'server returned incomplete capabilities');
	}
	const references = withoutUploadUrls(prepared);
	try {
		for (const capability of prepared) {
			const local = downloaded.find(({ itemId }) => itemId === capability.itemId);
			if (local === undefined || typeof capability.uploadUrl !== 'string') {
				throw new CliFailure('image-preparation', 'invalid server capability');
			}
			let upload: Response;
			try {
				upload = await dependencies.fetch(capability.uploadUrl, {
					method: 'PUT',
					headers: {
						'Content-Type': local.image.contentType,
						'Content-Length': String(local.image.byteLength),
					},
					body: local.image.bytes as unknown as BodyInit,
				});
			} catch (caught) {
				if (caught instanceof CliFailure) {
					throw caught;
				}
				throw new CliFailure(
					'image-upload',
					caught instanceof Error ? caught.message : 'Image upload failed',
					local.itemId,
				);
			}
			if (!upload.ok) {
				throw new CliFailure('image-upload', `HTTP ${upload.status}`, local.itemId);
			}
		}
	} catch (caught) {
		await bestEffortCleanup(callApi, manifest, references);
		throw caught;
	}
	dependencies.stdout(
		JSON.stringify({
			stage: 'image-upload',
			uploaded: prepared.map(({ itemId, key }) => ({ itemId, key })),
		}),
	);
	return references;
}

function reportFailure(error: unknown, apply: boolean, dependencies: CliDependencies): void {
	const failure =
		error instanceof CliFailure
			? error
			: new CliFailure(
					apply ? 'apply' : 'dry-run',
					error instanceof Error ? error.message : 'Gift ingestion failed',
				);
	dependencies.stderr(
		JSON.stringify({
			stage: failure.stage,
			...(failure.itemId === undefined ? {} : { itemId: failure.itemId }),
			error: failure.message,
		}),
	);
}

export async function runGiftIngestionCli(
	args: readonly string[],
	dependencies: CliDependencies = defaultDependencies,
): Promise<number> {
	let arguments_: CliArguments;
	try {
		arguments_ = parseGiftIngestionCliArguments(args);
	} catch (caught) {
		dependencies.stderr(
			JSON.stringify({
				error: caught instanceof Error ? caught.message : 'Invalid arguments',
			}),
		);
		return 2;
	}

	try {
		const { manifest, endpoint, token } = await loadCliInputs(arguments_, dependencies);
		const callApi = createIngestionTransport(endpoint, token, dependencies);
		const dryRun = await callApi({ manifest, apply: false });
		dependencies.stdout(JSON.stringify(dryRun));
		if (Array.isArray(dryRun.ambiguities) && dryRun.ambiguities.length > 0) {
			return 1;
		}
		if (Array.isArray(dryRun.conflicts) && dryRun.conflicts.length > 0) {
			return 1;
		}
		if (!arguments_.apply) {
			return 0;
		}

		const references = await executeImageWorkflow(manifest, dryRun, callApi, dependencies);
		let result: Record<string, unknown>;
		try {
			result = await callApi({ manifest, apply: true, preparedImages: references });
		} catch (caught) {
			await bestEffortCleanup(callApi, manifest, references);
			throw caught;
		}
		dependencies.stdout(JSON.stringify({ stage: 'apply', ...result }));
		return Array.isArray(result.conflicts) && result.conflicts.length > 0 ? 1 : 0;
	} catch (caught) {
		reportFailure(caught, arguments_.apply, dependencies);
		return 1;
	}
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
	process.exitCode = await runGiftIngestionCli(process.argv.slice(2));
}
