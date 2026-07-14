<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import HourglassIcon from '@lucide/svelte/icons/hourglass';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import UsersIcon from '@lucide/svelte/icons/users';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import {
		WISHLIST_STATUS_LABELS,
		WISHLIST_STATUS_BADGE_MAP,
	} from '$lib/modules/wishlists/dashboard_types.js';
	import { eventCountdown } from '$lib/modules/wishlists/event_countdown.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import { wishlistHeaderVariants } from './wishlist_header_variants.js';

	interface WishlistHeaderProps {
		title: string;
		/** Who the list is for: linked recipient's account name or the free-text recipient name. */
		recipientDisplayName: string;
		/** True for a free-text (for-someone-else) list; drives the recipient-edit pencil gating. */
		isForSomeoneElse: boolean;
		/**
		 * Names of the správci managing the list (all lists, self included; a self-promoted
		 * recipient is included by the server). Powers „Spravuje/Spravují".
		 */
		managerNames: string[];
		description: string | null;
		imageKey: string | null;
		imageSlots: WishlistImageSlots | null;
		/** Theme-derived emoji for the no-image polaroid fallback. */
		themeEmoji: string;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		role: WishlistRole;
		giftCount: number | null;
		/** True when the linked recipient self-promoted to also see reservation state (trust warning). */
		recipientIsModerator: boolean;
		onshare?: () => void;
		onmoderators?: () => void;
		onarchive?: () => void;
		oneditimage?: () => void;
		oneditrecipient?: () => void;
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
		oneditrecipient,
	}: WishlistHeaderProps = $props();

	const styles = wishlistHeaderVariants();

	// The wishlist photo (image-slots crop) renders as the taped polaroid print.
	// The photo area is exactly square, so it consumes the 1:1 `thumbnail` slot
	// (#116 D4/REQ-5) – the `card` slot belongs solely to the dashboard banner.
	const polaroidSrc = $derived(wishlistImageUrl(imageKey));
	const polaroidFrame = $derived(wishlistSlotToFrameProps(imageSlots, 'thumbnail'));
	// Management actions open to any manager — the linked recipient OR a správce (issue #99).
	const canManage = $derived(canManageWishlist(role));
	const isArchived = $derived(status === 'archived');
	const isEventPast = $derived(eventDate !== null && new Date(eventDate) < new Date());
	// Recipient edit pencil (issue #150): free-text lists → any manager may rename; linked
	// lists → ONLY the linked recipient may flip to free-text (no evicting by správci).
	// Archived lists are read-only, both actions are rejected server-side.
	const canEditRecipient = $derived(
		!isArchived && (isForSomeoneElse ? canManage : role === WISHLIST_ROLES.recipient),
	);

	// „Spravuje {name}" (single správce) / „Spravují {names}" (multiple) — rendered whenever
	// správci exist, self lists included (2026-07-14 header decision).
	const managedByLabel = $derived.by(() => {
		if (managerNames.length === 0) {
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

	// Sticky-note / meta-chip countdown (REQ-12): hidden without an event date,
	// „proběhlo" once the event passed (the manager archive prompt takes over).
	const countdownLabel = $derived.by(() => {
		if (eventDate === null) {
			return null;
		}
		const countdown = eventCountdown(new Date(eventDate));
		if (countdown !== null) {
			return m.wishlist_countdown_note({ countdown });
		}
		return m.wishlist_countdown_passed();
	});

	// Polaroid caption mimics a handwritten photo label: event date only („červenec 2026").
	// The recipient name lives in the „Pro: {name}" line, never in the caption (2026-07-14
	// dedup decision) — without an event date the polaroid has no caption at all.
	const polaroidCaption = $derived.by(() => {
		if (eventDate === null) {
			return null;
		}
		try {
			return new Intl.DateTimeFormat(getLocale(), {
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
	<!-- Spiral-notebook panel: punch holes, red margin line, ruled lines -->
	<div class="notebook" data-testid="wishlist-banner">
		<div class="notebook-face">
			{#if countdownLabel !== null}
				<!-- Sunshine sticky note pinned to the page's top-right corner (desktop only) -->
				<div class="sticky-note" aria-hidden="true">{countdownLabel}</div>
			{/if}

			<!-- Taped polaroid print — a physical photo, so frame + caption ink stay fixed -->
			<figure class="polaroid reveal group/polaroid">
				<div class="polaroid-img">
					<WishlistSlotImage
						class="size-full rounded-none"
						src={polaroidSrc}
						frame={polaroidFrame}
						{themeEmoji}
						alt={title}
						variant="thumbnail"
						eagerLoading
					/>
					{#if canManage && !isArchived}
						<Button
							size="icon-sm"
							intent="secondary"
							class={styles.editImageButton()}
							aria-label={m.wishlist_edit_image_label()}
							onclick={oneditimage}
						>
							<PencilIcon />
						</Button>
					{/if}
				</div>
				{#if polaroidCaption !== null}
					<figcaption>{polaroidCaption}</figcaption>
				{/if}
			</figure>

			<div class={styles.headerText()}>
				<!-- Every list leads with „Pro: {recipient}" — colon form, prefix lighter, name bold
				     (2026-07-14 header decision, self lists included). -->
				<p class={styles.recipientLine()}>
					{m.wishlist_header_for_prefix()}
					<strong class={styles.recipientName()}>{recipientDisplayName}</strong
					>{#if canEditRecipient}
						<Button
							size="icon-sm"
							intent="ghost"
							class="ms-1.5 align-middle"
							aria-label={m.wishlist_edit_recipient_label()}
							data-testid="edit-recipient-button"
							onclick={oneditrecipient}
						>
							<PencilIcon />
						</Button>
					{/if}
				</p>
				<h1 class={styles.title()}>{title}</h1>
				{#if description}
					<p class={styles.description()}>{description}</p>
				{/if}
				<div class={styles.metaRow()}>
					<Badge tone={statusBadgeTone} size="lg">{statusLabel}</Badge>
					{#if giftCountLabel !== null}
						<Badge tone="neutral" size="lg">{giftCountLabel}</Badge>
					{/if}
					{#if formattedDate !== null}
						<Badge tone="neutral" size="lg">
							<CalendarIcon data-icon="inline-start" />
							{formattedDate}
						</Badge>
					{/if}
					{#if countdownLabel !== null}
						<!-- Stands in for the sticky note below 960 px -->
						<Badge size="lg" class={styles.countdownChip()}>
							<HourglassIcon data-icon="inline-start" />
							{countdownLabel}
						</Badge>
					{/if}
					{#if managedByLabel !== null}
						<span class={styles.managersLine()}>{managedByLabel}</span>
					{/if}
				</div>
				{#if canManage}
					<div class={styles.actionRow()}>
						{#if !isArchived}
							<Button
								size="sm"
								aria-label={m.wishlist_share_label()}
								onclick={onshare}
							>
								<ShareIcon data-icon="inline-start" />
								{m.wishlist_share_button()}
							</Button>
						{/if}
						<Button
							size="sm"
							intent="secondary"
							aria-label={m.wishlist_moderators_label()}
							onclick={onmoderators}
						>
							<UsersIcon data-icon="inline-start" />
							{m.wishlist_moderators_label()}
						</Button>
						{#if !isArchived}
							<Button
								size="sm"
								intent="secondary"
								aria-label={m.wishlist_archive_label()}
								onclick={onarchive}
							>
								<ArchiveIcon data-icon="inline-start" />
								{m.wishlist_archive_button()}
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Lifecycle notices: calm tinted panels (the shared/draft strips are gone — REQ-12) -->
	{#if isArchived}
		<Alert.Root>
			<ArchiveIcon />
			<Alert.Title>{m.wishlist_archived_banner()}</Alert.Title>
		</Alert.Root>
	{:else if canManage && isEventPast}
		<Alert.Root>
			<ArchiveIcon />
			<Alert.Title>{m.wishlist_archive_event_passed()}</Alert.Title>
			<Alert.Action>
				<Button size="sm" intent="secondary" onclick={onarchive}>
					{m.wishlist_archive_button()}
				</Button>
			</Alert.Action>
		</Alert.Root>
	{/if}

	<!-- Reservation-visibility notices (REQ-13): calm reassurance vs loud trust warning -->
	{#if recipientIsModerator && role !== WISHLIST_ROLES.recipient}
		<!-- Loud sticky-note warning — visitors must not miss it. NO tape (settled decision). -->
		<Alert.Root tone="warning" class="reveal reveal-5 -rotate-[0.5deg]">
			<TriangleAlertIcon />
			<Alert.Title>{m.wishlist_trust_warning({ name: recipientDisplayName })}</Alert.Title>
		</Alert.Root>
	{:else if role === WISHLIST_ROLES.moderator}
		<Alert.Root class="reveal reveal-5 -rotate-[0.35deg]">
			<EyeIcon />
			<Alert.Title
				>{m.wishlist_moderator_sees_reservations({
					name: recipientDisplayName,
				})}</Alert.Title
			>
		</Alert.Root>
	{/if}
</header>

<style>
	/* Static „spiral notebook page": ruled lines, red margin, punch holes down the
	   left edge. Layered backgrounds don't translate to utility classes, so the
	   notebook motifs live here; colors come from the palette tokens in app.css. */
	.notebook {
		position: relative;
		background-color: var(--card);
		background-image:
			radial-gradient(
				circle at 34px 26px,
				var(--hole-inner) 0 5.5px,
				var(--hole-ring) 5.5px 8px,
				transparent 8.5px
			),
			linear-gradient(
				to right,
				transparent 0 84px,
				var(--margin-red) 84px 86.5px,
				transparent 86.5px
			),
			repeating-linear-gradient(transparent 0 33px, var(--rule-line) 33px 35px);
		background-size:
			100% 52px,
			100% 100%,
			100% 100%;
		background-repeat: repeat-y, no-repeat, no-repeat;
		border: 2.5px solid var(--ink);
		border-radius: 14px;
		box-shadow: 6px 6px 0 var(--hard-shadow-strong);
	}

	.notebook-face {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-6);
		padding: var(--space-6) var(--space-8) var(--space-6) 116px;
	}

	/* Sunshine sticky note pinned to the page's top-right corner (static) */
	.sticky-note {
		position: absolute;
		top: 18px;
		right: 34px;
		z-index: 1;
		padding: 14px 18px 12px;
		font-family: var(--font-head);
		font-size: 15px;
		line-height: 1.25;
		text-align: center;
		color: var(--accent-loud-foreground);
		background: var(--accent-loud);
		border: 2.5px solid var(--accent-loud-foreground);
		border-radius: 4px;
		transform: rotate(4deg);
		box-shadow: 4px 5px 0 var(--hard-shadow-strong);
	}

	/* Strip of translucent tape over the note's top edge (tape belongs on paper) */
	.sticky-note::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		width: 62px;
		height: 18px;
		transform: translateX(-50%) rotate(-3deg);
		background: var(--tape-bg);
		border: 1.5px solid var(--tape-border);
	}

	/* Taped polaroid print — the print stays a physical photo, so its frame and
	   caption ink are fixed and do NOT follow the palette or dark mode. */
	.polaroid {
		position: relative;
		flex: none;
		width: 172px;
		margin: 0;
		padding: 9px 9px 0;
		background: #fffdf6;
		border: 2px solid #4a443a;
		border-radius: 3px;
		transform: rotate(-3deg);
		box-shadow: 5px 6px 0 var(--hard-shadow-strong);
	}

	.polaroid::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		z-index: 1;
		width: 72px;
		height: 20px;
		transform: translateX(-50%) rotate(-4deg);
		background: var(--tape-bg);
		border: 1.5px solid var(--tape-border);
	}

	.polaroid-img {
		position: relative;

		/* Square photo: matches the 1:1 thumbnail slot the crop editor shows (#116 D4). */
		aspect-ratio: 1 / 1;
		overflow: hidden;
		border: 2px solid rgb(0 0 0 / 14%);
	}

	.polaroid figcaption {
		padding: 7px 4px 9px;
		font-family: var(--font-head);
		font-size: 13.5px;
		text-align: center;
		color: #6c6353;
	}

	@media (width <= 960px) {
		.sticky-note {
			display: none;
		}
	}

	@media (width <= 640px) {
		.notebook {
			background-image:
				radial-gradient(
					circle at 20px 26px,
					var(--hole-inner) 0 4.5px,
					var(--hole-ring) 4.5px 6.5px,
					transparent 7px
				),
				linear-gradient(
					to right,
					transparent 0 48px,
					var(--margin-red) 48px 50px,
					transparent 50px
				),
				repeating-linear-gradient(transparent 0 33px, var(--rule-line) 33px 35px);
		}

		.notebook-face {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-4);
			padding: var(--space-4) var(--space-4) var(--space-4) 66px;
		}

		.polaroid {
			width: 148px;
			transform: rotate(-2deg);
		}

		.polaroid-img {
			height: 116px;
		}
	}
</style>
