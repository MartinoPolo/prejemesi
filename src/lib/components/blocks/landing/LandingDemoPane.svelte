<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import {
		setLandingDemoGiftContexts,
		type LandingDemoLikeControls,
	} from './landing_demo_contexts.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	interface LandingDemoPaneProps {
		role: WishlistRole;
		gifts: GiftByRole[];
		label: string;
		hint: string;
		/** Optional second line under the hint; the gifter pane uses it for the like rule. */
		note?: string;
		/** Shared like counter wiring — the demo's one live remote surface. */
		likeControls: LandingDemoLikeControls;
		/** Ids the demo visitor has reserved — drives the recipient pane's narration only. */
		reservedGiftIds: ReadonlySet<string>;
		testId: string;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		class?: string;
	}

	let {
		role,
		gifts,
		label,
		hint,
		note,
		likeControls,
		reservedGiftIds,
		testId,
		onreserve,
		onunreserve,
		class: className,
	}: LandingDemoPaneProps = $props();

	// Read through closures rather than handing the prop objects over directly: the context
	// is created once at init, and a captured prop reference would freeze at its first value
	// (svelte's state_referenced_locally warning fires on the direct form).
	setLandingDemoGiftContexts(
		() => gifts,
		() => role,
		{
			getLikedGiftIds: () => likeControls.getLikedGiftIds(),
			toggleLike: (giftId) => likeControls.toggleLike(giftId),
		},
	);

	const isRecipientPane = $derived(role === WISHLIST_ROLES.recipient);
</script>

<div
	class={cn(
		'flex min-w-0 flex-col gap-3 rounded-panel border-[2.5px] border-ink bg-card p-4 shadow-sticker',
		className,
	)}
	data-testid={testId}
>
	<div class="flex min-w-0 flex-col gap-1">
		<h3 class="font-heading text-[19px] font-semibold">{label}</h3>
		<p class="text-(length:--text-base) leading-relaxed text-muted-foreground">{hint}</p>
		{#if note !== undefined}
			<!-- Visible text, not a tooltip: this has to be readable on a phone, where a
			     hover affordance would be unreachable. -->
			<p
				class="mt-1 rounded-lg border-2 border-dashed border-ink bg-note px-3 py-2 text-(length:--text-base) leading-relaxed text-note-ink"
				data-testid="landing-demo-like-note"
			>
				{note}
			</p>
		{/if}
	</div>

	<div class="flex min-w-0 flex-col">
		{#each gifts as gift (gift.id)}
			{@const isNarrated = isRecipientPane && reservedGiftIds.has(gift.id)}
			<!-- Horizontal padding is constant so the mobile narration tint can never shift the
			     row; the desktop split view resets the tint because the recipient pane must stay
			     pixel-identical while the gifter pane changes (issue #218 REQ-6). -->
			<div
				class={cn(
					'-mx-2 rounded-lg px-2 transition-colors duration-300',
					isNarrated && 'bg-tint lg:bg-transparent',
				)}
				data-testid="landing-demo-gift-{gift.id}"
			>
				<!-- The product hides list-row counts; the demo shows them because the live,
				     shared counter is the whole point of its like buttons. -->
				<GiftListItem {gift} {role} showLikeCount={true} {onreserve} {onunreserve} />
				{#if isNarrated}
					<p
						class="my-3 rounded-lg border-2 border-ink bg-note px-3 py-2 text-(length:--text-base) font-semibold text-note-ink lg:hidden"
						data-testid="landing-demo-invariant-caption"
					>
						{m.landing_demo_invariant_caption()}
					</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
