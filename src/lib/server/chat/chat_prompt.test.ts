import { describe, expect, it } from 'vitest';
import { chatSystemPrompt } from './chat_prompt.js';
import { chatRunnerSystemPrompt } from './chat_runner_prompt.js';

const CONTEXT = {
	wishlistId: 'wishlist-1',
	wishlistShortId: 'short-1',
	wishlistTitle: 'Vánoce',
	userName: 'Martin',
	locale: 'cs',
};

describe.each([
	['chat', chatSystemPrompt],
	['chat runner', chatRunnerSystemPrompt],
])('the %s system prompt', (_label, systemPrompt) => {
	it('mentions browse_page only when the chat offers it', () => {
		expect(
			systemPrompt(CONTEXT, { canBrowsePages: true, requiresConversationAddresses: false }),
		).toContain('browse_page');
		expect(
			systemPrompt(CONTEXT, { canBrowsePages: false, requiresConversationAddresses: false }),
		).not.toContain('browse_page');
	});

	it('names where image addresses must come from only when the chat restricts them', () => {
		const imageAddressSource = "taken from the user's messages";
		expect(
			systemPrompt(CONTEXT, { canBrowsePages: false, requiresConversationAddresses: true }),
		).toContain(imageAddressSource);
		expect(
			systemPrompt(CONTEXT, { canBrowsePages: false, requiresConversationAddresses: false }),
		).not.toContain(imageAddressSource);
	});
});
