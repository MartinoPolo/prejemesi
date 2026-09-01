import { spawn } from 'node:child_process';

function runCheck(check) {
	return new Promise((resolve) => {
		const startedAt = performance.now();
		let output = '';
		let settled = false;

		const finish = (exitCode, error) => {
			if (settled) {
				return;
			}
			settled = true;
			if (error !== undefined) {
				output += `${error.message}\n`;
			}
			resolve({
				...check,
				exitCode,
				output,
				durationSeconds: ((performance.now() - startedAt) / 1000).toFixed(1),
			});
		};

		try {
			const childProcess = spawn(check.command, { shell: true, stdio: 'pipe' });
			childProcess.stdout.on('data', (data) => (output += data));
			childProcess.stderr.on('data', (data) => (output += data));
			childProcess.on('error', (error) => finish(1, error));
			childProcess.on('close', (exitCode) => finish(exitCode ?? 1));
		} catch (error) {
			finish(1, error instanceof Error ? error : new Error(String(error)));
		}
	});
}

export function runParallelChecks(checks) {
	return Promise.all(checks.map(runCheck));
}
