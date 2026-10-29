import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import type { PluralMessages } from '$lib/modules/change_proposals/change_review_copy.js';
import { CHAT_TOOL_KIND, type ChatToolLine } from '$lib/modules/chat/chat_thread.js';

/** The controls a proposal card hands to the decision bar; compared by identity on release. */
export interface DecisionBarControls {
	render: Snippet;
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
