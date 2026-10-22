// Inlines the shared engine into each self-contained variant page: `node build.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, 'src', name), 'utf8');
const coreCss = read('core.css');
const coreJs = read('core.js');

const ids = process.argv.length > 2 ? process.argv.slice(2) : ['a', 'b', 'c'];
for (const id of ids) {
	const variantJs = read(`variant-${id}.js`);
	const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>#533 Editor obrázků – varianta ${id.toUpperCase()}</title>
<style>
${coreCss}
</style>
</head>
<body>
<script>
${coreJs}
${variantJs}
</script>
</body>
</html>
`;
	writeFileSync(join(here, `variant-${id}.html`), html);
	console.log(`variant-${id}.html`);
}
