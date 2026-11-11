import test from 'node:test';
import assert from 'node:assert/strict';
import {
	claudeArguments,
	createJobReporter,
	readClaudeStreamLine,
	windowsBatchScriptFor,
} from './chat_runner.mjs';

const assistantLine = (...content) =>
	JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } });

test('assistant text becomes a text event', () => {
	assert.deepEqual(
		readClaudeStreamLine(assistantLine({ type: 'text', text: 'Našel jsem kolo.' })),
		{
			events: [{ type: 'text', text: 'Našel jsem kolo.' }],
			finalStatus: null,
		},
	);
});

test('web searches and page reads become tool events with their query', () => {
	const line = assistantLine(
		{ type: 'text', text: 'Hledám.' },
		{ type: 'tool_use', id: 't1', name: 'WebSearch', input: { query: 'dětské kolo' } },
		{ type: 'tool_use', id: 't2', name: 'WebFetch', input: { url: 'https://example.cz/kolo' } },
		{ type: 'tool_use', id: 't3', name: 'WebSearch', input: {} },
	);

	assert.deepEqual(readClaudeStreamLine(line).events, [
		{ type: 'text', text: 'Hledám.' },
		{ type: 'tool', name: 'web_search', query: 'dětské kolo' },
		{ type: 'tool', name: 'web_fetch', query: 'https://example.cz/kolo' },
		{ type: 'tool', name: 'web_search', query: null },
	]);
});

test('app tool calls and other output add no events, since the app records its own tools', () => {
	const appTool = assistantLine({
		type: 'tool_use',
		id: 't1',
		name: 'mcp__prejemesi__createGift',
		input: { name: 'Kolo' },
	});
	const toolResult = JSON.stringify({
		type: 'user',
		message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] },
	});
	const init = JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus' });

	for (const line of [appTool, toolResult, init, 'not json', '']) {
		assert.deepEqual(readClaudeStreamLine(line), { events: [], finalStatus: null });
	}
});

test('the result line ends the job as done, or failed when it is an error', () => {
	assert.equal(
		readClaudeStreamLine(
			JSON.stringify({ type: 'result', subtype: 'success', is_error: false }),
		).finalStatus,
		'done',
	);
	assert.equal(
		readClaudeStreamLine(
			JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true }),
		).finalStatus,
		'failed',
	);
});

test('text longer than the app accepts in one event is split, not lost', () => {
	const text = 'a'.repeat(20_000) + 'b';

	assert.deepEqual(
		readClaudeStreamLine(assistantLine({ type: 'text', text })).events.map(
			(event) => event.text.length,
		),
		[20_000, 1],
	);
});

test('claude runs with only the app MCP server and the web tools, without --bare', () => {
	const args = claudeArguments({
		model: 'sonnet',
		mcpConfigPath: 'C:/job/mcp.json',
		systemPromptPath: 'C:/job/system-prompt.md',
	});

	assert.equal(args.includes('--bare'), false);
	assert.deepEqual(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2), [
		'--model',
		'sonnet',
	]);
	assert.deepEqual(
		args.slice(args.indexOf('--allowedTools'), args.indexOf('--allowedTools') + 4),
		['--allowedTools', 'mcp__prejemesi', 'WebSearch', 'WebFetch'],
	);
	for (const flag of [
		'--strict-mcp-config',
		'--disable-slash-commands',
		'--no-session-persistence',
	]) {
		assert.equal(args.includes(flag), true, flag);
	}
	assert.equal(args[args.indexOf('--mcp-config') + 1], 'C:/job/mcp.json');
	assert.equal(args[args.indexOf('--system-prompt-file') + 1], 'C:/job/system-prompt.md');
	assert.equal(args[args.indexOf('--setting-sources') + 1], '');
	assert.equal(args[args.indexOf('--permission-mode') + 1], 'dontAsk');
});

test('a CLAUDE_BIN naming a .cmd or .bat script is found, on any platform', () => {
	for (const claudeBin of ['C:/npm/claude.cmd', 'C:\\npm\\CLAUDE.BAT']) {
		assert.equal(
			windowsBatchScriptFor(claudeBin, { platform: 'linux', fileExists: () => false }),
			claudeBin,
		);
	}
});

test('a bare claude resolving only to a .cmd on the Windows PATH is found', () => {
	const files = new Set(['C:/npm/claude.cmd']);
	const options = {
		platform: 'win32',
		searchPath: 'C:/tools;C:/npm',
		fileExists: (path) => files.has(path.replaceAll('\\', '/')),
	};

	assert.equal(
		windowsBatchScriptFor('claude', options)?.replaceAll('\\', '/'),
		'C:/npm/claude.cmd',
	);
	files.add('C:/tools/claude.exe');
	assert.equal(windowsBatchScriptFor('claude', options), null);
	assert.equal(windowsBatchScriptFor('C:/tools/claude.exe', options), null);
	assert.equal(windowsBatchScriptFor('claude', { ...options, platform: 'linux' }), null);
});

test('reports are numbered in order, and a retried report keeps its number', async (context) => {
	const sentBodies = [];
	let failNext = true;
	context.mock.method(globalThis, 'fetch', async (_url, init) => {
		sentBodies.push(JSON.parse(init.body));
		if (failNext) {
			failNext = false;
			throw new Error('connection reset');
		}
		return Response.json({ cancelled: false });
	});
	context.mock.method(console, 'log', () => {});
	const reporter = createJobReporter({
		appUrl: 'https://app.example',
		job: { id: 'job-1', token: 'token-1' },
		onCancelled: () => assert.fail('the job was not cancelled'),
	});

	await reporter.report([{ type: 'text', text: 'Ahoj' }]);
	await reporter.report([], 'done');

	assert.deepEqual(sentBodies, [
		{ sequence: 1, events: [{ type: 'text', text: 'Ahoj' }] },
		{ sequence: 1, events: [{ type: 'text', text: 'Ahoj' }] },
		{ sequence: 2, events: [], status: 'done' },
	]);
});
