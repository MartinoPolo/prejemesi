<script lang="ts">
	import { untrack } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { uploadFile } from '$lib/modules/uploads/upload.js';
	import { prepareImageForUpload } from '$lib/modules/uploads/prepare_image.js';
	import type { UploadTarget } from '$lib/server/storage/r2.js';
	import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from '$lib/modules/uploads/types.js';
	import type { UploadResult, UploadProgress } from '$lib/modules/uploads/types.js';
	import { imageUploadVariants, type ImageUploadSize } from './image_upload_variants.js';
	import { imageUploadErrorMessage } from './image_upload_errors.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { CONTROL_SIZE_CLASSES } from '$lib/components/base/control_sizing.js';
	import * as m from '$lib/paraglide/messages.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		/** Upload target (determines R2 path prefix and size limits). */
		target: UploadTarget;
		/** Allowed MIME types. Defaults to all image types. */
		accept?: string;
		/** Component size variant. */
		size?: ImageUploadSize;
		/** Prevents starting, replacing, or removing an upload. */
		disabled?: boolean;
		/** Optional visible and accessible label for compact upload actions. */
		label?: string;
		/** Existing image shown as the initial preview (edit mode); replaced on upload. */
		initialPreviewUrl?: string;
		/** Called when upload completes successfully. */
		onUpload?: (result: UploadResult, uploadedFile: File) => void;
		/** Reports the full upload lifecycle, including authorization. */
		onPendingChange?: (pending: boolean) => void;
		/** Called when an error occurs, with the localized message shown to the user. */
		onError?: (error: Error, message: string) => void;
		/** Called when the user clears the current image (so callers can drop the key/url). */
		onRemove?: () => void;
		/** Additional CSS classes. */
		class?: string;
	}

	let {
		target,
		accept = ALLOWED_CONTENT_TYPES.join(','),
		size = 'medium',
		disabled = false,
		label,
		initialPreviewUrl,
		onUpload,
		onPendingChange,
		onError,
		onRemove,
		class: className,
	}: Props = $props();

	let fileInputElement: HTMLInputElement | undefined = $state(undefined);
	let isDragOver = $state(false);
	let isUploadPending = $state(false);
	// Seed from the existing image (edit mode). A real http(s) URL here, not a blob –
	// the revoke-on-cleanup calls below are harmless no-ops for non-blob URLs.
	// svelte-ignore state_referenced_locally
	let previewUrl = $state<string | undefined>(initialPreviewUrl);
	// The browser could not render this URL; any other preview URL is tried again.
	let unrenderablePreviewUrl = $state<string | undefined>(undefined);
	const hasPreviewImage = $derived(previewUrl !== undefined && previewUrl !== '');
	const showsPreview = $derived(hasPreviewImage && previewUrl !== unrenderablePreviewUrl);
	let activeAbortController: AbortController | null = null;
	let progress = $state<UploadProgress>({
		status: 'idle',
		percentage: 0,
	});

	const currentState = $derived(
		isDragOver
			? 'dragover'
			: isUploadPending
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
		if (disabled) {
			return;
		}
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		if (disabled || isUploadPending) {
			return;
		}
		const file = event.dataTransfer?.files[0];
		if (file != null) {
			void processFile(file);
		}
	}

	function handleClick() {
		if (!disabled && !isUploadPending) {
			fileInputElement?.click();
		}
	}

	/** Opens the native file picker programmatically (e.g. from an external click-to-edit affordance). */
	export function openFilePicker(): void {
		handleClick();
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
		if (file != null) {
			void processFile(file);
		}
		// Reset input so re-selecting the same file triggers change
		input.value = '';
	}

	async function processFile(file: File) {
		// Keep one operation responsible for the pending lifecycle and preview at a time.
		if (disabled || isUploadPending) {
			return;
		}

		isUploadPending = true;
		onPendingChange?.(true);

		// The previous image stays the caller's value until this file uploads, so keep its preview
		// to restore if preparation or upload fails.
		const previousPreviewUrl = previewUrl;
		const filePreviewUrl = URL.createObjectURL(file);
		previewUrl = filePreviewUrl;

		activeAbortController = new AbortController();
		const maxBytes = MAX_FILE_SIZE[target];

		try {
			let result: UploadResult;
			let uploadedFile: File;
			try {
				progress = { status: 'preparing', percentage: 0 };
				uploadedFile = await prepareImageForUpload(file, maxBytes);
				result = await uploadFile(
					uploadedFile,
					target,
					(uploadProgress) => {
						progress = uploadProgress;
					},
					activeAbortController.signal,
				);
			} catch (thrown) {
				URL.revokeObjectURL(filePreviewUrl);
				previewUrl = previousPreviewUrl;
				const uploadError = thrown instanceof Error ? thrown : new Error('Upload failed');
				const errorMessage = imageUploadErrorMessage(thrown, maxBytes);
				progress = { status: 'error', percentage: 0, errorMessage };
				onError?.(uploadError, errorMessage);
				return;
			}
			// Only preparation or upload failures roll back; the uploaded file stays previewed.
			if (previousPreviewUrl != null) {
				URL.revokeObjectURL(previousPreviewUrl);
			}
			onUpload?.(result, uploadedFile);
		} finally {
			activeAbortController = null;
			isUploadPending = false;
			onPendingChange?.(false);
		}
	}

	function handleRemove(event: MouseEvent) {
		event.stopPropagation();
		if (disabled || isUploadPending) {
			return;
		}
		if (previewUrl != null) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = undefined;
		progress = { status: 'idle', percentage: 0 };
		onRemove?.();
	}

	// Unmount guard – manual revokes in handlers cover the normal case
	$effect(() => {
		return () => {
			activeAbortController?.abort();
			const unmountedPreviewUrl = untrack(() => previewUrl);
			if (unmountedPreviewUrl != null) {
				URL.revokeObjectURL(unmountedPreviewUrl);
			}
		};
	});
</script>

{#snippet fileInput()}
	<input
		bind:this={fileInputElement}
		type="file"
		{accept}
		class="sr-only"
		{disabled}
		onchange={handleFileSelect}
		tabindex={-1}
	/>
{/snippet}

{#if size === 'compact'}
	<!-- A compact upload is an ordinary outline Button that still accepts a dropped file; the caller
	     reports upload errors and shows the uploaded image. -->
	{@render fileInput()}
	<Button
		intent="outline"
		class={className}
		disabled={disabled || isUploadPending}
		aria-busy={isUploadPending}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleClick}
	>
		<UploadIcon data-icon="inline-start" />
		{label ?? m.image_upload_dropzone()}
	</Button>
{:else}
	<div
		class={cn(styles.root(), className)}
		role="button"
		aria-label={label ?? m.image_upload_aria()}
		aria-disabled={disabled}
		tabindex={disabled || isUploadPending ? -1 : 0}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleClick}
		onkeydown={handleKeyDown}
	>
		{@render fileInput()}

		{#if showsPreview}
			<img
				src={previewUrl}
				alt={m.image_upload_preview_alt()}
				class={styles.preview()}
				data-testid="image-upload-preview"
				onerror={() => (unrenderablePreviewUrl = previewUrl)}
			/>
		{:else}
			<UploadIcon class="size-8 text-muted-foreground" />
			<p class={styles.label()}>{label ?? m.image_upload_dropzone()}</p>
		{/if}

		{#if hasPreviewImage && !isUploadPending}
			<Button
				size="sm"
				format="icon"
				intent="ghost"
				class={cn(styles.removeButtonOwner(), CONTROL_SIZE_CLASSES.sm)}
				surfaceClass={styles.removeButtonSurface()}
				onclick={handleRemove}
				aria-label={m.image_upload_remove()}
				{disabled}
			>
				<XIcon data-icon="solo" />
			</Button>
		{/if}

		{#if isUploadPending}
			<div class={styles.progressTrack()}>
				<div
					class={styles.progressBar()}
					style:width="{String(progress.percentage)}%"
				></div>
			</div>
		{/if}

		{#if progress.status === 'error' && progress.errorMessage}
			<p class={styles.errorText()}>{progress.errorMessage}</p>
		{/if}
	</div>
{/if}
