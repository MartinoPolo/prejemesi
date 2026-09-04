<script lang="ts">
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
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
		oncopy?: () => void;
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
		oncopy = () => undefined,
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
	let mobileBulkSheetOpen = $state(false);
	let mobileBulkTrigger = $state<HTMLButtonElement | null>(null);

	function handleMobileBulkSheetOpenChange(open: boolean) {
		mobileBulkSheetOpen = open;
		if (!open) {
			requestAnimationFrame(() => mobileBulkTrigger?.focus({ preventScroll: true }));
		}
	}

	function handleImageFit(fit: 'fill' | 'fit') {
		onaction({ action: 'imageFit', fit });
	}

	function handleImageBackground(background: '#ffffff' | '#000000' | null) {
		onaction({ action: 'imageBackground', background });
	}

	function handleReceived(received: boolean) {
		onaction({ action: 'received', received });
	}

	function handleCopy() {
		if (mobileBulkSheetOpen) {
			mobileBulkSheetOpen = false;
			requestAnimationFrame(oncopy);
			return;
		}
		oncopy();
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

{#snippet bulkRadioChoice(
	name: string,
	value: string,
	label: string,
	checked: boolean,
	optionDisabled: boolean,
	onchange: () => void,
)}
	<label class="bulk-sheet-choice" class:bulk-sheet-choice-disabled={optionDisabled}>
		<input type="radio" {name} {value} {checked} disabled={optionDisabled} {onchange} />
		<span>{label}</span>
	</label>
{/snippet}

{#snippet mobileBulkSheet()}
	<Sheet.Root open={mobileBulkSheetOpen} onOpenChange={handleMobileBulkSheetOpenChange}>
		<Sheet.Trigger>
			{#snippet child({ props })}
				<Button
					bind:ref={mobileBulkTrigger}
					{...props}
					intent="outline"
					size="md"
					{disabled}
				>
					{pending !== null ? pendingLabel : m.gift_selection_actions()}
				</Button>
			{/snippet}
		</Sheet.Trigger>
		{#if mobileBulkSheetOpen}
			<WishlistBottomSheet>
				<Sheet.Header class="border-border border-b px-4 py-3">
					<Sheet.Title>{m.gift_selection_actions()}</Sheet.Title>
					<Sheet.Description>
						{pending !== null
							? pendingLabel
							: m.gift_selection_count({ count: selectedCount })}
					</Sheet.Description>
				</Sheet.Header>
				<div class="bulk-sheet-scroll" data-testid="selection-bulk-sheet-scroll">
					<fieldset class="bulk-sheet-section" disabled={disabled || !priorityReady}>
						<legend
							>{m.gift_priority_label()}: {priorityReady
								? prioritySummary
								: m.moderator_loading()}</legend
						>
						{@render bulkRadioChoice(
							'bulk-priority',
							'',
							m.gift_priority_none(),
							commonPriorityId === null,
							disabled || !priorityReady,
							() => onpriority(null),
						)}
						{#each priorityLevels as choice (choice.id)}
							{@render bulkRadioChoice(
								'bulk-priority',
								choice.id,
								choice.label,
								commonPriorityId === choice.id,
								disabled || !priorityReady,
								() => onpriority(choice.id),
							)}
						{/each}
					</fieldset>
					<fieldset class="bulk-sheet-section" disabled={disabled || !categoryReady}>
						<legend
							>{m.gift_context_category()}: {categoryReady
								? categorySummary
								: m.moderator_loading()}</legend
						>
						{@render bulkRadioChoice(
							'bulk-category',
							'',
							m.gift_category_uncategorized(),
							commonCategoryId === null,
							disabled || !categoryReady,
							() => oncategory(null),
						)}
						{#each categories as choice (choice.id)}
							{@render bulkRadioChoice(
								'bulk-category',
								choice.id,
								choice.label,
								commonCategoryId === choice.id,
								disabled || !categoryReady,
								() => oncategory(choice.id),
							)}
						{/each}
					</fieldset>
					<fieldset class="bulk-sheet-section" {disabled}>
						<legend>{m.image_fit_label()}: {imageFitSummary}</legend>
						{@render bulkRadioChoice(
							'bulk-image-fit',
							'fill',
							m.image_fit_fill(),
							commonImageFit === 'fill',
							disabled,
							() => handleImageFit('fill'),
						)}
						{@render bulkRadioChoice(
							'bulk-image-fit',
							'fit',
							m.image_fit_fit(),
							commonImageFit === 'fit',
							disabled,
							() => handleImageFit('fit'),
						)}
					</fieldset>
					<fieldset class="bulk-sheet-section" {disabled}>
						<legend>{m.image_background_label()}: {backgroundSummary}</legend>
						{@render bulkRadioChoice(
							'bulk-image-background',
							'#ffffff',
							m.image_background_white(),
							commonImageBackground === '#ffffff',
							disabled,
							() => handleImageBackground('#ffffff'),
						)}
						{@render bulkRadioChoice(
							'bulk-image-background',
							'#000000',
							m.image_background_black(),
							commonImageBackground === '#000000',
							disabled,
							() => handleImageBackground('#000000'),
						)}
						{@render bulkRadioChoice(
							'bulk-image-background',
							'transparent',
							m.image_background_transparent(),
							commonImageBackground === null,
							disabled,
							() => handleImageBackground(null),
						)}
					</fieldset>
					<div class="bulk-sheet-section">
						<Button
							class="w-full justify-start"
							intent="ghost"
							{disabled}
							onclick={handleCopy}
						>
							<CopyIcon data-icon="inline-start" />{m.gift_bulk_copy()}
						</Button>
					</div>
					<fieldset class="bulk-sheet-section" {disabled}>
						<legend>{m.gift_selection_received_state()}: {receivedSummary}</legend>
						{@render bulkRadioChoice(
							'bulk-received',
							'true',
							m.gift_mark_received(),
							commonReceived === true,
							disabled,
							() => handleReceived(true),
						)}
						{@render bulkRadioChoice(
							'bulk-received',
							'false',
							m.gift_mark_unreceived(),
							commonReceived === false,
							disabled,
							() => handleReceived(false),
						)}
					</fieldset>
				</div>
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{/snippet}

<div class="selection-toolbar" role="region" aria-label={m.gift_selection_toolbar()}>
	<div class="mobile-selection-row">
		<strong class="mobile-selection-label">
			{m.gift_selection_mode_label()} · {m.gift_selection_count({ count: selectedCount })}
		</strong>
		<div class="mobile-selection-actions">
			<label class="mobile-select-all">
				<Checkbox
					checked={visibleState === 'all'}
					indeterminate={visibleState === 'some'}
					onCheckedChange={onselectvisible}
					aria-label={m.gift_selection_visible_all()}
				/>
				<span>{m.draft_grid_select_all()}</span>
			</label>
			{@render mobileBulkSheet()}
			<Button intent="primary" size="md" onclick={ondone}>{m.cancel()}</Button>
		</div>
	</div>
	<div class="selection-summary desktop-selection-summary">
		<label class="select-all">
			<Checkbox
				checked={visibleState === 'all'}
				indeterminate={visibleState === 'some'}
				onCheckedChange={onselectvisible}
				aria-label={m.gift_selection_visible_all()}
			/>
			<span class="select-all-label">{m.draft_grid_select_all()}</span>
		</label>
		<strong class="selection-count whitespace-nowrap text-sm"
			>{m.gift_selection_count({ count: selectedCount })}</strong
		>{#if hiddenCount > 0}<span
				class="hidden-selection-count inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-bold text-warning-foreground"
				><EyeOffIcon class="size-3.5" />{m.gift_selection_hidden_count({
					count: hiddenCount,
				})}</span
			>{/if}
	</div>
	<div class="wide-controls" data-testid="selection-wide-controls">
		<Button intent="outline" size="md" {disabled} onclick={handleCopy}>
			<CopyIcon data-icon="inline-start" />{m.gift_bulk_copy()}
		</Button>
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
				><DropdownMenu.Item onclick={handleCopy}>
					<CopyIcon data-icon="inline-start" />{m.gift_bulk_copy()}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Sub
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
	<Button class="done" intent="primary" size="md" onclick={ondone}>
		{m.done()}
	</Button>
</div>

<style>
	.selection-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.selection-summary,
	.select-all {
		display: flex;
		min-width: 0;
		align-items: center;
	}

	.selection-summary {
		gap: 0.75rem;
	}

	.select-all {
		gap: 0.375rem;
		white-space: nowrap;
	}

	.mobile-selection-row {
		display: none;
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

	.bulk-sheet-scroll {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.5rem;
	}

	.bulk-sheet-section {
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0.25rem 0;
	}

	.bulk-sheet-section + .bulk-sheet-section {
		margin-top: 0.5rem;
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
	}

	.bulk-sheet-section legend {
		width: 100%;
		padding: 0.25rem 0.75rem;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 800;
	}

	.bulk-sheet-choice {
		display: flex;
		min-height: 48px;
		align-items: center;
		gap: 0.75rem;
		border-radius: var(--radius-btn);
		padding: 0.5rem 0.75rem;
		font-weight: 650;
	}

	.bulk-sheet-choice:hover {
		background: var(--accent);
	}

	.bulk-sheet-choice input {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
	}

	.bulk-sheet-choice-disabled {
		opacity: 0.5;
	}

	@media (width <= 639px) {
		.selection-toolbar {
			display: block;
		}

		.desktop-selection-summary,
		.wide-controls,
		.narrow-actions,
		:global(.done) {
			display: none;
		}

		.mobile-selection-row,
		.mobile-selection-actions,
		.mobile-select-all {
			display: flex;
			min-width: 0;
			align-items: center;
		}

		.mobile-selection-row {
			width: 100%;
			justify-content: space-between;
			gap: 4px;
		}

		.mobile-selection-label {
			min-width: 0;
			overflow: hidden;
			font-family: var(--font-heading);
			font-size: 0.75rem;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mobile-selection-actions {
			flex: 0 0 auto;
			gap: 4px;
		}

		.mobile-select-all {
			gap: 2px;
			font-size: 0.6875rem;
			white-space: nowrap;
		}

		.mobile-selection-actions :global(button),
		.mobile-selection-actions :global([data-slot='checkbox']) {
			min-width: 40px;
			min-height: 40px;
			padding-inline: 0.375rem;
		}
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
