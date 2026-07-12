import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape_html.js';

describe('escapeHtml', () => {
	it('escapes all HTML special characters', () => {
		expect(escapeHtml(`<script>alert("x&y")</script> 'q'`)).toBe(
			'&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt; &#39;q&#39;',
		);
	});

	it('escapes ampersand first so entities are not double-encoded incorrectly', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('leaves plain text untouched', () => {
		expect(escapeHtml('Vánoce 2026 – seznam přání')).toBe('Vánoce 2026 – seznam přání');
	});
});
