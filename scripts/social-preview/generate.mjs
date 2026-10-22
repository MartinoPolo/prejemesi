#!/usr/bin/env node
/**
 * Renders the branded fallback Open Graph / Twitter image (1200×630) from
 * `social-preview.html` with the default palette's primitives read from `src/app.css`,
 * the self-hosted brand fonts and the Czech landing copy, so the preview follows the
 * current brand instead of drifting as a hand-made asset.
 *
 * Usage: node scripts/social-preview/generate.mjs
 * Rerun after a brand, palette, font or landing-copy change and commit the PNG.
 */
import { chromium } from 'playwright';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sharedBrowserTestLaunchOptions } from '../browser-automation.mjs';

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 630;
const BRAND_PALETTE = 'sky';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..', '..');
const outputPath = path.join(repositoryRoot, 'src', 'lib', 'assets', 'social-preview.png');

function fontUrl(packageName, fileName) {
	return pathToFileURL(
		path.join(
			repositoryRoot,
			'node_modules',
			'@fontsource-variable',
			packageName,
			'files',
			fileName,
		),
	).href;
}

function readPalettePrimitives(appCss) {
	const block = new RegExp(`\\[data-palette='${BRAND_PALETTE}'\\]\\s*\\{([^}]*)\\}`).exec(appCss);
	if (block === null) {
		throw new Error(`Palette '${BRAND_PALETTE}' not found in src/app.css`);
	}
	const primitives = Object.fromEntries(
		[...block[1].matchAll(/--p-([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [
			name,
			value.trim(),
		]),
	);
	for (const name of ['brand', 'deep', 'ink', 'accent', 'on-accent']) {
		if (primitives[name] === undefined) {
			throw new Error(`Palette '${BRAND_PALETTE}' is missing --p-${name}`);
		}
	}
	return primitives;
}

function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

const [template, appCss, catalogText] = await Promise.all([
	readFile(path.join(scriptDirectory, 'social-preview.html'), 'utf8'),
	readFile(path.join(repositoryRoot, 'src', 'app.css'), 'utf8'),
	readFile(path.join(repositoryRoot, 'messages', 'cs.json'), 'utf8'),
]);
const catalog = JSON.parse(catalogText);
const palette = readPalettePrimitives(appCss);

const replacements = {
	headingFontLatin: fontUrl('dynapuff', 'dynapuff-latin-wght-normal.woff2'),
	headingFontLatinExtended: fontUrl('dynapuff', 'dynapuff-latin-ext-wght-normal.woff2'),
	bodyFontLatin: fontUrl('geist', 'geist-latin-wght-normal.woff2'),
	bodyFontLatinExtended: fontUrl('geist', 'geist-latin-ext-wght-normal.woff2'),
	brand: palette.brand,
	deep: palette.deep,
	ink: palette.ink,
	accent: palette.accent,
	onAccent: palette['on-accent'],
	headline: escapeHtml(catalog.landing_hero_title),
	tagline: escapeHtml(catalog.landing_og_description),
	giftBook: escapeHtml(catalog.landing_gift_book),
	giftHeadphones: escapeHtml(catalog.landing_gift_headphones),
	giftCandles: escapeHtml(catalog.landing_gift_candles),
	reservedBadge: escapeHtml(catalog.landing_status_reserved),
};

const html = template.replaceAll(/\{\{(\w+)\}\}/g, (placeholder, key) => {
	const value = replacements[key];
	if (value === undefined) {
		throw new Error(`Unknown template placeholder ${placeholder}`);
	}
	return value;
});

const browser = await chromium.launch(sharedBrowserTestLaunchOptions);
try {
	const page = await browser.newPage({
		viewport: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT },
		deviceScaleFactor: 1,
	});
	// A file:// document may load the local font files referenced by the template.
	const documentPath = path.join(scriptDirectory, '.rendered-social-preview.html');
	await writeFile(documentPath, html);
	try {
		await page.goto(pathToFileURL(documentPath).href);
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: outputPath, type: 'png' });
	} finally {
		await rm(documentPath, { force: true });
	}
} finally {
	await browser.close();
}

console.log(outputPath);
