import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] ?? 4610);
const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.woff2': 'font/woff2',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.png': 'image/png',
};

createServer(async (request, response) => {
	const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
	const file = join(
		root,
		path.endsWith('\\') || path.endsWith('/') ? join(path, 'index.html') : path,
	);
	if (!file.startsWith(root)) {
		return response.writeHead(403).end();
	}
	try {
		const body = await readFile(file);
		response.writeHead(200, {
			'content-type': types[extname(file)] ?? 'application/octet-stream',
			'cache-control': 'no-store',
		});
		response.end(body);
	} catch {
		response.writeHead(404).end('not found');
	}
}).listen(port, () => console.log(`http://localhost:${port}/`));
