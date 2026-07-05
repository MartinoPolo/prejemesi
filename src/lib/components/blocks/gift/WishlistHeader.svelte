<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import LockIcon from '@lucide/svelte/icons/lock';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import InfoIcon from '@lucide/svelte/icons/info';
	import UsersIcon from '@lucide/svelte/icons/users';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		WISHLIST_STATUS_LABELS,
		WISHLIST_STATUS_BADGE_MAP,
	} from '$lib/modules/wishlists/dashboard_types.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import { wishlistHeaderVariants } from './wishlist_header_variants.js';

	interface WishlistHeaderProps {
		title: string;
		ownerName: string;
		description: string | null;
		imageKey: string | null;
		imageSlots: WishlistImageSlots | null;
		/** Theme-derived emoji for the no-image fallback hero (REQ-3). */
		themeEmoji: string;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		role: WishlistRole;
		giftCount: number;
		ownerIsModerator: boolean;
		onshare?: () => void;
		onmoderators?: () => void;
		onarchive?: () => void;
		oneditimage?: () => void;
	}

	let {
		title,
		ownerName,
		description,
		imageKey,
		imageSlots,
		themeEmoji,
		eventDate,
		status,
		role,
		giftCount,
		ownerIsModerator,
		onshare,
		onmoderators,
		onarchive,
		oneditimage,
	}: WishlistHeaderProps = $props();

	const styles = wishlistHeaderVariants();

	// Banner always renders the themed surface: the assigned image (cropped for the
	// banner slot) when present, otherwise the theme-aware fallback hero (REQ-3/4).
	const bannerSrc = $derived(wishlistImageUrl(imageKey));
	const bannerFrame = $derived(wishlistSlotToFrameProps(imageSlots, 'banner'));
	const isOwner = $derived(role === 'owner');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');
	const isArchived = $derived(status === 'archived');
	const isDraft = $derived(status === 'draft');
	const isEventPast = $derived(eventDate !== null && new Date(eventDate) < new Date());

	const formattedDate = $derived.by(() => {
		if (eventDate === null) {
			return null;
		}
		try {
			return new Intl.DateTimeFormat(getLocale(), {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}).format(new Date(eventDate));
		} catch {
			return null;
		}
	});

	const statusLabel = $derived(WISHLIST_STATUS_LABELS[status]());

	const statusBadgeTone = $derived(WISHLIST_STATUS_BADGE_MAP[status]);

	const giftCountLabel = $derived.by(() => {
		if (giftCount === 1) {
			return m.wishlist_gift_count_one();
		}
		return m.wishlist_gift_count_other({ count: giftCount });
	});
</script>

<header class={styles.root()}>
	<!-- Themed banner: assigned image (banner-slot crop) or theme-aware fallback hero -->
	<div class="{styles.bannerArea()} min-h-48 overflow-hidden" data-testid="wishlist-banner">
		<div class="absolute inset-0">
			<WishlistSlotImage src={bannerSrc} frame={bannerFrame} {themeEmoji} alt={title} />
		</div>
		<div class={styles.bannerOverlay()}></div>
		{#if isOwner && !isArchived}
			<Button
				size="sm"
				intent="outline"
				class={styles.editImageButton()}
				aria-label={m.wishlist_edit_image_label()}
				onclick={oneditimage}
			>
				<PencilIcon data-icon="inline-start" />
				{m.wishlist_edit_image_label()}
			</Button>
		{/if}
		<div class={styles.contentArea()}>
			<span class={styles.ownerNameOnBanner()}>{ownerName}</span>
			<h1 class={styles.titleOnBanner()}>{title}</h1>
			{#if description}
				<p class={styles.descriptionOnBanner()}>{description}</p>
			{/if}
			<div class={styles.metaRowOnBanner()}>
				<Badge tone={statusBadgeTone}>{statusLabel}</Badge>
				<span>{giftCountLabel}</span>
				{#if formattedDate}
					<span class="inline-flex items-center gap-1">
						<CalendarIcon class="size-3.5" />
						{formattedDate}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action buttons -->
	{#if isOwnerOrModerator}
		<div class={styles.actionRow()}>
			{#if isOwner && !isArchived}
				<Button
					size="sm"
					intent="outline"
					aria-label={m.wishlist_share_label()}
					onclick={onshare}
				>
					<ShareIcon data-icon="inline-start" />
					{m.wishlist_share_button()}
				</Button>
			{/if}
			{#if isOwner}
				<Button
					size="sm"
					intent="outline"
					aria-label={m.wishlist_moderators_label()}
					onclick={onmoderators}
				>
					<UsersIcon data-icon="inline-start" />
					{m.wishlist_moderators_label()}
				</Button>
			{/if}
			{#if isOwner && !isArchived}
				<Button
					size="sm"
					intent="outline"
					aria-label={m.wishlist_archive_label()}
					onclick={onarchive}
				>
					<ArchiveIcon data-icon="inline-start" />
					{m.wishlist_archive_button()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Owner sees reservations disclosure – visible to ALL users -->
	{#if ownerIsModerator}
		<div class={styles.disclosureBanner()}>
			<EyeIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_owner_sees_reservations()}</span>
		</div>
	{/if}

	<!-- Lifecycle banners -->
	{#if isArchived}
		<div class={styles.archivedBanner()}>
			<ArchiveIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_archived_banner()}</span>
		</div>
	{:else if isOwner && isEventPast}
		<div class={styles.archivedBanner()}>
			<ArchiveIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_archive_event_passed()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onarchive}>
				{m.wishlist_archive_button()}
			</Button>
		</div>
	{:else if !isDraft && isOwner}
		<div class={styles.sharedBanner()}>
			<LockIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_shared_banner()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onshare}>
				{m.wishlist_reshare()}
			</Button>
		</div>
	{:else if isDraft && isOwner}
		<div class={styles.draftBanner()}>
			<InfoIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_draft_banner()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onshare}>
				{m.wishlist_share_list()}
			</Button>
		</div>
	{/if}
</header>
