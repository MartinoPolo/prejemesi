<script lang="ts">
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftBulkAction,
		PendingGiftBulkActionDescriptor,
	} from '$lib/modules/gifts/gift_bulk_update.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props {
		selectedCount: number;
		hiddenCount: number;
		visibleState: 'none' | 'some' | 'all';
		pending?: PendingGiftBulkActionDescriptor | null;
		priorityReady?: boolean;
		categoryReady?: boolean;
		priorityLevels: Choice[];
		categories: Choice[];
		commonPriorityId: string | null | undefined;
		commonCategoryId: string | null | undefined;
		commonImageFit?: 'fill' | 'fit' | undefined;
		commonImageBackground: string | null | undefined;
		commonReceived?: boolean | undefined;
		onselectvisible: (checked: boolean) => void;
		onpriority: (id: string | null) => void;
		oncategory: (id: string | null) => void;
		onaction: (action: GiftBulkAction) => void;
		ondone: () => void;
	}
	let {
		selectedCount,
		hiddenCount,
		visibleState,
		pending = null,
		priorityReady = false,
		categoryReady = false,
		priorityLevels,
		categories,
		commonPriorityId,
		commonCategoryId,
		commonImageFit = undefined,
		commonImageBackground,
		commonReceived = undefined,
		onselectvisible,
		onpriority,
		oncategory,
		onaction,
		ondone,
	}: Props = $props();
	const disabled = $derived(pending !== null || selectedCount === 0);
	const pendingLabel = $derived(
		pending === null ? '' : m.gift_bulk_pending({ count: pending.count }),
	);
	const prioritySummary = $derived(
		commonPriorityId === undefined
			? m.gift_selection_mixed()
			: commonPriorityId === null
				? m.gift_priority_none()
				: (priorityLevels.find((x) => x.id === commonPriorityId)?.label ??
					m.gift_priority_none()),
	);
	const categorySummary = $derived(
		commonCategoryId === undefined
			? m.gift_selection_mixed()
			: commonCategoryId === null
				? m.gift_category_uncategorized()
				: (categories.find((x) => x.id === commonCategoryId)?.label ??
					m.gift_category_uncategorized()),
	);
	const imageFitSummary = $derived(
		commonImageFit === undefined
			? m.gift_selection_mixed()
			: commonImageFit === 'fill'
				? m.image_fit_fill()
				: m.image_fit_fit(),
	);
	const backgroundSummary = $derived(
		commonImageBackground === undefined
			? m.gift_selection_mixed()
			: commonImageBackground === null
				? m.image_background_transparent()
				: commonImageBackground === '#ffffff'
					? m.image_background_white()
					: commonImageBackground === '#000000'
						? m.image_background_black()
						: m.gift_selection_mixed(),
	);
	const receivedSummary = $derived(
		commonReceived === undefined
			? m.gift_selection_mixed()
			: commonReceived
				? m.gift_mark_received()
				: m.gift_mark_unreceived(),
	);
	function labelWithOptionalSummary(label: string, summary: string) {
		return `${label}: ${summary}`;
	}
	function triggerLabel(action: PendingGiftBulkActionDescriptor['action'], fallback: string) {
		return pending?.action === action ? pendingLabel : fallback;
	}

	const MIXED_RADIO_VALUE = '__mixed__';

	function handleImageFit(fit: 'fill' | 'fit') {
		onaction({ action: 'imageFit', fit });
	}

	function handleImageBackground(background: '#ffffff' | '#000000' | null) {
		onaction({ action: 'imageBackground', background });
	}

	function handleReceived(received: boolean) {
		onaction({ action: 'received', received });
	}
</script>

{#snippet priorityItems()}{#if commonPriorityId === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonPriorityId === undefined ? MIXED_RADIO_VALUE : (commonPriorityId ?? '')}
		onValueChange={(id) => onpriority(id === '' ? null : id)}
		><DropdownMenu.RadioItem value="">{m.gift_priority_none()}</DropdownMenu.RadioItem
		>{#each priorityLevels as choice (choice.id)}<DropdownMenu.RadioItem value={choice.id}
				>{choice.label}</DropdownMenu.RadioItem
			>{/each}</DropdownMenu.RadioGroup
	>{/snippet}
{#snippet categoryItems()}{#if commonCategoryId === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonCategoryId === undefined ? MIXED_RADIO_VALUE : (commonCategoryId ?? '')}
		onValueChange={(id) => oncategory(id === '' ? null : id)}
		><DropdownMenu.RadioItem value="">{m.gift_category_uncategorized()}</DropdownMenu.RadioItem
		>{#each categories as choice (choice.id)}<DropdownMenu.RadioItem value={choice.id}
				>{choice.label}</DropdownMenu.RadioItem
			>{/each}</DropdownMenu.RadioGroup
	>{/snippet}
{#snippet imageFitItems()}{#if commonImageFit === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonImageFit ?? MIXED_RADIO_VALUE}
		onValueChange={(fit) => {
			if (fit === 'fill' || fit === 'fit') handleImageFit(fit);
		}}
		><DropdownMenu.RadioItem data-testid="selection-image-fit-fill" value="fill"
			>{m.image_fit_fill()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-image-fit-fit" value="fit"
			>{m.image_fit_fit()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}
{#snippet imageBackgroundItems()}{#if commonImageBackground === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonImageBackground === undefined
			? MIXED_RADIO_VALUE
			: (commonImageBackground ?? 'transparent')}
		onValueChange={(background) =>
			handleImageBackground(
				background === '#ffffff' || background === '#000000' ? background : null,
			)}
		><DropdownMenu.RadioItem data-testid="selection-image-background-white" value="#ffffff"
			>{m.image_background_white()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-image-background-black" value="#000000"
			>{m.image_background_black()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem
			data-testid="selection-image-background-transparent"
			value="transparent">{m.image_background_transparent()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}
{#snippet receivedItems()}{#if commonReceived === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonReceived === undefined ? MIXED_RADIO_VALUE : String(commonReceived)}
		onValueChange={(received) => {
			if (received === 'true' || received === 'false') handleReceived(received === 'true');
		}}
		><DropdownMenu.RadioItem data-testid="selection-received-true" value="true"
			>{m.gift_mark_received()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-received-false" value="false"
			>{m.gift_mark_unreceived()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}

<div class="selection-toolbar" role="region" aria-label={m.gift_selection_toolbar()}>
	<div class="selection-summary">
		<Checkbox
			checked={visibleState === 'all'}
			indeterminate={visibleState === 'some'}
			onCheckedChange={onselectvisible}
			aria-label={m.gift_selection_visible_all()}
		/><strong class="whitespace-nowrap text-sm"
			>{m.gift_selection_count({ count: selectedCount })}</strong
		>{#if hiddenCount > 0}<span
				class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-bold text-warning-foreground"
				><EyeOffIcon class="size-3.5" />{m.gift_selection_hidden_count({
					count: hiddenCount,
				})}</span
			>{/if}
	</div>
	<div class="wide-controls" data-testid="selection-wide-controls">
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button
						{...props}
						intent="outline"
						size="md"
						disabled={disabled || !priorityReady}
						>{triggerLabel(
							'priority',
							labelWithOptionalSummary(
								m.gift_priority_label(),
								priorityReady ? prioritySummary : m.moderator_loading(),
							),
						)}<ChevronDownIcon data-icon="inline-end" /></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content>{@render priorityItems()}</DropdownMenu.Content
			></DropdownMenu.Root
		>
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button
						{...props}
						intent="outline"
						size="md"
						disabled={disabled || !categoryReady}
						>{triggerLabel(
							'category',
							labelWithOptionalSummary(
								m.gift_context_category(),
								categoryReady ? categorySummary : m.moderator_loading(),
							),
						)}<ChevronDownIcon data-icon="inline-end" /></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content>{@render categoryItems()}</DropdownMenu.Content
			></DropdownMenu.Root
		>
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button {...props} intent="outline" size="md" {disabled}
						>{triggerLabel(
							'imageFit',
							labelWithOptionalSummary(m.image_fit_label(), imageFitSummary),
						)}<ChevronDownIcon data-icon="inline-end" /></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content>{@render imageFitItems()}</DropdownMenu.Content
			></DropdownMenu.Root
		>
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button {...props} intent="outline" size="md" {disabled}
						>{triggerLabel(
							'imageBackground',
							labelWithOptionalSummary(m.image_background_label(), backgroundSummary),
						)}<ChevronDownIcon data-icon="inline-end" /></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content>{@render imageBackgroundItems()}</DropdownMenu.Content
			></DropdownMenu.Root
		>
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button {...props} intent="outline" size="md" {disabled}
						>{triggerLabel(
							'received',
							labelWithOptionalSummary(
								m.gift_selection_received_state(),
								receivedSummary,
							),
						)}<ChevronDownIcon data-icon="inline-end" /></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content>{@render receivedItems()}</DropdownMenu.Content
			></DropdownMenu.Root
		>
	</div>
	<div class="narrow-actions" data-testid="selection-narrow-actions">
		<DropdownMenu.Root
			><DropdownMenu.Trigger
				>{#snippet child({ props })}<Button {...props} intent="outline" size="md" {disabled}
						><SlidersHorizontalIcon data-icon="inline-start" />{pending !== null
							? pendingLabel
							: m.gift_selection_actions()}<ChevronDownIcon
							data-icon="inline-end"
						/></Button
					>{/snippet}</DropdownMenu.Trigger
			><DropdownMenu.Content align="end"
				><DropdownMenu.Sub
					><DropdownMenu.SubTrigger disabled={!priorityReady}
						>{labelWithOptionalSummary(
							m.gift_priority_label(),
							priorityReady ? prioritySummary : m.moderator_loading(),
						)}</DropdownMenu.SubTrigger
					><DropdownMenu.SubContent>{@render priorityItems()}</DropdownMenu.SubContent
					></DropdownMenu.Sub
				><DropdownMenu.Sub
					><DropdownMenu.SubTrigger disabled={!categoryReady}
						>{labelWithOptionalSummary(
							m.gift_context_category(),
							categoryReady ? categorySummary : m.moderator_loading(),
						)}</DropdownMenu.SubTrigger
					><DropdownMenu.SubContent>{@render categoryItems()}</DropdownMenu.SubContent
					></DropdownMenu.Sub
				><DropdownMenu.Sub
					><DropdownMenu.SubTrigger
						>{labelWithOptionalSummary(
							m.image_fit_label(),
							imageFitSummary,
						)}</DropdownMenu.SubTrigger
					><DropdownMenu.SubContent>{@render imageFitItems()}</DropdownMenu.SubContent
					></DropdownMenu.Sub
				><DropdownMenu.Sub
					><DropdownMenu.SubTrigger
						>{labelWithOptionalSummary(
							m.image_background_label(),
							backgroundSummary,
						)}</DropdownMenu.SubTrigger
					><DropdownMenu.SubContent
						>{@render imageBackgroundItems()}</DropdownMenu.SubContent
					></DropdownMenu.Sub
				><DropdownMenu.Sub
					><DropdownMenu.SubTrigger
						>{labelWithOptionalSummary(
							m.gift_selection_received_state(),
							receivedSummary,
						)}</DropdownMenu.SubTrigger
					><DropdownMenu.SubContent>{@render receivedItems()}</DropdownMenu.SubContent
					></DropdownMenu.Sub
				></DropdownMenu.Content
			></DropdownMenu.Root
		>
	</div>
	<Button class="done" intent="primary" size="md" onclick={ondone}>{m.done()}</Button>
</div>

<style>
	.selection-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.selection-summary {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.75rem;
	}

	.wide-controls {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	.narrow-actions {
		grid-column: 1 / -1;
	}

	.narrow-actions :global(button) {
		width: 100%;
	}

	:global(.done) {
		grid-column: 2;
		grid-row: 1;
	}

	@container wishlist-toolbar (min-width: 56rem) {
		.selection-toolbar {
			display: flex;
			flex-wrap: nowrap;
		}

		.selection-summary {
			margin-right: auto;
		}

		.wide-controls {
			display: flex;
		}

		.narrow-actions {
			display: none;
		}

		:global(.done) {
			border-left: 1px solid var(--border);
			margin-left: 0.25rem;
		}
	}

	@container wishlist-toolbar (min-width: 40rem) and (max-width: 55.999rem) {
		.selection-toolbar {
			display: flex;
		}

		.selection-summary {
			margin-right: auto;
		}

		.narrow-actions {
			grid-column: auto;
		}

		.narrow-actions :global(button) {
			width: auto;
		}
	}
</style>
