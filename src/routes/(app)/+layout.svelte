<script lang="ts">
	import Navbar from '$lib/components/blocks/navbar/Navbar.svelte';
	import DemoNotice from '$lib/components/blocks/demo/DemoNotice.svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import { setAssistantDockContext } from '$lib/modules/chat/assistant_dock.context.svelte.js';
	import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
	import { scheduleIdle } from '$lib/utils/schedule_idle.js';
	import * as m from '$lib/paraglide/messages.js';
	import { preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		authenticatedIdlePreloadRoutes,
		shouldIdlePreloadAuthenticatedRoutes,
		type NetworkConnectionInfo,
	} from './idle_preload_eligibility.js';
	import { createContentScrollRestoration } from './content_scroll_restoration.svelte.js';

	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';

	interface AppLayoutProps {
		data: LayoutData;
		children: Snippet;
	}

	const IDLE_PRELOAD_TIMEOUT_MS = 3_000;

	let { data, children }: AppLayoutProps = $props();
	let demoExpired = $state(false);

	const user: typeof data.user | null = $derived(
		typeof data.user === 'object' ? data.user : null,
	);
	const isWishlistDetailRoute = $derived(page.route.id === '/(app)/w/[id]');
	const userInitials = $derived.by(() => {
		if (user !== null && typeof user.name === 'string' && user.name.length > 0) {
			return user.name
				.split(' ')
				.map((part: string) => part[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
		}
		return 'U';
	});

	// svelte-ignore state_referenced_locally (intentional initial seed; the count is owned/updated by the notifications context thereafter)
	setNotificationsContext(data.unreadNotificationCount);
	const assistantDock = setAssistantDockContext();

	let contentScroller = $state<HTMLElement | null>(null);
	export const snapshot = createContentScrollRestoration(() => contentScroller);

	onMount(() => {
		const connection = (navigator as Navigator & { connection?: NetworkConnectionInfo })
			.connection;
		if (!shouldIdlePreloadAuthenticatedRoutes(user !== null, connection)) {
			return;
		}
		const preloadPrimaryRouteCode = () => {
			void Promise.allSettled(
				authenticatedIdlePreloadRoutes(page.url.pathname).map((route) =>
					preloadCode(route),
				),
			);
		};
		return scheduleIdle(preloadPrimaryRouteCode, IDLE_PRELOAD_TIMEOUT_MS);
	});
</script>

<div class="app-shell">
	{#if !demoExpired}
		<div class="navbar-slot" inert={assistantDock.modal.current}>
			<Navbar
				{user}
				userName={user?.name ?? m.nav_default_user()}
				userEmail={user?.email ?? ''}
				demo={data.demoExpiresAt !== null}
				{userInitials}
				userImage={resolveUserImageUrl(user?.image)}
			/>
		</div>
	{/if}
	{#if data.demoExpiresAt}<DemoNotice
			expiresAt={data.demoExpiresAt}
			onexpired={() => (demoExpired = true)}
		/>{/if}
	{#if !demoExpired}<div class="app-body">
			<main
				bind:this={contentScroller}
				class="app-content"
				inert={assistantDock.modal.current}
			>
				<div
					class="app-content-inner"
					class:wishlist-detail-content={isWishlistDetailRoute}
				>
					{@render children()}
				</div>
			</main>
			{@render assistantDock.panel.current?.()}
		</div>{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	.navbar-slot {
		display: contents;
	}

	/* A docked assistant panel sits beside the content and narrows it. */
	.app-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	/* The scroller is the containing block for absolutely positioned content (sr-only labels),
	   which otherwise resolves against the body and gives the document a second scrollbar. */
	.app-content {
		position: relative;
		flex: 1;
		min-width: 0;
		overflow: hidden auto;
	}

	/* The reserved gutter keeps the content column still when filtering shows or hides a classic
	   scrollbar; the navbar reserves the same one to keep its edges on the column. Below `lg` the
	   layouts are sized for the full width: the md navbar row has no spare pixel for the gutter,
	   and phone card columns and carousel cards would shrink in a narrow desktop window, while
	   phones themselves overlay their scrollbars. */
	@media (width >= 1024px) {
		.app-content {
			scrollbar-gutter: stable;
		}
	}

	.app-content-inner {
		max-width: var(--content-max-width);
		margin-inline: auto;
		padding-inline: var(--page-gutter);
		padding-block: var(--space-6);
	}

	/* Wishlist theme backdrops (#535) position against the content column and fill at least
	   the visible scroller, so short lists never end in a plain strip. */
	.app-content-inner.wishlist-detail-content {
		position: relative;
		min-height: 100%;
	}

	@media (width < 640px) {
		.app-content-inner.wishlist-detail-content {
			padding-block: 0;
		}
	}
</style>
