import { DAY_MS } from '$lib/server/operations/constants.js';

/**
 * Every limit of the AI assistant. The daily caps bound the model provider's cost; they count
 * the user's messages since midnight in the family's time zone, so a cap resets at 0:00 as the
 * chat says.
 */
export const CHAT_LIMITS = {
	userMessagesPerDay: 50,
	/** Across every user: the bound on one day's provider bill. */
	globalMessagesPerDay: 300,
	/** Model responses within one turn: each tool round trip is one. */
	modelCallsPerTurn: 8,
	maxOutputTokens: 4096,
	/** The most recent stored messages the model sees again on each turn. */
	contextMessages: 40,
	turnTimeoutMs: 120_000,
} as const;

/**
 * The chat runner's timing. The Workers Free plan bounds CPU per invocation, so a turn's stream
 * and the runner's claim each hold one request for a short window only, polling the database.
 */
export const CHAT_RUNNER_LIMITS = {
	/** How long one turn response relays events before handing over to a continuation. */
	relayWindowMs: 20_000,
	relayPollIntervalMs: 1_500,
	/** How long one claim request waits for a pending job. */
	claimWindowMs: 20_000,
	claimPollIntervalMs: 2_000,
	/** A job nobody claimed by then finds the runner offline. */
	runnerOfflineMs: 30_000,
	/** The runner reports at least this often while Claude Code works. */
	heartbeatTimeoutMs: 90_000,
	turnTimeoutMs: 600_000,
	eventsPerReport: 100,
	textEventMaxLength: 20_000,
	/** A reported web search's query or page address. */
	queryMaxLength: 2_000,
} as const;

export type ChatRunnerLimits = { [Limit in keyof typeof CHAT_RUNNER_LIMITS]: number };

/** A chat is deleted this long after its last turn. */
export const CHAT_RETENTION_MS = 30 * DAY_MS;

const CHAT_TIME_ZONE = 'Europe/Prague';

let dateTimeParts: Intl.DateTimeFormat | undefined;

// Built on first use: a time-zone formatter costs Worker CPU at module load even when unused.
function getDateTimeParts(): Intl.DateTimeFormat {
	dateTimeParts ??= new Intl.DateTimeFormat('en-US', {
		timeZone: CHAT_TIME_ZONE,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	});
	return dateTimeParts;
}

/** The wall-clock time in the chat's time zone, read as if it were UTC. */
function wallClockAsUtc(instant: number): number {
	const parts = Object.fromEntries(
		getDateTimeParts()
			.formatToParts(instant)
			.map((part) => [part.type, Number(part.value)]),
	);
	return Date.UTC(
		parts.year ?? 0,
		(parts.month ?? 1) - 1,
		parts.day ?? 1,
		parts.hour ?? 0,
		parts.minute ?? 0,
		parts.second ?? 0,
	);
}

/** Midnight of `now`'s day in the chat's time zone, the start of the daily caps. */
export function chatDayStart(now: Date): Date {
	const wallClock = wallClockAsUtc(now.getTime());
	const wallMidnight = wallClock - (wallClock % DAY_MS);
	const offsetNow = wallClock - now.getTime();
	const guess = wallMidnight - offsetNow;
	// A daylight saving switch between midnight and now changes the offset once more.
	const offsetAtMidnight = wallClockAsUtc(guess) - guess;
	return new Date(wallMidnight - offsetAtMidnight);
}
