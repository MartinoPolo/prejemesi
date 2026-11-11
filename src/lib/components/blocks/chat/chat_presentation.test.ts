import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { CHAT_TOOL_KIND } from '$lib/modules/chat/chat_thread.js';
import { chatToolLabel, composerMaxLines } from './chat_presentation.js';

// Caps from the approved mobile keyboard design (designs/mobile-keyboard/refined.html).
describe('composerMaxLines', () => {
	it.each([
		[584, 4],
		[400, 4],
		[399, 3],
		[320, 3],
		[319, 2],
		[180, 2],
	])('caps the composer at the lines that fit in %ipx above the keyboard', (height, lines) => {
		expect(composerMaxLines(height)).toBe(lines);
	});
});

describe('chatToolLabel', () => {
	it('names a read web page by its host', () => {
		expect(
			chatToolLabel({
				kind: CHAT_TOOL_KIND.fetch,
				query: 'https://www.alza.cz/lego-technic?dq=1',
			}),
		).toBe(m.chat_tool_fetch({ page: 'www.alza.cz' }));
		expect(chatToolLabel({ kind: CHAT_TOOL_KIND.fetch, query: null })).toBe(
			m.chat_tool_fetch_plain(),
		);
	});
});
