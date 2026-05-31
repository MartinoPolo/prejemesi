<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift-detail-modal-variants.js';
	import {
		GIFT_CURRENCIES,
		GIFT_CURRENCY_LABELS,
		type GiftCurrency,
		type GiftByRole,
		type CreateGiftInput,
		type UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';

	interface Props {
		open: boolean;
		mode: GiftDetailModalMode;
		gift?: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		isOwner?: boolean;
		canEdit?: boolean;
		canDelete?: boolean;
		isSubmitting?: boolean;
		isDeleting?: boolean;
		oncreate?: (input: CreateGiftInput) => void;
		onupdate?: (input: UpdateGiftInput) => void;
		ondelete?: (giftId: string) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		mode,
		gift = null,
		wishlistId,
		priorityLevels,
		isOwner = false,
		canEdit = true,
		canDelete = true,
		isSubmitting = false,
		isDeleting = false,
		oncreate,
		onupdate,
		ondelete,
		onreceived,
		onclose,
	}: Props = $props();

	// Form state
	let name = $state('');
	let description = $state('');
	let url = $state('');
	let price = $state('');
	let currency = $state<GiftCurrency>('CZK');
	let imageUrl = $state('');
	let imageKey = $state('');
	let quantity = $state('1');
	let priorityLevelId = $state('');
	let imageMode = $state<'url' | 'upload'>('url');
	let showDeleteConfirm = $state(false);
	let nameError = $state('');

	const styles = giftDetailModalVariants();

	const isEdit = $derived(mode === 'edit');
	const title = $derived(isEdit ? 'Upravit darek' : 'Pridat darek');
	const submitLabel = $derived(isEdit ? 'Ulozit' : 'Pridat darek');
	const showQuantityField = $derived(
		Number(quantity) > 1 || mode === 'create' || mode === 'edit',
	);
	const hasImage = $derived(imageUrl !== '' || imageKey !== '');

	// Reset form when gift changes or modal opens
	$effect(() => {
		if (open) {
			if (mode === 'edit' && gift !== null) {
				name = gift.name;
				description = gift.description ?? '';
				url = gift.url ?? '';
				price = gift.price !== null ? String(gift.price) : '';
				currency = (gift.currency as GiftCurrency) ?? 'CZK';
				imageUrl = gift.imageUrl ?? '';
				imageKey = '';
				quantity = String(gift.quantity ?? 1);
				priorityLevelId = '';
				imageMode = gift.imageUrl ? 'url' : 'url';
			} else {
				name = '';
				description = '';
				url = '';
				price = '';
				currency = 'CZK';
				imageUrl = '';
				imageKey = '';
				quantity = '1';
				priorityLevelId = '';
				imageMode = 'url';
			}
			showDeleteConfirm = false;
			nameError = '';
		}
	});

	function validateForm(): boolean {
		nameError = '';
		if (name.trim() === '') {
			nameError = 'Nazev je povinny';
			return false;
		}
		return true;
	}

	function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		const parsedPrice = price.trim() !== '' ? Number(price) : null;
		const parsedQuantity = quantity.trim() !== '' ? Number(quantity) : 1;

		if (mode === 'create') {
			oncreate?.({
				wishlistId,
				name: name.trim(),
				description: description.trim() || null,
				url: url.trim() || null,
				price: parsedPrice,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				quantity: parsedQuantity,
				priorityLevelId: priorityLevelId || null,
			});
		} else if (mode === 'edit' && gift !== null) {
			onupdate?.({
				id: gift.id,
				name: name.trim(),
				description: description.trim() || null,
				url: url.trim() || null,
				price: parsedPrice,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				quantity: parsedQuantity,
				priorityLevelId: priorityLevelId || null,
			});
		}
	}

	function handleDelete() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
			return;
		}
		if (gift !== null) {
			ondelete?.(gift.id);
		}
	}

	function handleReceived() {
		if (gift !== null) {
			onreceived?.(gift.id, !gift.received);
		}
	}

	function handleImageUpload(result: UploadResult) {
		imageKey = result.objectKey;
		imageUrl = result.publicUrl;
	}

	function handleImageUploadError(uploadError: Error) {
		console.error('Image upload failed:', uploadError.message);
	}

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			onclose?.();
		}
		open = newOpen;
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class={styles.content()} showCloseButton={true}>
		<Dialog.Title class="sr-only">{title}</Dialog.Title>
		<Dialog.Description class="sr-only">
			{isEdit ? 'Formular pro upravu darku' : 'Formular pro pridani noveho darku'}
		</Dialog.Description>

		<div class={styles.body()}>
			<!-- Left column: image -->
			<div class={styles.imageColumn()}>
				{#if hasImage}
					<img src={imageUrl} alt={name || 'Nahled darku'} class={styles.image()} />
				{:else}
					<div class={styles.imagePlaceholder()}>
						<GiftIcon class="size-16 text-muted-foreground/40" />
						<span class="text-sm font-medium text-muted-foreground/60"
							>Nahled obrazku</span
						>
					</div>
				{/if}
			</div>

			<!-- Right column: form -->
			<div class={styles.detailColumn()}>
				<!-- Name -->
				<div class={styles.formField()}>
					<Label for="gift-name">Nazev *</Label>
					<Input
						id="gift-name"
						bind:value={name}
						placeholder="Nazev darku"
						aria-invalid={nameError !== '' ? true : undefined}
					/>
					{#if nameError}
						<span class="text-xs text-destructive">{nameError}</span>
					{/if}
				</div>

				<!-- Description -->
				<div class="mt-3 {styles.formField()}">
					<Label for="gift-description">Popis</Label>
					<Textarea
						id="gift-description"
						bind:value={description}
						placeholder="Popis darku (volitelne)"
						rows={3}
					/>
				</div>

				<!-- URL -->
				<div class="mt-3 {styles.formField()}">
					<Label for="gift-url">Odkaz</Label>
					<Input id="gift-url" bind:value={url} placeholder="https://..." type="url" />
				</div>

				<!-- Price + Currency -->
				<div class="mt-3 {styles.formRow()}">
					<div class={styles.formField()}>
						<Label for="gift-price">Cena</Label>
						<Input
							id="gift-price"
							bind:value={price}
							placeholder="0"
							type="number"
							min="0"
						/>
					</div>
					<div class={styles.formField()}>
						<Label>Mena</Label>
						<Select.Root type="single" bind:value={currency}>
							<Select.Trigger class="w-full">
								{GIFT_CURRENCY_LABELS[currency]}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each Object.entries(GIFT_CURRENCIES) as [key, val] (key)}
										<Select.Item value={val} label={GIFT_CURRENCY_LABELS[val]}>
											{GIFT_CURRENCY_LABELS[val]}
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Image -->
				<div class="mt-3 {styles.formField()}">
					<Label>Obrazek</Label>
					<div class={styles.imageTabRow()}>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'url',
							}).imageTab()}
							onclick={() => (imageMode = 'url')}
						>
							<LinkIcon class="mr-1 inline size-3" />
							URL
						</button>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'upload',
							}).imageTab()}
							onclick={() => (imageMode = 'upload')}
						>
							<UploadIcon class="mr-1 inline size-3" />
							Nahrat
						</button>
					</div>
					{#if imageMode === 'url'}
						<Input
							bind:value={imageUrl}
							placeholder="https://example.com/image.jpg"
							type="url"
						/>
					{:else}
						<ImageUpload
							target="gift-image"
							size="small"
							onUpload={handleImageUpload}
							onError={handleImageUploadError}
						/>
					{/if}
				</div>

				<!-- Quantity -->
				<div class="mt-3 {styles.formField()}">
					<Label for="gift-quantity">Pocet (skryto pri 1)</Label>
					<Input
						id="gift-quantity"
						bind:value={quantity}
						type="number"
						min="1"
						placeholder="1"
					/>
				</div>

				<!-- Priority -->
				{#if priorityLevels.length > 0}
					<div class="mt-3 {styles.formField()}">
						<Label>Priorita</Label>
						<Select.Root type="single" bind:value={priorityLevelId}>
							<Select.Trigger class="w-full">
								{#if priorityLevelId}
									{priorityLevels.find((p) => p.id === priorityLevelId)?.label ??
										'Zvolte prioritu'}
								{:else}
									Bez priority
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="" label="Bez priority"
										>Bez priority</Select.Item
									>
									{#each priorityLevels as level (level.id)}
										<Select.Item value={level.id} label={level.label}>
											{level.label}
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				{/if}

				<Separator class="my-4" />

				<!-- Actions -->
				<div class={styles.formActions()}>
					<Button
						class={styles.submitButton()}
						disabled={isSubmitting}
						onclick={handleSubmit}
					>
						{#if isSubmitting}
							Ukladam...
						{:else}
							{submitLabel}
						{/if}
					</Button>

					{#if isEdit && gift !== null}
						{#if isOwner}
							<Button
								variant="outline"
								class={styles.receivedButton()}
								onclick={handleReceived}
							>
								<CheckIcon data-icon="inline-start" />
								{gift.received ? 'Oznacit jako neprijaty' : 'Oznacit jako prijaty'}
							</Button>
						{/if}

						{#if canDelete}
							<Button
								variant="destructive"
								class={styles.deleteButton()}
								disabled={isDeleting}
								onclick={handleDelete}
							>
								<TrashIcon data-icon="inline-start" />
								{#if showDeleteConfirm}
									Opravdu smazat?
								{:else if isDeleting}
									Mazani...
								{:else}
									Smazat darek
								{/if}
							</Button>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
