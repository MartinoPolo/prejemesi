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
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
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
		/** Who the list is for: linked recipient's account name or the free-text recipient name. */
		recipientDisplayName: string;
		/** True for a free-text (for-someone-else) list; drives the „Pro {recipient}" name slot + managed-by line. */
		isForSomeoneElse: boolean;
		/** Names of the správci managing a for-someone list (empty on self lists). Powers „Spravuje/Spravují". */
		managerNames: string[];
		description: string | null;
		imageKey: string | null;
		imageSlots: WishlistImageSlots | null;
		/** Theme-derived emoji for the no-image fallback hero (REQ-3). */
		themeEmoji: string;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		role: WishlistRole;
		giftCount: number | null;
		/** True when the linked recipient self-promoted to also see reservation state (disclosure banner). */
		recipientIsModerator: boolean;
		onshare?: () => void;
		onmoderators?: () => void;
		onarchive?: () => void;
		oneditimage?: () => void;
	}

	let {
		title,
		recipientDisplayName,
		isForSomeoneElse,
		managerNames,
		description,
		imageKey,
		imageSlots,
		themeEmoji,
		eventDate,
		status,
		role,
		giftCount,
		recipientIsModerator,
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
	// Management actions (share/archive/edit-image + lifecycle banners) are now open to any manager
	// — the linked recipient OR a správce — per the rights matrix (issue #99), not just an owner.
	const canManage = $derived(canManageWishlist(role));
	const isArchived = $derived(status === 'archived');
	const isDraft = $derived(status === 'draft');
	const isEventPast = $derived(eventDate !== null && new Date(eventDate) < new Date());

	// „Spravuje {name}" (single správce) / „Spravují {names}" (multiple, comma-joined) — for-someone lists only.
	const managedByLabel = $derived.by(() => {
		if (!isForSomeoneElse || managerNames.length === 0) {
			return null;
		}
		if (managerNames.length === 1) {
			return m.wishlist_managed_by_one({ name: managerNames[0]! });
		}
		return m.wishlist_managed_by_many({ names: managerNames.join(', ') });
	});

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
		if (giftCount === null) {
			return null;
		}
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
		{#if canManage && !isArchived}
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
			<!-- Variant A: for-someone lists lead with „Pro {recipient}" (prefix lighter, name bold);
			     self lists render the recipient name exactly as the old owner slot did. -->
			<span class={styles.ownerNameOnBanner()}>
				{#if isForSomeoneElse}<span class={styles.recipientForPrefix()}
						>{m.wishlist_header_for_prefix()}</span
					>&nbsp;{/if}{recipientDisplayName}
			</span>
			<h1 class={styles.titleOnBanner()}>{title}</h1>
			{#if description}
				<p class={styles.descriptionOnBanner()}>{description}</p>
			{/if}
			<div class={styles.metaRowOnBanner()}>
				<Badge tone={statusBadgeTone}>{statusLabel}</Badge>
				{#if giftCountLabel !== null}
					<span>{giftCountLabel}</span>
				{/if}
				{#if formattedDate}
					<span class="inline-flex items-center gap-1">
						<CalendarIcon class="size-3.5" />
						{formattedDate}
					</span>
				{/if}
			</div>
			{#if managedByLabel !== null}
				<div class={styles.managedByLine()}>{managedByLabel}</div>
			{/if}
		</div>
	</div>

	<!-- Action buttons – open to any manager (recipient OR správce) per the rights matrix -->
	{#if canManage}
		<div class={styles.actionRow()}>
			{#if !isArchived}
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
			<Button
				size="sm"
				intent="outline"
				aria-label={m.wishlist_moderators_label()}
				onclick={onmoderators}
			>
				<UsersIcon data-icon="inline-start" />
				{m.wishlist_moderators_label()}
			</Button>
			{#if !isArchived}
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

	<!-- Recipient-also-správce disclosure – visible to ALL users -->
	{#if recipientIsModerator}
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
	{:else if canManage && isEventPast}
		<div class={styles.archivedBanner()}>
			<ArchiveIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_archive_event_passed()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onarchive}>
				{m.wishlist_archive_button()}
			</Button>
		</div>
	{:else if !isDraft && canManage}
		<div class={styles.sharedBanner()}>
			<LockIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_shared_banner()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onshare}>
				{m.wishlist_reshare()}
			</Button>
		</div>
	{:else if isDraft && canManage}
		<div class={styles.draftBanner()}>
			<InfoIcon class="size-4 flex-shrink-0" />
			<span>{m.wishlist_draft_banner()}</span>
			<Button size="sm" intent="link" class="ml-auto px-0" onclick={onshare}>
				{m.wishlist_share_list()}
			</Button>
		</div>
	{/if}
</header>
