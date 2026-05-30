import { execSync, spawn } from 'node:child_process';

function runCommand({ name, cmd }) {
	return new Promise((resolve) => {
		const start = performance.now();
		const proc = spawn(cmd, { stdio: 'pipe', shell: true });
		let output = '';
		proc.stdout.on('data', (data) => (output += data));
		proc.stderr.on('data', (data) => (output += data));
		proc.on('close', (code) => {
			const elapsed = ((performance.now() - start) / 1000).toFixed(1);
			resolve({ name, code, output, elapsed });
		});
	});
}

const totalStart = performance.now();

execSync('pnpm exec svelte-kit sync', { stdio: 'ignore' });

const commands = [
	{ name: 'fallow', cmd: 'pnpm check:fallow' },
	{ name: 'typecheck', cmd: 'pnpm exec svelte-check --tsconfig ./tsconfig.json' },
	{ name: 'eslint', cmd: 'pnpm exec eslint --cache .' },
	{ name: 'vitest', cmd: 'pnpm test run --project client --project server' },
];

const results = await Promise.all(commands.map(runCommand));
const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(1);

let failed = false;
for (const { name, code, output, elapsed } of results) {
	if (code === 0) {
		console.log(`  \x1b[32m✓\x1b[0m ${name} \x1b[2m(${elapsed}s)\x1b[0m`);
	} else {
		failed = true;
		console.log(`  \x1b[31m✗\x1b[0m ${name} \x1b[2m(${elapsed}s)\x1b[0m`);
		console.log(output);
	}
}

console.log(
	`\n  ${failed ? '\x1b[31mPre-push failed\x1b[0m' : '\x1b[32mAll checks passed\x1b[0m'} \x1b[2m(${totalElapsed}s total)\x1b[0m`,
);
process.exit(failed ? 1 : 0);
