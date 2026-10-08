#!/usr/bin/env node
/**
 * Reads product/search pages from bot-protected retailers (Alza, Heureka) for the add-gifts skill.
 *
 * Opens a visible, fresh Chrome session. Hiding the AutomationControlled blink feature keeps
 * `navigator.webdriver` false; without it Cloudflare Turnstile rejects even a human's clicks.
 * Most challenges then clear on their own; when one persists, the script waits for a human to solve
 * it in the window before extracting evidence.
 *
 * Usage:
 *   node scripts/gift-research-browser.mjs <https-url...> [--out <file>] [--verification-timeout <seconds>]
 *
 * Prints a JSON array (or writes it to --out) with, per URL: final URL, title, canonical URL,
 * parsed JSON-LD, OpenGraph/product/itemprop metadata, same-site links, and a visible-text excerpt.
 */
import { sharedChromeLaunchOptions } from './browser-automation.mjs';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAVIGATION_TIMEOUT_MILLISECONDS = 45_000;
const CHALLENGE_POLL_MILLISECONDS = 2_000;
const SELF_CLEARING_CHALLENGE_MILLISECONDS = 20_000;
const SETTLE_MILLISECONDS = 2_000;
const MAX_LINKS = 120;
const MAX_TEXT_CHARACTERS = 20_000;

function parseArguments(argumentList) {
	const urls = [];
	const options = { out: undefined, verificationTimeoutSeconds: 300 };
	for (let index = 0; index < argumentList.length; index++) {
		const argument = argumentList[index];
		if (argument === '--out') {
			options.out = argumentList[++index];
		} else if (argument === '--verification-timeout') {
			options.verificationTimeoutSeconds = Number(argumentList[++index]);
		} else {
			urls.push(argument);
		}
	}
	if (urls.length === 0) {
		throw new Error('Pass at least one https:// URL.');
	}
	for (const url of urls) {
		if (new URL(url).protocol !== 'https:') {
			throw new Error(`Not an HTTPS URL: ${url}`);
		}
	}
	if (!(options.verificationTimeoutSeconds > 0)) {
		throw new Error('--verification-timeout must be a positive number of seconds.');
	}
	return { urls, options };
}

async function isChallengePage(page) {
	return page
		.evaluate(() => {
			const challengeTitle =
				/just a moment|okamžik|attention required|checking your browser|captcha|ověř|robot/i;
			const challengeSelectors = [
				'iframe[src*="challenges.cloudflare.com"]',
				'#challenge-form',
				'#challenge-running',
				'.cf-turnstile',
				'.g-recaptcha',
				'.h-captcha',
			];
			return (
				'_cf_chl_opt' in window ||
				challengeTitle.test(document.title) ||
				challengeSelectors.some((selector) => document.querySelector(selector) !== null)
			);
		})
		.catch(() => true);
}

async function waitPastChallenge(page, verificationTimeoutSeconds) {
	const selfClearingDeadline = Date.now() + SELF_CLEARING_CHALLENGE_MILLISECONDS;
	const deadline = Date.now() + verificationTimeoutSeconds * 1000;
	let announced = false;
	while (await isChallengePage(page)) {
		if (Date.now() > deadline) {
			return false;
		}
		if (!announced && Date.now() > selfClearingDeadline) {
			process.stderr.write(
				`Verification needed on ${new URL(page.url()).host}: complete it in the Chrome window (waiting up to ${verificationTimeoutSeconds}s).\n`,
			);
			announced = true;
		}
		await page.waitForTimeout(CHALLENGE_POLL_MILLISECONDS);
	}
	await page.waitForLoadState('domcontentloaded').catch(() => {});
	return true;
}

function extractPageEvidence(limits) {
	const jsonLd = [];
	for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			jsonLd.push(JSON.parse(script.textContent ?? ''));
		} catch {
			jsonLd.push({ unparsable: (script.textContent ?? '').slice(0, 500) });
		}
	}
	const metadata = {};
	for (const element of document.querySelectorAll('meta[property], meta[name]')) {
		const key = element.getAttribute('property') ?? element.getAttribute('name') ?? '';
		if (/^(og:|product:|twitter:|description$)/.test(key)) {
			metadata[key] = element.getAttribute('content');
		}
	}
	const itemprop = {};
	for (const element of document.querySelectorAll(
		'[itemprop="price"], [itemprop="priceCurrency"], [itemprop="lowPrice"], [itemprop="highPrice"], [itemprop="gtin13"], [itemprop="sku"], [itemprop="availability"]',
	)) {
		const key = element.getAttribute('itemprop') ?? '';
		const value =
			element.getAttribute('content') ?? element.getAttribute('href') ?? element.textContent;
		(itemprop[key] ??= []).push(value?.trim());
	}
	const seenLinks = new Set();
	const links = [];
	for (const anchor of document.querySelectorAll('a[href]')) {
		const text = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim();
		const sameSite = anchor.hostname.split('.').slice(-2).join('.') === limits.siteDomain;
		if (!text || !sameSite || seenLinks.has(anchor.href)) {
			continue;
		}
		seenLinks.add(anchor.href);
		links.push({ text: text.slice(0, 160), url: anchor.href });
		if (links.length >= limits.maxLinks) {
			break;
		}
	}
	return {
		finalUrl: location.href,
		title: document.title,
		canonicalUrl: document.querySelector('link[rel="canonical"]')?.href ?? null,
		jsonLd,
		metadata,
		itemprop,
		links,
		text: (document.body?.innerText ?? '').slice(0, limits.maxTextCharacters),
	};
}

async function readPage(page, url, verificationTimeoutSeconds) {
	try {
		const response = await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
		});
		if (!(await waitPastChallenge(page, verificationTimeoutSeconds))) {
			return {
				requestedUrl: url,
				error: 'Verification was not completed before the timeout.',
			};
		}
		await page.waitForTimeout(SETTLE_MILLISECONDS);
		const evidence = await page.evaluate(extractPageEvidence, {
			maxLinks: MAX_LINKS,
			maxTextCharacters: MAX_TEXT_CHARACTERS,
			siteDomain: new URL(page.url()).hostname.split('.').slice(-2).join('.'),
		});
		return { requestedUrl: url, initialStatus: response?.status() ?? null, ...evidence };
	} catch (error) {
		return { requestedUrl: url, error: error instanceof Error ? error.message : String(error) };
	}
}

async function main() {
	const { urls, options } = parseArguments(process.argv.slice(2));
	const browser = await chromium.launch({
		...sharedChromeLaunchOptions,
		headless: false,
		args: ['--disable-blink-features=AutomationControlled'],
	});
	try {
		const context = await browser.newContext({ locale: 'cs-CZ', viewport: null });
		const page = await context.newPage();
		const results = [];
		for (const url of urls) {
			results.push(await readPage(page, url, options.verificationTimeoutSeconds));
		}
		const output = JSON.stringify(results, null, '\t');
		if (options.out) {
			writeFileSync(resolve(options.out), output);
			process.stdout.write(`${resolve(options.out)}\n`);
		} else {
			process.stdout.write(`${output}\n`);
		}
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
