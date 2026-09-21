import { chromium } from 'playwright';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8300';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
	throw new Error(
		'Reference capture requires a local development server and seeded test account.',
	);
}
const directory = new URL('./', import.meta.url);
const browser = await chromium.launch();
try {
	const context = await browser.newContext({ colorScheme: 'light', reducedMotion: 'reduce' });
	const response = await context.request.post(`${base}/api/auth/sign-in/email`, {
		headers: { Origin: base, 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
		data: {
			email: 'martin@test.cz',
			password: process.env.SEED_PASSWORD ?? ['password', '123'].join(''),
		},
	});
	if (!response.ok()) throw new Error(`Local seed login failed: ${response.status()}`);
	const reference = {};
	let stylesheet = '';
	for (const [device, width] of [
		['mobile', 390],
		['desktop', 1280],
	]) {
		const page = await context.newPage();
		await page.setViewportSize({ width, height: 1000 });
		await page.goto(`${base}/w/xmas2026`);
		await page
			.locator(
				`[data-testid="${device === 'mobile' ? 'mobile' : 'desktop'}-display-trigger"]:visible`,
			)
			.waitFor();
		await page.evaluate(() => document.fonts.ready);
		const capture = await page.evaluate(() => {
			const switcher = [
				...document.querySelectorAll('[data-testid="gift-view-switcher"]'),
			].find((element) => element.getBoundingClientRect().height > 0);
			const toolbar = switcher.closest('.wishlist-toolbar');
			const measure = (element) => {
				const rectangle = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return {
					testid: element.dataset.testid,
					label: element.getAttribute('aria-label'),
					text: element.textContent.trim(),
					x: rectangle.x - toolbar.getBoundingClientRect().x,
					y: rectangle.y - toolbar.getBoundingClientRect().y,
					width: rectangle.width,
					height: rectangle.height,
					padding: style.padding,
					radius: style.borderRadius,
					font: style.font,
					gap: style.gap,
				};
			};
			const clone = toolbar.cloneNode(true);
			clone.querySelectorAll('*').forEach((element) => {
				for (const attribute of [...element.attributes]) {
					if (
						['id', 'aria-controls', 'aria-describedby', 'aria-labelledby'].includes(
							attribute.name,
						)
					)
						element.removeAttribute(attribute.name);
				}
			});
			const rules = (sheet) =>
				[...sheet.cssRules]
					.map((rule) => (rule.styleSheet ? rules(rule.styleSheet) : rule.cssText))
					.join('\n');
			return {
				html: clone.outerHTML,
				palette: toolbar.closest('[data-palette]').dataset.palette,
				toolbar: measure(toolbar),
				controls: [...toolbar.querySelectorAll('button,[data-testid="gift-view-switcher"]')]
					.filter((element) => element.getBoundingClientRect().height > 0)
					.map(measure),
				css: [...document.styleSheets].map(rules).join('\n'),
			};
		});
		stylesheet = capture.css;
		delete capture.css;
		reference[device] = capture;
		await page.close();
	}
	await mkdir(new URL('assets/', directory), { recursive: true });
	for (const family of ['dynapuff', 'geist']) {
		await copyFile(
			new URL(`../../node_modules/@fontsource-variable/${family}/LICENSE`, directory),
			new URL(`assets/${family}-LICENSE.txt`, directory),
		);
	}
	const assetUrls = [
		...new Set(
			[...stylesheet.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
				.map((match) => match[1])
				.filter((url) => !url.startsWith('data:')),
		),
	];
	for (const assetUrl of assetUrls) {
		const absoluteUrl = new URL(assetUrl, base);
		if (absoluteUrl.origin !== new URL(base).origin)
			throw new Error(`Unexpected external asset: ${absoluteUrl.origin}`);
		const asset = await context.request.get(absoluteUrl.href);
		if (!asset.ok()) throw new Error(`Asset capture failed: ${absoluteUrl.pathname}`);
		const filename = basename(absoluteUrl.pathname);
		await writeFile(new URL(`assets/${filename}`, directory), await asset.body());
		stylesheet = stylesheet.split(assetUrl).join(`assets/${filename}`);
	}
	await writeFile(
		new URL('app-reference.css', directory),
		`/* Generated from the rendered local app by refresh-reference.mjs. */\n${stylesheet}\n`,
	);
	await writeFile(
		new URL('reference-data.js', directory),
		`// Generated local seeded toolbar reference; no app runtime or credentials.\nwindow.toolbarReference = ${JSON.stringify(reference, null, 2)};\n`,
	);
	console.log(
		'Captured current mobile/desktop toolbar markup, dimensions, compiled CSS and local fonts.',
	);
} finally {
	await browser.close();
}
