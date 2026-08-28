<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import {
		getGiftCategories,
		saveGiftCategorySettingsCommand,
	} from '$lib/modules/gift-categories/gift_categories.remote.js';
	import {
		GIFT_CATEGORY_PRESETS,
		MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
		type GiftCategoryPresetKey,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { tick } from 'svelte';

	interface Props {
		wishlistId: string;
		ondirtychange?: (dirty: boolean) => void;
		onsavingchange?: (saving: boolean) => void;
		onsaved?: () => void;
	}
	interface CustomDraft {
		key: string;
		id: string | null;
		label: string;
		usedCount: number;
	}
	interface PendingRemoval {
		type: 'custom' | 'preset';
		key: string;
		categoryId: string;
		label: string;
		usedCount: number;
	}

	let { wishlistId, ondirtychange, onsavingchange, onsaved }: Props = $props();
	const categoriesQuery = $derived(getGiftCategories(wishlistId));
	const categories = $derived(categoriesQuery.current ?? []);
	let customLabel = $state('');
	let customDrafts = $state<CustomDraft[]>([]);
	let enabledPresets = $state<GiftCategoryPresetKey[]>([]);
	let baseline = $state('');
	let seededSignature = $state('');
	let saving = $state(false);
	let pendingRemoval = $state<PendingRemoval | null>(null);
	let confirmedRemovalCategoryIds = $state<string[]>([]);
	let removalTrigger = $state<HTMLElement | null>(null);

	function snapshot(): string {
		return JSON.stringify({
			custom: customDrafts.map(({ id, label }) => ({ id, label: label.trim() })),
			presets: [...enabledPresets].sort(),
		});
	}
	const dirty = $derived(baseline !== '' && snapshot() !== baseline);
	$effect(() => ondirtychange?.(dirty));
	$effect(() => onsavingchange?.(saving));
	$effect(() => {
		const signature = JSON.stringify(categories);
		if (signature === seededSignature || dirty) {
			return;
		}
		customDrafts = categories
			.filter((category) => category.customLabel !== null)
			.map((category) => ({
				key: category.id,
				id: category.id,
				label: category.customLabel ?? '',
				usedCount: category.usedCount,
			}));
		enabledPresets = categories.flatMap((category) => category.presetKey ?? []);
		baseline = snapshot();
		seededSignature = signature;
	});

	function createCustom() {
		const label = customLabel.trim();
		if (!label || saving) {
			return;
		}
		customDrafts = [
			{ key: crypto.randomUUID(), id: null, label, usedCount: 0 },
			...customDrafts,
		];
		customLabel = '';
	}
	function handleCreateKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.isComposing) {
			return;
		}
		event.preventDefault();
		createCustom();
	}
	function move(index: number, direction: -1 | 1) {
		const next = [...customDrafts];
		const item = next.splice(index, 1)[0]!;
		next.splice(index + direction, 0, item);
		customDrafts = next;
	}
	async function togglePreset(
		key: GiftCategoryPresetKey,
		checked: boolean,
		label: string,
		usedCount: number,
	) {
		const persisted = categories.find((category) => category.presetKey === key);
		if (!checked && persisted !== undefined) {
			removalTrigger = document.activeElement as HTMLElement | null;
			pendingRemoval = { type: 'preset', key, categoryId: persisted.id, label, usedCount };
			// Bits UI updates its bindable state before reporting the attempted toggle. Drive the
			// controlled prop through a full state change to restore it without recreating the node.
			enabledPresets = enabledPresets.filter((candidate) => candidate !== key);
			await tick();
			if (pendingRemoval?.categoryId === persisted.id) {
				enabledPresets = [...enabledPresets, key];
			}
			return;
		}
		if (checked) {
			enabledPresets = enabledPresets.includes(key)
				? enabledPresets
				: [...enabledPresets, key];
			if (persisted !== undefined) {
				confirmedRemovalCategoryIds = confirmedRemovalCategoryIds.filter(
					(id) => id !== persisted.id,
				);
			}
		} else {
			enabledPresets = enabledPresets.filter((candidate) => candidate !== key);
		}
	}
	function requestCustomRemoval(category: CustomDraft, trigger: HTMLElement) {
		if (category.id !== null) {
			removalTrigger = trigger;
			pendingRemoval = {
				type: 'custom',
				key: category.key,
				categoryId: category.id,
				label: category.label.trim(),
				usedCount: category.usedCount,
			};
			return;
		}
		customDrafts = customDrafts.filter((item) => item.key !== category.key);
	}
	function confirmRemoval() {
		const removal = pendingRemoval;
		if (removal === null) {
			return;
		}
		confirmedRemovalCategoryIds = [
			...confirmedRemovalCategoryIds.filter((id) => id !== removal.categoryId),
			removal.categoryId,
		];
		if (removal.type === 'custom') {
			customDrafts = customDrafts.filter((item) => item.key !== removal.key);
		} else {
			enabledPresets = enabledPresets.filter((key) => key !== removal.key);
		}
		pendingRemoval = null;
	}
	function restoreRemovalTrigger(event: Event) {
		event.preventDefault();
		if (removalTrigger?.isConnected) {
			removalTrigger.focus();
		}
		removalTrigger = null;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			await saveGiftCategorySettingsCommand({
				wishlistId,
				customCategories: customDrafts.map(({ id, label }) => ({
					id,
					label: label.trim(),
				})),
				presetKeys: enabledPresets,
				confirmedRemovalCategoryIds,
			});
			confirmedRemovalCategoryIds = [];
			baseline = snapshot();
			toastSuccess(m.gift_categories_saved());
			onsaved?.();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			saving = false;
		}
	}
</script>

<form id="wishlist-categories-form" class="flex flex-col gap-5" onsubmit={save}>
	<p class="text-sm text-muted-foreground">{m.gift_categories_settings_hint()}</p>

	<div class="flex flex-col gap-2">
		<h3 class="text-base font-semibold">{m.gift_category_create()}</h3>
		<div class="flex flex-wrap gap-2">
			<Input
				bind:value={customLabel}
				maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
				placeholder={m.gift_category_custom_placeholder()}
				class="min-w-56 flex-1"
				disabled={saving}
				onkeydown={handleCreateKeydown}
			/>
			<Button
				type="button"
				onclick={createCustom}
				disabled={saving || customLabel.trim() === ''}>{m.gift_category_create()}</Button
			>
		</div>
	</div>

	<div class="flex flex-col gap-3">
		<h3 class="text-base font-semibold">{m.gift_categories_custom_title()}</h3>
		{#if customDrafts.length === 0}
			<HelpText>{m.gift_categories_empty()}</HelpText>
		{:else}
			{#each customDrafts as category, index (category.key)}
				<div
					class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
				>
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<Input
							bind:value={category.label}
							maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
							class="min-w-0 flex-1"
							disabled={saving}
						/>
						<span
							data-testid="gift-category-used-count"
							class="w-20 shrink-0 text-right text-xs text-muted-foreground"
							>{m.gift_category_usage_compact({ count: category.usedCount })}</span
						>
					</div>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={saving || index === 0}
						onclick={() => move(index, -1)}
						aria-label={m.move_up()}><ArrowUpIcon /></Button
					>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={saving || index === customDrafts.length - 1}
						onclick={() => move(index, 1)}
						aria-label={m.move_down()}><ArrowDownIcon /></Button
					>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={saving}
						onclick={(event) => requestCustomRemoval(category, event.currentTarget)}
						aria-label={m.delete()}><TrashIcon /></Button
					>
				</div>
			{/each}
		{/if}
	</div>

	<div class="flex flex-col gap-3">
		<h3 class="text-base font-semibold">{m.gift_categories_presets_title()}</h3>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each GIFT_CATEGORY_PRESETS as preset (preset.key)}
				{@const checked = enabledPresets.includes(preset.key)}
				{@const label = preset.labels[getLocale().startsWith('en') ? 'en' : 'cs']}
				{@const usedCount =
					categories.find((category) => category.presetKey === preset.key)?.usedCount ??
					0}
				<label
					class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
				>
					<Checkbox
						{checked}
						disabled={saving}
						onCheckedChange={(value) =>
							togglePreset(preset.key, value === true, label, usedCount)}
					/>
					<span class="min-w-0 flex-1">{label}</span>
					{#if checked}
						<span
							data-testid="gift-category-used-count"
							class="w-20 shrink-0 text-right text-xs font-normal text-muted-foreground"
							>{m.gift_category_usage_compact({ count: usedCount })}</span
						>
					{/if}
				</label>
			{/each}
		</div>
	</div>
</form>

<Dialog.Root
	open={pendingRemoval !== null}
	onOpenChange={(open) => {
		if (!open) pendingRemoval = null;
	}}
>
	<Dialog.Content size="md" onCloseAutoFocus={restoreRemovalTrigger}>
		<Dialog.Header>
			<Dialog.Title>
				{m.gift_category_remove_confirm_title({ category: pendingRemoval?.label ?? '' })}
			</Dialog.Title>
			<Dialog.Description>
				{m.gift_category_remove_confirm_description({
					count: pendingRemoval?.usedCount ?? 0,
				})}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button type="button" intent="outline" onclick={() => (pendingRemoval = null)}>
				{m.cancel()}
			</Button>
			<Button
				type="button"
				intent="danger"
				data-testid="gift-category-remove-confirm"
				onclick={confirmRemoval}
			>
				{m.gift_category_remove_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
