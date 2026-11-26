<script lang="ts">
	import Link2Icon from '@lucide/svelte/icons/link-2';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import WishlistBadge from '$lib/components/derived/wishlist-badge/WishlistBadge.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard_types.js';
	import { occasionDisplayLabel } from '$lib/modules/wishlists/wishlist_occasion_display.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftUnlinkConfirmDialog from './GiftUnlinkConfirmDialog.svelte';

	interface Props {
		/** The edited gift. */
		giftId: string;
		linkedCopies: readonly LinkedGiftCopy[];
		role: WishlistRole;
	}

	interface UnlinkTarget {
		giftId: string;
		wishlistTitle: string;
	}

	let { giftId, linkedCopies, role }: Props = $props();

	const headingId = $props.id();
	let unlinkTarget = $state<UnlinkTarget | null>(null);
	let unlinkOpen = $state(false);

	/**
	 * Unlinking needs management of the copy's own list. Unlinking either member of a pair
	 * dissolves it, so a pair always unlinks the edited gift; in a larger group only the recipient
	 * is known to manage every other copy, and an archived list accepts no change.
	 */
	function unlinkTargetFor(copy: LinkedGiftCopy): UnlinkTarget | null {
		if (linkedCopies.length === 1) {
			return { giftId, wishlistTitle: copy.wishlistTitle };
		}
		if (role === WISHLIST_ROLES.recipient && copy.status !== 'archived') {
			return { giftId: copy.giftId, wishlistTitle: copy.wishlistTitle };
		}
		return null;
	}

	function confirmUnlink(target: UnlinkTarget) {
		unlinkTarget = target;
		unlinkOpen = true;
	}
</script>

<section class="grid gap-1.5" aria-labelledby={headingId} data-testid="gift-linked-copies">
	<div class="flex items-center gap-1.5">
		<h3 id={headingId} class="text-sm font-semibold text-foreground">
			{m.gift_linked_copies_title()}
		</h3>
		<Badge
			tone="neutral"
			badgeStyle="count"
			aria-label={m.gift_linked_copies_count_label({ count: linkedCopies.length })}
		>
			{linkedCopies.length}
		</Badge>
	</div>
	<ul class="m-0 list-none rounded-badge border-2 border-edge p-0">
		{#each linkedCopies as copy (copy.giftId)}
			{@const target = unlinkTargetFor(copy)}
			{@const occasion = occasionDisplayLabel(copy.occasion)}
			<li
				class="flex min-h-9 items-center gap-2 py-1 pr-1 pl-2.5 not-first:border-t not-first:border-border max-sm:min-h-11"
			>
				<Link2Icon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<a
					class="min-w-0 flex-1 truncate text-(length:--text-md) font-semibold text-foreground underline-offset-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					href={localizeInternalHref(
						resolve('/(app)/w/[id]', { id: copy.wishlistShortId }),
					)}
					title={copy.wishlistTitle}
				>
					{copy.wishlistTitle}
				</a>
				{#if occasion !== null}
					<span class="text-xs whitespace-nowrap text-muted-foreground">{occasion}</span>
				{/if}
				<WishlistBadge presentation="list-status" status={copy.status} class="shrink-0">
					{WISHLIST_STATUS_LABELS[copy.status]()}
				</WishlistBadge>
				{#if target !== null}
					<Button
						intent="outline"
						size="sm"
						class="shrink-0 rounded-[calc(var(--radius-badge)-2px-0.25rem)]"
						aria-label={m.gift_unlink_copy_label({ title: copy.wishlistTitle })}
						onclick={() => confirmUnlink(target)}
					>
						{m.gift_unlink_button()}
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
	<HelpText>{m.gift_linked_copies_note()}</HelpText>
</section>

{#if unlinkTarget !== null}
	<GiftUnlinkConfirmDialog
		bind:open={unlinkOpen}
		giftId={unlinkTarget.giftId}
		wishlistTitle={unlinkTarget.wishlistTitle}
	/>
{/if}
