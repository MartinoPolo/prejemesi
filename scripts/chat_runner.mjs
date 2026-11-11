// Answers the in-app AI chat with Claude Code on this computer: claims queued turns from the app,
// runs `claude -p` for each one and reports what it writes back. See README "AI asistent přes
// Claude Code". Dependency-free so it runs with plain `node`.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const RUNNER_EVENT = { text: 'text', tool: 'tool' };
export const RUNNER_FINAL_STATUS = { done: 'done', failed: 'failed' };

/** The app's MCP server name; its tool calls reach the chat through MCP, not the event stream. */
const APP_MCP_SERVER = 'prejemesi';
const WEB_TOOL_EVENT_NAMES = { WebSearch: 'web_search', WebFetch: 'web_fetch' };

/** Mirrors the app's report limits in src/lib/server/chat/limits.ts; limits.test.ts compares them. */
export const REPORT_LIMITS = {
	eventsPerReport: 100,
	textEventMaxLength: 20_000,
	queryMaxLength: 2_000,
};

const RUNNER_TIMING = {
	heartbeatMs: 20_000,
	turnTimeoutMs: 10 * 60_000,
	maxBackoffMs: 30_000,
	requestTimeoutMs: 15_000,
	// The app holds a claim open for its own polling window, so this only bounds a hung connection.
	claimTimeoutMs: 60_000,
	reportAttempts: 3,
};

function textChunks(text) {
	const chunks = [];
	for (let start = 0; start < text.length; start += REPORT_LIMITS.textEventMaxLength) {
		chunks.push(text.slice(start, start + REPORT_LIMITS.textEventMaxLength));
	}
	return chunks;
}

function toolQuery(value) {
	return typeof value === 'string' && value.length > 0
		? value.slice(0, REPORT_LIMITS.queryMaxLength)
		: null;
}

function assistantBlockEvents(block) {
	if (block?.type === 'text' && typeof block.text === 'string') {
		return textChunks(block.text).map((text) => ({ type: RUNNER_EVENT.text, text }));
	}
	if (block?.type !== 'tool_use' || typeof block.name !== 'string') {
		return [];
	}
	if (block.name === 'WebSearch') {
		return [
			{
				type: RUNNER_EVENT.tool,
				name: WEB_TOOL_EVENT_NAMES.WebSearch,
				query: toolQuery(block.input?.query),
			},
		];
	}
	if (block.name === 'WebFetch') {
		return [
			{
				type: RUNNER_EVENT.tool,
				name: WEB_TOOL_EVENT_NAMES.WebFetch,
				query: toolQuery(block.input?.url),
			},
		];
	}
	return [];
}

/**
 * Turns one line of `claude -p --output-format stream-json` output into the chat events it adds
 * and, for the final result line, the job's final status. App tool calls are skipped because the
 * app records them itself when Claude Code calls its MCP server.
 */
export function readClaudeStreamLine(line) {
	let message;
	try {
		message = JSON.parse(line);
	} catch {
		return { events: [], finalStatus: null };
	}
	if (message?.type === 'result') {
		return {
			events: [],
			finalStatus:
				message.is_error === true ? RUNNER_FINAL_STATUS.failed : RUNNER_FINAL_STATUS.done,
		};
	}
	if (message?.type === 'assistant' && Array.isArray(message.message?.content)) {
		return { events: message.message.content.flatMap(assistantBlockEvents), finalStatus: null };
	}
	return { events: [], finalStatus: null };
}

/** `claude -p` arguments for one job; the prompt itself goes on stdin. */
export function claudeArguments({ model, mcpConfigPath, systemPromptPath }) {
	return [
		'-p',
		'--output-format',
		'stream-json',
		'--verbose',
		'--model',
		model,
		'--setting-sources',
		'',
		'--strict-mcp-config',
		'--mcp-config',
		mcpConfigPath,
		'--tools',
		'WebSearch,WebFetch',
		'--allowedTools',
		`mcp__${APP_MCP_SERVER}`,
		'WebSearch',
		'WebFetch',
		'--permission-mode',
		'dontAsk',
		'--disable-slash-commands',
		'--no-session-persistence',
		'--system-prompt-file',
		systemPromptPath,
	];
}

function log(message) {
	console.log(`${new Date().toISOString().slice(11, 19)} ${message}`);
}

function oneLine(text, maxLength = 100) {
	const flattened = text.replace(/\s+/g, ' ').trim();
	return flattened.length > maxLength ? `${flattened.slice(0, maxLength)}…` : flattened;
}

function eventLogLine(event) {
	return event.type === RUNNER_EVENT.text
		? `text: ${oneLine(event.text)}`
		: `${event.name}: ${event.query ?? ''}`;
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const WINDOWS_BATCH_SCRIPT = /\.(cmd|bat)$/i;

/**
 * The .cmd or .bat script `claudeBin` names or, on Windows, the one a bare name resolves to on
 * the PATH when no executable does; null when it starts an executable. Node runs such a script
 * only through a shell, which would re-parse the prompt paths and arguments.
 */
export function windowsBatchScriptFor(
	claudeBin,
	{
		platform = process.platform,
		searchPath = process.env.PATH ?? '',
		fileExists = existsSync,
	} = {},
) {
	if (WINDOWS_BATCH_SCRIPT.test(claudeBin)) {
		return claudeBin;
	}
	if (platform !== 'win32' || extname(claudeBin) !== '' || /[\\/]/.test(claudeBin)) {
		return null;
	}
	const directories = searchPath.split(';').filter(Boolean);
	const resolves = (extensions) =>
		directories
			.flatMap((directory) =>
				extensions.map((extension) => join(directory, claudeBin + extension)),
			)
			.find((candidate) => fileExists(candidate)) ?? null;
	return resolves(['.com', '.exe']) === null ? resolves(['.cmd', '.bat']) : null;
}

function readRunnerConfig() {
	const secret = process.env.CHAT_RUNNER_SECRET?.trim() ?? '';
	if (secret === '') {
		throw new Error('CHAT_RUNNER_SECRET is missing; put it in .env.chat-runner.');
	}
	const claudeBin = process.env.CLAUDE_BIN?.trim() || 'claude';
	const batchScript = windowsBatchScriptFor(claudeBin);
	if (batchScript !== null) {
		throw new Error(
			`${batchScript} is a batch script, which the runner cannot start without a shell. Set CLAUDE_BIN to the path of claude.exe.`,
		);
	}
	return {
		appUrl: (process.env.CHAT_RUNNER_URL?.trim() || 'https://prejemesi.cz').replace(/\/+$/, ''),
		secret,
		claudeBin,
	};
}

function killProcessTree(child) {
	if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
		return;
	}
	if (process.platform === 'win32') {
		spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
	} else {
		try {
			process.kill(-child.pid, 'SIGKILL');
		} catch {
			child.kill('SIGKILL');
		}
	}
}

/**
 * Sends a job's events in order; tells `onCancelled` when the app no longer wants the job. Each
 * report carries the next number, and its retries repeat it, so the app applies it only once.
 */
export function createJobReporter({ appUrl, job, onCancelled }) {
	const eventsUrl = `${appUrl}/chat-runner/jobs/${job.id}/events`;
	let queue = Promise.resolve();
	let cancelled = false;
	let lastSequence = 0;

	async function post(report) {
		lastSequence += 1;
		const body = { sequence: lastSequence, ...report };
		for (let attempt = 1; attempt <= RUNNER_TIMING.reportAttempts; attempt += 1) {
			try {
				const response = await fetch(eventsUrl, {
					method: 'POST',
					headers: {
						authorization: `Bearer ${job.token}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify(body),
					signal: AbortSignal.timeout(RUNNER_TIMING.requestTimeoutMs),
				});
				if (response.ok) {
					const answer = await response.json();
					return answer?.cancelled === true;
				}
				// The app forgets a job's token once it ended the job itself.
				if (response.status === 401 || response.status === 404) {
					return true;
				}
				log(`[${job.id}] report answered ${response.status}`);
			} catch (error) {
				log(`[${job.id}] report failed: ${error instanceof Error ? error.message : error}`);
			}
			await delay(attempt * 1_000);
		}
		return false;
	}

	async function send(events, status) {
		if (cancelled) {
			return;
		}
		const batches = [];
		for (let start = 0; start < events.length; start += REPORT_LIMITS.eventsPerReport) {
			batches.push(events.slice(start, start + REPORT_LIMITS.eventsPerReport));
		}
		if (batches.length === 0) {
			batches.push([]);
		}
		for (const [index, batch] of batches.entries()) {
			const isLastBatch = index === batches.length - 1;
			const wasCancelled = await post(
				isLastBatch && status !== undefined ? { events: batch, status } : { events: batch },
			);
			if (wasCancelled) {
				cancelled = true;
				onCancelled();
				return;
			}
		}
	}

	return {
		/** Queues a report; an empty one is a heartbeat. */
		report(events, status) {
			queue = queue.then(() => send(events, status));
			return queue;
		},
		get cancelled() {
			return cancelled;
		},
	};
}

/** Runs one claimed job to its end and reports its final status. */
async function runJob(config, job, runState) {
	const workDirectory = await mkdtemp(join(tmpdir(), 'prejemesi-chat-runner-'));
	const mcpConfigPath = join(workDirectory, 'mcp.json');
	const systemPromptPath = join(workDirectory, 'system-prompt.md');
	let child = null;
	let heartbeat = null;
	let timeout = null;
	try {
		await writeFile(
			mcpConfigPath,
			JSON.stringify({
				mcpServers: {
					[APP_MCP_SERVER]: {
						type: 'http',
						url: job.mcpUrl,
						headers: { Authorization: `Bearer ${job.token}` },
					},
				},
			}),
		);
		await writeFile(systemPromptPath, job.systemPrompt);

		let stopReason = null;
		const stop = (reason) => {
			if (stopReason === null) {
				stopReason = reason;
				if (child !== null) {
					killProcessTree(child);
				}
			}
		};
		const reporter = createJobReporter({
			appUrl: config.appUrl,
			job,
			onCancelled: () => stop('cancelled'),
		});
		runState.stopCurrentJob = stop;
		if (runState.stopping) {
			stop('stopped');
		}

		child = spawn(
			config.claudeBin,
			claudeArguments({ model: job.model, mcpConfigPath, systemPromptPath }),
			{
				cwd: workDirectory,
				stdio: ['pipe', 'pipe', 'pipe'],
				windowsHide: true,
				detached: process.platform !== 'win32',
			},
		);
		if (stopReason !== null) {
			killProcessTree(child);
		}
		const exited = new Promise((resolve) => {
			child.once('error', (error) => resolve({ code: null, error }));
			child.once('close', (code) => resolve({ code, error: null }));
		});
		child.stdin.on('error', () => {});
		child.stdin.end(job.prompt);
		let stderrTail = '';
		child.stderr.on('data', (chunk) => {
			stderrTail = (stderrTail + chunk.toString()).slice(-2_000);
		});

		heartbeat = setInterval(() => void reporter.report([]), RUNNER_TIMING.heartbeatMs);
		timeout = setTimeout(() => stop('timeout'), RUNNER_TIMING.turnTimeoutMs);

		let finalStatus = null;
		for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
			const update = readClaudeStreamLine(line);
			for (const event of update.events) {
				log(`[${job.id}] ${eventLogLine(event)}`);
			}
			if (update.events.length > 0) {
				void reporter.report(update.events);
			}
			finalStatus = update.finalStatus ?? finalStatus;
		}
		const exit = await exited;
		clearInterval(heartbeat);
		clearTimeout(timeout);

		if (stopReason === 'cancelled' || reporter.cancelled) {
			log(`[${job.id}] cancelled in the app`);
			return;
		}
		if (exit.error !== null) {
			log(`[${job.id}] could not start ${config.claudeBin}: ${exit.error.message}`);
		} else if (exit.code !== 0 && stopReason === null) {
			log(`[${job.id}] claude exited with ${exit.code}: ${oneLine(stderrTail, 300)}`);
		}
		const succeeded =
			stopReason === null &&
			exit.error === null &&
			exit.code === 0 &&
			finalStatus === RUNNER_FINAL_STATUS.done;
		const status = succeeded ? RUNNER_FINAL_STATUS.done : RUNNER_FINAL_STATUS.failed;
		await reporter.report([], status);
		log(`[${job.id}] ${stopReason ?? status}`);
	} finally {
		clearInterval(heartbeat);
		clearTimeout(timeout);
		runState.stopCurrentJob = null;
		await rm(workDirectory, { recursive: true, force: true }).catch(() => {});
	}
}

const RUNNER_SETUP_ERROR = {
	401: 'The app refused CHAT_RUNNER_SECRET; it differs from the app’s secret.',
	404: 'The app has no CHAT_RUNNER_SECRET set, so it accepts no runner.',
};

/** A setup mistake that retrying cannot fix. */
class RunnerSetupError extends Error {}

/** Long-polls the app for the next job; null when there is none yet. */
async function claimJob(config, signal) {
	const response = await fetch(`${config.appUrl}/chat-runner/claim`, {
		method: 'POST',
		headers: { authorization: `Bearer ${config.secret}` },
		signal: AbortSignal.any([signal, AbortSignal.timeout(RUNNER_TIMING.claimTimeoutMs)]),
	});
	if (response.status === 204) {
		return null;
	}
	if (response.ok) {
		return response.json();
	}
	const setupError = RUNNER_SETUP_ERROR[response.status];
	if (setupError !== undefined) {
		throw new RunnerSetupError(setupError);
	}
	throw new Error(`The claim answered ${response.status}`);
}

async function main() {
	const config = readRunnerConfig();
	const runState = { stopping: false, stopCurrentJob: null };
	const claimAbort = new AbortController();
	process.on('SIGINT', () => {
		if (runState.stopping) {
			process.exit(130);
		}
		log('Stopping…');
		runState.stopping = true;
		claimAbort.abort();
		runState.stopCurrentJob?.('stopped');
	});

	log(`Chat runner answering ${config.appUrl} with ${config.claudeBin}. Ctrl+C stops it.`);
	let backoffMs = 1_000;
	while (!runState.stopping) {
		let job;
		try {
			job = await claimJob(config, claimAbort.signal);
			backoffMs = 1_000;
		} catch (error) {
			if (runState.stopping) {
				break;
			}
			if (error instanceof RunnerSetupError) {
				log(error.message);
				process.exitCode = 1;
				break;
			}
			log(
				`Claim failed (${error instanceof Error ? error.message : error}); retrying in ${backoffMs / 1000} s`,
			);
			await delay(backoffMs);
			backoffMs = Math.min(backoffMs * 2, RUNNER_TIMING.maxBackoffMs);
			continue;
		}
		if (job === null) {
			continue;
		}
		log(`[${job.id}] claimed, ${job.model}`);
		try {
			await runJob(config, job, runState);
		} catch (error) {
			log(`[${job.id}] runner error: ${error instanceof Error ? error.message : error}`);
		}
	}
	log('Stopped.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
