<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		hasExplicitFrameFill,
	} from '$lib/components/derived/image-frame/index.js';
	import GiftPieceCount from './GiftPieceCount.svelte';
	import GiftLinkList from './GiftLinkList.svelte';
	import GiftDescription from './GiftDescription.svelte';
	import GiftStateList from './GiftStateList.svelte';
	import GiftViewerActions from './GiftViewerActions.svelte';
	import { giftViewerVariants } from './gift_viewer_variants.js';
	import type { GiftMoreProps } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, formatAppendDate } from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { restingShadowNesting } from '$lib/utils/resting_shadow_nesting.js';

	interface GiftViewerProps extends GiftMoreProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	// Stored image metadata carries no dimensions, so the photo column uses this ratio until the
	// image decodes.
	const FALLBACK_PHOTO_ASPECT_RATIO = 4 / 3;

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = role === 'recipient',
		onreserve,
		onunreserve,
		onmore,
		moreOpen,
		moreSurface,
	}: GiftViewerProps = $props();

	let measuredPhoto = $state<{ src: string; aspectRatio: number } | null>(null);
	let failedPhotoSrc = $state<string | null>(null);

	const { isVisitorOrModerator, visitorGift, reservationAwareGift, reservedCount, presentation } =
		$derived(deriveGiftDisplayState(gift, role, hideReservationState));
	const stateEntries = $derived(hideReservationState ? [] : presentation.overlay);
	const photoSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const hasPhoto = $derived(photoSrc !== null && failedPhotoSrc !== photoSrc);
	const photoAspectRatio = $derived(
		measuredPhoto !== null && measuredPhoto.src === photoSrc
			? measuredPhoto.aspectRatio
			: FALLBACK_PHOTO_ASPECT_RATIO,
	);
	const explicitPhotoFill = $derived.by(() => {
		const fillColor = gift.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	});
	const styles = $derived(
		giftViewerVariants({
			hasPhoto,
			hasPrice: gift.price !== null,
			hasExplicitFill: explicitPhotoFill !== null,
		}),
	);
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const showsPieceCount = $derived(gift.quantity !== null && gift.quantity !== 1);
	const actionGift = $derived(isVisitorOrModerator ? visitorGift : null);

	function rememberPhotoAspectRatio(aspectRatio: number) {
		if (photoSrc !== null) {
			measuredPhoto = { src: photoSrc, aspectRatio };
		}
	}

	function dropFailedPhoto() {
		failedPhotoSrc = photoSrc;
	}

	// The viewer is the dialog content's direct child. Measuring that parent while attaching sets
	// the nested insets before the first paint, unlike a bound dialog ref that arrives a frame later.
	function nestInsideDialogBorder(viewerRoot: HTMLElement) {
		return restingShadowNesting(viewerRoot, viewerRoot.parentElement ?? viewerRoot).destroy;
	}
</script>

<div
	class={styles.root()}
	data-testid="gift-viewer"
	data-photo={hasPhoto ? 'natural' : 'none'}
	{@attach nestInsideDialogBorder}
>
	<div class={styles.layout()}>
		{#if hasPhoto}
			<figure
				class={styles.photoRegion()}
				data-testid="gift-viewer-photo"
				style:--photo-aspect-ratio={photoAspectRatio}
				style:--frame-fill={explicitPhotoFill ?? undefined}
			>
				<div class={styles.photoSizer()}></div>
				<ImageFrame
					natural
					class={styles.photo()}
					src={photoSrc}
					alt={gift.name}
					fillColor={explicitPhotoFill}
					tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
					onmeasured={rememberPhotoAspectRatio}
					onerror={dropFailedPhoto}
				/>
				<GiftStateList
					entries={stateEntries}
					class={styles.photoStates()}
					data-placement="photo"
				/>
			</figure>
		{/if}

		<div class={styles.captionColumn()}>
			<div class={styles.captionScroll()} data-testid="gift-viewer-caption">
				<div class={styles.caption()}>
					<Dialog.Title>
						{#snippet child({ props })}
							<h2 {...props} class={styles.title()}>{gift.name}</h2>
						{/snippet}
					</Dialog.Title>

					<p class={styles.priceLine()}>
						<span class={styles.price()}>{priceDisplay}</span>
						{#if showsPieceCount}
							<span aria-hidden="true">&middot;</span>
						{/if}
						<GiftPieceCount
							quantity={gift.quantity}
							role={reservationAwareGift === null ? 'recipient' : 'visitor'}
							{reservedCount}
							reservationAcknowledgementKey={visitorGift?.myReservationId ?? null}
							hideWhenOne
						/>
					</p>

					<GiftLinkList links={gift.links} maxVisible={gift.links.length} display="row" />

					<GiftStateList
						entries={stateEntries}
						class={styles.captionStates()}
						data-placement="caption"
					/>

					<GiftDescription
						class={styles.description()}
						description={gift.description}
						descriptionAppends={gift.descriptionAppends}
						maxVisibleAppends={null}
					/>

					{#if gift.editedAfterShareAt !== null}
						<p class={styles.editedLine()}>
							{m.gift_edited_after_share_line({
								date: formatAppendDate(gift.editedAfterShareAt.toISOString()),
							})}
						</p>
					{/if}
				</div>
			</div>

			{#if actionGift !== null}
				<GiftViewerActions
					gift={actionGift}
					{role}
					{isArchived}
					{onreserve}
					{onunreserve}
					{onmore}
					{moreOpen}
					{moreSurface}
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Scroll shadows: the covers ride the content, the shades stay at the edges. */
	@media (width >= 40rem) {
		.gift-viewer-caption-scroll {
			background:
				linear-gradient(var(--card) 30%, transparent) top / 100% 28px no-repeat local,
				linear-gradient(transparent, var(--card) 70%) bottom / 100% 28px no-repeat local,
				radial-gradient(
						farthest-side at 50% 0,
						color-mix(in oklab, var(--ink) 28%, transparent),
						transparent
					)
					top / 100% 12px no-repeat scroll,
				radial-gradient(
						farthest-side at 50% 100%,
						color-mix(in oklab, var(--ink) 28%, transparent),
						transparent
					)
					bottom / 100% 12px no-repeat scroll;
		}
	}
</style>
