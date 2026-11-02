<script lang="ts" module>
	import type { ImageMetadata } from '$lib/modules/images/index.js';

	export interface GiftImageStripItem {
		id: string;
		/** Resolved preview URL; null while the image has no source yet. */
		src: string | null;
		imageMeta: ImageMetadata | null;
	}
</script>

<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import { createGiftPointerReorderController } from '$lib/components/blocks/wishlist/gift_pointer_reorder.svelte.js';
	import { MAX_GIFT_IMAGES } from '$lib/modules/gifts/gift_images.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import GiftImage from './GiftImage.svelte';
	import { giftImageStripVariants } from './gift_image_strip_variants.js';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';

	interface Props {
		items: readonly GiftImageStripItem[];
		selectedId: string | null;
		/** Blocks every strip action, e.g. while the gift saves or an image uploads. */
		disabled: boolean;
		/** Whether new images may be added at all (the demo allows only prepared images). */
		canAdd: boolean;
		onselect: (id: string) => void;
		onremove: (id: string) => void;
		onreorder: (orderedIds: string[]) => void;
		/** A new image uploaded through „Nahrát soubor“, prepared and stripped like any upload. */
		onupload: (result: UploadResult) => void;
		onuploadpendingchange: (pending: boolean) => void;
		/** „Vložit odkaz na obrázek“: the editor starts a new image and focuses its link field. */
		onaddurl: () => void;
	}

	let {
		items,
		selectedId,
		disabled,
		canAdd,
		onselect,
		onremove,
		onreorder,
		onupload,
		onuploadpendingchange,
		onaddurl,
	}: Props = $props();

	const styles = giftImageStripVariants();
	const headingId = $props.id();
	const limitNoteId = `${headingId}-limit`;

	let listElement = $state<HTMLUListElement | null>(null);
	let addTrigger = $state<HTMLButtonElement | null>(null);
	let addUploader: ReturnType<typeof ImageUpload> | undefined = $state();
	let isAddUploadPending = $state(false);
	let uploadErrorMessage = $state<string | null>(null);
	let announcement = $state('');
	let addsLinkOnMenuClose = false;
	/** The image a pointer drag or arrow key is moving, announced once it lands. */
	let movingImageId: string | null = null;

	const atLimit = $derived(items.length >= MAX_GIFT_IMAGES);
	const addDisabled = $derived(disabled || !canAdd || atLimit || isAddUploadPending);

	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			listElement === null
				? []
				: Array.from(
						listElement.querySelectorAll<HTMLElement>(
							':scope > [data-gift-image-tile]',
						),
					),
		getItemIds: () => items.map((item) => item.id),
		onPreviewOrder: (orderedIds) => onreorder(orderedIds),
		onCommitOrder: (orderedIds) => {
			onreorder(orderedIds);
			announceMove(orderedIds);
		},
		onCancelOrder: (orderedIds) => onreorder(orderedIds),
	});
	onDestroy(() => reorder.destroy());

	function announceMove(orderedIds: readonly string[]) {
		const position = orderedIds.indexOf(movingImageId ?? '') + 1;
		movingImageId = null;
		if (position === 0) {
			return;
		}
		const count = orderedIds.length;
		announcement =
			position === 1
				? m.gift_image_strip_moved_cover({ count })
				: m.gift_image_strip_moved({ position, count });
	}

	function tileElement(id: string): HTMLElement | null {
		return (
			listElement?.querySelector<HTMLElement>(
				`:scope > [data-gift-image-tile="${CSS.escape(id)}"]`,
			) ?? null
		);
	}

	function handleGripPointerDown(event: PointerEvent, index: number) {
		if (disabled) {
			return;
		}
		movingImageId = items[index]?.id ?? null;
		reorder.start(event, index);
	}

	async function handleGripKeydown(event: KeyboardEvent, index: number, id: string) {
		const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (direction === 0 || disabled) {
			return;
		}
		event.preventDefault();
		movingImageId = id;
		if (!reorder.move(index, direction)) {
			movingImageId = null;
			return;
		}
		await tick();
		tileElement(id)?.querySelector<HTMLElement>('[data-gift-image-grip]')?.focus();
	}

	/** Escape mid-drag cancels the drag before the editor dialog would treat it as dismissal. */
	function cancelDragOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape' && reorder.draggedGiftId.current !== null) {
			event.preventDefault();
			event.stopPropagation();
			reorder.cancel();
		}
	}

	async function removeImage(index: number, id: string) {
		if (disabled) {
			return;
		}
		onremove(id);
		await tick();
		const nextTile = items[index] ?? items[index - 1];
		const nextFocus =
			nextTile === undefined
				? addTrigger
				: tileElement(nextTile.id)?.querySelector<HTMLElement>('[data-gift-image-select]');
		nextFocus?.focus();
	}

	function selectLabel(index: number, item: GiftImageStripItem): string {
		const position = index + 1;
		if (item.src === null) {
			return m.gift_image_strip_select_pending({ position });
		}
		return index === 0
			? m.gift_image_strip_select_cover({ position })
			: m.gift_image_strip_select({ position });
	}

	function startUpload() {
		uploadErrorMessage = null;
		addUploader?.openFilePicker();
	}

	function handleAddMenuCloseFocus(event: Event) {
		if (!addsLinkOnMenuClose) {
			return;
		}
		addsLinkOnMenuClose = false;
		event.preventDefault();
		// bits-ui calls this from the closing menu's effect; runes created there would be
		// owned by it and freeze once the menu unmounts, so the new draft must start outside it.
		queueMicrotask(onaddurl);
	}

	function handleUploadPendingChange(pending: boolean) {
		isAddUploadPending = pending;
		onuploadpendingchange(pending);
	}

	function handleUploadError(uploadError: Error, message: string) {
		console.error('Image upload failed:', uploadError.message);
		uploadErrorMessage = message;
	}
</script>

<svelte:window onkeydowncapture={cancelDragOnEscape} />

<div class={styles.root()} data-testid="gift-image-strip">
	<div class={styles.heading()}>
		<strong id={headingId} class={styles.headingTitle()}>
			{m.gift_image_strip_heading({ count: items.length, max: MAX_GIFT_IMAGES })}
		</strong>
		<span class={styles.headingHint()}>{m.gift_image_strip_hint()}</span>
	</div>
	<ul class={styles.list()} aria-labelledby={headingId} bind:this={listElement}>
		{#each items as item, index (item.id)}
			{@const position = index + 1}
			<li
				class={styles.tile()}
				data-gift-image-tile={item.id}
				data-selected={item.id === selectedId ? '' : undefined}
			>
				<button
					type="button"
					class={styles.select()}
					aria-pressed={item.id === selectedId}
					aria-label={selectLabel(index, item)}
					data-gift-image-select
					aria-disabled={disabled}
					onclick={() => {
						if (!disabled) {
							onselect(item.id);
						}
					}}
				>
					{#if item.src === null}
						<span class={styles.emptySource()}><LinkIcon aria-hidden="true" /></span>
					{:else}
						<GiftImage
							class="size-full rounded-none"
							imageUrl={item.src}
							imageMeta={item.imageMeta}
							target="thumb"
							alt=""
							variant="listThumb"
						/>
					{/if}
				</button>
				{#if items.length > 1}
					<Button
						type="button"
						intent="secondary"
						size="sm"
						format="icon"
						class={cn(styles.cornerControl(), styles.grip())}
						aria-label={m.gift_image_strip_move_label({ position })}
						title={m.gift_image_strip_move_hint()}
						aria-keyshortcuts="ArrowLeft ArrowRight"
						data-gift-image-grip
						aria-disabled={disabled}
						onpointerdown={(event: PointerEvent) => handleGripPointerDown(event, index)}
						onkeydown={(event: KeyboardEvent) =>
							void handleGripKeydown(event, index, item.id)}
					>
						<GripVerticalIcon data-icon="solo" />
					</Button>
				{/if}
				<Button
					type="button"
					intent="danger"
					size="sm"
					format="icon"
					class={cn(styles.cornerControl(), styles.remove())}
					aria-label={m.gift_image_strip_remove_label({ position })}
					aria-disabled={disabled}
					onclick={() => void removeImage(index, item.id)}
				>
					<XIcon data-icon="solo" />
				</Button>
				{#if index === 0 && item.src !== null}
					<span class={styles.cover()} aria-hidden="true"
						>{m.gift_image_strip_cover()}</span
					>
				{/if}
			</li>
		{/each}
		{#if isAddUploadPending}
			<li class={styles.pendingTile()} data-testid="gift-image-strip-uploading">
				<LoaderIcon aria-hidden="true" />
				<span class="sr-only">{m.gift_image_strip_uploading()}</span>
			</li>
		{/if}
		<li class="shrink-0">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={addDisabled}>
					{#snippet child({ props })}
						<!-- Focusable while unavailable so the limit note stays reachable; the
						     disabled Trigger already ignores presses. -->
						<button
							{...props}
							disabled={undefined}
							aria-disabled={addDisabled}
							bind:this={addTrigger}
							type="button"
							class={styles.addTile()}
							aria-label={m.gift_image_strip_add_label()}
							aria-describedby={atLimit ? limitNoteId : undefined}
							data-testid="gift-image-strip-add"
						>
							<PlusIcon aria-hidden="true" />
							<span aria-hidden="true">{m.gift_image_strip_add()}</span>
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					preventScroll={false}
					shadowedTrigger={false}
					onCloseAutoFocus={handleAddMenuCloseFocus}
				>
					<DropdownMenu.Item onSelect={startUpload}>
						<UploadIcon />{m.gift_image_strip_add_upload()}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={() => (addsLinkOnMenuClose = true)}>
						<LinkIcon />{m.gift_image_strip_add_url()}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</li>
	</ul>
	{#if atLimit}
		<p id={limitNoteId} class={styles.limitNote()}>
			{m.gift_image_strip_limit({ max: MAX_GIFT_IMAGES })}
		</p>
	{/if}
	{#if uploadErrorMessage !== null}
		<HelpText state="error" role="alert">{uploadErrorMessage}</HelpText>
	{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
	{#if canAdd}
		<ImageUpload
			bind:this={addUploader}
			target="gift-image"
			size="compact"
			class="hidden"
			{disabled}
			onUpload={onupload}
			onPendingChange={handleUploadPendingChange}
			onError={handleUploadError}
		/>
	{/if}
</div>
