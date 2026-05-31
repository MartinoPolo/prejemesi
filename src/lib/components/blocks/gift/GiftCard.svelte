<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import ReservationBadge from '$lib/components/blocks/reservation/ReservationBadge.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		extractDomain,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift-display.js';
	import { giftCardVariants } from './gift-card-variants.js';

	interface GiftCardProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, role, isArchived = false, onreserve }: GiftCardProps = $props();

	const isOwner = $derived(role === 'owner');
	const isVisitorOrModerator = $derived(role === 'visitor' || role === 'moderator');

	const visitorGift = $derived(isVisitorOrModerator ? (gift as GiftForVisitor) : null);
	const isFullyReserved = $derived(visitorGift?.isFullyReserved ?? false);

	const styles = $derived(giftCardVariants({ reserved: isFullyReserved }));

	const domain = $derived(extractDomain(gift.url));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const showQuantity = $derived((gift.quantity ?? 1) > 1);
</script>

<div class={styles.card()}>
	<!-- Image area -->
	<div class={styles.imageArea()}>
		{#if gift.imageUrl}
			<img src={gift.imageUrl} alt={gift.name} class={styles.image()} />
		{:else}
			<div class={styles.imagePlaceholder()}>
				<GiftIcon class="size-12 text-muted-foreground/40" />
			</div>
		{/if}

		{#if isVisitorOrModerator && isFullyReserved}
			<div class={styles.reservedOverlay()}>
				<Badge
					variant="secondary"
					class="bg-reserved/15 text-reserved gap-1 border-reserved/25"
				>
					<CheckIcon class="size-3" />
					Rezervovano
				</Badge>
			</div>
		{/if}

		{#if gift.received}
			<div class="absolute top-2 right-2">
				<Badge variant="default" class="gap-1">
					<CheckIcon class="size-3" />
					Prijato
				</Badge>
			</div>
		{/if}
	</div>

	<!-- Body -->
	<div class={styles.body()}>
		<h3 class={styles.name()}>{gift.name}</h3>

		{#if gift.price !== null}
			<span class={styles.price()}>{priceDisplay}</span>
		{:else}
			<span class={styles.priceEmpty()}>{priceDisplay}</span>
		{/if}

		{#if domain}
			<a
				href={gift.url ?? '#'}
				target="_blank"
				rel="noopener noreferrer"
				class={styles.linkRow()}
			>
				<ExternalLinkIcon class="size-3" />
				{domain}
			</a>
		{:else}
			<span class={styles.linkEmpty()}>Bez odkazu</span>
		{/if}

		<!-- Badges row -->
		<div class={styles.badgeRow()}>
			{#if priorityInfo}
				<Badge variant="secondary" class={priorityInfo.colorClass}>
					{priorityInfo.label}
				</Badge>
			{/if}

			{#if showQuantity}
				<span class={styles.quantityBadge()}>x{gift.quantity}</span>
			{/if}

			{#if visitorGift && !isFullyReserved}
				<ReservationBadge gift={visitorGift} />
			{/if}
		</div>
	</div>

	<!-- Footer: like + reserve (visitor/moderator only) -->
	{#if isVisitorOrModerator && visitorGift}
		<div class={styles.footer()}>
			<LikeButton giftId={gift.id} giftName={gift.name} likeCount={visitorGift.likeCount} />

			{#if visitorGift}
				<ReserveButton gift={visitorGift} {isArchived} {onreserve} />
			{/if}
		</div>
	{/if}
</div>
