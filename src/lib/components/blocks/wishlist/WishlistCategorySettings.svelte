<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import {
		getGiftCategories,
		saveGiftCategorySettingsCommand,
	} from '$lib/modules/gift-categories/gift_categories.remote.js';
	import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

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

	let { wishlistId, ondirtychange, onsavingchange, onsaved }: Props = $props();
	const categoriesQuery = $derived(getGiftCategories(wishlistId));
	const categories = $derived(categoriesQuery.current ?? []);
	let customLabel = $state('');
	let customDrafts = $state<CustomDraft[]>([]);
	let enabledPresets = $state<string[]>([]);
	let baseline = $state('');
	let seededSignature = $state('');
	let saving = $state(false);

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
		if (!label) {
			return;
		}
		customDrafts = [
			{ key: crypto.randomUUID(), id: null, label, usedCount: 0 },
			...customDrafts,
		];
		customLabel = '';
	}
	function move(index: number, direction: -1 | 1) {
		const next = [...customDrafts];
		const [item] = next.splice(index, 1);
		if (item) {
			next.splice(index + direction, 0, item);
		}
		customDrafts = next;
	}
	function togglePreset(key: string, checked: boolean) {
		enabledPresets = checked
			? [...enabledPresets, key]
			: enabledPresets.filter((candidate) => candidate !== key);
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
				presetKeys: enabledPresets as never,
			});
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
				maxlength={80}
				placeholder={m.gift_category_custom_placeholder()}
				class="min-w-56 flex-1"
				disabled={saving}
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
					<div class="min-w-0 flex-1">
						<Input bind:value={category.label} maxlength={80} disabled={saving} />
						{#if category.usedCount > 0}<HelpText
								>{m.gift_category_used_count({
									count: category.usedCount,
								})}</HelpText
							>{/if}
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
						disabled={saving || category.usedCount > 0}
						onclick={() =>
							(customDrafts = customDrafts.filter(
								(item) => item.key !== category.key,
							))}
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
				<label
					class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
				>
					<Checkbox
						{checked}
						disabled={saving}
						onCheckedChange={(value) => togglePreset(preset.key, value === true)}
					/>
					{preset.labels[getLocale().startsWith('en') ? 'en' : 'cs']}
				</label>
			{/each}
		</div>
	</div>
</form>
