import { writeFile } from 'node:fs/promises';
import { resolveDevelopmentEnvironment } from '../src/lib/config/mpx_development.js';

const output = process.argv[2] ?? 'scripts/r2-cors.json';
const origins = [
	'https://prejemesi.cz',
	'https://www.prejemesi.cz',
	...resolveDevelopmentEnvironment(process.env).r2LocalOrigins,
];
const configuration = {
	rules: [
		{
			allowed: { origins, methods: ['PUT'], headers: ['Content-Type'] },
			exposeHeaders: ['ETag'],
			maxAgeSeconds: 3600,
		},
	],
};
await writeFile(output, `${JSON.stringify(configuration, null, '\t')}\n`, 'utf8');
console.log(output);
