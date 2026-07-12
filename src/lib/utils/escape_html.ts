/**
 * Escapes HTML special characters so untrusted text can be safely embedded
 * in HTML output (email bodies, `{@html}` message interpolations, …).
 */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
