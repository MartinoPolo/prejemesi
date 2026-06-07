<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { parseTabular } from '$lib/modules/import/index.js';
	import { fetchGoogleSheetCsv } from '$lib/modules/import/import.remote.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';

	interface ImportSourceSheetLinkProps {
		onparsed: (result: { rows: string[][] }) => void;
		onerror: (message: string) => void;
		disabled: boolean;
	}

	let { onparsed, onerror, disabled }: ImportSourceSheetLinkProps = $props();

	let sheetUrl = $state('');
	let isLoading = $state(false);

	const ERROR_MAP: Record<string, () => string> = {
		[SERVER_ERROR.SHEETS_PRIVATE]: () => m.import_wizard_error_sheets_private(),
		[SERVER_ERROR.SHEETS_LINK_INVALID]: () => m.import_wizard_error_sheets_invalid(),
		[SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET]: () => m.import_wizard_error_sheets_not_a_sheet(),
		[SERVER_ERROR.SHEETS_FETCH_FAILED]: () => m.import_wizard_error_sheets_fetch_failed(),
	};

	function mapSheetError(thrown: unknown): string {
		if (thrown instanceof Error) {
			const message = thrown.message;
			for (const [code, getMessage] of Object.entries(ERROR_MAP)) {
				if (message.includes(code)) {
					return getMessage();
				}
			}
		}
		return m.import_wizard_error_sheets_fetch_failed();
	}

	async function handleLoad() {
		if (disabled || isLoading || !sheetUrl.trim()) {
			return;
		}

		isLoading = true;
		try {
			const csv = await fetchGoogleSheetCsv(sheetUrl.trim());
			const parsed = parseTabular(csv);
			if (parsed.rows.length === 0) {
				onerror(m.import_wizard_error_no_data());
				return;
			}
			onparsed({ rows: parsed.rows });
		} catch (thrown) {
			onerror(mapSheetError(thrown));
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex h-full w-full items-center gap-2">
	<div class="flex-1">
		<Input
			type="url"
			placeholder={m.import_wizard_sheets_placeholder()}
			bind:value={sheetUrl}
			disabled={disabled || isLoading}
		/>
	</div>
	<Button onclick={handleLoad} disabled={disabled || isLoading || !sheetUrl.trim()}>
		{#if isLoading}
			{m.import_wizard_committing()}
		{:else}
			{m.import_wizard_sheets_load()}
		{/if}
	</Button>
</div>
