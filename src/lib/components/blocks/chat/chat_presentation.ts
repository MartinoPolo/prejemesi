import type { Snippet } from 'svelte';
import ImageIcon from '@lucide/svelte/icons/image';
import LinkIcon from '@lucide/svelte/icons/link';
import ListIcon from '@lucide/svelte/icons/list';
import * as m from '$lib/paraglide/messages.js';
import type { PluralMessages } from '$lib/modules/change_proposals/change_review_copy.js';
import { CHAT_TOOL_KIND, type ChatToolLine } from '$lib/modules/chat/chat_thread.js';

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

export function chatToolLabel(line: ChatToolLine): string {
	switch (line.kind) {
		case CHAT_TOOL_KIND.search:
			return line.query === null
				? m.chat_tool_search_plain()
				: m.chat_tool_search({ query: line.query });
		case CHAT_TOOL_KIND.read:
			return m.chat_tool_read();
		case CHAT_TOOL_KIND.change:
			return m.chat_tool_change();
	}
}
