#!/usr/bin/env node
/**
 * Generates the curated wishlist background library (#531) offline with Gemini image generation:
 * an illustrated and a photo variant per wishlist theme, each with a light and a dark file,
 * saved as `static/wishlist-backgrounds/<id>-<mode>-<width>.webp` and listed with their modes in
 * `src/lib/theme/wishlist_background_library.json`. The app requires both modes of every image, so
 * the run fails while any image lacks one.
 *
 * Usage: GEMINI_API_KEY=... pnpm generate:theme-backgrounds [--model <id>] [--theme <id>] [--force]
 * Image generation needs a paid-tier key; the free tier has no image quota.
 * Existing files are skipped unless --force is given, so an interrupted run resumes. A mode whose
 * other mode exists is generated as an edit of that file, so both modes keep one composition;
 * --force regenerates the light file from scratch and edits it into the dark one.
 *
 * Images made with any other tool: `--prompts` prints both prompts per mode (from scratch, or as
 * an edit of the other mode), and `--from <directory>` imports `<id>-<light|dark>.png|jpg|jpeg|webp`
 * files from that directory instead of calling Gemini.
 */
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {
	BACKGROUND_MODES,
	BACKGROUND_VARIANTS,
	THEME_PROMPTS,
	backgroundCounterpartPrompt,
	backgroundPrompt,
	otherBackgroundMode,
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

/** `sourceImage` is the WebP of the other mode when the request edits it into this mode. */
async function requestImage(model, apiKey, prompt, sourceImage) {
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
					contents: [
						{
							parts: [
								...(sourceImage === undefined
									? []
									: [
											{
												inlineData: {
													mimeType: 'image/webp',
													data: sourceImage.toString('base64'),
												},
											},
										]),
								{ text: prompt },
							],
						},
					],
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

/** The base name of one mode of an image, shared by output files and imported sources. */
function fileStem(id, mode) {
	return `${id}-${mode}`;
}

function imagePath(id, mode, width) {
	return path.join(OUTPUT_DIRECTORY, `${fileStem(id, mode)}-${String(width)}.webp`);
}

/** Not matched by `savedWidths`, so an interrupted save never lists a partial file. */
function temporaryImagePath(id, mode, width) {
	return path.join(OUTPUT_DIRECTORY, `${fileStem(id, mode)}-${String(width)}.tmp.webp`);
}

/** Widths already saved for one mode of an image, ascending. */
async function savedWidths(id, mode) {
	const prefix = `${fileStem(id, mode)}-`;
	const fileNames = await readdir(OUTPUT_DIRECTORY);
	return fileNames
		.filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.webp'))
		.map((fileName) => fileName.slice(prefix.length, -'.webp'.length))
		.filter((width) => /^\d+$/.test(width))
		.map(Number)
		.sort((first, second) => first - second);
}

/** The widest saved file of one mode, the source for editing it into the other mode. */
async function widestSavedImage(id, mode) {
	const widths = await savedWidths(id, mode);
	return widths.length === 0
		? undefined
		: readFile(imagePath(id, mode, widths[widths.length - 1]));
}

/**
 * Encodes every width before replacing any file, and removes stale widths last, so a crash never
 * leaves a mode without files. Widths above the generated resolution are capped to it; upscaling
 * adds bytes, not detail.
 */
async function saveWebpWidths(id, mode, imageBuffer) {
	const previousWidths = await savedWidths(id, mode);
	const { width: sourceWidth } = await sharp(imageBuffer).metadata();
	const widths = [...new Set(OUTPUT_WIDTHS.map((width) => Math.min(width, sourceWidth)))];
	for (const width of widths) {
		await sharp(imageBuffer)
			.resize({ width })
			.webp({ quality: WEBP_QUALITY })
			.toFile(temporaryImagePath(id, mode, width));
	}
	for (const width of widths) {
		await rename(temporaryImagePath(id, mode, width), imagePath(id, mode, width));
	}
	for (const width of previousWidths.filter((width) => !widths.includes(width))) {
		await rm(imagePath(id, mode, width));
	}
}

const IMPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

async function findImportedImage(directory, id, mode) {
	const fileNames = await readdir(directory);
	const fileName = fileNames.find((candidate) => {
		const extension = path.extname(candidate).toLowerCase();
		return (
			IMPORTED_IMAGE_EXTENSIONS.includes(extension) &&
			path.basename(candidate, path.extname(candidate)) === fileStem(id, mode)
		);
	});
	return fileName === undefined ? undefined : path.join(directory, fileName);
}

/**
 * Lists every id with saved files and the widths of each mode it has, in theme then variant order,
 * and returns the ids lacking a mode.
 */
async function writeManifest() {
	const entries = [];
	for (const themeId of Object.keys(THEME_PROMPTS)) {
		for (const variant of BACKGROUND_VARIANTS) {
			const id = `${themeId}-${variant}`;
			const widthsByMode = {};
			for (const mode of BACKGROUND_MODES) {
				const widths = await savedWidths(id, mode);
				if (widths.length > 0) {
					widthsByMode[mode] = widths;
				}
			}
			if (Object.keys(widthsByMode).length > 0) {
				entries.push({ id, themeId, variant, widthsByMode });
			}
		}
	}
	await writeFile(MANIFEST_PATH, `${JSON.stringify(entries, null, '\t')}\n`);
	console.log(`Manifest lists ${String(entries.length)} images.`);
	return entries
		.filter(({ widthsByMode }) => BACKGROUND_MODES.some((mode) => !(mode in widthsByMode)))
		.map(({ id }) => id);
}

async function main() {
	const { values } = parseArgs({
		options: {
			model: { type: 'string', default: DEFAULT_MODEL },
			theme: { type: 'string' },
			force: { type: 'boolean', default: false },
			prompts: { type: 'boolean', default: false },
			from: { type: 'string' },
		},
	});
	if (values.theme !== undefined && !(values.theme in THEME_PROMPTS)) {
		throw new Error(
			`Unknown theme "${values.theme}". Known: ${Object.keys(THEME_PROMPTS).join(', ')}`,
		);
	}
	const themeIds = values.theme === undefined ? Object.keys(THEME_PROMPTS) : [values.theme];
	if (values.prompts) {
		for (const themeId of themeIds) {
			for (const variant of BACKGROUND_VARIANTS) {
				const id = `${themeId}-${variant}`;
				for (const mode of BACKGROUND_MODES) {
					const stem = fileStem(id, mode);
					const sourceStem = fileStem(id, otherBackgroundMode(mode));
					console.log(`${stem}\n${backgroundPrompt(themeId, variant, mode)}\n`);
					console.log(
						`${stem} as an edit of ${sourceStem}\n${backgroundCounterpartPrompt(themeId, variant, mode)}\n`,
					);
				}
			}
		}
		return;
	}
	const apiKey = process.env.GEMINI_API_KEY;
	if (values.from === undefined && !apiKey) {
		throw new Error(
			'Set GEMINI_API_KEY (a paid-tier key; the free tier has no image quota), or import images with --from <directory>.',
		);
	}
	await mkdir(OUTPUT_DIRECTORY, { recursive: true });
	const failures = [];
	for (const themeId of themeIds) {
		for (const variant of BACKGROUND_VARIANTS) {
			const id = `${themeId}-${variant}`;
			for (const mode of BACKGROUND_MODES) {
				const stem = fileStem(id, mode);
				const complete = (await savedWidths(id, mode)).length > 0;
				if (complete && !values.force) {
					console.log(`${stem}: exists, skipped`);
					continue;
				}
				try {
					let imageBuffer;
					if (values.from !== undefined) {
						const importedPath = await findImportedImage(values.from, id, mode);
						if (importedPath === undefined) {
							console.log(`${stem}: no file in ${values.from}, skipped`);
							continue;
						}
						console.log(`${stem}: importing ${importedPath}`);
						imageBuffer = await readFile(importedPath);
					} else {
						// --force regenerates the pair, so its first mode starts from scratch.
						const counterpart =
							values.force && mode === BACKGROUND_MODES[0]
								? undefined
								: await widestSavedImage(id, otherBackgroundMode(mode));
						const editing =
							counterpart === undefined ? '' : ' as an edit of the other mode';
						console.log(`${stem}: generating with ${values.model}${editing}`);
						imageBuffer = await requestImage(
							values.model,
							apiKey,
							counterpart === undefined
								? backgroundPrompt(themeId, variant, mode)
								: backgroundCounterpartPrompt(themeId, variant, mode),
							counterpart,
						);
					}
					await saveWebpWidths(id, mode, imageBuffer);
					console.log(`${stem}: saved`);
				} catch (generationError) {
					failures.push(stem);
					console.error(`${stem}: ${generationError.message}`);
				}
			}
		}
	}
	const imagesMissingAMode = await writeManifest();
	if (failures.length > 0) {
		console.error(`Failed: ${failures.join(', ')}. Re-run to resume.`);
		process.exitCode = 1;
	}
	if (imagesMissingAMode.length > 0) {
		console.error(
			`Missing a light or dark file, which the app requires: ${imagesMissingAMode.join(', ')}.`,
		);
		process.exitCode = 1;
	}
}

main().catch((scriptError) => {
	console.error(scriptError.message);
	process.exitCode = 1;
});
