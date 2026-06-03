<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { parseTabular } from '$lib/modules/import/index.js';

	interface ImportSourcePasteProps {
		onparsed: (result: { rows: string[][] }) => void;
		onerror: (message: string) => void;
		disabled: boolean;
	}

	let { onparsed, onerror, disabled }: ImportSourcePasteProps = $props();

	function handlePaste(event: ClipboardEvent) {
		if (disabled) {
			return;
		}

		event.preventDefault();

		try {
			const clipboardData = event.clipboardData;
			if (!clipboardData) {
				onerror(m.import_wizard_error_parse_failed());
				return;
			}

			// Try HTML first (Excel/Sheets paste tables as HTML)
			const html = clipboardData.getData('text/html');
			if (html) {
				const parsed = parseTabular({ kind: 'html', html });
				if (parsed.rows.length > 0) {
					onparsed({ rows: parsed.rows });
					return;
				}
			}

			// Fall back to plain text (TSV/CSV)
			const text = clipboardData.getData('text/plain');
			if (text) {
				const parsed = parseTabular({ kind: 'text', text });
				if (parsed.rows.length > 0) {
					onparsed({ rows: parsed.rows });
					return;
				}
			}

			onerror(m.import_wizard_error_no_data());
		} catch {
			onerror(m.import_wizard_error_parse_failed());
		}
	}
</script>

<textarea
	class="border-input bg-input-surface focus-visible:border-ring focus-visible:ring-ring/50 min-h-[160px] w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 outline-none resize-none"
	placeholder={m.import_wizard_paste_placeholder()}
	onpaste={handlePaste}
	{disabled}
	readonly
></textarea>
