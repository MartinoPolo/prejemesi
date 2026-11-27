<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import Link2Icon from '@lucide/svelte/icons/link-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { resolve } from '$app/paths';
	import { badgeVariants } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import { interactiveChipClass } from '$lib/components/derived/overflow-chips/index.js';
	import WishlistBadge from '$lib/components/derived/wishlist-badge/WishlistBadge.svelte';
	import WishlistBottomSheet from '$lib/components/blocks/wishlist/WishlistBottomSheet.svelte';
	import WishlistSheetBody from '$lib/components/blocks/wishlist/WishlistSheetBody.svelte';
	import WishlistSheetHeader from '$lib/components/blocks/wishlist/WishlistSheetHeader.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard_types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { closeOnOutsidePress } from '$lib/utils/outside_press.js';

	interface Props {
		/** The gift's other copies; the chip renders nothing without them. */
		linkedCopies: readonly LinkedGiftCopy[];
		/** Names the gift in the mobile sheet, which covers the card it was opened from. */
		giftName: string;
		/** When false, the chip is static so a surrounding press (selection, reorder) owns it. */
		interactive?: boolean;
		/** Opens the gift editor's linked copies section; omitted when the viewer cannot edit. */
		oneditlinkedcopies?: () => void;
	}

	let { linkedCopies, giftName, interactive = true, oneditlinkedcopies }: Props = $props();

	const narrowViewport = useNarrowViewportState();
	const popoverTitleId = $props.id();
	let open = $state(false);
	let triggerElement = $state<HTMLElement | null>(null);
	let popoverElement = $state<HTMLElement | null>(null);

	const chipLabel = $derived(
		m.gift_linked_copies_chip_label({
			titles: linkedCopies.map((copy) => copy.wishlistTitle).join(', '),
		}),
	);
	const chipClass = $derived(
		cn(
			badgeVariants({ tone: 'neutral', badgeStyle: 'overlay' }),
			'relative shrink-0 gap-0.5 pr-1.5 pl-1 [&_[data-icon]]:size-3.25',
			interactive && [
				interactiveChipClass,
				"before:absolute before:-inset-x-2 before:-inset-y-2.75 before:content-[''] aria-expanded:bg-ink-fill aria-expanded:text-ink-fill-foreground",
			],
		),
	);

	function wishlistHref(copy: LinkedGiftCopy): string {
		return localizeInternalHref(resolve('/(app)/w/[id]', { id: copy.wishlistShortId }));
	}

	function editLinkedCopies() {
		open = false;
		oneditlinkedcopies?.();
	}

	$effect(() => {
		if (!open || narrowViewport.current) {
			return;
		}
		return closeOnOutsidePress(
			() => [popoverElement, triggerElement],
			() => (open = false),
		);
	});
</script>

{#snippet chipFace()}
	<Link2Icon data-icon aria-hidden="true" />
	<span aria-hidden="true">{linkedCopies.length}</span>
{/snippet}

{#snippet statusBadge(copy: LinkedGiftCopy)}
	<WishlistBadge presentation="list-status" status={copy.status} class="shrink-0">
		{WISHLIST_STATUS_LABELS[copy.status]()}
	</WishlistBadge>
{/snippet}

{#snippet popoverRows()}
	<ul class="m-0 flex list-none flex-col p-0" data-slot="gift-link-copies">
		{#each linkedCopies as copy (copy.giftId)}
			<li class="flex min-h-8 min-w-0 items-center gap-2">
				<a
					class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					href={wishlistHref(copy)}
					title={copy.wishlistTitle}
					onclick={() => (open = false)}
				>
					{copy.wishlistTitle}
				</a>
				{@render statusBadge(copy)}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet sheetRows()}
	<ul class="m-0 flex list-none flex-col p-0" data-slot="gift-link-copies">
		{#each linkedCopies as copy (copy.giftId)}
			<li>
				<a
					class="flex min-h-11 min-w-0 items-center gap-2 rounded-btn px-2 text-base text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					href={wishlistHref(copy)}
					onclick={() => (open = false)}
				>
					<span class="min-w-0 flex-1 truncate font-semibold">{copy.wishlistTitle}</span>
					{@render statusBadge(copy)}
					<ChevronRightIcon
						class="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet editAction()}
	<PencilIcon data-icon="inline-start" />
	{m.gift_linked_copies_edit()}
{/snippet}

{#if linkedCopies.length > 0}
	{#if !interactive}
		<span class={chipClass} role="img" aria-label={chipLabel} data-slot="gift-link-chip">
			{@render chipFace()}
		</span>
	{:else if narrowViewport.current}
		<button
			type="button"
			class={chipClass}
			aria-label={chipLabel}
			aria-haspopup="dialog"
			aria-expanded={open}
			data-slot="gift-link-chip"
			data-prevent-gift-card-open
			onclick={() => (open = true)}
		>
			{@render chipFace()}
		</button>
		<Sheet.Root bind:open>
			{#if open}
				<WishlistBottomSheet>
					<WishlistSheetHeader>
						<Sheet.Title>{m.gift_linked_copies_popover_title()}</Sheet.Title>
						<Sheet.Description class="truncate">{giftName}</Sheet.Description>
					</WishlistSheetHeader>
					<WishlistSheetBody>
						{@render sheetRows()}
					</WishlistSheetBody>
					{#if oneditlinkedcopies !== undefined}
						<div class="px-4 pt-1 pb-3">
							<Button
								intent="outline"
								size="lg"
								class="w-full"
								onclick={editLinkedCopies}
							>
								{@render editAction()}
							</Button>
						</div>
					{/if}
				</WishlistBottomSheet>
			{/if}
		</Sheet.Root>
	{:else}
		<Popover.Root bind:open>
			<SimpleTooltip text={m.gift_linked_copies_chip_tooltip()} side="top" disabled={open}>
				{#snippet asChild(tooltipProps)}
					<Popover.Trigger bind:ref={triggerElement}>
						{#snippet child({ props: popoverProps })}
							<button
								type="button"
								{...mergeProps(tooltipProps, popoverProps)}
								class={chipClass}
								aria-label={chipLabel}
								data-slot="gift-link-chip"
								data-prevent-gift-card-open
							>
								{@render chipFace()}
							</button>
						{/snippet}
					</Popover.Trigger>
				{/snippet}
			</SimpleTooltip>
			<Popover.Content
				bind:ref={popoverElement}
				class="w-59"
				shadowedTrigger={false}
				role="dialog"
				aria-labelledby={popoverTitleId}
				data-slot="gift-link-popover"
			>
				<Popover.Label id={popoverTitleId}
					>{m.gift_linked_copies_popover_title()}</Popover.Label
				>
				<div class="max-h-40 overflow-y-auto px-2 pb-1">
					{@render popoverRows()}
				</div>
				{#if oneditlinkedcopies !== undefined}
					<div class="border-t-2 border-edge p-1">
						<Button
							intent="ghost"
							size="sm"
							class="w-full justify-start"
							onclick={editLinkedCopies}
						>
							{@render editAction()}
						</Button>
					</div>
				{/if}
			</Popover.Content>
		</Popover.Root>
	{/if}
{/if}
