<script lang="ts">
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
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { cn } from '$lib/utils.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		getMyWishlists,
		getModeratedWishlists,
		getFollowedWishlists,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
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

	const STATUS_BADGE: Record<
		Wishlist['status'],
		{ label: string; variant: NavDropdownItem['badgeVariant'] }
	> = {
		draft: { label: m.dashboard_status_draft(), variant: 'draft' },
		active: { label: m.dashboard_status_shared(), variant: 'shared' },
		archived: { label: m.dashboard_status_archived(), variant: 'draft' },
	};

	let shouldLoadNavDropdownData = $state(false);

	function requestNavDropdownData() {
		if (user !== null) {
			shouldLoadNavDropdownData = true;
		}
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
</script>

<header class="topbar">
	<!-- Mobile hamburger -->
	{#if user}
		<MobileNav navLinks={NAV_LINKS} oncreate={() => (isCreateModalOpen = true)} />
	{/if}

	<!-- Logo -->
	<LogoMark />

	<!-- Desktop nav links with dropdowns -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if user}
		<nav
			class="nav-links"
			aria-label={m.nav_main_label()}
			onpointerenter={requestNavDropdownData}
			onfocusin={requestNavDropdownData}
		>
			{#each NAV_LINKS as link, i (link.href)}
				<div class="nav-item">
					<a
						class={cn('nav-link', isNavActive(link.href) && 'is-active')}
						href={link.href}
						aria-current={isNavActive(link.href) ? 'page' : undefined}
					>
						{link.label}
						<ChevronDownIcon class="nav-chevron" />
					</a>
					<NavDropdown
						title={link.label}
						viewAllHref={link.href}
						items={navDropdownItems[i]}
						totalCount={navDropdownTotalCounts[i]}
						grouped={i === 2}
					>
						{#snippet footer()}
							{#if i === 0}
								<button
									class="nav-dropdown-create"
									onclick={() => (isCreateModalOpen = true)}
								>
									<PlusIcon class="size-3.5" />
									{m.nav_footer_new_list()}
								</button>
							{:else if i === 1}
								<span class="nav-dropdown-stats">
									<GiftIcon class="size-3.5" />
									{m.nav_footer_reserved_stats({
										reserved: moderatedStats.reserved,
										total: moderatedStats.total,
									})}
								</span>
							{:else}
								<span class="nav-dropdown-stats">
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
			<!-- Import CTA -->
			<Button
				intent="outline"
				size="md"
				class="hidden md:inline-flex"
				onclick={() => (isImportWizardOpen = true)}
			>
				<FileUpIcon data-icon="inline-start" />
				{m.import_wizard_title()}
			</Button>
			<Button
				intent="outline"
				size="icon"
				class="md:hidden"
				aria-label={m.import_wizard_title()}
				onclick={() => (isImportWizardOpen = true)}
			>
				<FileUpIcon />
			</Button>

			<!-- Create CTA -->
			<Button
				intent="primary"
				size="md"
				class="hidden md:inline-flex"
				onclick={() => (isCreateModalOpen = true)}
			>
				<PlusIcon data-icon="inline-start" />
				{m.nav_create()}
			</Button>

			<!-- Notification bell -->
			<NotificationBell />
		{/if}

		<!-- Palette / dark mode / language controls: separate buttons on desktop; below
		     768px they consolidate into the MobileNav drawer (logged-in) or a compact
		     popover (anonymous — no drawer exists for them). -->
		<div class="hidden items-center gap-1 md:flex">
			<PaletteSwitcher />
			<DarkModeToggle />
			<LanguageToggle variant="icon" />
		</div>
		{#if !user}
			<div class="md:hidden">
				<AppearanceMenu />
			</div>
		{/if}

		{#if user}
			<!-- User menu -->
			<UserMenu {userName} {userEmail} {userInitials} {userImage} />
		{:else}
			<Button intent="primary" size="sm" href={localizeInternalHref(resolve('/login'))}
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
	<ImportWizard bind:open={isImportWizardOpen} mode={WIZARD_MODE.newList} />
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

	.nav-item {
		position: relative;
	}

	/* Mockup pill states: hover = subtle surface pill, active = filled pill
	   with an ink border (no underline). */
	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 36px;
		padding: 0 var(--space-3);
		border-radius: 9px;
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		color: var(--muted-foreground);
		text-decoration: none;
		border: 2px solid transparent;
		background: transparent;
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--duration-normal) var(--ease-standard),
			color var(--duration-normal) var(--ease-standard);
		white-space: nowrap;
	}

	.nav-link:hover {
		background: var(--accent);
		color: var(--foreground);
	}

	.nav-link.is-active {
		background: var(--accent);
		color: var(--foreground);
		border-color: var(--ink);
	}

	.nav-item:hover :global(.nav-chevron) {
		transform: rotate(180deg);
	}

	:global(.nav-chevron) {
		opacity: 0.55;
		transition: transform var(--duration-normal) var(--ease-standard);
		flex-shrink: 0;
		width: 14px;
		height: 14px;
	}

	/* Dropdown footer variants */
	.nav-dropdown-create {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--primary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: var(--font-sans);
	}

	.nav-dropdown-create:hover {
		text-decoration: underline;
	}

	.nav-dropdown-stats {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-sm);
		color: var(--muted-foreground);
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
