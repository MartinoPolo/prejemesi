import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { CHAT_TOOL_KIND } from '$lib/modules/chat/chat_thread.js';
import {
	CHAT_TOOL_ERROR_REASON_MAX_LENGTH,
	chatToolDuration,
	chatToolErrorMessage,
	chatToolErrorReason,
	chatToolLabel,
	composerMaxLines,
} from './chat_presentation.js';

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

describe('chatToolErrorReason', () => {
	it('names a known failure in its own words', () => {
		expect(
			chatToolErrorReason({ code: 'BROWSER_LIMIT_REACHED', message: 'The browser…' }),
		).toBe(m.chat_tool_error_browser_limit());
		expect(chatToolErrorReason({ code: 'url_not_accessible', message: null })).toBe(
			m.chat_tool_error_page_unavailable(),
		);
	});

	it('shows the tool message for an unknown failure', () => {
		expect(chatToolErrorReason({ code: 'NOT_FOUND', message: 'Dárek nebyl nalezen.' })).toBe(
			'Dárek nebyl nalezen.',
		);
	});

	it('shows a generic failure when the tool names neither a known code nor a message', () => {
		expect(chatToolErrorReason({ code: null, message: null })).toBe(
			m.chat_tool_error_generic(),
		);
	});

	it('cuts a long tool message to the limit, ellipsis included', () => {
		const reason = chatToolErrorReason({ code: null, message: 'x'.repeat(500) });

		expect(reason).toHaveLength(CHAT_TOOL_ERROR_REASON_MAX_LENGTH);
		expect(reason.endsWith('…')).toBe(true);
	});
});

describe('chatToolErrorMessage', () => {
	it('adds the tool message when a known code shows its own reason', () => {
		expect(
			chatToolErrorMessage({ code: 'unavailable', message: 'Upstream search failed' }),
		).toBe('Upstream search failed');
	});

	it('omits the tool message the reason already shows', () => {
		expect(
			chatToolErrorMessage({ code: 'GIFT_NOT_FOUND', message: 'Dárek nebyl nalezen' }),
		).toBeNull();
		expect(chatToolErrorMessage({ code: null, message: 'x'.repeat(500) })).toBeNull();
		expect(chatToolErrorMessage({ code: 'unavailable', message: null })).toBeNull();
	});
});

describe('chatToolDuration', () => {
	it.each([
		[0, '0 ms'],
		[12.4, '12 ms'],
		[999, '999 ms'],
	])('shows %f ms under a second as whole milliseconds', (durationMs, text) => {
		expect(chatToolDuration(durationMs)).toBe(text);
	});

	it.each([
		[999.6, '1,0 s'],
		[1234, '1,2 s'],
		[61_000, '61,0 s'],
	])('shows %f ms from a second up as seconds to one decimal', (durationMs, text) => {
		expect(chatToolDuration(durationMs)).toBe(text);
	});
});
