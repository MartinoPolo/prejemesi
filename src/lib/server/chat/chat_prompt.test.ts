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
		expect(systemPrompt(CONTEXT, { canBrowsePages: true })).toContain('browse_page');
		expect(systemPrompt(CONTEXT, { canBrowsePages: false })).not.toContain('browse_page');
	});
});
