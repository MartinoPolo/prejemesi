<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import GiftCategoryBadge from '$lib/components/blocks/gift/GiftCategoryBadge.svelte';
	import { getGiftCategories } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
	import { saveGiftCategorySettingsCommand } from '$lib/modules/gift-categories/gift_categories.remote.js';
	import {
		MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
		type PublicGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import { giftCategoryColorForIndex } from '$lib/modules/gift-categories/gift_category_colors.js';
	import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		getServerErrorCode,
		translateServerError,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onDestroy, onMount, tick } from 'svelte';
	import WishlistCategorySettingsRow from './WishlistCategorySettingsRow.svelte';
	import { createCategorySettingsMotion } from './wishlist_category_settings_motion.svelte.js';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import {
		categoryForRow,
		categorySettingsDraft,
		labelConflicts,
		rowsFromCategories,
		type CategorySettingsDraft,
		type CategorySettingsRow,
	} from './wishlist_category_settings_draft.js';

	interface Props {
		wishlistId: string;
		saving?: boolean;
		commitVersion?: number;
		ondirtychange?: (dirty: boolean) => void;
		ondraftchange?: (draft: CategorySettingsDraft | null) => void;
	}

	let {
		wishlistId,
		saving = false,
		commitVersion = 0,
		ondirtychange,
		ondraftchange,
	}: Props = $props();
	const categoriesQuery = $derived(getGiftCategories(wishlistId));
	const savedCategories = $derived(categoriesQuery.current ?? []);
	const locale = $derived(getLocale().startsWith('en') ? 'en' : 'cs');
	let rows = $state<CategorySettingsRow[]>([]);
	let baseline = $state('');
	let seededSignature = $state('');
	let nextCustomColorIndex = $state(0);
	// svelte-ignore state_referenced_locally (one-time version seed)
	let seenCommitVersion = $state(commitVersion);
	let listElement = $state<HTMLElement | null>(null);
	let newCategoryOpen = $state(false);
	let newCategoryLabel = $state('');
	let newCategoryError = $state<string | null>(null);
	let newCategoryInput = $state<HTMLInputElement | null>(null);
	let newCategoryButton = $state<HTMLButtonElement | null>(null);
	const newCategoryErrorId = $props.id();
	let usageRefreshStatus = $state<'loading' | 'fresh' | 'error'>('loading');
	const categoryControlsDisabled = $derived(saving || usageRefreshStatus !== 'fresh');
	const keptRows = $derived(rows.filter((row) => !row.stagedForRemoval));
	const keptCountLabel = $derived.by(() => {
		const count = keptRows.length;
		const plural = czechPluralCategory(count);
		if (plural === 'one') {
			return m.gift_categories_count_one();
		}
		return plural === 'few'
			? m.gift_categories_count_few({ count })
			: m.gift_categories_count_other({ count });
	});
	const newCategoryPreview = $derived<PublicGiftCategory>({
		id: 'new-category-preview',
		presetKey: null,
		customLabel: newCategoryLabel.trim() || m.gift_category_new(),
		color: giftCategoryColorForIndex(nextCustomColorIndex),
		sortOrder: 0,
	});
	const categoryMotion = createCategorySettingsMotion();
	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			listElement === null
				? []
				: Array.from(
						listElement.querySelectorAll<HTMLElement>(':scope > [data-category-row]'),
					),
		getItemIds: () => rows.map((row) => row.key),
		onPreviewOrder: (orderedKeys) => void applyOrder(orderedKeys),
		onCommitOrder: (orderedKeys) => void applyOrder(orderedKeys),
		onCancelOrder: (orderedKeys) => void applyOrder(orderedKeys),
	});
	onDestroy(() => {
		reorder.destroy();
		categoryMotion.destroy();
	});
	onMount(() => {
		void refreshCategoryUsage();
	});

	async function refreshCategoryUsage() {
		usageRefreshStatus = 'loading';
		try {
			if (categoriesQuery.current === undefined) {
				await categoriesQuery;
			} else {
				await categoriesQuery.refresh();
			}
			usageRefreshStatus = 'fresh';
		} catch (thrown) {
			console.error('Failed to refresh category usage:', thrown);
			usageRefreshStatus = 'error';
		}
	}

	function usedCountFor(row: CategorySettingsRow): number {
		if (row.id === null) {
			return 0;
		}
		return categoriesQuery.current?.find((category) => category.id === row.id)?.usedCount ?? 0;
	}

	function snapshot(): string {
		return JSON.stringify(categorySettingsDraft(rows));
	}
	const dirty = $derived(baseline !== '' && snapshot() !== baseline);
	$effect(() => {
		ondirtychange?.(dirty);
		ondraftchange?.(dirty ? categorySettingsDraft(rows) : null);
	});
	$effect(() => {
		if (commitVersion !== seenCommitVersion) {
			seenCommitVersion = commitVersion;
			rows = rows.filter((row) => !row.stagedForRemoval);
			baseline = snapshot();
		}
	});
	$effect(() => {
		const signature = JSON.stringify(savedCategories);
		if (signature === seededSignature || dirty) {
			return;
		}
		rows = rowsFromCategories(savedCategories, locale);
		nextCustomColorIndex = savedCategories.filter(
			(category) => category.presetKey === null,
		).length;
		baseline = snapshot();
		seededSignature = signature;
	});

	function rowElement(key: string): HTMLElement | null {
		return (
			listElement?.querySelector<HTMLElement>(
				`:scope > [data-category-id="${CSS.escape(key)}"]`,
			) ?? null
		);
	}

	async function focusInRow(key: string, selector: string) {
		await tick();
		rowElement(key)?.querySelector<HTMLElement>(selector)?.focus();
	}

	async function applyOrder(orderedKeys: string[]) {
		if (orderedKeys.every((key, index) => rows[index]?.key === key)) {
			return;
		}
		const motionSnapshot = listElement === null ? null : categoryMotion.capture(listElement);
		const rowsByKey = new Map(rows.map((row) => [row.key, row]));
		rows = orderedKeys.flatMap((key) => rowsByKey.get(key) ?? []);
		await tick();
		if (motionSnapshot !== null && listElement !== null) {
			void categoryMotion.play(motionSnapshot, listElement);
		}
	}

	function handleGripPointerDown(event: PointerEvent, index: number) {
		if (!categoryControlsDisabled) {
			reorder.start(event, index);
		}
	}

	/** Escape mid-drag cancels the drag before the settings dialog would treat it as dismissal. */
	function cancelDragOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape' && reorder.draggedGiftId.current !== null) {
			event.preventDefault();
			event.stopPropagation();
			reorder.cancel();
		}
	}

	function handleGripKeydown(event: KeyboardEvent, index: number, key: string) {
		const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (direction === 0 || categoryControlsDisabled) {
			return;
		}
		event.preventDefault();
		if (reorder.move(index, direction)) {
			void focusInRow(key, '[data-category-grip]');
		}
	}

	function updateRow(key: string, change: Partial<CategorySettingsRow>) {
		rows = rows.map((row) => (row.key === key ? { ...row, ...change } : row));
	}

	async function removeRow(row: CategorySettingsRow) {
		if (categoryControlsDisabled) {
			return;
		}
		if (usedCountFor(row) > 0) {
			updateRow(row.key, { stagedForRemoval: true });
			void focusInRow(row.key, 'button');
			return;
		}
		const index = rows.findIndex((candidate) => candidate.key === row.key);
		const motionSnapshot =
			listElement === null ? null : categoryMotion.capture(listElement, row.key);
		rows = rows.filter((candidate) => candidate.key !== row.key);
		await tick();
		const nextRow = rows[index] ?? rows[index - 1];
		const nextFocus =
			nextRow === undefined
				? newCategoryButton
				: rowElement(nextRow.key)?.querySelector<HTMLElement>('button:not(:disabled)');
		nextFocus?.focus();
		if (motionSnapshot !== null && listElement !== null) {
			void categoryMotion.play(motionSnapshot, listElement);
		}
	}

	function restoreRow(row: CategorySettingsRow) {
		updateRow(row.key, { stagedForRemoval: false });
		void focusInRow(row.key, '[data-category-remove]');
	}

	async function openNewCategory() {
		newCategoryOpen = true;
		await tick();
		newCategoryInput?.focus();
	}

	async function closeNewCategory() {
		newCategoryOpen = false;
		newCategoryLabel = '';
		newCategoryError = null;
		await tick();
		newCategoryButton?.focus();
	}

	function addNewCategory() {
		const label = newCategoryLabel.trim();
		if (label === '' || categoryControlsDisabled) {
			newCategoryInput?.focus();
			return;
		}
		if (labelConflicts(rows, label, null)) {
			newCategoryError = m.server_error_gift_category_label_conflict();
			newCategoryInput?.focus();
			return;
		}
		rows = [
			...rows,
			{
				key: crypto.randomUUID(),
				id: null,
				presetKey: null,
				label,
				color: giftCategoryColorForIndex(nextCustomColorIndex),
				stagedForRemoval: false,
			},
		];
		nextCustomColorIndex += 1;
		newCategoryLabel = '';
		newCategoryError = null;
		newCategoryInput?.focus();
	}

	function handleNewCategoryKeydown(event: KeyboardEvent) {
		if (event.isComposing) {
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			addNewCategory();
		} else if (event.key === 'Escape') {
			// Escape closes the inline row, not the settings dialog around it.
			event.preventDefault();
			event.stopPropagation();
			void closeNewCategory();
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (ondraftchange !== undefined) {
			return;
		}
		saving = true;
		try {
			await saveGiftCategorySettingsCommand({ wishlistId, ...categorySettingsDraft(rows) });
			rows = rows.filter((row) => !row.stagedForRemoval);
			baseline = snapshot();
			await tick();
			toastSuccess(m.gift_categories_saved());
		} catch (thrown) {
			if (
				getServerErrorCode(thrown) ===
				SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH
			) {
				baseline = '';
				seededSignature = '';
				await refreshCategoryUsage();
			}
			toastError(translateServerError(thrown));
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydowncapture={cancelDragOnEscape} />

<form id="wishlist-categories-form" class="category-settings flex flex-col gap-4" onsubmit={save}>
	<p class="max-w-160 text-sm text-muted-foreground">{m.gift_categories_intro()}</p>
	{#if usageRefreshStatus === 'error'}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3"
			role="alert"
		>
			<p class="text-sm text-status-danger-text">{m.error_generic()}</p>
			<Button type="button" size="sm" intent="outline" onclick={refreshCategoryUsage}>
				{m.import_wizard_retry()}
			</Button>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex items-baseline justify-between gap-3">
				<h3 class="text-base font-semibold">{m.gift_categories_list_title()}</h3>
				<span
					class="text-sm font-semibold text-muted-foreground"
					data-testid="gift-category-count">{keptCountLabel}</span
				>
			</div>
			{#if rows.length === 0}
				<HelpText>{m.gift_categories_empty()}</HelpText>
			{/if}
			<div class="relative flex flex-col gap-2" bind:this={listElement}>
				{#each rows as row, index (row.key)}
					<WishlistCategorySettingsRow
						{row}
						usedCount={usedCountFor(row)}
						disabled={categoryControlsDisabled}
						labelConflicts={(label) => labelConflicts(rows, label, row.key)}
						onrename={(label) => updateRow(row.key, { label })}
						oncolorchange={(color) => updateRow(row.key, { color })}
						onremove={() => removeRow(row)}
						onrestore={() => restoreRow(row)}
						ongrippointerdown={(event) => handleGripPointerDown(event, index)}
						ongripkeydown={(event) => handleGripKeydown(event, index, row.key)}
					/>
				{/each}
			</div>
			{#if newCategoryOpen}
				<div
					class="flex flex-col gap-1 rounded-(--category-row-radius) border-(length:--category-new-row-border) border-ink bg-card p-(--category-row-padding) [--radius-btn:var(--category-new-row-inner-radius)]"
					data-testid="gift-category-new-row"
				>
					<div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
						<span
							class="grid size-(--size-control-lg) shrink-0 place-items-center text-muted-foreground sm:size-(--size-control-md)"
							aria-hidden="true"><PlusIcon class="size-4" /></span
						>
						<Input
							bind:ref={newCategoryInput}
							bind:value={newCategoryLabel}
							class="min-w-0 flex-[1_1_9rem]"
							maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
							placeholder={m.gift_category_quick_add_name_label()}
							aria-label={m.gift_category_quick_add_name_label()}
							state={newCategoryError === null ? 'default' : 'error'}
							aria-describedby={newCategoryError === null
								? undefined
								: newCategoryErrorId}
							disabled={categoryControlsDisabled}
							oninput={() => (newCategoryError = null)}
							onkeydown={handleNewCategoryKeydown}
						/>
						<span
							class="order-last max-w-full basis-full pl-[calc(var(--size-control-lg)+0.5rem)] sm:order-none sm:max-w-[40%] sm:basis-auto sm:pl-0"
							data-testid="gift-category-new-preview"
						>
							<GiftCategoryBadge category={newCategoryPreview} />
						</span>
						<Button
							type="button"
							class="me-(--depth-clearance)"
							disabled={categoryControlsDisabled}
							onclick={addNewCategory}
						>
							{m.gift_category_add()}
						</Button>
					</div>
					{#if newCategoryError !== null}
						<HelpText
							id={newCategoryErrorId}
							state="error"
							class="pl-[calc(var(--size-control-lg)+0.5rem)] sm:pl-[calc(var(--size-control-md)+0.5rem)]"
							>{newCategoryError}</HelpText
						>
					{/if}
				</div>
			{:else}
				<button
					bind:this={newCategoryButton}
					type="button"
					class="flex min-h-[calc(var(--size-control-lg)+var(--category-row-chrome))] w-full cursor-pointer items-center gap-2 rounded-(--category-row-radius) border-(length:--category-new-row-border) border-dashed border-border-strong p-(--category-row-padding) text-base font-bold text-brand-link outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[calc(var(--size-control-md)+var(--category-row-chrome))]"
					disabled={categoryControlsDisabled}
					onclick={openNewCategory}
				>
					<span
						class="grid size-(--size-control-lg) shrink-0 place-items-center sm:size-(--size-control-md)"
						aria-hidden="true"><PlusIcon class="size-4" /></span
					>
					{m.gift_category_new()}
				</button>
			{/if}
		</div>

		<aside
			class="sticky top-0 hidden self-start rounded-panel border border-border bg-muted p-4 lg:block"
			data-testid="gift-category-order-preview"
		>
			<h3 class="mb-1.5 text-base font-semibold">{m.gift_categories_order_title()}</h3>
			<p class="mb-3 text-sm text-muted-foreground">{m.gift_categories_order_hint()}</p>
			<div class="flex flex-wrap gap-1.5">
				{#each keptRows as row (row.key)}
					<GiftCategoryBadge category={categoryForRow(row)} />
				{/each}
			</div>
		</aside>
	</div>
</form>

<style>
	/* Row controls keep the shared button radius, so the row corner is derived outward from it.
	   The new-category rows share that outer corner with a thicker border, so their controls take
	   the radius left after border and padding (AGENTS.md, nested corner geometry). The closed
	   new-category row adds a row's padding and border around its control to match a row's height. */
	.category-settings {
		--category-row-padding: 0.375rem;
		--category-row-border: 1px;
		--category-new-row-border: 2px;
		--category-row-radius: calc(
			var(--radius-btn) + var(--category-row-padding) + var(--category-row-border)
		);
		--category-new-row-inner-radius: max(
			0px,
			var(--category-row-radius) - var(--category-new-row-border) -
				var(--category-row-padding)
		);
		--category-row-chrome: calc(2 * (var(--category-row-padding) + var(--category-row-border)));
	}
</style>
