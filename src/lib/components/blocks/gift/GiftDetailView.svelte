<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Badge } from '$lib/components/base/badge/index.js';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftDescription from '$lib/components/blocks/gift/GiftDescription.svelte';
	import GiftEditedBadge from './GiftEditedBadge.svelte';
	import { giftDetailModalVariants } from './gift_detail_modal_variants.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';

	interface Props {
		gift: GiftByRole;
		role: WishlistRole;
	}

	let { gift, role }: Props = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role),
	);

	const styles = giftDetailModalVariants();
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div class={styles.body()}>
	<!-- Left column: plain read-only image, no editing affordances. -->
	<div class={styles.imageColumn()} data-testid="gift-detail-view-image-column">
		<GiftImage
			class="size-full"
			imageUrl={gift.imageUrl}
			imageMeta={gift.imageMeta}
			target="detail"
			alt={gift.name}
		/>
	</div>

	<!-- Right column: same scroll/actions frame as the edit form, but every field is static text. -->
	<div class={styles.detailColumn()}>
		<div class={styles.detailScroll()} data-testid="gift-detail-view-scroll">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="font-heading text-xl font-semibold text-foreground">{gift.name}</h2>
				<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
				{#if gift.received}
					<Badge tone="neutral" class="gap-1 text-[11px]">
						<CheckIcon class="size-2.5" />
						{m.gift_received_badge()}
					</Badge>
				{/if}
			</div>

			<GiftEditedBadge editedAfterShareAt={gift.editedAfterShareAt} />

			<div class="mt-2 flex flex-wrap items-center gap-2">
				{#if gift.price !== null}
					<span class="text-lg font-bold text-foreground">{priceDisplay}</span>
				{:else}
					<span class="text-sm text-ink-soft italic">{priceDisplay}</span>
				{/if}

				{#if priorityInfo}
					<Badge tone="neutral" badgeStyle="subtle" class={priorityInfo.colorClass}>
						{priorityInfo.label()}
					</Badge>
				{/if}

				{#if isVisitorOrModerator && isFullyReserved && reserverLine !== null}
					<span class="text-sm font-semibold text-ink-soft">{reserverLine}</span>
				{/if}
			</div>

			<div class="mt-3">
				<GiftLinkList links={gift.links} maxVisible={10} />
			</div>

			<GiftDescription
				description={gift.description}
				descriptionAppends={gift.descriptionAppends}
				maxVisibleAppends={null}
				class="mt-3"
			/>
		</div>
	</div>
</div>
