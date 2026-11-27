<script lang="ts">
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import * as m from '$lib/paraglide/messages.js';
	import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { useSharedGiftListRecipient } from '$lib/modules/gifts/shared_gift_list_recipient.js';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftSharedInfoLayer from '$lib/components/blocks/gift/GiftSharedInfoLayer.svelte';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { getContext } from 'svelte';
	import { giftSectionLabel } from './gift_section_label.js';
	import { formatGiftCount } from '$lib/modules/gifts/gift_display.js';

	interface GiftSectionHeaderProps {
		section: GiftSection;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		/** Marks the header as part of a grouped-reorder drop target. */
		reorderGroupKey?: string;
		/** Gifts in the row the header introduces, shown after the label. */
		count?: number;
		/** Visible card range of the row, shown at the end of the line; sighted-only. */
		position?: string;
		/** Id that makes the heading an in-page jump target. */
		jumpTargetId?: string;
	}

	let {
		section,
		selectionMode = false,
		onselectiontoggle,
		reorderGroupKey,
		count,
		position,
		jumpTargetId,
	}: GiftSectionHeaderProps = $props();
	const isSelected = getContext<((giftId: string) => boolean) | undefined>(
		'wishlist-gift-selection',
	);
	const sharedGiftListRecipient = useSharedGiftListRecipient();
	const isSharedSection = $derived(section.kind === GIFT_SECTION_KINDS.shared);
	const sharedSectionRecipientName = $derived(
		isSharedSection ? (sharedGiftListRecipient()?.name ?? null) : null,
	);
	const sectionIds = $derived(section.gifts.map((gift) => gift.id));
	const selectedCount = $derived(sectionIds.filter((id) => isSelected?.(id) ?? false).length);

	const label = $derived(giftSectionLabel(section));
	// Focusable only by script, so a jump can land on it without adding a tab stop.
	const jumpTargetAttributes = $derived(
		jumpTargetId === undefined ? {} : { id: jumpTargetId, tabindex: -1 },
	);
</script>

<div class="flex items-center gap-2 pt-1 pb-0.5" data-gift-reorder-group={reorderGroupKey}>
	{#if selectionMode}
		<span class="inline-flex shrink-0">
			<Checkbox
				checked={selectedCount === sectionIds.length && sectionIds.length > 0}
				indeterminate={selectedCount > 0 && selectedCount < sectionIds.length}
				onCheckedChange={(checked) => {
					for (const giftId of sectionIds) {
						if ((isSelected?.(giftId) ?? false) !== checked) {
							onselectiontoggle?.(giftId);
						}
					}
				}}
				aria-label={label}
			/>
		</span>
	{/if}
	<!-- The plate only paints over a wishlist theme backdrop, keeping text off the artwork. -->
	<span class="wishlist-backdrop-plate inline-flex min-w-0 items-center gap-2">
		{#if label !== ''}
			<h2
				{...jumpTargetAttributes}
				class={[
					'font-heading text-sm font-bold tracking-wide text-foreground uppercase [word-spacing:0.1em]',
					jumpTargetId !== undefined &&
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
				]}
			>
				{label}
			</h2>
		{/if}
		{#if count !== undefined}
			<span
				class="text-sm font-semibold whitespace-nowrap text-muted-foreground"
				data-testid="gift-section-count">{formatGiftCount(count)}</span
			>
		{/if}
		{#if selectionMode}<span class="text-xs text-muted-foreground"
				>{m.gift_selection_section_count({
					selectedCount,
					totalCount: sectionIds.length,
				})}</span
			>{/if}
	</span>
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
	{#if isSharedSection && !selectionMode}
		<GiftSharedInfoLayer title={m.gift_shared_how_title()}>
			{#snippet trigger({ props })}
				<Button
					{...props}
					intent="ghost"
					size="sm"
					class="wishlist-backdrop-plate shrink-0"
					data-testid="gift-shared-how"
				>
					<CircleHelpIcon data-icon="inline-start" />
					{m.gift_shared_how_trigger()}
				</Button>
			{/snippet}
			<ol class="m-0 grid list-decimal gap-2 pl-5 text-sm text-foreground">
				<li>{m.gift_shared_how_step_one()}</li>
				<li>{m.gift_shared_how_step_two()}</li>
				<li>{m.gift_shared_how_step_three()}</li>
			</ol>
		</GiftSharedInfoLayer>
	{/if}
	{#if position}
		<span
			class="wishlist-backdrop-plate text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
			aria-hidden="true"
			data-testid="gift-section-position">{position}</span
		>
	{/if}
</div>
{#if sharedSectionRecipientName !== null}
	<p
		class="wishlist-backdrop-plate w-fit text-sm text-muted-foreground"
		data-testid="gift-shared-section-note"
	>
		{m.gift_shared_section_note({ name: sharedSectionRecipientName })}
	</p>
{/if}
