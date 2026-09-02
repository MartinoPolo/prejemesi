import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	compare,
	median,
	compressedSizes,
	compareReports,
	renderMarkdown,
	waitReady,
} from './production-performance.mjs';

test('median handles odd and even samples', () => {
	assert.equal(median([9, 1, 5]), 5);
	assert.equal(median([8, 2, 4, 6]), 5);
	assert.equal(median([]), null);
});

test('compressedSizes returns deterministic raw, gzip, and Brotli sizes', () => {
	const bytes = Buffer.from('repeatable payload '.repeat(20));
	assert.deepEqual(compressedSizes(bytes), {
		raw: bytes.length,
		gzip: gzipSync(bytes).length,
		brotli: brotliCompressSync(bytes).length,
	});
	assert.deepEqual(compressedSizes(bytes), compressedSizes(bytes));
});

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

test('readiness polling removes abort listeners after each normal delay', async () => {
	const originalFetch = globalThis.fetch;
	const originalSetTimeout = globalThis.setTimeout;
	let requests = 0;
	let addedListeners = 0;
	let removedListeners = 0;
	const signal = {
		aborted: false,
		addEventListener: () => addedListeners++,
		removeEventListener: () => removedListeners++,
	};
	globalThis.fetch = async () => ({ ok: ++requests === 2 });
	globalThis.setTimeout = (callback) => (queueMicrotask(callback), 1);
	try {
		await waitReady('http://127.0.0.1:1/', { exitCode: null }, signal);
		assert.equal(addedListeners, 1);
		assert.equal(removedListeners, 1);
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.setTimeout = originalSetTimeout;
	}
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
