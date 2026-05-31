<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import InfoIcon from '@lucide/svelte/icons/info';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		WISHLIST_STATUS_LABELS,
		WISHLIST_STATUS_BADGE_MAP,
	} from '$lib/modules/wishlists/dashboard-types.js';
	import { wishlistHeaderVariants } from './wishlist-header-variants.js';

	interface WishlistHeaderProps {
		title: string;
		ownerName: string;
		description: string | null;
		bannerImageKey: string | null;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		role: WishlistRole;
		giftCount: number;
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
			return new Intl.DateTimeFormat('cs-CZ', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}).format(new Date(eventDate));
		} catch {
			return null;
		}
	});

	const statusLabel = $derived(WISHLIST_STATUS_LABELS[status]);

	const statusBadgeVariant = $derived.by(() => {
		const mapped = WISHLIST_STATUS_BADGE_MAP[status];
		if (mapped === 'success') {
			return 'default' as const;
		}
		if (mapped === 'warning') {
			return 'secondary' as const;
		}
		return 'outline' as const;
	});

	const giftCountLabel = $derived.by(() => {
		if (giftCount === 1) {
			return '1 prani';
		}
		if (giftCount >= 2 && giftCount <= 4) {
			return `${giftCount} prani`;
		}
		return `${giftCount} prani`;
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
					<Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
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
				<Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
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
			<Button size="sm" variant="outline" aria-label="Sdilet seznam">
				<ShareIcon data-icon="inline-start" />
				Sdilet
			</Button>
			{#if isOwner}
				<Button size="sm" variant="outline" aria-label="Nastaveni seznamu">
					<SettingsIcon data-icon="inline-start" />
					Nastaveni
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Lifecycle banners -->
	{#if isArchived}
		<div class={styles.archivedBanner()}>
			<ArchiveIcon class="size-4 flex-shrink-0" />
			<span>Archivovano — seznam je uzavren. Nova rezervace neni mozna.</span>
		</div>
	{:else if isDraft && isOwner}
		<div class={styles.draftBanner()}>
			<InfoIcon class="size-4 flex-shrink-0" />
			<span>Tento seznam jeste nebyl sdilen.</span>
			<Button size="sm" variant="link" class="ml-auto px-0 text-blue-800">
				Sdilet seznam
			</Button>
		</div>
	{/if}
</header>
