<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
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
	import { wishlistHeaderVariants } from './wishlist_header_variants.js';

	interface WishlistHeaderProps {
		title: string;
		ownerName: string;
		description: string | null;
		bannerImageKey: string | null;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		role: WishlistRole;
		giftCount: number;
		ownerIsModerator: boolean;
		onshare?: () => void;
		onmoderators?: () => void;
	}

	let {
		title,
		ownerName,
		description,
		bannerImageKey,
		eventDate,
		status,
		role,
		giftCount,
		ownerIsModerator,
		onshare,
		onmoderators,
	}: WishlistHeaderProps = $props();

	const styles = wishlistHeaderVariants();

	const hasBanner = $derived(bannerImageKey !== null);
	const isOwner = $derived(role === 'owner');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');
	const isArchived = $derived(status === 'archived');
	const isDraft = $derived(status === 'draft');

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
	{#if hasBanner}
		<!-- Banner with background image -->
		<div class={styles.bannerArea()} style:background-image="url({bannerImageKey})">
			<div class={styles.bannerOverlay()}></div>
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
	{:else}
		<!-- No banner — standard header -->
		<div class={styles.contentArea()}>
			<span class={styles.ownerName()}>{ownerName}</span>
			<h1 class={styles.title()}>{title}</h1>
			{#if description}
				<p class={styles.description()}>{description}</p>
			{/if}
			<div class={styles.metaRow()}>
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
	{/if}

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
		</div>
	{/if}

	<!-- Owner sees reservations disclosure — visible to ALL users -->
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
