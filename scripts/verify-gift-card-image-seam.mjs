#!/usr/bin/env node
/** Native-pixel check against an already-running Storybook; --baseline restores the old seam for diagnosis. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex < 0 ? undefined : process.argv[baseIndex + 1];
const baseline = process.argv.includes('--baseline');
const outputIndex = process.argv.indexOf('--output');
const outputDirectory = outputIndex < 0 ? undefined : process.argv[outputIndex + 1];
if (outputIndex >= 0 && (!outputDirectory || outputDirectory.startsWith('--'))) {
	throw new Error('Pass a directory after --output.');
}
if (!base || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
	throw new Error('Pass --base with a loopback Storybook URL.');
}

const fixtureNavy = [49, 91, 125];
const quantizationTolerance = 2;
const browser = await chromium.launch({ args: ['--no-proxy-server'], timeout: 15000 });
try {
	for (const deviceScaleFactor of [1, 1.5, 2]) {
		const context = await browser.newContext({
			viewport: { width: 1280, height: 900 },
			deviceScaleFactor,
			colorScheme: 'light',
			reducedMotion: 'reduce',
		});
		try {
			const page = await context.newPage();
			page.setDefaultTimeout(30000);
			await page.goto(
				new URL(
					'/iframe.html?id=blocks-gift-giftcard--loaded-image-seam-regression&viewMode=story',
					base,
				).href,
				{ waitUntil: 'domcontentloaded', timeout: 45000 },
			);
			if (baseline) {
				await page.addStyleTag({
					content: '.gift-card-painted-surface::after { content: none !important; }',
				});
			}
			const frame = page.locator('[data-testid="gift-card-image-frame"]');
			try {
				await frame.waitFor();
			} catch (error) {
				throw new Error(
					`Story did not render at ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 500)}`,
					{ cause: error },
				);
			}
			await page.waitForFunction(() => {
				const image = document.querySelector('[data-testid="gift-card-image-frame"] img');
				return (
					image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
				);
			});
			const cases = [288, 287.5, 320].flatMap((width) =>
				[0, 0.25, 0.5].map((verticalShift) => ({
					width,
					verticalShift,
					zoom: 1,
					translation: false,
				})),
			);
			if (deviceScaleFactor === 1.5) {
				for (const zoom of [1.25, 1.5]) {
					cases.push({ width: 288, verticalShift: 0, zoom, translation: true });
				}
			}
			for (const { width, verticalShift, zoom, translation } of cases) {
				await page.locator('.w-72').evaluate(
					(element, { width, verticalShift, zoom, translation }) => {
						element.style.width = `${width}px`;
						element.style.marginTop = `${verticalShift}px`;
						element.style.zoom = String(zoom);
						element.style.transform = translation ? 'translate(0.25px, 0.5px)' : '';
					},
					{ width, verticalShift, zoom, translation },
				);
				const bounds = await frame.evaluate((element, baseline) => {
					const separator = element.querySelector(
						'[data-testid="gift-card-image-separator"]',
					);
					const composition = element.querySelector(
						'[data-testid="gift-card-crop-composition"]',
					);
					if (
						!(separator instanceof HTMLElement) ||
						!(composition instanceof HTMLElement)
					) {
						throw new Error('Missing image composition or separator');
					}
					if (baseline) {
						element.style.paddingBottom = '0';
						element.style.borderBottom = '2.5px solid var(--ink)';
						separator.style.display = 'none';
						const wrapper = composition.parentElement;
						if (!wrapper) {
							throw new Error('Missing image composition wrapper');
						}
						Object.assign(wrapper.style, {
							position: 'absolute',
							inset: '0',
							display: 'block',
						});
						Object.assign(composition.style, {
							position: 'absolute',
							insetInline: '0',
							top: '50%',
							transform: 'translateY(-50%)',
							width: '100%',
						});
					}
					const frameBounds = element.getBoundingClientRect();
					const surface = element.closest('.gift-card-painted-surface');
					if (!(surface instanceof HTMLElement)) {
						throw new Error('Missing card surface');
					}
					const surfaceBounds = surface.getBoundingClientRect();
					const separatorBounds = separator.getBoundingClientRect();
					const borderWidth = Number.parseFloat(
						getComputedStyle(element).borderBottomWidth,
					);
					return {
						bottom: {
							axis: 'y',
							position: frameBounds.left + frameBounds.width * 0.15,
							ink: baseline
								? frameBounds.bottom - 1.25
								: separatorBounds.bottom - 1.25,
							image: baseline
								? frameBounds.bottom - borderWidth - 8
								: separatorBounds.top - 8,
						},
						top: {
							axis: 'y',
							position: frameBounds.left + frameBounds.width * 0.5,
							ink: surfaceBounds.top + 1,
							image: frameBounds.top + 8,
						},
						left: {
							axis: 'x',
							position: frameBounds.top + 40,
							ink: surfaceBounds.left + 1,
							image: frameBounds.left + 8,
						},
						right: {
							axis: 'x',
							position: frameBounds.top + 40,
							ink: surfaceBounds.right - 1,
							image: frameBounds.right - 8,
						},
					};
				}, baseline);
				// Capture the viewport at native resolution, not a locator clip rounded to device pixels.
				const screenshotPath =
					outputDirectory &&
					width === 288 &&
					(translation ||
						(verticalShift === 0 && zoom === 1) ||
						(deviceScaleFactor === 1.5 && verticalShift === 0.25))
						? join(
								outputDirectory,
								`gift-card-seam-${baseline ? 'baseline' : 'fixed'}-${deviceScaleFactor}x-zoom-${zoom}-shift-${verticalShift}${translation ? '-translated' : ''}.png`,
							)
						: undefined;
				if (screenshotPath) {
					await mkdir(outputDirectory, { recursive: true });
				}
				const screenshot = (
					await page.screenshot({
						fullPage: true,
						timeout: 15000,
						path: screenshotPath,
					})
				).toString('base64');
				if (screenshotPath) {
					console.log(`Screenshot: ${screenshotPath}`);
				}
				const samples = await page.evaluate(
					async ({ screenshot, bounds, deviceScaleFactor }) => {
						const image = new Image();
						image.src = `data:image/png;base64,${screenshot}`;
						await image.decode();
						const canvas = document.createElement('canvas');
						canvas.width = image.width;
						canvas.height = image.height;
						const context = canvas.getContext('2d', { willReadFrequently: true });
						if (!context) {
							throw new Error('Canvas unavailable');
						}
						context.drawImage(image, 0, 0);
						const pixel = (x, y) => {
							if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
								throw new Error(`Sample outside screenshot: ${x},${y}`);
							}
							return [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
						};
						return Object.fromEntries(
							Object.entries(bounds).map(([side, edge]) => {
								const position = Math.floor(edge.position * deviceScaleFactor);
								const sampleAt = (coordinate) =>
									edge.axis === 'x'
										? pixel(coordinate, position)
										: pixel(position, coordinate);
								// Scan the painted ink-to-photo interval, never the page outside the border.
								const first = Math.floor(
									Math.min(edge.ink, edge.image) * deviceScaleFactor,
								);
								const last = Math.floor(
									Math.max(edge.ink, edge.image) * deviceScaleFactor,
								);
								return [
									side,
									{
										image: sampleAt(Math.floor(edge.image * deviceScaleFactor)),
										ink: sampleAt(Math.floor(edge.ink * deviceScaleFactor)),
										boundary: Array.from(
											{ length: last - first + 1 },
											(_, index) => ({
												coordinate: first + index,
												rgb: sampleAt(first + index),
											}),
										),
									},
								];
							}),
						);
					},
					{ screenshot, bounds, deviceScaleFactor },
				);
				const caseName = `${width}px / ${deviceScaleFactor}x / zoom ${zoom} / shift ${verticalShift}px / translated ${translation}${baseline ? ' / baseline' : ''}`;
				for (const [side, sample] of Object.entries(samples)) {
					if (
						sample.image.some(
							(channel, position) =>
								Math.abs(channel - fixtureNavy[position]) > quantizationTolerance,
						)
					) {
						throw new Error(
							`Expected solid navy fixture at ${side} image endpoint (${caseName}): ${sample.image}`,
						);
					}
					if (
						sample.ink.some(
							(channel, position) =>
								channel > sample.image[position] + quantizationTolerance,
						)
					) {
						throw new Error(
							`Expected dark ink at ${side} border endpoint (${caseName}): ${sample.ink}`,
						);
					}
					for (const { coordinate, rgb } of sample.boundary) {
						if (
							rgb.some(
								(channel, position) =>
									channel <
										Math.min(sample.image[position], sample.ink[position]) -
											quantizationTolerance ||
									channel >
										Math.max(sample.image[position], sample.ink[position]) +
											quantizationTolerance,
							)
						) {
							throw new Error(
								`Mat-colored ${side} image seam at ${caseName}, native coordinate ${coordinate}: ${rgb}; image ${sample.image}, ink ${sample.ink}`,
							);
						}
					}
				}
				console.log(`PASS ${caseName}: ${JSON.stringify(samples)}`);
			}
		} finally {
			await context.close();
		}
	}
} finally {
	await browser.close();
}
