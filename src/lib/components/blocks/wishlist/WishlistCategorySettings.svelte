<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import {
		createCustomGiftCategoryCommand,
		deleteCustomGiftCategoryCommand,
		getGiftCategories,
		renameCustomGiftCategoryCommand,
		reorderGiftCategories,
		togglePresetGiftCategory,
	} from '$lib/modules/gift-categories/gift-categories.remote.js';
	import {
		GIFT_CATEGORY_PRESETS,
		labelForGiftCategory,
		type ManagedGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface Props {
		wishlistId: string;
		isShared: boolean;
	}

	let { wishlistId, isShared }: Props = $props();

	const categoriesQuery = $derived(getGiftCategories(wishlistId));
	const categories = $derived(categoriesQuery.current ?? []);
	const activePresetKeys = $derived(
		new Set(categories.flatMap((category) => category.presetKey ?? [])),
	);
	let customLabel = $state('');
	let renaming = $state<Record<string, string>>({});
	let pending = $state(false);

	function categoryLabel(category: ManagedGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	async function run(work: () => Promise<void>, success: string) {
		pending = true;
		try {
			await work();
			toastSuccess(success);
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			pending = false;
		}
	}

	function movedCategoryIds(index: number, direction: -1 | 1): string[] {
		const ids = categories.map((category) => category.id);
		const target = index + direction;
		const [id] = ids.splice(index, 1);
		if (id !== undefined) {
			ids.splice(target, 0, id);
		}
		return ids;
	}

	function reorder(ids: string[]) {
		void run(
			() => reorderGiftCategories({ wishlistId, categoryIds: ids }),
			m.gift_categories_reordered(),
		);
	}
</script>

<div class="flex flex-col gap-5">
	<p class="text-sm text-muted-foreground">{m.gift_categories_settings_hint()}</p>

	<div class="grid gap-2 sm:grid-cols-2">
		{#each GIFT_CATEGORY_PRESETS as preset (preset.key)}
			{@const enabled = activePresetKeys.has(preset.key)}
			<div
				class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
			>
				<div>
					<p class="text-sm font-semibold">
						{preset.labels[getLocale().startsWith('en') ? 'en' : 'cs']}
					</p>
					<p class="text-xs text-muted-foreground">
						{preset.labels.cs} / {preset.labels.en}
					</p>
				</div>
				<Button
					size="sm"
					intent={enabled ? 'outline' : 'primary'}
					disabled={pending}
					onclick={() =>
						void run(
							() =>
								togglePresetGiftCategory({
									wishlistId,
									presetKey: preset.key,
									enabled: !enabled,
								}),
							enabled ? m.gift_category_disabled() : m.gift_category_enabled(),
						)}
				>
					{enabled ? m.gift_category_disable() : m.gift_category_enable()}
				</Button>
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-3">
		<h3 class="text-base font-semibold">{m.gift_categories_active_title()}</h3>
		{#if categories.length === 0}
			<HelpText>{m.gift_categories_empty()}</HelpText>
		{:else}
			{#each categories as category, index (category.id)}
				{@const used = category.usedCount > 0}
				<div
					class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
				>
					<div class="min-w-0 flex-1">
						{#if category.customLabel === null}
							<p class="truncate text-sm font-semibold">{categoryLabel(category)}</p>
							<p class="text-xs text-muted-foreground">
								{m.gift_category_preset_locked()}
							</p>
						{:else}
							<Input
								value={renaming[category.id] ?? category.customLabel}
								maxlength={80}
								disabled={pending}
								oninput={(event) =>
									(renaming[category.id] = event.currentTarget.value)}
							/>
							{#if isShared && used}
								<HelpText>{m.gift_category_shared_rename_warning()}</HelpText>
							{/if}
						{/if}
						{#if used}
							<HelpText
								>{m.gift_category_used_count({
									count: category.usedCount,
								})}</HelpText
							>
						{/if}
					</div>
					<Button
						size="icon-sm"
						intent="ghost"
						disabled={pending || index === 0}
						onclick={() => reorder(movedCategoryIds(index, -1))}
						aria-label={m.move_up()}
					>
						<ArrowUpIcon />
					</Button>
					<Button
						size="icon-sm"
						intent="ghost"
						disabled={pending || index === categories.length - 1}
						onclick={() => reorder(movedCategoryIds(index, 1))}
						aria-label={m.move_down()}
					>
						<ArrowDownIcon />
					</Button>
					{#if category.customLabel !== null}
						<Button
							size="sm"
							intent="outline"
							disabled={pending ||
								(renaming[category.id] ?? category.customLabel).trim() ===
									category.customLabel}
							onclick={() =>
								void run(
									() =>
										renameCustomGiftCategoryCommand({
											categoryId: category.id,
											label: (
												renaming[category.id] ??
												category.customLabel ??
												''
											).trim(),
										}),
									m.gift_category_renamed(),
								)}
						>
							{m.save()}
						</Button>
						<Button
							size="icon-sm"
							intent="ghost"
							disabled={pending || used}
							onclick={() =>
								void run(
									() =>
										deleteCustomGiftCategoryCommand({
											categoryId: category.id,
										}),
									m.gift_category_deleted(),
								)}
							aria-label={m.delete()}
						>
							<TrashIcon />
						</Button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<form
		class="flex flex-wrap gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			const label = customLabel.trim();
			if (label === '') return;
			void run(async () => {
				await createCustomGiftCategoryCommand({ wishlistId, label });
				customLabel = '';
			}, m.gift_category_created());
		}}
	>
		<Input
			bind:value={customLabel}
			maxlength={80}
			placeholder={m.gift_category_custom_placeholder()}
			class="min-w-56 flex-1"
		/>
		<Button type="submit" disabled={pending || customLabel.trim() === ''}
			>{m.gift_category_create()}</Button
		>
	</form>

	<Alert.Root>
		<Alert.Description>{m.gift_categories_no_tags()}</Alert.Description>
	</Alert.Root>
</div>
