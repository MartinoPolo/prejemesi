<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { uploadFile } from '$lib/modules/uploads/upload.js';
	import type { UploadTarget } from '$lib/server/storage/r2.js';
	import type { UploadResult, UploadProgress } from '$lib/modules/uploads/types.js';
	import { imageUploadVariants, type ImageUploadSize } from './image-upload-variants.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		/** Upload target (determines R2 path prefix and size limits). */
		target: UploadTarget;
		/** Allowed MIME types. Defaults to all image types. */
		accept?: string;
		/** Maximum file size in bytes. Overrides the default for the target if set. */
		maxSize?: number;
		/** Component size variant. */
		size?: ImageUploadSize;
		/** Called when upload completes successfully. */
		onUpload?: (result: UploadResult) => void;
		/** Called when an error occurs. */
		onError?: (error: Error) => void;
		/** Additional CSS classes. */
		class?: string;
	}

	let {
		target,
		accept = 'image/jpeg,image/png,image/webp,image/gif',
		maxSize,
		size = 'medium',
		onUpload,
		onError,
		class: className,
	}: Props = $props();

	let fileInputElement: HTMLInputElement | undefined = $state(undefined);
	let isDragOver = $state(false);
	let previewUrl = $state<string | undefined>(undefined);
	let progress = $state<UploadProgress>({
		status: 'idle',
		percentage: 0,
	});

	const currentState = $derived(
		isDragOver
			? 'dragover'
			: progress.status === 'uploading'
				? 'uploading'
				: progress.status === 'complete'
					? 'complete'
					: progress.status === 'error'
						? 'error'
						: 'idle',
	);

	const styles = $derived(imageUploadVariants({ state: currentState, size }));

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		const file = event.dataTransfer?.files[0];
		if (file) {
			void processFile(file);
		}
	}

	function handleClick() {
		if (progress.status !== 'uploading') {
			fileInputElement?.click();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			void processFile(file);
		}
		// Reset input so re-selecting the same file triggers change
		input.value = '';
	}

	async function processFile(file: File) {
		// Client-side max size check
		if (maxSize && file.size > maxSize) {
			const maxMb = Math.round(maxSize / (1024 * 1024));
			const fileError = new Error(`File too large. Maximum size: ${String(maxMb)}MB`);
			progress = { status: 'error', percentage: 0, errorMessage: fileError.message };
			onError?.(fileError);
			return;
		}

		// Generate preview
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = URL.createObjectURL(file);

		try {
			const result = await uploadFile(file, target, (uploadProgress) => {
				progress = uploadProgress;
			});
			onUpload?.(result);
		} catch (thrown) {
			const uploadError = thrown instanceof Error ? thrown : new Error('Upload failed');
			onError?.(uploadError);
		}
	}

	function handleRemove(event: MouseEvent) {
		event.stopPropagation();
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = undefined;
		progress = { status: 'idle', percentage: 0 };
	}
</script>

<div
	class={cn(styles.root(), className)}
	role="button"
	tabindex={progress.status === 'uploading' ? -1 : 0}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	<input
		bind:this={fileInputElement}
		type="file"
		{accept}
		class="sr-only"
		onchange={handleFileSelect}
		tabindex={-1}
	/>

	{#if previewUrl}
		<img src={previewUrl} alt="Upload preview" class={styles.preview()} />

		{#if progress.status !== 'uploading'}
			<button
				type="button"
				class={styles.removeButton()}
				onclick={handleRemove}
				aria-label="Remove image"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}
	{:else}
		<UploadIcon class="size-8 text-muted-foreground" />
		<p class={styles.label()}>Drag and drop an image, or click to select</p>
	{/if}

	{#if progress.status === 'uploading'}
		<div class={styles.progressTrack()}>
			<div class={styles.progressBar()} style:width="{String(progress.percentage)}%"></div>
		</div>
	{/if}

	{#if progress.status === 'error' && progress.errorMessage}
		<p class={styles.errorText()}>{progress.errorMessage}</p>
	{/if}
</div>
