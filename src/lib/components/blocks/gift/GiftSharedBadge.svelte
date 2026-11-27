<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';
	import { badgeVariants } from '$lib/components/base/badge/index.js';
	import Avatar from '$lib/components/derived/avatar/Avatar.svelte';
	import { interactiveChipClass } from '$lib/components/derived/overflow-chips/index.js';
	import { showsAsSharedGift } from '$lib/modules/gifts/shared_gift.js';
	import { sharedGiftBadgeNames } from '$lib/modules/gifts/shared_gift_copy.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { getInitials } from '$lib/utils/initials.js';
	import GiftSharedExplanation from './GiftSharedExplanation.svelte';
	import GiftSharedInfoLayer from './GiftSharedInfoLayer.svelte';

	interface Props {
		gift: GiftByRole;
		role: WishlistRole;
		/**
		 * Shows the other recipients' avatars without names, for narrow tiles such as the
		 * carousel where a name would truncate; the label and explanation still name them.
		 */
		compact?: boolean;
		/** When false, the badge is static so a surrounding press (selection, reorder) owns it. */
		interactive?: boolean;
		class?: string;
	}

	let { gift, role, compact = false, interactive = true, class: className }: Props = $props();

	const otherNames = $derived(gift.sharedWith.map((member) => member.recipientDisplayName));
	const shownMembers = $derived(gift.sharedWith.slice(0, compact ? 3 : 2));
	const firstName = $derived(otherNames[0] ?? '');
	const remainingCount = $derived(
		Math.max(0, otherNames.length - (compact ? shownMembers.length : 1)),
	);
	const accessibleLabel = $derived(
		m.gift_shared_badge_aria({ names: sharedGiftBadgeNames(otherNames) }),
	);
	const badgeClass = $derived(
		cn(
			badgeVariants({ tone: 'accent', badgeStyle: 'overlay' }),
			'relative max-w-full min-w-0 shrink gap-1 pr-1.5 pl-1 [&_[data-icon]]:size-3.25',
			interactive && [
				interactiveChipClass,
				// The accent face keeps its dark text, so hover tints the accent instead of the card.
				"hover:bg-[color-mix(in_oklab,var(--accent-loud)_82%,var(--card))] aria-expanded:bg-ink-fill aria-expanded:text-ink-fill-foreground before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
			],
			className,
		),
	);
</script>

{#snippet badgeFace()}
	<span class="flex shrink-0 items-center" aria-hidden="true">
		{#each shownMembers as member, index (index)}
			<Avatar
				src={member.recipientImage}
				alt=""
				initials={getInitials(member.recipientDisplayName)}
				size="xs"
				shape="circle"
				class={cn('size-4 border border-edge bg-card', index > 0 && '-ml-1.5')}
			/>
		{/each}
	</span>
	{#if !compact}
		<span class="min-w-0 truncate" aria-hidden="true"
			>{m.gift_shared_badge_label({ names: firstName })}</span
		>
	{/if}
	{#if remainingCount > 0}
		<span class="shrink-0" aria-hidden="true">+{remainingCount}</span>
	{/if}
	{#if interactive}
		<InfoIcon data-icon aria-hidden="true" class="shrink-0" />
	{/if}
{/snippet}

{#if showsAsSharedGift(gift)}
	{#if interactive}
		<GiftSharedInfoLayer title={m.gift_shared_explanation_title()}>
			{#snippet trigger({ props })}
				<button
					type="button"
					{...props}
					class={badgeClass}
					aria-label={accessibleLabel}
					data-slot="gift-shared-badge"
				>
					{@render badgeFace()}
				</button>
			{/snippet}
			<GiftSharedExplanation {gift} {role} />
		</GiftSharedInfoLayer>
	{:else}
		<span
			class={badgeClass}
			role="img"
			aria-label={accessibleLabel}
			data-slot="gift-shared-badge"
		>
			{@render badgeFace()}
		</span>
	{/if}
{/if}
