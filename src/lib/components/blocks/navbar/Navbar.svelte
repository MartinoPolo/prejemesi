<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import { CreateWishlistModal } from '$lib/components/blocks/wishlist/index.js';
	import { NotificationBell } from '$lib/components/blocks/notification/index.js';
	import LogoMark from './LogoMark.svelte';
	import NavDropdown, { type NavDropdownItem } from './NavDropdown.svelte';
	import UserMenu from './UserMenu.svelte';
	import MobileNav from './MobileNav.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		getMyWishlists,
		getModeratedWishlists,
		getFollowedWishlists,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getThemePreset, type WishlistTheme } from '$lib/modules/wishlists/wishlist_theme.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import type {
		ModeratedWishlist,
		FollowedWishlist,
	} from '$lib/modules/wishlists/dashboard_types.js';

	interface NavbarProps {
		userName?: string;
		userEmail?: string;
		userInitials?: string;
		userImage?: string | null;
	}

	let {
		userName = m.nav_default_user(),
		userEmail = '',
		userInitials = 'U',
		userImage = null,
	}: NavbarProps = $props();

	const MAX_DROPDOWN_ITEMS = 3;

	const STATUS_BADGE: Record<
		Wishlist['status'],
		{ label: string; variant: NavDropdownItem['badgeVariant'] }
	> = {
		draft: { label: m.dashboard_status_draft(), variant: 'draft' },
		active: { label: m.dashboard_status_shared(), variant: 'shared' },
		archived: { label: m.dashboard_status_archived(), variant: 'draft' },
	};

	let myListsItems = $state<NavDropdownItem[]>([]);
	let moderatedItems = $state<NavDropdownItem[]>([]);
	let followedItems = $state<NavDropdownItem[]>([]);

	function wishlistToDropdownItem(wishlistRecord: Wishlist): NavDropdownItem {
		const theme = getThemePreset(wishlistRecord.theme as WishlistTheme);
		const badge = STATUS_BADGE[wishlistRecord.status];
		return {
			name: wishlistRecord.title,
			meta: theme.label,
			href: resolve('/(app)/w/[id]', { id: wishlistRecord.shortId }),
			emoji: theme.emoji,
			badgeLabel: badge.label,
			badgeVariant: badge.variant,
		};
	}

	function moderatedToDropdownItem(wishlistRecord: ModeratedWishlist): NavDropdownItem {
		const theme = getThemePreset(wishlistRecord.theme as WishlistTheme);
		return {
			name: wishlistRecord.title,
			meta: wishlistRecord.ownerName,
			href: resolve('/(app)/w/[id]', { id: wishlistRecord.shortId }),
			emoji: theme.emoji,
			badgeLabel: `${wishlistRecord.reservedGifts}/${wishlistRecord.totalGifts}`,
			badgeVariant: 'draft',
		};
	}

	function followedToDropdownItem(wishlistRecord: FollowedWishlist): NavDropdownItem {
		const theme = getThemePreset(wishlistRecord.theme as WishlistTheme);
		return {
			name: wishlistRecord.title,
			meta: wishlistRecord.ownerName,
			href: resolve('/(app)/w/[id]', { id: wishlistRecord.shortId }),
			emoji: theme.emoji,
			badgeLabel:
				wishlistRecord.availableGifts > 0
					? m.nav_available_count({ count: wishlistRecord.availableGifts })
					: undefined,
			badgeVariant: 'shared',
		};
	}

	onMount(async () => {
		const [myLists, moderated, followed] = await Promise.allSettled([
			getMyWishlists(),
			getModeratedWishlists(),
			getFollowedWishlists(),
		]);

		if (myLists.status === 'fulfilled') {
			myListsItems = myLists.value
				.filter((w) => w.status !== 'archived')
				.slice(-MAX_DROPDOWN_ITEMS)
				.reverse()
				.map(wishlistToDropdownItem);
		}
		if (moderated.status === 'fulfilled') {
			moderatedItems = moderated.value
				.slice(-MAX_DROPDOWN_ITEMS)
				.reverse()
				.map(moderatedToDropdownItem);
		}
		if (followed.status === 'fulfilled') {
			followedItems = followed.value
				.filter((w) => w.unfollowedAt === null)
				.slice(-MAX_DROPDOWN_ITEMS)
				.reverse()
				.map(followedToDropdownItem);
		}
	});

	const NAV_LINKS = [
		{ label: m.nav_my_lists(), href: resolve('/(app)/my-lists') },
		{ label: m.nav_moderated(), href: resolve('/(app)/moderated') },
		{ label: m.nav_followed(), href: resolve('/(app)/followed') },
	] as const;

	const navDropdownItems = $derived<NavDropdownItem[][]>([
		myListsItems,
		moderatedItems,
		followedItems,
	]);

	let isCreateModalOpen = $state(false);

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}
</script>

<header class="topbar">
	<!-- Mobile hamburger -->
	<MobileNav navLinks={NAV_LINKS.map((l) => ({ label: l.label, href: l.href }))} />

	<!-- Logo -->
	<LogoMark />

	<!-- Desktop nav links with dropdowns -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<nav class="nav-links" aria-label={m.nav_main_label()}>
		{#each NAV_LINKS as link (link.href)}
			<div class="nav-item">
				<a
					class={cn('nav-link', isActive(link.href) && 'is-active')}
					href={link.href}
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
					<ChevronDown class="nav-chevron" />
				</a>
				<NavDropdown
					title={link.label}
					viewAllHref={link.href}
					items={navDropdownItems[NAV_LINKS.indexOf(link)]}
				/>
			</div>
		{/each}
	</nav>

	<!-- Right controls -->
	<div class="nav-right">
		<!-- Create CTA -->
		<Button
			intent="primary"
			size="sm"
			class="hidden md:inline-flex"
			onclick={() => (isCreateModalOpen = true)}
		>
			<PlusIcon data-icon="inline-start" />
			{m.nav_create()}
		</Button>

		<!-- Notification bell -->
		<NotificationBell />

		<!-- Dark mode toggle -->
		<DarkModeToggle />

		<!-- User menu -->
		<UserMenu {userName} {userEmail} {userInitials} {userImage} />
	</div>
</header>

<CreateWishlistModal bind:open={isCreateModalOpen} />

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		height: var(--nav-height);
		background: oklch(from var(--background) l c h / 92%);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
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

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 36px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--muted-foreground);
		text-decoration: none;
		border: none;
		background: transparent;
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--duration-normal) var(--ease-standard),
			color var(--duration-normal) var(--ease-standard);
		white-space: nowrap;
		position: relative;
	}

	.nav-link:hover {
		background: var(--accent);
		color: var(--foreground);
	}

	.nav-link.is-active {
		color: var(--primary);
		font-weight: var(--weight-semibold);
	}

	/* Active underline indicator */
	.nav-link.is-active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: var(--space-3);
		right: var(--space-3);
		height: 2px;
		background: var(--primary);
		border-radius: 9999px;
	}

	.nav-link.is-active:hover {
		background: oklch(from var(--primary) l c h / 8%);
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

	/* Right side controls */
	.nav-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
