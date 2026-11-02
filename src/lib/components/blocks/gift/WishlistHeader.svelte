<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import HourglassIcon from '@lucide/svelte/icons/hourglass';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import {
		WISHLIST_KIND,
		WISHLIST_OCCASION,
		WISHLIST_ROLES,
		type WishlistKind,
		type WishlistOccasion,
		type WishlistRole,
	} from '$lib/modules/wishlists/types.js';
	import { displayedWishlistOccasion } from '$lib/modules/wishlists/wishlist_occasion.js';
	import {
		WISHLIST_OCCASION_DISPLAY,
		occasionDisplayLabel,
	} from '$lib/modules/wishlists/wishlist_occasion_display.js';
	import { INLINE_TEXT_SEPARATOR } from '$lib/utils/inline_text_separator.js';
	import type { WishlistHeroFrame } from '$lib/theme/wishlist_themes.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { Avatar } from '$lib/components/derived/avatar/index.js';
	import { getInitials } from '$lib/utils/initials.js';
	import {
		WISHLIST_STATUS_LABELS,
		WISHLIST_STATUS_BADGE_MAP,
	} from '$lib/modules/wishlists/dashboard_types.js';
	import { eventCountdown } from '$lib/modules/wishlists/event_countdown.js';
	import { hasUpcomingEventDate } from '$lib/modules/wishlists/event_date.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import type { WishlistThemeMotif } from '$lib/components/blocks/wishlist/wishlist_theme_scope.js';
	import WishlistHeaderActions from './WishlistHeaderActions.svelte';
	import WishlistHeroEmblem from './WishlistHeroEmblem.svelte';
	import WishlistHeroFrameShell from './WishlistHeroFrame.svelte';
	import { wishlistHeaderVariants } from './wishlist_header_variants.js';
	import { wishlistHeroFrameVariants } from './wishlist_hero_frame_variants.js';

	interface WishlistHeaderProps {
		title: string;
		/** Who the list is for: linked recipient's account name or the free-text recipient name. */
		recipientDisplayName: string;
		/** Linked recipient's avatar (Google profile picture or uploaded avatar); null for a
		 *  free-text recipient or when the recipient has no avatar (issue #158). */
		recipientImage: string | null;
		/** True for a free-text (for-someone-else) list; drives the recipient-edit pencil gating. */
		isForSomeoneElse: boolean;
		/**
		 * Names of the správci managing the list (all lists, self included; a self-promoted
		 * recipient is included by the server). Powers „Spravuje/Spravují".
		 */
		managerNames: string[];
		description: string | null;
		imageKey: string | null;
		/**
		 * Ready-made polaroid URL that bypasses `imageKey` resolution. Only fixture surfaces
		 * (the landing demo) pass it: their `asset()` URL is document-relative (`./demo/…`)
		 * during SSR, which `wishlistImageUrl` would take for an object key. Unset everywhere
		 * else, leaving the `imageKey` path untouched.
		 */
		imageSrc?: string | null;
		imageSlots: WishlistImageSlots | null;
		/** Theme-derived emoji for the no-image polaroid fallback. */
		themeEmoji: string;
		/** Wishlist theme motif for the no-image polaroid on themed lists (#535). */
		themeMotif?: WishlistThemeMotif | null;
		eventDate: Date | null;
		status: 'draft' | 'active' | 'archived';
		kind?: WishlistKind;
		/** What the list is for; a permanent list is always the Stálý seznam. */
		occasion?: WishlistOccasion;
		/** The frame the motif chose, or the stored override. */
		heroFrame?: WishlistHeroFrame;
		role: WishlistRole;
		giftCount: number | null;
		/** True when the linked recipient self-promoted to also see reservation state (trust warning). */
		recipientIsModerator: boolean;
		adminSettingsAvailable?: boolean;
		demo?: boolean;
		/**
		 * Which heading element the title renders as. The wishlist page is the list's own
		 * page, so the title is its `<h1>` — but on the landing page the demo header sits
		 * under the hero's `<h1>` and must step down to `<h2>` to keep one h1 per document.
		 */
		headingLevel?: 1 | 2;
		onshare?: () => void;
		onmoderators?: () => void;
		onarchive?: () => void;
		oneditimage?: () => void;
		oneditrecipient?: () => void;
		onsettings?: () => void;
	}

	let {
		title,
		recipientDisplayName,
		recipientImage,
		isForSomeoneElse,
		managerNames,
		description,
		imageKey,
		imageSrc = null,
		imageSlots,
		themeEmoji,
		themeMotif = null,
		eventDate,
		status,
		kind = WISHLIST_KIND.occasion,
		occasion = WISHLIST_OCCASION.other,
		heroFrame = 'notebook',
		role,
		giftCount,
		recipientIsModerator,
		adminSettingsAvailable = false,
		demo = false,
		headingLevel = 1,
		onshare,
		onmoderators,
		onarchive,
		oneditimage,
		oneditrecipient,
		onsettings,
	}: WishlistHeaderProps = $props();

	const styles = wishlistHeaderVariants();
	const frameStyles = $derived(wishlistHeroFrameVariants({ frame: heroFrame }));

	// The wishlist photo (image-slots crop) renders as the taped polaroid print.
	// The photo area is exactly square, so it consumes the 1:1 `thumbnail` slot
	// (#116 D4/REQ-5) – the `card` slot belongs solely to the dashboard banner.
	const polaroidSrc = $derived(imageSrc ?? wishlistImageUrl(imageKey));
	const polaroidFrame = $derived(wishlistSlotToFrameProps(imageSlots, 'thumbnail'));
	// Management actions open to any manager — the linked recipient OR a správce (issue #99).
	const canManage = $derived(canManageWishlist(role));
	const isArchived = $derived(status === 'archived');
	const isPermanent = $derived(kind === WISHLIST_KIND.permanent);
	const displayedOccasion = $derived(displayedWishlistOccasion(kind, occasion));
	const OccasionIcon = $derived(WISHLIST_OCCASION_DISPLAY[displayedOccasion].icon);
	// Without a label (Jiná) the emblem and meta line show only the countdown.
	const occasionLabel = $derived(occasionDisplayLabel(displayedOccasion));
	const settingsAvailable = $derived((canManage && !isArchived) || adminSettingsAvailable);
	const isEventPast = $derived(eventDate !== null && !hasUpcomingEventDate(eventDate));
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

	// Emblem, meta-chip and mobile countdown (REQ-12): hidden without an event date,
	// „proběhlo" once the event passed (the manager archive prompt takes over).
	const countdown = $derived(eventDate === null ? null : eventCountdown(new Date(eventDate)));
	const countdownLabel = $derived(
		eventDate === null ? null : (countdown ?? m.wishlist_countdown_passed()),
	);
	// The Pozvánka seal is part of the envelope; stamp and tag appear only with something to say.
	const hasEmblem = $derived(
		heroFrame === 'invitation' || occasionLabel !== null || countdownLabel !== null,
	);
	// The 640–960 px meta chip keeps the exclaimed note the sticky note used to carry.
	const countdownChipLabel = $derived(
		countdown === null ? countdownLabel : m.wishlist_countdown_note({ countdown }),
	);

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

	// Fallback initials for a broken/expired recipient avatar URL (Avatar's own onerror path).
	const recipientInitials = $derived(getInitials(recipientDisplayName));

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

<!-- Mobile and desktop layouts each place the same actions; CSS shows one of them. -->
{#snippet headerActions()}
	<WishlistHeaderActions
		{canManage}
		{settingsAvailable}
		canShare={!isArchived && !demo}
		canEditImage={!isArchived && !demo}
		{canEditRecipient}
		canArchive={!isArchived}
		{onshare}
		onmoderators={demo ? undefined : onmoderators}
		{onsettings}
		{oneditimage}
		{oneditrecipient}
		{onarchive}
	/>
{/snippet}

<header class={styles.root()}>
	<!-- Narrow screens use a standalone compact hero. The notices below intentionally remain
	     siblings so lifecycle and reservation privacy messaging never gets clipped by it. -->
	<WishlistHeroFrameShell frame={heroFrame} layout="mobile" data-testid="wishlist-mobile-hero">
		<div class="mobile-hero">
			<figure class="mobile-photo" data-testid="wishlist-mobile-photo">
				<WishlistSlotImage
					class="size-full rounded-none"
					src={polaroidSrc}
					frame={polaroidFrame}
					{themeEmoji}
					{themeMotif}
					alt={title}
					variant="banner"
					eagerLoading
				/>
			</figure>
			<div class="mobile-copy">
				<p class="mobile-recipient" data-testid="wishlist-mobile-recipient">
					{m.wishlist_header_for_prefix()} <strong>{recipientDisplayName}</strong>
				</p>
				<svelte:element this={headingLevel === 1 ? 'h1' : 'h2'} class="mobile-title">
					{title}
				</svelte:element>
				<p class="mobile-meta" data-testid="wishlist-mobile-meta">
					<span class="mobile-meta-item">{statusLabel}</span
					>{#if occasionLabel !== null}<span aria-hidden="true"
							>{INLINE_TEXT_SEPARATOR}</span
						><span class="mobile-meta-item mobile-meta-occasion"
							><OccasionIcon
								class="mobile-meta-icon"
								aria-hidden="true"
							/>{occasionLabel}</span
						>{/if}{#if countdownLabel !== null}<span aria-hidden="true"
							>{INLINE_TEXT_SEPARATOR}</span
						><span class="mobile-meta-item">{countdownLabel}</span
						>{/if}{#if giftCountLabel !== null}<span aria-hidden="true"
							>{INLINE_TEXT_SEPARATOR}</span
						><span class="mobile-meta-item">{giftCountLabel}</span>{/if}
				</p>
			</div>
			{@render headerActions()}
		</div>
	</WishlistHeroFrameShell>

	<WishlistHeroFrameShell frame={heroFrame} layout="desktop" data-testid="wishlist-banner">
		<div class={frameStyles.face()}>
			<div class="desktop-header-actions">
				{@render headerActions()}
			</div>

			<!-- Blok: taped polaroid print — a physical photo, so frame + caption ink stay fixed.
			     The other frames show the photo as a flat tile. -->
			<figure
				class={[
					frameStyles.photo(),
					heroFrame !== 'notebook' && frameStyles.photoTile(),
					'group/polaroid',
				]}
			>
				<div class={frameStyles.photoImage()}>
					<WishlistSlotImage
						class="size-full rounded-none"
						src={polaroidSrc}
						frame={polaroidFrame}
						{themeEmoji}
						{themeMotif}
						alt={title}
						variant="banner"
						eagerLoading
					/>
					{#if canManage && !isArchived}
						<Button
							size="sm"
							format="icon"
							intent="secondary"
							class={styles.editImageButton()}
							aria-label={m.wishlist_edit_image_label()}
							onclick={oneditimage}
						>
							<PencilIcon />
						</Button>
					{/if}
				</div>
				{#if heroFrame === 'notebook' && polaroidCaption !== null}
					<figcaption>{polaroidCaption}</figcaption>
				{/if}
			</figure>

			<div
				class={styles.headerText()}
				class:header-text-has-actions={settingsAvailable || canManage}
				class:header-text-beside-emblem={hasEmblem}
			>
				<!-- Every list leads with „Pro: {recipient}" — colon form, prefix lighter, name bold
				     (2026-07-14 header decision, self lists included). A `<div>`, not a `<p>`: the
				     recipient avatar below renders ImageFrame's `<div>` root, and a div nested in a
				     `<p>` is invalid HTML – the browser's parser auto-closes the paragraph early,
				     which desyncs SSR vs. hydrated DOM and crashes hydration (issue #158). -->
				<div class={styles.recipientLine()}>
					{m.wishlist_header_for_prefix()}
					<span class={styles.recipientNameGroup()}>
						{#if recipientImage !== null}
							<Avatar
								src={recipientImage}
								alt=""
								initials={recipientInitials}
								size="sm"
								class={styles.recipientAvatar()}
							/>
						{/if}
						<strong class={styles.recipientName()}>{recipientDisplayName}</strong>
						{#if canEditRecipient}
							<Button
								size="sm"
								format="icon"
								intent="ghost"
								aria-label={m.wishlist_edit_recipient_label()}
								data-testid="edit-recipient-button"
								onclick={oneditrecipient}
							>
								<PencilIcon />
							</Button>
						{/if}
					</span>
				</div>
				<svelte:element this={headingLevel === 1 ? 'h1' : 'h2'} class={styles.title()}>
					{title}
				</svelte:element>
				{#if description}
					<p class={styles.description()}>{description}</p>
				{/if}
				<div class={styles.metaRow()}>
					<Badge tone={statusBadgeTone} size="lg">{statusLabel}</Badge>
					{#if giftCountLabel !== null}
						<Badge tone="neutral" size="lg">{giftCountLabel}</Badge>
					{/if}
					{#if occasionLabel !== null}
						<!-- The emblem names the occasion from 960 px. -->
						<Badge
							tone="neutral"
							size="lg"
							class={styles.occasionChip()}
							data-testid="wishlist-occasion-chip"
						>
							<OccasionIcon data-icon="inline-start" />
							{occasionLabel}
						</Badge>
					{/if}
					{#if formattedDate !== null}
						<Badge tone="neutral" size="lg">
							<CalendarIcon data-icon="inline-start" />
							{formattedDate}
						</Badge>
					{/if}
					{#if countdownChipLabel !== null}
						<!-- Stands in for the emblem countdown below 960 px -->
						<Badge size="lg" class={styles.countdownChip()}>
							<HourglassIcon data-icon="inline-start" />
							{countdownChipLabel}
						</Badge>
					{/if}
					{#if managedByLabel !== null}
						<span class={styles.managersLine()}>{managedByLabel}</span>
					{/if}
				</div>
			</div>
		</div>
		<WishlistHeroEmblem
			frame={heroFrame}
			occasionIcon={OccasionIcon}
			{occasionLabel}
			{countdownLabel}
		/>
	</WishlistHeroFrameShell>

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

	<!-- Visitors learn that a permanent list changes over time; managers shape it themselves. -->
	{#if isPermanent && !canManage && !isArchived}
		<Alert.Root data-testid="wishlist-permanent-note">
			<RefreshCwIcon />
			<Alert.Title>{m.wishlist_permanent_visitor_note()}</Alert.Title>
		</Alert.Root>
	{/if}

	<!-- Reservation-visibility notices (REQ-13): calm reassurance vs loud trust warning -->
	{#if recipientIsModerator && role !== WISHLIST_ROLES.recipient}
		<!-- Loud sticky-note warning — visitors must not miss it. NO tape (settled decision). -->
		<Alert.Root tone="warning" class="reveal reveal-5">
			<TriangleAlertIcon />
			<Alert.Title>{m.wishlist_trust_warning({ name: recipientDisplayName })}</Alert.Title>
		</Alert.Root>
	{:else if role === WISHLIST_ROLES.moderator}
		<Alert.Root class="reveal reveal-5">
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
	.desktop-header-actions {
		position: absolute;
		z-index: 2;
		top: var(--hero-actions-top);
		right: var(--hero-actions-end);
	}

	/* Taped polaroid print — the print stays a physical photo, so its frame and
	   caption ink are fixed and do NOT follow the palette or dark mode. */
	.polaroid {
		--polaroid-rotation: -3deg;

		position: relative;
		flex: none;
		width: 172px;
		margin: 0;
		padding: 9px;
		background: #fffdf6;
		border: 2px solid #4a443a;
		border-radius: 3px;
		transform: rotate(var(--polaroid-rotation));
		box-shadow: var(--elevation-lifted-strong);
	}

	@media (prefers-reduced-motion: no-preference) {
		.polaroid.reveal {
			animation: polaroid-fade-up 0.6s ease backwards;
		}
	}

	@keyframes polaroid-fade-up {
		from {
			opacity: 0;
			transform: translateY(18px) rotate(0deg);
		}

		to {
			opacity: 1;
			transform: translateY(0) rotate(var(--polaroid-rotation));
		}
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

	/* The copy keeps clear of the actions, the frame's own end decoration and, from 960 px,
	   the occasion emblem, so decorations never overlap the title. */
	@media (width >= 640px) {
		.header-text-has-actions {
			padding-inline-end: max(
				var(--hero-copy-end-minimum),
				calc(var(--hero-actions-end) + 7.5rem - var(--hero-face-end))
			);
		}
	}

	@media (width >= 960px) {
		.header-text-beside-emblem {
			padding-inline-end: calc(
				var(--hero-emblem-reserve) + var(--space-4) - var(--hero-face-end)
			);
		}
	}

	@media (width < 640px) {
		/* The frame shell draws the paper; its extras clear the frame's edge decorations.
		   A minimum, not a fixed height: long titles and wrapped meta lines grow the hero
		   instead of overflowing its bottom padding. */
		.mobile-hero {
			display: grid;
			box-sizing: border-box;
			min-height: calc(112px - 2 * var(--hero-mobile-border) + var(--hero-mobile-top-extra));
			grid-template-columns: 92px minmax(0, 1fr) auto;
			align-items: center;
			gap: var(--space-2);
			padding: calc(var(--space-2) + var(--hero-mobile-top-extra))
				calc(var(--space-2) + var(--hero-mobile-end-extra)) var(--space-2)
				calc(var(--space-2) + var(--hero-mobile-start-extra));
		}

		.mobile-photo {
			width: 92px;
			height: 92px;
			margin: 0;
			overflow: hidden;
			border: max(1px, calc(var(--border-w) - 0.5px)) solid var(--ink);
			border-radius: max(0px, calc(var(--radius-panel) - 6px));
		}

		:global([data-hero-frame='tag']) .mobile-photo {
			border-radius: var(--wishlist-pill-radius, 50%);
		}

		.mobile-copy {
			min-width: 0;
		}

		.mobile-hero :global([data-testid='wishlist-header-actions']) {
			align-self: start;
		}

		.mobile-recipient,
		.mobile-meta {
			margin: 0;
			color: var(--muted-foreground);
			font-size: 11px;
			line-height: 15px;
			font-weight: 600;
		}

		.mobile-recipient strong {
			color: var(--ink);
		}

		.mobile-title {
			display: -webkit-box;
			margin: 1px 0 0;
			overflow: hidden;
			font-family: var(--font-head);
			font-size: 16px;
			font-weight: 700;
			line-height: 1.15;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}

		.mobile-meta {
			margin-top: var(--space-1);
		}

		/* Wraps only between segments, never inside one such as "3 přání". */
		.mobile-meta-item {
			white-space: nowrap;
		}

		.mobile-meta-occasion :global(.mobile-meta-icon) {
			display: inline;
			width: 11px;
			height: 11px;
			margin-inline-end: 3px;
			vertical-align: -1px;
		}
	}
</style>
