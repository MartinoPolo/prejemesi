#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assignedService } from './development-service-environment.mjs';

const service = process.argv[2];
const preview = assignedService(process.env.MPX_PREVIEW_PORT, '8301');
const storybook = assignedService(process.env.MPX_STORYBOOK_PORT, '8302');

const definitions = {
	preview: {
		bin: new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
		args: [
			'dev',
			'.svelte-kit/cloudflare/_worker.js',
			'--port',
			preview.port,
			'--var',
			`ORIGIN:${preview.origin}`,
		],
	},
	storybook: {
		bin: new URL('../node_modules/storybook/dist/bin/dispatcher.js', import.meta.url),
		args: ['dev', '--port', storybook.port],
	},
};
const definition = definitions[service];
if (!definition) {
	console.error(`Unknown development service: ${service ?? ''}`);
	process.exitCode = 2;
} else {
	const child = spawn(process.execPath, [fileURLToPath(definition.bin), ...definition.args], {
		stdio: 'inherit',
		env: process.env,
		windowsHide: true,
	});
	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.on(signal, () => child.kill(signal));
	}
	child.on('exit', (code, signal) => {
		process.exitCode = code ?? (signal ? 1 : 0);
	});
}
