import { chromium } from 'playwright';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sharedChromeLaunchOptions } from '../../scripts/browser-automation.mjs';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8300';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
	throw new Error('Reference capture requires a local development server and seeded test account.');
}
const directory = new URL('./', import.meta.url);
const devices = [
	['mobile', 390, 844],
	['desktop', 1280, 1000]
];

async function waitForWishlistHydration(page) {
	await page.locator('[data-testid="gift-view-switcher"]:visible').first().waitFor();
	// Clicks before hydration are lost, so wait for the client handlers to attach.
	await page.waitForTimeout(2000);
}

// Each shipped control is captured inside the real container it lives in. `open` reaches it.
const contexts = [
	{
		key: 'toolbar',
		path: '/w/xmas2026',
		control: '[data-testid="gift-view-switcher"]',
		container: '[data-testid="wishlist-toolbar"]'
	},
	{
		key: 'dashboard',
		path: '/my-lists',
		control: '[data-slot="toggle-group"][aria-label="Zobrazení"]',
		container: 'main'
	},
	{
		key: 'image-source',
		path: '/w/xmas2026',
		control: '[data-testid="gift-image-source"] [data-slot="toggle-group"]',
		container: '[data-slot="dialog-content"], [role="dialog"]',
		open: async (page) => {
			await waitForWishlistHydration(page);
			await page
				.locator('[data-testid="wishlist-toolbar"]')
				.getByRole('button', { name: 'Přidat dárek' })
				.filter({ visible: true })
				.first()
				.click();
		}
	},
	{
		key: 'settings-tabs',
		path: '/w/xmas2026',
		control: '[role="tablist"]',
		container: '[data-slot="dialog-content"], [role="dialog"]',
		open: async (page) => {
			await waitForWishlistHydration(page);
			await page.locator('[data-testid="wishlist-header-actions"] button:visible').first().click();
			await page.getByRole('tab', { name: 'Vzhled' }).click();
		}
	},
	{ key: 'auth-tabs', path: '/login', control: 'nav.auth-tabs', container: '.form-panel', signedOut: true }
];

function serializeStylesheets() {
	const rules = (sheet) =>
		[...sheet.cssRules].flatMap((rule) => (rule.styleSheet ? rules(rule.styleSheet) : [rule.cssText]));
	return [...document.styleSheets].flatMap(rules);
}

function captureContainer(control, containerSelector) {
	const container = control.closest(containerSelector);
	const clone = container.cloneNode(true);
	for (const node of [clone, ...clone.querySelectorAll('*')]) {
		for (const attribute of [...node.attributes]) {
			if (['id', 'aria-controls', 'aria-describedby', 'aria-labelledby'].includes(attribute.name)) {
				node.removeAttribute(attribute.name);
			}
		}
	}
	const clippingAncestors = [];
	for (let ancestor = container.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
		const style = getComputedStyle(ancestor);
		if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
			clippingAncestors.push(`${ancestor.tagName.toLowerCase()}.${[...ancestor.classList].slice(0, 4).join('.')} (${style.overflowX}/${style.overflowY})`);
		}
	}
	const rect = container.getBoundingClientRect();
	return {
		html: clone.outerHTML,
		width: rect.width,
		height: rect.height,
		fixed: getComputedStyle(container).position === 'fixed',
		palette: container.closest('[data-palette]')?.dataset.palette ?? null,
		clippingAncestors
	};
}

const browser = await chromium.launch(sharedChromeLaunchOptions);
try {
	const contextOptions = { colorScheme: 'light', reducedMotion: 'reduce' };
	const signedIn = await browser.newContext(contextOptions);
	const passwordField = 'password';
	const response = await signedIn.request.post(`${base}/api/auth/sign-in/email`, {
		headers: { Origin: base, 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
		data: {
			email: 'martin@test.cz',
			[passwordField]: process.env.SEED_PASSWORD ?? ['password', '123'].join('')
		}
	});
	if (!response.ok()) throw new Error(`Local seed login failed: ${response.status()}`);
	const signedOut = await browser.newContext(contextOptions);
	await signedOut.addCookies([{ name: 'dev-auto-login-opt-out', value: '1', url: base }]);

	const reference = {};
	const stylesheetRules = new Set();
	for (const [device, width, height] of devices) {
		reference[device] = {};
		for (const context of contexts) {
			const page = await (context.signedOut ? signedOut : signedIn).newPage();
			await page.setViewportSize({ width, height });
			await page.goto(`${base}${context.path}`);
			await context.open?.(page);
			const control = page.locator(context.control).filter({ visible: true }).first();
			await control.waitFor();
			await page.evaluate(() => document.fonts.ready);
			reference[device][context.key] = {
				control: context.control,
				...(await control.evaluate(captureContainer, context.container))
			};
			for (const rule of await page.evaluate(serializeStylesheets)) stylesheetRules.add(rule);
			await page.close();
		}
	}

	let stylesheet = [...stylesheetRules].join('\n');
	let referenceSource = JSON.stringify(reference, null, '\t');
	await mkdir(new URL('assets/', directory), { recursive: true });
	for (const family of ['dynapuff', 'geist']) {
		await copyFile(
			new URL(`../../node_modules/@fontsource-variable/${family}/LICENSE`, directory),
			new URL(`assets/${family}-LICENSE.txt`, directory)
		);
	}
	async function localizeAsset(assetUrl) {
		const absoluteUrl = new URL(assetUrl.replaceAll('&amp;', '&'), base);
		if (absoluteUrl.origin !== new URL(base).origin) throw new Error(`Unexpected external asset: ${absoluteUrl.origin}`);
		const asset = await signedIn.request.get(absoluteUrl.href);
		if (!asset.ok()) throw new Error(`Asset capture failed: ${absoluteUrl.pathname}`);
		const filename = basename(absoluteUrl.pathname);
		await writeFile(new URL(`assets/${filename}`, directory), await asset.body());
		return `assets/${filename}`;
	}
	const stylesheetAssets = new Set(
		[...stylesheet.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
			.map((match) => match[1])
			.filter((url) => !url.startsWith('data:') && !url.startsWith('#'))
	);
	for (const assetUrl of stylesheetAssets) {
		stylesheet = stylesheet.split(assetUrl).join(await localizeAsset(assetUrl));
	}
	const imageAssets = new Set(
		[...referenceSource.matchAll(/src=\\"([^"\\]+)\\"/g)].map((match) => match[1]).filter((url) => !url.startsWith('data:'))
	);
	for (const assetUrl of imageAssets) {
		referenceSource = referenceSource.split(`src=\\"${assetUrl}\\"`).join(`src=\\"${await localizeAsset(assetUrl)}\\"`);
	}
	referenceSource = referenceSource.replace(/ srcset=\\"[^"\\]*\\"/g, '');
	await writeFile(
		new URL('app-reference.css', directory),
		`/* Generated from the rendered local app by capture-reference.mjs. */\n${stylesheet}\n`
	);
	await writeFile(
		new URL('reference-data.js', directory),
		`// Generated local seeded app captures; no app runtime or credentials.\nwindow.appReference = ${referenceSource};\n`
	);
	console.log('Captured shipped controls in their containers, compiled CSS, images and local fonts.');
} finally {
	await browser.close();
}
