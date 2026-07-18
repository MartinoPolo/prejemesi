<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import StarIcon from '@lucide/svelte/icons/star';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import { IMAGE_TOKEN_SCOPES } from '$lib/components/derived/image-frame/index.js';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftDescription from '$lib/components/blocks/gift/GiftDescription.svelte';
	import GiftDetailActionBar from './GiftDetailActionBar.svelte';
	import { giftDetailModalVariants } from './gift_detail_modal_variants.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatAppendDate,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';

	interface Props {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, role, isArchived = false, onreserve, onunreserve }: Props = $props();

	// Role gating single source (SUMMARY.md invariant): the recipient sees no
	// action area, no reservation status, no like state anywhere in this view.
	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role),
	);

	const styles = giftDetailModalVariants();
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	// Dimming applies to a reservation held by someone ELSE only (SUMMARY.md state
	// matrix): the viewer's own reservation never dims their content.
	const isDimmed = $derived(
		isVisitorOrModerator && isFullyReserved && (visitorGift?.myReservationId ?? null) === null,
	);
</script>

<div class={styles.viewGrid()}>
	<!-- Media column: square photo sticker on the dotted mat; ALL reservation status
	     (own + others') renders once here as a photo overlay, never in the action
	     bar (REQ-3). -->
	<div class={styles.viewMedia()} data-testid="gift-detail-view-image-column">
		<div class={styles.viewPhotoFrame()}>
			{#if isVisitorOrModerator && visitorGift}
				<GiftDetailActionBar
					placement="overlay"
					gift={visitorGift}
					{isArchived}
					{onreserve}
					{onunreserve}
				/>
			{/if}
			<div class={styles.viewPhoto({ viewDimmed: isDimmed })}>
				<div class={styles.viewPhotoInner()}>
					<!-- Full uncropped photo at its natural aspect ratio, height-capped
					     (issue #183 REQ-10): the detail view stops being a crop-target
					     consumer, so no `imageMeta`/`target` is involved – tall photos
					     display tall, wide photos display wide. -->
					<ImageFrame
						natural
						class="max-h-[300px] sm:max-h-[480px] max-w-full"
						src={gift.imageUrl}
						alt={gift.name}
						tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Content column: internal scroll on desktop (REQ-1 long-description strategy),
	     flows into the outer sheet scroll on mobile. -->
	<div class={styles.viewContent()}>
		<div
			class={styles.viewContentScroll({ viewDimmed: isDimmed })}
			data-testid="gift-detail-view-scroll"
		>
			<div class="flex flex-wrap items-center gap-2 pr-12">
				<h2 class="font-heading text-xl font-semibold text-foreground">{gift.name}</h2>
				<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
				{#if gift.received}
					<Badge tone="neutral" class="gap-1 text-[11px]">
						<CheckIcon class="size-2.5" />
						{m.gift_received_badge()}
					</Badge>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if gift.price !== null}
					<span class="text-lg font-bold text-foreground">{priceDisplay}</span>
				{:else}
					<span class="text-sm text-ink-soft italic">{priceDisplay}</span>
				{/if}

				{#if priorityInfo}
					<!-- Sticker pill restyle (issue #165): outlined ink border + star icon +
					     the long "Priorita · {label}" form, replacing the borderless tinted
					     pill. Hue stays owned by PRIORITY_DISPLAY.colorClass. -->
					<Badge
						tone="neutral"
						badgeStyle="outlined"
						class={cn('-rotate-1', priorityInfo.colorClass)}
					>
						{#snippet icon()}<StarIcon class="size-3" />{/snippet}
						{m.gift_priority_badge_label({ label: priorityInfo.label() })}
					</Badge>
				{/if}
			</div>

			<GiftLinkList links={gift.links} maxVisible={10} display="row" />

			<GiftDescription
				description={gift.description}
				descriptionAppends={gift.descriptionAppends}
				maxVisibleAppends={null}
			/>

			{#if gift.editedAfterShareAt !== null}
				<!-- Edited-after-share transparency (issue #185): a single muted text
				     line, no icon, no pill – visitors only see this once they open the
				     detail modal deliberately. -->
				<p class="text-xs text-muted-foreground">
					{m.gift_edited_after_share_line({
						date: formatAppendDate(gift.editedAfterShareAt.toISOString()),
					})}
				</p>
			{/if}
		</div>
	</div>

	<!-- Action bar: at most two elements, one line, in every state (SUMMARY.md final
	     rules) – like left, primary action right, never any status text. Absent
	     entirely for the recipient. -->
	{#if isVisitorOrModerator && visitorGift}
		<GiftDetailActionBar
			placement="bar"
			gift={visitorGift}
			{isArchived}
			{onreserve}
			{onunreserve}
			class="sm:col-span-2"
		/>
	{/if}
</div>
