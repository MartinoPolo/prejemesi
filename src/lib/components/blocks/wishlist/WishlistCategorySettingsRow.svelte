<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { tick } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { ColorPicker } from '$lib/components/derived/color-picker/index.js';
	import GiftCategoryBadge from '$lib/components/blocks/gift/GiftCategoryBadge.svelte';
	import { MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH } from '$lib/modules/gift-categories/types.js';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UndoIcon from '@lucide/svelte/icons/undo-2';
	import {
		categoryForRow,
		type CategorySettingsRow,
	} from './wishlist_category_settings_draft.js';

	interface Props {
		row: CategorySettingsRow;
		usedCount: number;
		disabled: boolean;
		labelConflicts: (label: string) => boolean;
		onrename: (label: string) => void;
		oncolorchange: (color: string) => void;
		onremove: () => void;
		onrestore: () => void;
		ongrippointerdown: (event: PointerEvent) => void;
		ongripkeydown: (event: KeyboardEvent) => void;
	}

	let {
		row,
		usedCount,
		disabled,
		labelConflicts,
		onrename,
		oncolorchange,
		onremove,
		onrestore,
		ongrippointerdown,
		ongripkeydown,
	}: Props = $props();

	const category = $derived(categoryForRow(row));
	const removalNote = $derived(
		usedCount === 1
			? m.gift_category_removal_staged_one()
			: m.gift_category_removal_staged_other({ count: usedCount }),
	);
	const renameErrorId = $props.id();
	// Recomputed whenever `disabled` changes, so a save or usage refresh closes an open rename.
	let renaming = $derived.by(() => {
		void disabled;
		return false;
	});
	let renameDraft = $state('');
	let renameError = $state<string | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);
	let renameTrigger = $state<HTMLButtonElement | null>(null);

	async function startRename() {
		if (disabled) {
			return;
		}
		renameDraft = row.label;
		renameError = null;
		renaming = true;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function finishRename(returnFocus: boolean) {
		renaming = false;
		renameError = null;
		if (returnFocus) {
			await tick();
			renameTrigger?.focus();
		}
	}

	function commitRename(returnFocus: boolean) {
		const label = renameDraft.trim();
		if (label !== '' && label !== row.label) {
			if (labelConflicts(label)) {
				renameError = m.server_error_gift_category_label_conflict();
				return;
			}
			onrename(label);
		}
		void finishRename(returnFocus);
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.isComposing) {
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRename(true);
		} else if (event.key === 'Escape') {
			// Escape belongs to the rename, not to the settings dialog around it.
			event.preventDefault();
			event.stopPropagation();
			void finishRename(true);
		}
	}

	function handleRenameBlur() {
		if (renaming) {
			commitRename(false);
		}
	}
</script>

<div
	class={[
		'flex items-center gap-2 rounded-(--category-row-radius) border-(length:--category-row-border) p-(--category-row-padding)',
		'data-[gift-reorder-overlay]:border-ink data-[gift-reorder-overlay]:bg-card',
		row.stagedForRemoval
			? 'border-[color-mix(in_oklab,var(--status-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-danger)_8%,var(--card))]'
			: 'border-border bg-background',
	]}
	data-testid="gift-category-settings-card"
	data-category-row
	data-category-id={row.key}
	data-category-label={row.label}
	data-staged-for-removal={row.stagedForRemoval ? '' : undefined}
>
	{#if row.stagedForRemoval}
		<span class="size-(--size-control-lg) shrink-0 sm:size-(--size-control-md)"></span>
		<div
			class="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-0.5 sm:flex-row sm:items-center sm:gap-2"
		>
			<GiftCategoryBadge {category} isDimmed class="line-through" />
			<span
				class="text-sm leading-tight font-semibold text-status-danger-text sm:ml-auto sm:text-right"
				data-testid="gift-category-removal-note">{removalNote}</span
			>
		</div>
		<Button type="button" intent="outline" size="sm" {disabled} onclick={onrestore}>
			<UndoIcon data-icon="inline-start" />
			{m.gift_category_removal_undo()}
		</Button>
	{:else}
		<Button
			type="button"
			format="icon"
			intent="ghost"
			class="cursor-grab touch-none active:cursor-grabbing"
			data-category-grip
			aria-label={m.gift_category_move_label({ category: row.label })}
			title={m.gift_category_move_hint()}
			{disabled}
			onpointerdown={ongrippointerdown}
			onkeydown={ongripkeydown}
		>
			<GripVerticalIcon />
		</Button>
		<div
			class="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-0.5 sm:flex-row sm:items-center sm:gap-2"
		>
			{#if renaming}
				<div class="flex w-full min-w-0 flex-col gap-1">
					<Input
						bind:ref={renameInput}
						bind:value={renameDraft}
						maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
						aria-label={m.gift_category_quick_add_name_label()}
						state={renameError === null ? 'default' : 'error'}
						aria-describedby={renameError === null ? undefined : renameErrorId}
						oninput={() => (renameError = null)}
						onkeydown={handleRenameKeydown}
						onblur={handleRenameBlur}
					/>
					{#if renameError !== null}
						<HelpText id={renameErrorId} state="error">{renameError}</HelpText>
					{/if}
				</div>
			{:else}
				<button
					bind:this={renameTrigger}
					type="button"
					class="group/rename inline-flex max-w-full min-w-0 cursor-text items-center gap-1.5 rounded-badge text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid disabled:cursor-not-allowed"
					aria-label={m.gift_category_rename_label({ category: row.label })}
					{disabled}
					onclick={startRename}
				>
					<GiftCategoryBadge {category} />
					<PencilIcon
						class="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/rename:opacity-100 group-focus-visible/rename:opacity-100 group-disabled/rename:opacity-0 max-sm:opacity-70 pointer-coarse:opacity-70"
						aria-hidden="true"
					/>
				</button>
				<span
					data-testid="gift-category-used-count"
					class="text-sm font-semibold whitespace-nowrap text-muted-foreground sm:ml-auto sm:text-right"
					>{m.gift_category_usage_compact({ count: usedCount })}</span
				>
			{/if}
		</div>
		<div class="flex shrink-0 items-center px-(--depth-clearance)">
			<ColorPicker
				value={row.color}
				label={m.gift_category_color_label({ category: row.label })}
				{disabled}
				onValueChange={oncolorchange}
			>
				{#snippet preview(stagedColor)}
					<GiftCategoryBadge category={{ ...category, color: stagedColor }} />
				{/snippet}
			</ColorPicker>
		</div>
		<Button
			type="button"
			format="icon"
			intent="ghost"
			data-category-remove
			aria-label={m.gift_category_remove_label({ category: row.label })}
			{disabled}
			onclick={onremove}
		>
			<TrashIcon />
		</Button>
	{/if}
</div>
