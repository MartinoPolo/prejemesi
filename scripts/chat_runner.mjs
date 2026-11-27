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

export const RUNNER_EVENT = { text: 'text', tool: 'tool', toolResult: 'toolResult' };
export const RUNNER_FINAL_STATUS = { done: 'done', failed: 'failed' };
/** Mirror the app's tool outcome values in src/lib/modules/chat/types.ts; limits.test.ts checks. */
export const RUNNER_TOOL_STATUS = { ok: 'ok', error: 'error' };
export const RUNNER_TOOL_SUMMARY = { page: 'page', searchResults: 'searchResults' };

/** The app's MCP server name; its tool calls reach the chat through MCP, not the event stream. */
const APP_MCP_SERVER = 'prejemesi';
const APP_MCP_TOOL_PREFIX = `mcp__${APP_MCP_SERVER}__`;
const WEB_TOOLS = {
	WebSearch: { eventName: 'web_search', queryField: 'query' },
	WebFetch: { eventName: 'web_fetch', queryField: 'url' },
};

/** Mirrors the app's report limits in src/lib/server/chat/limits.ts; limits.test.ts compares them. */
export const REPORT_LIMITS = {
	eventsPerReport: 100,
	textEventMaxLength: 20_000,
	queryMaxLength: 2_000,
	toolErrorMaxLength: 500,
	debugTextMaxLength: 2_000,
	/** The app fails a job it has not heard from for this long. */
	heartbeatTimeoutMs: 90_000,
};

const RUNNER_TIMING = {
	heartbeatMs: 20_000,
	turnTimeoutMs: 10 * 60_000,
	maxBackoffMs: 30_000,
	// The app holds a claim open for its own polling window, so this only bounds a hung connection.
	claimTimeoutMs: 60_000,
};

/**
 * How a report that failed in transit is retried: with doubling waits, until the app would have
 * failed the silent job anyway.
 */
const REPORT_RETRY = {
	requestTimeoutMs: 15_000,
	firstDelayMs: 1_000,
	maxDelayMs: 10_000,
	giveUpAfterMs: REPORT_LIMITS.heartbeatTimeoutMs,
};

/** Why the reporter stopped a job. */
export const REPORT_STOP_REASON = { cancelled: 'cancelled', appUnreachable: 'app unreachable' };

const REPORT_OUTCOME = { running: 'running', retry: 'retry', ...REPORT_STOP_REASON };

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

function truncated(text, maxLength) {
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function oneLine(text, maxLength = 100) {
	return truncated(text.replace(/\s+/g, ' ').trim(), maxLength);
}

/** A tool result's text: a string, or the text items of a content list. */
function toolResultText(content) {
	if (typeof content === 'string') {
		return content;
	}
	return Array.isArray(content)
		? content
				.filter((item) => item?.type === 'text' && typeof item.text === 'string')
				.map((item) => item.text)
				.join('\n')
		: '';
}

/** The links a WebSearch result lists, or null when its format names none. */
function searchResultCount(text) {
	const count = text.match(/"url":/g)?.length ?? 0;
	return count === 0 ? null : count;
}

function webToolSummary(eventName, text) {
	if (eventName === WEB_TOOLS.WebFetch.eventName) {
		return { kind: RUNNER_TOOL_SUMMARY.page, characters: text.length, truncated: false };
	}
	const count = searchResultCount(text);
	return count === null ? null : { kind: RUNNER_TOOL_SUMMARY.searchResults, count };
}

function toolLabel(name) {
	return name.startsWith(APP_MCP_TOOL_PREFIX) ? name.slice(APP_MCP_TOOL_PREFIX.length) : name;
}

const NO_UPDATE = { events: [], logLines: [] };

/**
 * Reads `claude -p --output-format stream-json` output line by line into the chat events each
 * line adds, the lines it logs and, for the final result line, the job's final status. Web
 * searches and page reads are reported with their outcome when the app accepts outcomes
 * (`reportsToolOutcomes` from the claim); app tool calls are only logged, because the app records
 * them, with their outcome, itself when Claude Code calls its MCP server.
 */
export function createClaudeStreamReader({ reportsToolOutcomes = false, now = Date.now } = {}) {
	/** Tool calls awaiting their result, by `tool_use` id. */
	const startedTools = new Map();

	function toolUse(block) {
		const webTool = WEB_TOOLS[block.name];
		const input = block.input ?? {};
		const query = webTool === undefined ? null : toolQuery(input[webTool.queryField]);
		if (typeof block.id === 'string') {
			startedTools.set(block.id, { block, webTool, query, startedAt: now() });
		}
		if (webTool === undefined) {
			return {
				events: [],
				logLines: [`${toolLabel(block.name)}: ${oneLine(JSON.stringify(input))}`],
			};
		}
		const event = { type: RUNNER_EVENT.tool, name: webTool.eventName, query };
		return {
			events: [
				reportsToolOutcomes && typeof block.id === 'string'
					? { ...event, id: block.id }
					: event,
			],
			logLines: [`${webTool.eventName}: ${query ?? ''}`],
		};
	}

	function toolResult(block) {
		const started = startedTools.get(block.tool_use_id);
		if (started === undefined) {
			return NO_UPDATE;
		}
		startedTools.delete(block.tool_use_id);
		const isError = block.is_error === true;
		const text = toolResultText(block.content);
		const durationMs = Math.max(0, now() - started.startedAt);
		const label = started.webTool?.eventName ?? toolLabel(started.block.name);
		const logLine = isError
			? `${label} failed: ${oneLine(text, 300)}`
			: `${label} done in ${(durationMs / 1000).toFixed(1)} s`;
		if (started.webTool === undefined || !reportsToolOutcomes) {
			return { events: [], logLines: [logLine] };
		}
		const event = {
			type: RUNNER_EVENT.toolResult,
			id: block.tool_use_id,
			name: started.webTool.eventName,
			query: started.query,
			status: isError ? RUNNER_TOOL_STATUS.error : RUNNER_TOOL_STATUS.ok,
			error: isError
				? { code: null, message: oneLine(text, REPORT_LIMITS.toolErrorMaxLength) }
				: null,
			durationMs,
			summary: isError ? null : webToolSummary(started.webTool.eventName, text),
			debug: {
				input: truncated(
					JSON.stringify(started.block.input ?? {}, null, 2),
					REPORT_LIMITS.debugTextMaxLength,
				),
				result: truncated(text, REPORT_LIMITS.debugTextMaxLength),
			},
		};
		return { events: [event], logLines: [logLine] };
	}

	function assistantBlock(block) {
		if (block?.type === 'text' && typeof block.text === 'string') {
			return {
				events: textChunks(block.text).map((text) => ({ type: RUNNER_EVENT.text, text })),
				logLines: [`text: ${oneLine(block.text)}`],
			};
		}
		return block?.type === 'tool_use' && typeof block.name === 'string'
			? toolUse(block)
			: NO_UPDATE;
	}

	function userBlock(block) {
		return block?.type === 'tool_result' && typeof block.tool_use_id === 'string'
			? toolResult(block)
			: NO_UPDATE;
	}

	function contentUpdate(content, readBlock) {
		const updates = content.map(readBlock);
		return {
			events: updates.flatMap((update) => update.events),
			logLines: updates.flatMap((update) => update.logLines),
			finalStatus: null,
		};
	}

	return {
		read(line) {
			let message;
			try {
				message = JSON.parse(line);
			} catch {
				return { ...NO_UPDATE, finalStatus: null };
			}
			if (message?.type === 'result') {
				return {
					...NO_UPDATE,
					finalStatus:
						message.is_error === true
							? RUNNER_FINAL_STATUS.failed
							: RUNNER_FINAL_STATUS.done,
				};
			}
			const content = message?.message?.content;
			if (message?.type === 'assistant' && Array.isArray(content)) {
				return contentUpdate(content, assistantBlock);
			}
			if (message?.type === 'user' && Array.isArray(content)) {
				return contentUpdate(content, userBlock);
			}
			return { ...NO_UPDATE, finalStatus: null };
		},
	};
}

/** A reader for a claimed job: an app that sends no `reportsToolOutcomes` takes no outcomes. */
export function claudeStreamReaderFor(job) {
	return createClaudeStreamReader({ reportsToolOutcomes: job.reportsToolOutcomes === true });
}

/** Claude Code ranks `CLAUDE_CODE_EFFORT_LEVEL` above `--effort`, so it would mask the chat's choice. */
export function claudeEnvironment(environment) {
	const { CLAUDE_CODE_EFFORT_LEVEL: _maskingEffort, ...rest } = environment;
	return rest;
}

/**
 * `claude -p` arguments for one job; the prompt itself goes on stdin. An app released before the
 * effort choice names none, so the model keeps its default effort.
 */
export function claudeArguments({ model, effort, mcpConfigPath, systemPromptPath }) {
	return [
		'-p',
		'--output-format',
		'stream-json',
		'--verbose',
		'--model',
		model,
		...(effort === undefined ? [] : ['--effort', effort]),
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

/** Node's fetch reports every network failure as "fetch failed", with the reason as its cause. */
function failureMessage(error) {
	if (!(error instanceof Error)) {
		return String(error);
	}
	const cause = error.cause instanceof Error ? (error.cause.code ?? error.cause.message) : null;
	return cause === null ? error.message : `${error.message} (${cause})`;
}

function isTransientStatus(status) {
	return status === 408 || status === 429 || status >= 500;
}

/**
 * Sends a job's events in order; tells `onStop` when the app no longer wants the job or stayed
 * unreachable for as long as it waits for a silent job. Each report carries the next number and
 * its retries repeat it, so the app applies a report that arrived only once, even when its
 * answer was lost.
 */
export function createJobReporter({ appUrl, job, onStop, retry = REPORT_RETRY }) {
	const eventsUrl = `${appUrl}/chat-runner/jobs/${job.id}/events`;
	let queue = Promise.resolve();
	let stopReason = null;
	let lastSequence = 0;

	async function postOnce(body) {
		try {
			const response = await fetch(eventsUrl, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${job.token}`,
					'content-type': 'application/json',
				},
				body,
				signal: AbortSignal.timeout(retry.requestTimeoutMs),
			});
			if (response.ok) {
				const answer = await response.json();
				return answer?.cancelled === true
					? REPORT_OUTCOME.cancelled
					: REPORT_OUTCOME.running;
			}
			// The app forgets a job's token once it ended the job itself.
			if (response.status === 401 || response.status === 404) {
				return REPORT_OUTCOME.cancelled;
			}
			if (isTransientStatus(response.status)) {
				log(`[${job.id}] report answered ${response.status}`);
				return REPORT_OUTCOME.retry;
			}
			// Sending the same report again cannot change the answer.
			log(`[${job.id}] report refused with ${response.status}; skipping it`);
			return REPORT_OUTCOME.running;
		} catch (error) {
			log(`[${job.id}] report failed: ${failureMessage(error)}`);
			return REPORT_OUTCOME.retry;
		}
	}

	async function post(report) {
		lastSequence += 1;
		const body = JSON.stringify({ sequence: lastSequence, ...report });
		const giveUpAt = Date.now() + retry.giveUpAfterMs;
		let delayMs = retry.firstDelayMs;
		while (true) {
			const outcome = await postOnce(body);
			if (outcome !== REPORT_OUTCOME.retry) {
				return outcome;
			}
			if (Date.now() + delayMs >= giveUpAt) {
				log(`[${job.id}] the app stayed unreachable; stopping the job`);
				return REPORT_OUTCOME.appUnreachable;
			}
			await delay(delayMs);
			delayMs = Math.min(delayMs * 2, retry.maxDelayMs);
		}
	}

	async function send(events, status) {
		if (stopReason !== null) {
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
			const outcome = await post(
				isLastBatch && status !== undefined ? { events: batch, status } : { events: batch },
			);
			if (outcome !== REPORT_OUTCOME.running) {
				stopReason = outcome;
				onStop(outcome);
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
		/** A `REPORT_STOP_REASON` once the reporter stopped the job, otherwise null. */
		get stopReason() {
			return stopReason;
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
			onStop: stop,
		});
		runState.stopCurrentJob = stop;
		if (runState.stopping) {
			stop('stopped');
		}

		child = spawn(
			config.claudeBin,
			claudeArguments({
				model: job.model,
				effort: job.effort,
				mcpConfigPath,
				systemPromptPath,
			}),
			{
				cwd: workDirectory,
				env: claudeEnvironment(process.env),
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
		const streamReader = claudeStreamReaderFor(job);
		for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
			const update = streamReader.read(line);
			for (const logLine of update.logLines) {
				log(`[${job.id}] ${logLine}`);
			}
			if (update.events.length > 0) {
				void reporter.report(update.events);
			}
			finalStatus = update.finalStatus ?? finalStatus;
		}
		const exit = await exited;
		clearInterval(heartbeat);
		clearTimeout(timeout);

		if (reporter.stopReason === REPORT_STOP_REASON.cancelled) {
			log(`[${job.id}] cancelled in the app`);
			return;
		}
		// The app has failed the silent job by now, so no final status would reach it.
		if (reporter.stopReason === REPORT_STOP_REASON.appUnreachable) {
			log(`[${job.id}] stopped: the app stayed unreachable`);
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
		log(`[${job.id}] claimed, ${[job.model, job.effort].filter(Boolean).join(' ')}`);
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
