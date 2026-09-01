import { runParallelChecks } from './lib/run-parallel-checks.mjs';

const checks = [
	{ name: 'Oxlint', command: 'pnpm exec oxlint' },
	{ name: 'Migration safety', command: 'pnpm run check:migrations' },
	{ name: 'Vykání', command: 'pnpm run check:vykani' },
	{ name: 'Stylelint', command: 'pnpm exec stylelint "src/**/*.{css,svelte}"' },
	{ name: 'Fallow', command: 'pnpm run check:fallow' },
	{
		name: 'Svelte check',
		command: 'pnpm exec svelte-check --tsconfig ./tsconfig.json',
	},
	{
		name: 'ESLint',
		command: 'pnpm exec eslint --cache --cache-strategy content .',
	},
];

const startedAt = performance.now();
const results = await runParallelChecks(checks);
let failed = false;

for (const result of results) {
	const output = result.output.trimEnd();
	if (result.exitCode === 0) {
		console.log(`✓ ${result.name} (${result.durationSeconds}s)`);
		if (output !== '') {
			console.log(output);
		}
		continue;
	}

	failed = true;
	console.error(`✗ ${result.name} (${result.durationSeconds}s)`);
	if (output !== '') {
		console.error(output);
	}
}

const durationSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
console.log(`Parallel checks completed in ${durationSeconds}s.`);
process.exit(failed ? 1 : 0);
