<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import ImportSourceFileDrop from './ImportSourceFileDrop.svelte';
	import ImportSourcePaste from './ImportSourcePaste.svelte';
	import ImportSourceSheetLink from './ImportSourceSheetLink.svelte';
	import GoogleSheetsIcon from './GoogleSheetsIcon.svelte';
	import { validateImportLimits } from '$lib/modules/import/import_limits.js';
	import {
		SOURCE_METHOD,
		PARSE_STATUS,
		type SourceMethod,
		type ParseStatus,
	} from './import_wizard_types.js';
	import FileIcon from '@lucide/svelte/icons/file';
	import TableIcon from '@lucide/svelte/icons/table';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	interface ImportSourceStepProps {
		onparsed: (result: { rows: string[][]; filename?: string }) => void;
	}

	let { onparsed }: ImportSourceStepProps = $props();

	let sourceMethod = $state<SourceMethod>(SOURCE_METHOD.file);
	let parseStatus = $state<ParseStatus>(PARSE_STATUS.idle);
	let errorMessage = $state<string | null>(null);

	const isDisabled = $derived(parseStatus === PARSE_STATUS.parsing);

	function handleError(message: string) {
		errorMessage = message;
		parseStatus = PARSE_STATUS.error;
	}

	function handleParsed(result: { rows: string[][]; filename?: string }) {
		errorMessage = null;

		const byteSize = result.rows.reduce(
			(total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell.length, 0),
			0,
		);
		const limits = validateImportLimits(result.rows.length, byteSize);

		if (!limits.valid) {
			if (limits.error === 'rows') {
				handleError(m.import_wizard_error_too_many_rows());
			} else {
				handleError(m.import_wizard_error_too_large());
			}
			return;
		}

		parseStatus = PARSE_STATUS.parsed;
		onparsed(result);
	}
</script>

<div class="flex flex-col gap-5">
	<!-- Source method toggle -->
	<SegmentedToggle.Root
		value={sourceMethod}
		onValueChange={(value) => {
			sourceMethod = value as SourceMethod;
			errorMessage = null;
			parseStatus = PARSE_STATUS.idle;
		}}
		width="fill"
	>
		<SegmentedToggle.Item value={SOURCE_METHOD.file}>
			<FileIcon class="size-4" />
			{m.import_wizard_source_file()}
		</SegmentedToggle.Item>
		<SegmentedToggle.Item value={SOURCE_METHOD.paste}>
			<TableIcon class="size-4" />
			{m.import_wizard_source_paste()}
		</SegmentedToggle.Item>
		<SegmentedToggle.Item value={SOURCE_METHOD.sheets}>
			<GoogleSheetsIcon class="size-4" />
			{m.import_wizard_source_sheets()}
		</SegmentedToggle.Item>
	</SegmentedToggle.Root>

	<!-- Source sub-component – fixed height so the dialog does not jump between methods -->
	<div class="flex h-48">
		{#if sourceMethod === SOURCE_METHOD.file}
			<ImportSourceFileDrop
				onparsed={handleParsed}
				onerror={handleError}
				disabled={isDisabled}
			/>
		{:else if sourceMethod === SOURCE_METHOD.paste}
			<ImportSourcePaste
				onparsed={handleParsed}
				onerror={handleError}
				disabled={isDisabled}
			/>
		{:else if sourceMethod === SOURCE_METHOD.sheets}
			<ImportSourceSheetLink
				onparsed={handleParsed}
				onerror={handleError}
				disabled={isDisabled}
			/>
		{/if}
	</div>

	<!-- Error message -->
	{#if errorMessage}
		<Alert.Root tone="danger">
			<AlertCircleIcon class="size-4" />
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Limits notice -->
	<HelpText class="text-center">{m.import_wizard_limits_notice()}</HelpText>
</div>
