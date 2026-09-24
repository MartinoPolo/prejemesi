import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compare, compareReports, renderMarkdown, waitReady } from './production-performance.mjs';

const report = (jsBrotliBytes, fcp, error) => ({
	error,
	routes: {
		'/': {
			jsBrotliBytes,
			jsRequestCount: 4,
			cssBrotliBytes: 25,
			cssRequestCount: 1,
			fcp,
			lcp: 200,
			longTaskCount: 1,
			longTaskTotal: 60,
			longTaskMax: 60,
		},
		'/login': {
			jsBrotliBytes: 50,
			jsRequestCount: 2,
			cssBrotliBytes: 20,
			cssRequestCount: 1,
			fcp: 90,
			lcp: 150,
			longTaskCount: 0,
			longTaskTotal: 0,
			longTaskMax: 0,
		},
	},
});

test('comparison classifies byte and runtime warning bands', () => {
	const comparison = compareReports(report(100, 100), report(110, 115));
	const metrics = comparison.routes.find(({ route }) => route === '/').metrics;
	assert.equal(metrics.jsBrotliBytes.warning, true);
	assert.equal(metrics.fcp.warning, true);
	assert.equal(metrics.jsRequestCount.warning, false);
});

test('normal comparison calculates base, head, and delta', () => {
	const comparison = compareReports(report(100, 100), report(105, 110));
	const metrics = comparison.routes[0].metrics;
	assert.deepEqual(metrics.jsBrotliBytes, {
		base: 100,
		head: 105,
		delta: 5,
		relative: 0.05,
		warning: false,
	});
	const markdown = renderMarkdown(comparison);
	assert.match(markdown, /production-performance-report/);
	assert.match(markdown, /startup-window JS Brotli bytes/);
	assert.doesNotMatch(markdown, /initial JS\/CSS/);
});

test('failed and missing reports still render useful Markdown', () => {
	const failed = renderMarkdown(compareReports(null, { error: 'browser unavailable' }));
	assert.match(failed, /Base report is missing/);
	assert.match(failed, /Head collection failed.*browser unavailable/);
	assert.match(failed, /informational and non-blocking/);
});

test('readiness polling stops promptly when startup is cancelled', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (_url, { signal }) =>
		new Promise((_resolve, reject) =>
			signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
		);
	try {
		const controller = new AbortController();
		const failure = new Error('spawn failed');
		const waiting = waitReady('http://127.0.0.1:1/', { exitCode: null }, controller.signal);
		controller.abort(failure);
		await assert.rejects(waiting, failure);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('compare writes a non-blocking report for missing and malformed input files', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'production-performance-'));
	try {
		const malformed = join(directory, 'malformed.json');
		const output = join(directory, 'summary.md');
		await writeFile(malformed, '{');

		await compare({
			base: join(directory, 'missing.json'),
			head: malformed,
			output,
		});

		const markdown = await readFile(output, 'utf8');
		assert.match(markdown, /production-performance-report/);
		assert.match(markdown, /Missing or unreadable base report/);
		assert.match(markdown, /Missing or unreadable head report/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
