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
	import InfinityIcon from '@lucide/svelte/icons/infinity';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import {
		WISHLIST_KIND,
		WISHLIST_ROLES,
		type WishlistKind,
		type WishlistRole,
	} from '$lib/modules/wishlists/types.js';
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
	import { wishlistHeaderVariants } from './wishlist_header_variants.js';

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
		 * (the landing demo) pass it: their photo is a static asset, not an R2 object, so
		 * `wishlistImageUrl` would prepend the upload base and break the src. Unset everywhere
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

	// The wishlist photo (image-slots crop) renders as the taped polaroid print.
	// The photo area is exactly square, so it consumes the 1:1 `thumbnail` slot
	// (#116 D4/REQ-5) – the `card` slot belongs solely to the dashboard banner.
	const polaroidSrc = $derived(imageSrc ?? wishlistImageUrl(imageKey));
	const polaroidFrame = $derived(wishlistSlotToFrameProps(imageSlots, 'thumbnail'));
	// Management actions open to any manager — the linked recipient OR a správce (issue #99).
	const canManage = $derived(canManageWishlist(role));
	const isArchived = $derived(status === 'archived');
	const isPermanent = $derived(kind === WISHLIST_KIND.permanent);
	// Rendered as an expression because Svelte trims the spaces of literal element text.
	const META_SEPARATOR = ' · ';
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
	<div class="mobile-hero" data-testid="wishlist-mobile-hero">
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
				<span class="mobile-meta-item">{statusLabel}</span>{#if isPermanent}<span
						aria-hidden="true">{META_SEPARATOR}</span
					><span class="mobile-meta-item">{m.wishlist_kind_permanent()}</span
					>{/if}{#if giftCountLabel !== null}<span aria-hidden="true"
						>{META_SEPARATOR}</span
					><span class="mobile-meta-item">{giftCountLabel}</span>{/if}
			</p>
		</div>
		{@render headerActions()}
	</div>

	<!-- Spiral-notebook panel: punch holes, red margin line, ruled lines -->
	<div class="notebook" data-testid="wishlist-banner">
		<div class="notebook-face">
			<div class="desktop-header-actions">
				{@render headerActions()}
			</div>
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
				{#if polaroidCaption !== null}
					<figcaption>{polaroidCaption}</figcaption>
				{/if}
			</figure>

			<div
				class={styles.headerText()}
				class:header-text-has-actions={settingsAvailable || canManage}
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
					{#if isPermanent}
						<!-- Takes the place of the event-date chip a permanent list never has. -->
						<Badge tone="neutral" size="lg" data-testid="wishlist-kind-chip">
							<InfinityIcon data-icon="inline-start" />
							{m.wishlist_kind_permanent()}
						</Badge>
					{/if}
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
	.mobile-hero {
		display: none;
	}

	.desktop-header-actions {
		position: absolute;
		z-index: 2;
		top: 1rem;
		right: 1rem;
	}

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
		border: var(--border-w) solid var(--ink);
		border-radius: max(0px, calc(var(--radius-panel) - 2px));
		box-shadow: var(--elevation-ordinary-strong);
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
		right: 8rem;
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
		box-shadow: var(--elevation-ordinary-strong);
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

	@media (width <= 960px) {
		.sticky-note {
			display: none;
		}
	}

	@media (width >= 640px) {
		.header-text-has-actions {
			padding-inline-end: 6.5rem;
		}
	}

	@media (width < 640px) {
		.notebook {
			display: none;
		}

		.mobile-hero {
			display: grid;
			box-sizing: border-box;
			height: 112px;
			grid-template-columns: 92px minmax(0, 1fr) auto;
			align-items: center;
			gap: var(--space-2);
			padding: var(--space-2);
			overflow: hidden;
			background: var(--card);
			border: max(1px, calc(var(--border-w) - 0.5px)) solid var(--ink);
			border-radius: max(0px, calc(var(--radius-panel) - 2px));
			box-shadow: var(--elevation-ordinary);
		}

		.mobile-photo {
			width: 92px;
			height: 92px;
			margin: 0;
			overflow: hidden;
			border: max(1px, calc(var(--border-w) - 0.5px)) solid var(--ink);
			border-radius: max(0px, calc(var(--radius-panel) - 6px));
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
	}
</style>
