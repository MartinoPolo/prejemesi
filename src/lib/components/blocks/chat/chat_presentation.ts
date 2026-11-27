import type { Snippet } from 'svelte';
import ImageIcon from '@lucide/svelte/icons/image';
import LinkIcon from '@lucide/svelte/icons/link';
import ListIcon from '@lucide/svelte/icons/list';
import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { PluralMessages } from '$lib/modules/change_proposals/change_review_copy.js';
import { CHAT_TOOL_KIND, type ChatToolLine } from '$lib/modules/chat/chat_thread.js';
import {
	CHAT_TOOL_SUMMARY,
	type ChatToolError,
	type ChatToolSummary,
} from '$lib/modules/chat/types.js';

/**
 * The controls a proposal card hands to the decision bar; compared by identity on release. The
 * bar folds to one line while the on-screen keyboard is open.
 */
export interface DecisionBarControls {
	render: Snippet<[compact: boolean]>;
}

/** An empty chat's starters: cards in the thread, or chips above the composer while typing. */
export const CHAT_STARTERS = [
	{ icon: ImageIcon, label: m.chat_starter_enrich, prompt: m.chat_starter_enrich_prompt },
	{ icon: LinkIcon, label: m.chat_starter_add, prompt: m.chat_starter_add_prompt },
	{ icon: ListIcon, label: m.chat_starter_bulk, prompt: m.chat_starter_bulk_prompt },
];

/** Composer line caps by the minimum height above the keyboard, tallest first. */
const COMPOSER_LINE_CAPS = [
	{ minimumVisibleHeight: 400, lines: 4 },
	{ minimumVisibleHeight: 320, lines: 3 },
	{ minimumVisibleHeight: 0, lines: 2 },
] as const;

/** How many lines the composer grows to before it scrolls, from the height above the keyboard. */
export function composerMaxLines(visibleHeight: number): number {
	return COMPOSER_LINE_CAPS.find((cap) => visibleHeight >= cap.minimumVisibleHeight)?.lines ?? 2;
}

export const PROPOSAL_TITLES: PluralMessages = {
	one: m.chat_proposal_title_one,
	few: m.chat_proposal_title_few,
	other: m.chat_proposal_title_other,
};

export const APPLIED_TITLES: PluralMessages = {
	one: m.chat_applied_title_one,
	few: m.chat_applied_title_few,
	other: m.chat_applied_title_other,
};

/** Proposals with more gifts than this are checked on the review page rather than inline. */
export const INLINE_CHECK_MAX_ROWS = 5;

/** A page by its host, which reads shorter than the whole address. */
function pageName(url: string): string {
	try {
		return new URL(url).host || url;
	} catch {
		return url;
	}
}

export function chatToolLabel(line: Pick<ChatToolLine, 'kind' | 'query'>): string {
	switch (line.kind) {
		case CHAT_TOOL_KIND.search:
			return line.query === null
				? m.chat_tool_search_plain()
				: m.chat_tool_search({ query: line.query });
		case CHAT_TOOL_KIND.fetch:
			return line.query === null
				? m.chat_tool_fetch_plain()
				: m.chat_tool_fetch({ page: pageName(line.query) });
		case CHAT_TOOL_KIND.read:
			return m.chat_tool_read();
		case CHAT_TOOL_KIND.change:
			return m.chat_tool_change();
	}
}

/**
 * Short reasons for the failures a tool line names: the app's page browser codes and the model
 * provider's web tool codes.
 */
const TOOL_ERROR_REASONS: Readonly<Record<string, () => string>> = {
	BROWSER_LIMIT_REACHED: m.chat_tool_error_browser_limit,
	BROWSER_DAILY_LIMIT_REACHED: m.chat_tool_error_browser_daily_limit,
	PAGE_TIMED_OUT: m.chat_tool_error_page_timeout,
	PAGE_NOT_LOADED: m.chat_tool_error_page_unavailable,
	URL_NOT_ALLOWED: m.chat_tool_error_url_not_allowed,
	URL_NOT_IN_CONVERSATION: m.chat_tool_error_url_not_in_conversation,
	url_not_accessible: m.chat_tool_error_page_unavailable,
	url_not_allowed: m.chat_tool_error_url_not_allowed,
	url_too_long: m.chat_tool_error_url_not_allowed,
	too_many_requests: m.chat_tool_error_rate_limited,
	max_uses_exceeded: m.chat_tool_error_max_uses,
	unavailable: m.chat_tool_error_unavailable,
	unsupported_content_type: m.chat_tool_error_unsupported_content,
};

/** A tool message shown as the reason is cut to this length, ellipsis included. */
export const CHAT_TOOL_ERROR_REASON_MAX_LENGTH = 120;

function normalizedToolMessage(error: ChatToolError | null): string {
	return error?.message?.replace(/\s+/g, ' ').trim() ?? '';
}

function knownToolErrorReason(error: ChatToolError | null): (() => string) | undefined {
	return error?.code == null ? undefined : TOOL_ERROR_REASONS[error.code];
}

/** A known code's own reason, else the tool's message, else a generic failure. */
export function chatToolErrorReason(error: ChatToolError | null): string {
	const known = knownToolErrorReason(error);
	if (known !== undefined) {
		return known();
	}
	const message = normalizedToolMessage(error);
	if (message === '') {
		return m.chat_tool_error_generic();
	}
	return message.length > CHAT_TOOL_ERROR_REASON_MAX_LENGTH
		? `${message.slice(0, CHAT_TOOL_ERROR_REASON_MAX_LENGTH - 1)}…`
		: message;
}

/**
 * The tool's own message when the reason is a known code's own words that differ from it; a
 * reason taken from the message already shows it.
 */
export function chatToolErrorMessage(error: ChatToolError | null): string | null {
	const message = normalizedToolMessage(error);
	const known = knownToolErrorReason(error);
	return message === '' || known === undefined || message === known() ? null : message;
}

function formattedNumber(value: number, fractionDigits = 0): string {
	return new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(value);
}

/** Whole milliseconds under a second, else seconds to one decimal. */
export function chatToolDuration(durationMs: number): string {
	const milliseconds = Math.round(durationMs);
	return milliseconds < 1000
		? m.chat_tool_duration_milliseconds({ milliseconds: formattedNumber(milliseconds) })
		: m.chat_tool_duration({ seconds: formattedNumber(durationMs / 1000, 1) });
}

export function chatToolSummaryText(summary: ChatToolSummary): string {
	switch (summary.kind) {
		case CHAT_TOOL_SUMMARY.page: {
			const characters = formattedNumber(summary.characters);
			return summary.truncated
				? m.chat_tool_summary_page_truncated({ characters })
				: m.chat_tool_summary_page({ characters });
		}
		case CHAT_TOOL_SUMMARY.searchResults:
			return m.chat_tool_summary_search({ count: formattedNumber(summary.count) });
		case CHAT_TOOL_SUMMARY.proposal:
			return summary.applied ? m.chat_tool_summary_applied() : m.chat_tool_summary_proposal();
	}
}
