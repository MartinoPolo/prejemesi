<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import { setLandingDemoGiftContexts } from './landing_demo_contexts.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	interface LandingDemoPaneProps {
		role: WishlistRole;
		gifts: GiftByRole[];
		emoji: string;
		label: string;
		hint: string;
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
		emoji,
		label,
		hint,
		reservedGiftIds,
		testId,
		onreserve,
		onunreserve,
		class: className,
	}: LandingDemoPaneProps = $props();

	setLandingDemoGiftContexts(
		() => gifts,
		() => role,
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
		<h3 class="font-heading flex items-center gap-2 text-[19px] font-semibold">
			<span aria-hidden="true">{emoji}</span>
			{label}
		</h3>
		<p class="text-(length:--text-base) leading-relaxed text-muted-foreground">{hint}</p>
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
				<GiftListItem {gift} {role} {onreserve} {onunreserve} />
				{#if isNarrated}
					<p
						class="my-3 flex items-start gap-2 rounded-lg border-2 border-ink bg-note px-3 py-2 text-(length:--text-base) font-semibold text-note-ink lg:hidden"
						data-testid="landing-demo-invariant-caption"
					>
						<span aria-hidden="true">🤫</span>
						{m.landing_demo_invariant_caption()}
					</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
