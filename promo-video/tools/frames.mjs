import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { filmFrom, takeOption } from './film.mjs';

/*
 * Captures stills: node tools/frames.mjs <outDir> <time|gallery:N>... [--film cs] [--base url] [--scale 0.5]
 * Each still is rendered by the page itself, so what you see is exactly the video frame.
 */
const argumentsList = process.argv.slice(2);
const film = filmFrom(argumentsList);
const base = takeOption(argumentsList, '--base', film.url());
const scale = Number(takeOption(argumentsList, '--scale', '0.5'));
const [outDirectory, ...requests] = argumentsList;
mkdirSync(outDirectory, { recursive: true });

const browser = await chromium.launch({
	args: ['--use-angle=d3d11', '--enable-gpu-rasterization'],
});
try {
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
	page.on(
		'console',
		(message) => message.type() === 'error' && console.error('[page]', message.text()),
	);
	page.on('pageerror', (error) => console.error('[pageerror]', error.message));
	for (const request of requests) {
		const [kind, value] = request.startsWith('gallery:')
			? ['gallery', request.slice(8)]
			: ['t', request];
		await page.goto(`${base}?${kind}=${value}`, { timeout: 30000 });
		await page.waitForFunction(() => window.P?.ready, null, { timeout: 30000 });
		await page.evaluate(() => window.P.ready);
		const data = await page.evaluate(
			async ([kindName, valueText, outputScale]) => {
				if (kindName === 't') {
					await window.renderAt(Number(valueText));
				}
				const source = document.getElementById('film');
				const target = document.createElement('canvas');
				target.width = source.width * outputScale;
				target.height = source.height * outputScale;
				target.getContext('2d').drawImage(source, 0, 0, target.width, target.height);
				return target.toDataURL('image/png');
			},
			[kind, value, scale],
		);
		const file = `${outDirectory}/${kind}-${value}.png`;
		writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
		console.log(file);
	}
} finally {
	await browser.close();
}
