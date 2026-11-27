import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { filmFrom } from './film.mjs';

/*
 * Builds dist/prejemesi-promo-<film>.html: one self-contained file with scripts, styles, fonts,
 * audio and cues inlined. Usage: node tools/build.mjs [--film cs]
 */
const film = filmFrom(process.argv.slice(2));
const resolve = (reference) => posix.normalize(posix.join(film.directory, reference));
const dataUri = (reference, mimeType) =>
	`data:${mimeType};base64,${readFileSync(resolve(reference)).toString('base64')}`;
const replaceOnce = (source, pattern, replacement) => {
	if (!pattern.test(source)) {
		throw new Error(`build: nothing matches ${pattern}`);
	}
	return source.replace(pattern, replacement);
};
let html = readFileSync(`${film.directory}/index.html`, 'utf8');

html = html.replace(/'([^']+\.woff2)'/g, (_, file) => `'${dataUri(file, 'font/woff2')}'`);
html = replaceOnce(
	html,
	/audio: '([^']+\.mp3)',/,
	(_, file) => `audio: '${dataUri(file, 'audio/mpeg')}',`,
);
html = replaceOnce(
	html,
	/cues: '([^']+\.json)',/,
	(_, file) => `cuesData: ${JSON.stringify(JSON.parse(readFileSync(resolve(file), 'utf8')))},`,
);
html = replaceOnce(
	html,
	/<link rel="stylesheet" href="([^"]+\.css)" \/>/,
	(_, file) => `<style>\n${readFileSync(resolve(file), 'utf8')}</style>`,
);
html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (_, file) => {
	const source = readFileSync(resolve(file), 'utf8');
	if (source.includes('</script')) {
		throw new Error(`${file} contains a closing script tag`);
	}
	return `<script>\n${source}</script>`;
});

mkdirSync('dist', { recursive: true });
const output = `dist/prejemesi-promo-${film.name}.html`;
writeFileSync(output, html);
console.log(`${output} ${(html.length / 1024 / 1024).toFixed(2)} MB`);
