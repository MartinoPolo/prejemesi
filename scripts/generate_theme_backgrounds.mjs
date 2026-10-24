#!/usr/bin/env node
/**
 * Generates the curated wishlist background library (#531) offline with Gemini image generation:
 * an illustrated and a photo variant per wishlist theme, saved as WebP widths under
 * `static/wishlist-backgrounds/` and listed in `src/lib/theme/wishlist_background_library.json`.
 *
 * Usage: GEMINI_API_KEY=... pnpm generate:theme-backgrounds [--model <id>] [--theme <id>] [--force]
 * Image generation needs a paid-tier key; the free tier has no image quota.
 * Existing images are skipped unless --force is given, so an interrupted run resumes.
 */
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {
	BACKGROUND_VARIANTS,
	THEME_PROMPTS,
	backgroundPrompt,
} from './theme_background_prompts.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, 'static', 'wishlist-backgrounds');
const MANIFEST_PATH = path.join(
	REPOSITORY_ROOT,
	'src',
	'lib',
	'theme',
	'wishlist_background_library.json',
);
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const OUTPUT_WIDTHS = [640, 1280, 2560];
const WEBP_QUALITY = 78;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5_000;
/** A longer suggested delay means a daily quota, not a burst limit, so waiting is pointless. */
const MAX_RETRY_DELAY_MS = 120_000;
const LOGGED_RESPONSE_LENGTH = 500;

function sleep(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** The server-suggested delay from a `google.rpc.RetryInfo` detail such as `"17s"`. */
function retryDelayFromError(errorBody) {
	const details = errorBody?.error?.details ?? [];
	for (const detail of details) {
		const seconds = Number.parseFloat(String(detail?.retryDelay ?? ''));
		if (Number.isFinite(seconds)) {
			return seconds * 1000;
		}
	}
	return null;
}

async function requestImage(model, apiKey, prompt) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		let response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						responseModalities: ['IMAGE'],
						imageConfig: { aspectRatio: '16:9' },
					},
				}),
				signal: controller.signal,
			});
		} catch (requestError) {
			if (attempt === MAX_ATTEMPTS) {
				throw requestError;
			}
			console.warn(`  request failed (${requestError.message}), retrying`);
			await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
			continue;
		} finally {
			clearTimeout(timeout);
		}
		const responseBody = await response.json().catch(() => null);
		if (response.ok) {
			const parts = responseBody?.candidates?.[0]?.content?.parts ?? [];
			const imagePart = parts.find((part) => part?.inlineData?.data);
			if (imagePart === undefined) {
				const loggedBody = JSON.stringify(responseBody).slice(0, LOGGED_RESPONSE_LENGTH);
				throw new Error(`No image in the response: ${loggedBody}`);
			}
			return Buffer.from(imagePart.inlineData.data, 'base64');
		}
		const retryable = response.status === 429 || response.status >= 500;
		if (!retryable || attempt === MAX_ATTEMPTS) {
			throw new Error(
				`Gemini request failed with ${String(response.status)}: ${JSON.stringify(responseBody)}`,
			);
		}
		const delay = retryDelayFromError(responseBody) ?? BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
		if (delay > MAX_RETRY_DELAY_MS) {
			throw new Error(
				`Quota exhausted; Gemini suggests retrying in ${String(Math.ceil(delay / 60_000))} min.`,
			);
		}
		console.warn(
			`  ${String(response.status)}, retrying in ${String(Math.round(delay / 1000))} s`,
		);
		await sleep(delay);
	}
	throw new Error('Unreachable: every attempt either returned or threw.');
}

function imagePath(id, width) {
	return path.join(OUTPUT_DIRECTORY, `${id}-${String(width)}.webp`);
}

/** Not matched by `savedWidths`, so an interrupted save never lists a partial file. */
function temporaryImagePath(id, width) {
	return path.join(OUTPUT_DIRECTORY, `${id}-${String(width)}.tmp.webp`);
}

/** Widths already saved for an id, ascending. */
async function savedWidths(id) {
	const prefix = `${id}-`;
	const fileNames = await readdir(OUTPUT_DIRECTORY);
	return fileNames
		.filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.webp'))
		.map((fileName) => fileName.slice(prefix.length, -'.webp'.length))
		.filter((width) => /^\d+$/.test(width))
		.map(Number)
		.sort((first, second) => first - second);
}

/**
 * Encodes every width before replacing any file, and removes stale widths last, so a crash never
 * leaves an id without files. Widths above the generated resolution are capped to it; upscaling
 * adds bytes, not detail.
 */
async function saveWebpWidths(id, imageBuffer) {
	const previousWidths = await savedWidths(id);
	const { width: sourceWidth } = await sharp(imageBuffer).metadata();
	const widths = [...new Set(OUTPUT_WIDTHS.map((width) => Math.min(width, sourceWidth)))];
	for (const width of widths) {
		await sharp(imageBuffer)
			.resize({ width })
			.webp({ quality: WEBP_QUALITY })
			.toFile(temporaryImagePath(id, width));
	}
	for (const width of widths) {
		await rename(temporaryImagePath(id, width), imagePath(id, width));
	}
	for (const width of previousWidths.filter((width) => !widths.includes(width))) {
		await rm(imagePath(id, width));
	}
}

/** Lists every id with saved files, in theme then variant order. */
async function writeManifest() {
	const entries = [];
	for (const themeId of Object.keys(THEME_PROMPTS)) {
		for (const variant of BACKGROUND_VARIANTS) {
			const id = `${themeId}-${variant}`;
			const widths = await savedWidths(id);
			if (widths.length > 0) {
				entries.push({ id, themeId, variant, widths });
			}
		}
	}
	await writeFile(MANIFEST_PATH, `${JSON.stringify(entries, null, '\t')}\n`);
	console.log(`Manifest lists ${String(entries.length)} images.`);
}

async function main() {
	const { values } = parseArgs({
		options: {
			model: { type: 'string', default: DEFAULT_MODEL },
			theme: { type: 'string' },
			force: { type: 'boolean', default: false },
		},
	});
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('Set GEMINI_API_KEY (a paid-tier key; the free tier has no image quota).');
	}
	if (values.theme !== undefined && !(values.theme in THEME_PROMPTS)) {
		throw new Error(
			`Unknown theme "${values.theme}". Known: ${Object.keys(THEME_PROMPTS).join(', ')}`,
		);
	}
	const themeIds = values.theme === undefined ? Object.keys(THEME_PROMPTS) : [values.theme];
	await mkdir(OUTPUT_DIRECTORY, { recursive: true });
	const failures = [];
	for (const themeId of themeIds) {
		for (const variant of BACKGROUND_VARIANTS) {
			const id = `${themeId}-${variant}`;
			const complete = (await savedWidths(id)).length > 0;
			if (complete && !values.force) {
				console.log(`${id}: exists, skipped`);
				continue;
			}
			console.log(`${id}: generating with ${values.model}`);
			try {
				const imageBuffer = await requestImage(
					values.model,
					apiKey,
					backgroundPrompt(themeId, variant),
				);
				await saveWebpWidths(id, imageBuffer);
				console.log(`${id}: saved`);
			} catch (generationError) {
				failures.push(id);
				console.error(`${id}: ${generationError.message}`);
			}
		}
	}
	await writeManifest();
	if (failures.length > 0) {
		console.error(`Failed: ${failures.join(', ')}. Re-run to resume.`);
		process.exitCode = 1;
	}
}

main().catch((scriptError) => {
	console.error(scriptError.message);
	process.exitCode = 1;
});
