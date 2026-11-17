<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		labelForGiftCategory,
		type ManagedGiftCategory,
		type PublicGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import {
		MAX_GIFT_CATEGORIES,
		giftCategoriesForIds,
		withGiftCategoryAdded,
		withGiftCategoryRemoved,
	} from '$lib/modules/gift-categories/gift_category_assignment.js';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import GiftCategoryQuickAddDialog from './GiftCategoryQuickAddDialog.svelte';

	interface Props {
		/** Ordered: the first category groups the gift. */
		categoryIds: string[];
		categoryOptions: readonly ManagedGiftCategory[];
		/** Categories the gift already carries, which may be missing from the options. */
		giftCategories: readonly PublicGiftCategory[];
		/** Offers creating a category from the select; the gift gets it on save. */
		canCreateCategory: boolean;
		wishlistId: string;
	}

	let {
		categoryIds = $bindable(),
		categoryOptions,
		giftCategories,
		canCreateCategory,
		wishlistId,
	}: Props = $props();

	const CREATE_CATEGORY_VALUE = '__create-category__';

	let quickAddOpen = $state(false);
	let selectOpen = $state(false);
	let chipList = $state<HTMLElement | null>(null);
	// Shown until the refreshed category list that includes it arrives.
	let createdCategory = $state<PublicGiftCategory | null>(null);
	const selectOptions = $derived<readonly PublicGiftCategory[]>(
		createdCategory === null ||
			categoryOptions.some((category) => category.id === createdCategory?.id)
			? categoryOptions
			: [...categoryOptions, createdCategory],
	);
	const selectedCategories = $derived(
		giftCategoriesForIds(categoryIds, [...selectOptions, ...giftCategories]),
	);
	const isAtLimit = $derived(categoryIds.length >= MAX_GIFT_CATEGORIES);

	function categoryLabel(category: PublicGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	/** Keeps the chosen order: kept categories stay in place and new ones join at the end. */
	function chooseCategories(values: string[]) {
		if (values.includes(CREATE_CATEGORY_VALUE)) {
			selectOpen = false;
			quickAddOpen = true;
			return;
		}
		categoryIds = [
			...categoryIds.filter((id) => values.includes(id)),
			...values.filter((id) => !categoryIds.includes(id)),
		].slice(0, MAX_GIFT_CATEGORIES);
	}

	/** The pressed chip button disappears or moves, so keep keyboard focus on the chip list. */
	async function focusChipButton(categoryId: string | undefined) {
		await tick();
		const chipButton = chipList?.querySelector<HTMLElement>(
			`[data-category-chip="${categoryId}"] button`,
		);
		(
			chipButton ??
			document.querySelector<HTMLElement>('[data-testid="gift-category-select"]')
		)?.focus();
	}

	function removeCategory(id: string) {
		const index = categoryIds.indexOf(id);
		categoryIds = withGiftCategoryRemoved(categoryIds, id);
		void focusChipButton(categoryIds[index] ?? categoryIds[index - 1]);
	}

	function moveCategoryEarlier(index: number) {
		const reordered = [...categoryIds];
		[reordered[index - 1], reordered[index]] = [reordered[index]!, reordered[index - 1]!];
		categoryIds = reordered;
		void focusChipButton(reordered[index - 1]);
	}

	function selectCreatedCategory(category: PublicGiftCategory) {
		createdCategory = category;
		categoryIds = withGiftCategoryAdded(categoryIds, category.id);
	}
</script>

{#snippet categorySelect()}
	<Select.Root
		type="multiple"
		bind:open={selectOpen}
		bind:value={() => categoryIds, chooseCategories}
	>
		<Select.Trigger id="gift-category" class="w-full" data-testid="gift-category-select">
			<span class="truncate">
				{selectedCategories.length === 0
					? m.gift_category_none()
					: selectedCategories.map(categoryLabel).join(', ')}
			</span>
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				{#each selectOptions as category (category.id)}
					{@const label = categoryLabel(category)}
					<Select.Item
						value={category.id}
						{label}
						indicator="checkbox"
						disabled={isAtLimit && !categoryIds.includes(category.id)}
						><span
							class="size-3 shrink-0 rounded-full border border-edge"
							style:background-color={category.color}
							aria-hidden="true"
						></span>{label}</Select.Item
					>
				{/each}
			</Select.Group>
			{#if canCreateCategory}
				<Select.Separator />
				<Select.Item
					value={CREATE_CATEGORY_VALUE}
					label={m.gift_category_create()}
					disabled={isAtLimit}
					data-testid="gift-category-create-option"
					><PlusIcon />{m.gift_category_create()}</Select.Item
				>
			{/if}
		</Select.Content>
	</Select.Root>
{/snippet}

{#snippet selectedCategoryChips()}
	{#if selectedCategories.length > 0}
		<ul
			class="flex flex-wrap gap-1.5"
			aria-label={m.gift_category_label()}
			bind:this={chipList}
			data-testid="gift-category-chips"
		>
			{#each selectedCategories as category, index (category.id)}
				{@const label = categoryLabel(category)}
				<li
					class="inline-flex min-w-0 items-center gap-0.5"
					data-category-chip={category.id}
				>
					<GiftCategoryBadge {category} />
					{#if index > 0}
						<Button
							intent="ghost"
							size="sm"
							format="icon"
							aria-label={m.gift_category_chip_promote_label({ category: label })}
							onclick={() => moveCategoryEarlier(index)}><ArrowLeftIcon /></Button
						>
					{/if}
					<Button
						intent="ghost"
						size="sm"
						format="icon"
						aria-label={m.gift_category_chip_remove_label({ category: label })}
						onclick={() => removeCategory(category.id)}><XIcon /></Button
					>
				</li>
			{/each}
		</ul>
		{#if selectedCategories.length > 1}
			<HelpText>{m.gift_categories_primary_help()}</HelpText>
		{/if}
		{#if isAtLimit}
			<HelpText>{m.gift_categories_limit_help({ count: MAX_GIFT_CATEGORIES })}</HelpText>
		{/if}
	{/if}
{/snippet}

<div class="flex min-w-0 flex-col gap-1.5" data-testid="gift-category-field">
	<Label for="gift-category">{m.gift_category_label()}</Label>
	{#if selectOptions.length > 0 || canCreateCategory}
		{@render categorySelect()}
		{@render selectedCategoryChips()}
	{:else}
		<Select.Root type="single" disabled>
			<Select.Trigger id="gift-category" class="w-full" disabled>
				{m.gift_category_none_enabled()}
			</Select.Trigger>
		</Select.Root>
		<HelpText>{m.gift_category_none_enabled_help()}</HelpText>
	{/if}
</div>

{#if canCreateCategory}
	<GiftCategoryQuickAddDialog
		bind:open={quickAddOpen}
		{wishlistId}
		target={{ kind: 'editor' }}
		categories={selectOptions}
		oncreated={selectCreatedCategory}
	/>
{/if}
