<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import LogoMark from './LogoMark.svelte';
	import NavDropdown from './NavDropdown.svelte';
	import UserMenu from './UserMenu.svelte';
	import MobileNav from './MobileNav.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { cn } from '$lib/utils.js';

	interface NavbarProps {
		userName?: string;
		userEmail?: string;
		userInitials?: string;
		userImage?: string | null;
		notificationCount?: number;
	}

	let {
		userName = 'Uzivatel',
		userEmail = '',
		userInitials = 'U',
		userImage = null,
		notificationCount = 0,
	}: NavbarProps = $props();

	const NAV_LINKS = [
		{ label: 'Moje seznamy', href: resolve('/(app)/my-lists') },
		{ label: 'Spravovane', href: resolve('/(app)/moderated') },
		{ label: 'Sledovane', href: resolve('/(app)/followed') },
	] as const;

	/** Placeholder recent items for nav dropdowns */
	const PLACEHOLDER_ITEMS = [
		{
			name: 'Vanoce 2026',
			meta: '8 prani',
			href: resolve('/(app)/w/[id]', { id: 'placeholder-1' }),
			emoji: '🎄',
			badgeLabel: 'Sdileno',
			badgeVariant: 'shared' as const,
		},
		{
			name: 'Narozeniny',
			meta: '5 prani',
			href: resolve('/(app)/w/[id]', { id: 'placeholder-2' }),
			emoji: '🎂',
			badgeLabel: 'Koncept',
			badgeVariant: 'draft' as const,
		},
	];

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
	<nav class="nav-links" aria-label="Hlavni navigace">
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
				<NavDropdown title={link.label} viewAllHref={link.href} items={PLACEHOLDER_ITEMS} />
			</div>
		{/each}
	</nav>

	<!-- Right controls -->
	<div class="nav-right">
		<!-- Create CTA -->
		<Button variant="default" size="sm" class="hidden md:inline-flex">
			<PlusIcon data-icon="inline-start" />
			Vytvorit
		</Button>

		<!-- Notification bell -->
		<Button variant="ghost" size="icon" aria-label="Oznameni ({notificationCount} neprectene)">
			<BellIcon />
			{#if notificationCount > 0}
				<span class="notif-badge" aria-hidden="true">{notificationCount}</span>
			{/if}
		</Button>

		<!-- Dark mode toggle -->
		<DarkModeToggle />

		<!-- User menu -->
		<UserMenu {userName} {userEmail} {userInitials} {userImage} />
	</div>
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		height: var(--nav-height);
		background: oklch(from var(--background) l c h / 0.92);
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

	@media (min-width: 768px) {
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
		background: oklch(from var(--primary) l c h / 0.08);
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

	/* Notification badge */
	.notif-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 16px;
		height: 16px;
		padding: 0 3px;
		background: var(--destructive);
		color: white;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: var(--weight-bold);
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		border: 2px solid var(--background);
		pointer-events: none;
	}
</style>
