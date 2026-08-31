<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import AppearanceMenu from '$lib/components/derived/appearance-menu/AppearanceMenu.svelte';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import { CreateWishlistModal } from '$lib/components/blocks/wishlist/index.js';
	import { ImportWizard, WIZARD_MODE } from '$lib/components/blocks/import/index.js';
	import { NotificationBell } from '$lib/components/blocks/notification/index.js';
	import LogoMark from './LogoMark.svelte';
	import NavDropdown from './NavDropdown.svelte';
	import type { NavDropdownItem } from './navbar_types.js';
	import { isNavActive } from './navbar_utils.js';
	import UserMenu from './UserMenu.svelte';
	import MobileNav from './MobileNav.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		getMyWishlists,
		getModeratedWishlists,
		getFollowedWishlists,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import { HOME_OVERVIEW_DEPENDENCY } from '$lib/modules/wishlists/home_overview_types.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import { eventCountdown } from '$lib/modules/wishlists/event_countdown.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import {
		followedListState,
		FOLLOWED_LIST_STATE,
		type ModeratedWishlist,
		type FollowedWishlist,
		type MyWishlist,
	} from '$lib/modules/wishlists/dashboard_types.js';

	interface NavbarProps {
		user?: { name: string; email: string; image?: string | null } | null;
		userName?: string;
		userEmail?: string;
		userInitials?: string;
		userImage?: string | null;
	}

	let {
		user = null,
		userName = m.nav_default_user(),
		userEmail = '',
		userInitials = 'U',
		userImage = null,
	}: NavbarProps = $props();

	const MAX_DROPDOWN_ITEMS = 5;
	const dropdownFooterStatClass =
		'inline-flex items-center gap-1.5 text-sm text-muted-foreground';

	const STATUS_BADGE: Record<
		Wishlist['status'],
		{ label: string; variant: NavDropdownItem['badgeVariant'] }
	> = {
		draft: { label: m.dashboard_status_draft(), variant: 'draft' },
		active: { label: m.dashboard_status_shared(), variant: 'shared' },
		archived: { label: m.dashboard_status_archived(), variant: 'draft' },
	};

	let shouldLoadNavDropdownData = $state(false);

	// Stale-while-revalidate (issue #108): mutations no longer refresh the dashboard
	// list queries, so each dropdown re-fetches its own data when hovered/focused
	// again — throttled so ordinary nav mouse traffic doesn't spam requests. The
	// previous items stay visible while the refresh is in flight.
	const NAV_DROPDOWN_REFRESH_THROTTLE_MS = 30_000;
	const navDropdownQueries = [
		getMyWishlists,
		getModeratedWishlists,
		getFollowedWishlists,
	] as const;
	const navDropdownLastRefreshAt = [0, 0, 0];

	function requestNavDropdownData() {
		if (user !== null && !shouldLoadNavDropdownData) {
			shouldLoadNavDropdownData = true;
			// The queries fetch fresh right now — start their throttle windows so the
			// per-item hover handler doesn't immediately duplicate the initial load.
			navDropdownLastRefreshAt.fill(Date.now());
		}
	}

	function refreshNavDropdown(index: number) {
		if (!canLoadNavDropdownData) {
			return;
		}
		const now = Date.now();
		if (now - navDropdownLastRefreshAt[index]! < NAV_DROPDOWN_REFRESH_THROTTLE_MS) {
			return;
		}
		navDropdownLastRefreshAt[index] = now;
		void navDropdownQueries[index]!().refresh();
	}

	const canLoadNavDropdownData = $derived(user !== null && shouldLoadNavDropdownData);

	const myListsQuery = $derived(canLoadNavDropdownData ? getMyWishlists() : null);
	const myListsFiltered = $derived(
		(myListsQuery?.current ?? []).filter((w) => w.status !== 'archived'),
	);
	const myListsItems = $derived<NavDropdownItem[]>(
		myListsFiltered.slice(-MAX_DROPDOWN_ITEMS).reverse().map(wishlistToDropdownItem),
	);

	const moderatedQuery = $derived(canLoadNavDropdownData ? getModeratedWishlists() : null);
	const moderatedFiltered = $derived(
		(moderatedQuery?.current ?? []).filter((w) => w.status !== 'archived'),
	);
	const moderatedItems = $derived<NavDropdownItem[]>(
		moderatedFiltered.slice(-MAX_DROPDOWN_ITEMS).reverse().map(moderatedToDropdownItem),
	);

	const followedQuery = $derived(canLoadNavDropdownData ? getFollowedWishlists() : null);
	const followedFiltered = $derived(
		(followedQuery?.current ?? []).filter(
			(w) => w.unfollowedAt === null && w.status !== 'archived',
		),
	);
	// Recency-desc first (query returns updatedAt asc), then a stable sort surfaces action-needed
	// lists; slice last so open lists claim the limited slots before resolved ones.
	const followedItems = $derived<NavDropdownItem[]>(
		[...followedFiltered]
			.reverse()
			.sort(
				(a, b) =>
					FOLLOWED_STATE_RANK[followedListState(a)] -
					FOLLOWED_STATE_RANK[followedListState(b)],
			)
			.slice(0, MAX_DROPDOWN_ITEMS)
			.map(followedToDropdownItem),
	);

	// Custom cover image (cropped for the 1:1 thumbnail slot), falling back to the theme
	// emoji when no image is assigned. Shared by all three dropdown mappers.
	function thumbImage(
		wishlistRecord: Wishlist,
	): Pick<NavDropdownItem, 'imageUrl' | 'imageFrame'> {
		return {
			imageUrl: wishlistImageUrl(wishlistRecord.imageKey),
			imageFrame: wishlistSlotToFrameProps(wishlistRecord.imageSlots, 'thumbnail'),
		};
	}

	/** Czech-pluralized gift count for owner list cards. */
	function giftCountLabel(count: number): string {
		const category = czechPluralCategory(count);
		return category === 'one'
			? m.nav_gift_count_one()
			: category === 'few'
				? m.nav_gift_count_few({ count })
				: m.nav_gift_count_other({ count });
	}

	/** Czech-pluralized count of gifts still available to claim. */
	function availableCountLabel(count: number): string {
		const category = czechPluralCategory(count);
		return category === 'one'
			? m.nav_available_count_one()
			: category === 'few'
				? m.nav_available_count_few({ count })
				: m.nav_available_count_other({ count });
	}

	function wishlistToDropdownItem(wishlistRecord: MyWishlist): NavDropdownItem {
		const badge = STATUS_BADGE[wishlistRecord.status];
		// Owner invariant: gift count + event countdown only – never reservation data.
		return {
			name: wishlistRecord.title,
			meta: giftCountLabel(wishlistRecord.totalGifts),
			countdown: eventCountdown(wishlistRecord.eventDate) ?? undefined,
			href: localizeInternalHref(resolve('/(app)/w/[id]', { id: wishlistRecord.shortId })),
			emoji: getWishlistEmoji(wishlistRecord.theme),
			...thumbImage(wishlistRecord),
			badgeLabel: badge.label,
			badgeVariant: badge.variant,
		};
	}

	function moderatedToDropdownItem(wishlistRecord: ModeratedWishlist): NavDropdownItem {
		return {
			name: wishlistRecord.title,
			meta: m.wishlist_recipient_chip({ name: wishlistRecord.recipientDisplayName }),
			countdown: eventCountdown(wishlistRecord.eventDate) ?? undefined,
			href: localizeInternalHref(resolve('/(app)/w/[id]', { id: wishlistRecord.shortId })),
			emoji: getWishlistEmoji(wishlistRecord.theme),
			...thumbImage(wishlistRecord),
			badgeLabel: `${wishlistRecord.reservedGifts}/${wishlistRecord.totalGifts}`,
			badgeVariant: 'draft',
		};
	}

	function followedToDropdownItem(wishlistRecord: FollowedWishlist): NavDropdownItem {
		const state = followedListState(wishlistRecord);
		return {
			name: wishlistRecord.title,
			meta: m.wishlist_recipient_chip({ name: wishlistRecord.recipientDisplayName }),
			countdown: eventCountdown(wishlistRecord.eventDate) ?? undefined,
			href: localizeInternalHref(resolve('/(app)/w/[id]', { id: wishlistRecord.shortId })),
			emoji: getWishlistEmoji(wishlistRecord.theme),
			...thumbImage(wishlistRecord),
			...followedBadge(wishlistRecord, state),
			resolution: state === FOLLOWED_LIST_STATE.open ? undefined : state,
		};
	}

	/** Badge reflects the gifter's progress: available to claim → reserved count → done. */
	function followedBadge(
		wishlistRecord: FollowedWishlist,
		state: ReturnType<typeof followedListState>,
	): Pick<NavDropdownItem, 'badgeLabel' | 'badgeVariant'> {
		if (state === FOLLOWED_LIST_STATE.bought) {
			return { badgeLabel: m.nav_done_badge(), badgeVariant: 'draft' };
		}
		if (state === FOLLOWED_LIST_STATE.reserved) {
			return {
				badgeLabel: m.nav_reserved_badge({ count: wishlistRecord.myReservations }),
				badgeVariant: 'draft',
			};
		}
		return {
			badgeLabel:
				wishlistRecord.availableGifts > 0
					? availableCountLabel(wishlistRecord.availableGifts)
					: undefined,
			badgeVariant: 'shared',
		};
	}

	/** Action-needed first (open → reserved → bought); recency within each group. */
	const FOLLOWED_STATE_RANK: Record<ReturnType<typeof followedListState>, number> = {
		[FOLLOWED_LIST_STATE.open]: 0,
		[FOLLOWED_LIST_STATE.reserved]: 1,
		[FOLLOWED_LIST_STATE.bought]: 2,
	};

	const NAV_LINKS = [
		{ label: m.nav_my_lists(), href: localizeInternalHref(resolve('/(app)/my-lists')) },
		{ label: m.nav_moderated(), href: localizeInternalHref(resolve('/(app)/moderated')) },
		{ label: m.nav_followed(), href: localizeInternalHref(resolve('/(app)/followed')) },
	] as const;

	// Mobile menu leads with „Přehled" (the overview hub); desktop keeps the three
	// category links, since the logo already covers the overview there.
	const MOBILE_NAV_LINKS = [
		{ label: m.home_title(), href: localizeInternalHref(resolve('/(app)/home')) },
		...NAV_LINKS,
	] as const;

	const navDropdownItems = $derived<NavDropdownItem[][]>([
		myListsItems,
		moderatedItems,
		followedItems,
	]);

	const navDropdownTotalCounts = $derived([
		myListsFiltered.length,
		moderatedFiltered.length,
		followedFiltered.length,
	]);

	const moderatedStats = $derived({
		reserved: moderatedFiltered.reduce((sum, w) => sum + w.reservedGifts, 0),
		total: moderatedFiltered.reduce((sum, w) => sum + w.totalGifts, 0),
	});

	// How many followed lists still need a gift (gifter hasn't reserved anything yet). Drives the
	// footer nudge – counts only "open" lists, so users who never mark "bought" are never nagged.
	const followedOpenCount = $derived(
		followedFiltered.filter((w) => followedListState(w) === FOLLOWED_LIST_STATE.open).length,
	);

	let isCreateModalOpen = $state(false);
	let isImportWizardOpen = $state(false);

	// A single shared "which nav dropdown is open" index guarantees at most one of the three
	// hover dropdowns is visible: opening one closes any sibling before its own grace-period
	// close can fire.
	let openNavDropdownIndex = $state<number | null>(null);

	function setNavDropdownOpen(index: number, isOpen: boolean) {
		if (isOpen) {
			openNavDropdownIndex = index;
		} else if (openNavDropdownIndex === index) {
			openNavDropdownIndex = null;
		}
	}
</script>

<header class="topbar">
	<!-- Mobile hamburger -->
	{#if user}
		<MobileNav navLinks={MOBILE_NAV_LINKS} oncreate={() => (isCreateModalOpen = true)} />
	{/if}

	<!-- Logo -->
	<LogoMark />

	<!-- Desktop nav links with dropdowns -->
	{#if user}
		<nav
			class="nav-links"
			aria-label={m.nav_main_label()}
			onpointerenter={requestNavDropdownData}
			onfocusin={requestNavDropdownData}
		>
			{#each NAV_LINKS as link, i (link.href)}
				<!-- svelte-ignore a11y_no_static_element_interactions (hover/focus refresh is a
				     non-essential data prefetch; the link + dropdown inside stay fully accessible) -->
				<div
					class="contents"
					onpointerenter={() => refreshNavDropdown(i)}
					onfocusin={() => refreshNavDropdown(i)}
				>
					<NavDropdown
						title={link.label}
						viewAllHref={link.href}
						active={isNavActive(link.href)}
						items={navDropdownItems[i]}
						totalCount={navDropdownTotalCounts[i]}
						grouped={i === 2}
						bind:open={
							() => openNavDropdownIndex === i,
							(isOpen) => setNavDropdownOpen(i, isOpen)
						}
					>
						{#snippet footer()}
							{#if i === 0}
								<button
									class="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-primary hover:underline"
									onclick={() => (isCreateModalOpen = true)}
								>
									<PlusIcon class="size-3.5" />
									{m.nav_footer_new_list()}
								</button>
							{:else if i === 1}
								<span class={dropdownFooterStatClass}>
									<GiftIcon class="size-3.5" />
									{m.nav_footer_reserved_stats({
										reserved: moderatedStats.reserved,
										total: moderatedStats.total,
									})}
								</span>
							{:else}
								<span class={dropdownFooterStatClass}>
									<GiftIcon class="size-3.5" />
									{followedOpenCount > 0
										? m.nav_footer_lists_need_gift({ count: followedOpenCount })
										: m.nav_footer_all_sorted()}
								</span>
							{/if}
						{/snippet}
					</NavDropdown>
				</div>
			{/each}
		</nav>
	{/if}

	<!-- Right controls -->
	<div class="nav-right">
		{#if user}
			<!-- Create CTA -->
			<Button
				intent="primary"
				size="md"
				class="hidden min-[1040px]:inline-flex"
				onclick={() => (isCreateModalOpen = true)}
			>
				<PlusIcon data-icon="inline-start" />
				{m.nav_create()}
			</Button>
			<Button
				intent="primary"
				size="icon"
				class="min-[1040px]:hidden"
				aria-label={m.nav_create()}
				onclick={() => (isCreateModalOpen = true)}
			>
				<PlusIcon />
			</Button>
		{/if}

		<!-- Appearance controls. ≥1040px: three separate buttons (full desktop fits).
		     768–1039px: consolidated into one AppearanceMenu button so the header does not
		     overflow. Logged-in users below 768px get these inside the MobileNav drawer;
		     anonymous users have no drawer, so they keep the consolidated menu below 1040px. -->
		<div class="hidden items-center gap-1 min-[1040px]:flex">
			<PaletteSwitcher />
			<LanguageToggle variant="icon" />
			<DarkModeToggle />
		</div>
		{#if user}
			<!-- One compound range variant, not `md:block` + `min-[1040px]:hidden` as two
			     separate rules: Tailwind emits the arbitrary min-[1040px] media block before
			     the named md block regardless of pixel value, so md:block would win the
			     cascade at >=1040px and this control would stay stuck on-screen. A single
			     min-width+max-width range has no competing rule to lose to. Uses
			     max-[1040px] (not 1039) because Tailwind compiles arbitrary max-[Npx] to
			     `width < Npx` (exclusive), so 1040 is the value that still includes 1039px. -->
			<div class="hidden md:max-[1040px]:block">
				<AppearanceMenu />
			</div>
		{:else}
			<div class="min-[1040px]:hidden">
				<AppearanceMenu />
			</div>
		{/if}

		{#if user}
			<!-- Personal cluster: notifications + account sit together at the far right,
			     apart from the square appearance buttons. The bell stays ghost so its
			     badge never collides with a border. -->
			<NotificationBell />
			<UserMenu {userName} {userEmail} {userInitials} {userImage} />
		{:else}
			<Button intent="primary" size="md" href={localizeInternalHref(resolve('/login'))}
				>{m.nav_login()}</Button
			>
		{/if}
	</div>
</header>

{#if user}
	<CreateWishlistModal
		bind:open={isCreateModalOpen}
		onimport={() => (isImportWizardOpen = true)}
	/>
	<ImportWizard
		bind:open={isImportWizardOpen}
		mode={WIZARD_MODE.newList}
		onsuccess={() => void invalidate(HOME_OVERVIEW_DEPENDENCY)}
	/>
{/if}

<style>
	/* Mockup topbar treatment: solid panel + ink rule (no translucency). */
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		height: var(--nav-height);
		background: var(--card);
		border-bottom: var(--border-w) solid var(--ink);
		display: flex;
		align-items: center;
		padding: 0 var(--space-6);
		gap: var(--space-4);
		flex-shrink: 0;
	}

	/* Desktop nav links */
	.nav-links {
		display: none;
		align-items: center;
		gap: 2px;
		flex: 1;
	}

	@media (width >= 768px) {
		.nav-links {
			display: flex;
		}
	}

	/* Right side controls */
	.nav-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
