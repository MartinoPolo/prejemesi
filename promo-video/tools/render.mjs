import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { once } from 'node:events';
import { filmFrom, takeOption } from './film.mjs';

/*
 * Renders a film frame by frame in Chromium and encodes it with its mixed soundtrack.
 * Usage: node tools/render.mjs [output.mp4] [--film cs] [--base url] [--height 1080] [--from 0] [--to duration]
 */
const argumentsList = process.argv.slice(2);
const film = filmFrom(argumentsList);
const option = (name, fallback) => takeOption(argumentsList, name, fallback);
const base = option('--base', film.url());
const height = Number(option('--height', '1080'));
const from = Number(option('--from', '0'));
const to = Number(option('--to', String(film.cues.duration)));
const output = argumentsList[0] ?? `dist/prejemesi-promo-${film.name}.mp4`;
const framesPerSecond = 30;
mkdirSync(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });

const encoder = spawn(
	'ffmpeg',
	[
		'-hide_banner',
		'-loglevel',
		'error',
		'-y',
		'-f',
		'image2pipe',
		'-framerate',
		String(framesPerSecond),
		'-i',
		'-',
		'-ss',
		String(from),
		'-t',
		String(to - from),
		'-i',
		`${film.mix}.wav`,
		'-vf',
		`scale=-2:${height}:flags=lanczos,format=yuv420p`,
		'-c:v',
		'libx264',
		'-preset',
		'slow',
		'-crf',
		height >= 1080 ? '16' : '21',
		'-tune',
		'animation',
		'-c:a',
		'aac',
		'-b:a',
		'256k',
		'-shortest',
		'-movflags',
		'+faststart',
		output,
	],
	{ stdio: ['pipe', 'inherit', 'inherit'] },
);
const encoderExit = once(encoder, 'exit');

const browser = await chromium.launch({
	args: ['--use-angle=d3d11', '--enable-gpu-rasterization'],
});
const started = Date.now();
try {
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
	page.on('pageerror', (error) => console.error('[pageerror]', error.message));
	await page.goto(`${base}?t=0`, { timeout: 30000 });
	await page.waitForFunction(() => window.P?.ready, null, { timeout: 30000 });
	await page.evaluate(() => window.P.ready);
	const first = Math.round(from * framesPerSecond);
	const last = Math.round(to * framesPerSecond);
	for (let frame = first; frame < last; frame++) {
		const data = await page.evaluate(
			(time) => window.frameData(time, 'image/png'),
			frame / framesPerSecond,
		);
		if (!encoder.stdin.write(Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'))) {
			await once(encoder.stdin, 'drain');
		}
		if (frame % 60 === 0) {
			process.stdout.write(
				`\rframe ${frame}/${last} ${((Date.now() - started) / 1000).toFixed(0)}s`,
			);
		}
	}
} finally {
	encoder.stdin.end();
	await browser.close();
}
const [code] = await encoderExit;
if (code !== 0) {
	throw new Error(`ffmpeg exited with ${code}`);
}
console.log(`\n${output} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
