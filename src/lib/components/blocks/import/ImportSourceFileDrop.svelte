<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { parseTabular } from '$lib/modules/import/index.js';
	import { MAX_IMPORT_BYTES } from '$lib/modules/import/import_limits.js';
	import UploadIcon from '@lucide/svelte/icons/upload';

	interface ImportSourceFileDropProps {
		onparsed: (result: { rows: string[][]; filename: string }) => void;
		onerror: (message: string) => void;
		disabled: boolean;
	}

	let { onparsed, onerror, disabled }: ImportSourceFileDropProps = $props();

	let isDragOver = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	function handleFile(file: File) {
		if (disabled) {
			return;
		}

		const extension = file.name.toLowerCase();
		if (!extension.endsWith('.csv') && !extension.endsWith('.tsv')) {
			onerror(m.import_wizard_error_invalid_file());
			return;
		}

		if (file.size > MAX_IMPORT_BYTES) {
			onerror(m.import_wizard_error_too_large());
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const text = reader.result as string;
				const parsed = parseTabular(text);
				if (parsed.rows.length === 0) {
					onerror(m.import_wizard_error_no_data());
					return;
				}
				onparsed({ rows: parsed.rows, filename: file.name });
			} catch {
				onerror(m.import_wizard_error_parse_failed());
			}
		};
		reader.onerror = () => {
			onerror(m.import_wizard_error_parse_failed());
		};
		reader.readAsText(file);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		if (disabled) {
			return;
		}

		const file = event.dataTransfer?.files[0];
		if (file) {
			handleFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled) {
			isDragOver = true;
		}
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleClick() {
		if (!disabled) {
			fileInputRef?.click();
		}
	}

	function handleInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			handleFile(file);
		}
		// Reset so re-selecting the same file triggers change
		input.value = '';
	}
</script>

<button
	type="button"
	class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-panel border-[3px] border-dashed border-ink-soft px-6 transition-colors hover:border-ink hover:bg-tint {isDragOver
		? 'border-ink bg-tint'
		: ''} {disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'}"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	onclick={handleClick}
	{disabled}
>
	<div class="text-ink-soft">
		<UploadIcon class="size-8" />
	</div>
	<div class="text-center">
		<p class="text-sm font-semibold text-foreground">{m.import_wizard_file_drop_label()}</p>
		<p class="text-xs text-ink-soft">{m.import_wizard_file_drop_or_click()}</p>
	</div>
	<div class="flex gap-2">
		<span
			class="rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground"
		>
			.CSV
		</span>
		<span
			class="rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground"
		>
			.TSV
		</span>
	</div>
</button>

<input
	bind:this={fileInputRef}
	type="file"
	accept=".csv,.tsv"
	class="hidden"
	onchange={handleInputChange}
	{disabled}
/>
