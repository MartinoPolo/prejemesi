<script lang="ts">
	import Navbar from '$lib/components/blocks/navbar/Navbar.svelte';
	import DemoNotice from '$lib/components/blocks/demo/DemoNotice.svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import { setAssistantDockContext } from '$lib/modules/chat/assistant_dock.context.svelte.js';
	import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
	import * as m from '$lib/paraglide/messages.js';
	import { preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		authenticatedIdlePreloadRoutes,
		shouldIdlePreloadAuthenticatedRoutes,
		type NetworkConnectionInfo,
	} from './idle_preload_eligibility.js';

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
		if (typeof window.requestIdleCallback === 'function') {
			const idleHandle = window.requestIdleCallback(preloadPrimaryRouteCode, {
				timeout: IDLE_PRELOAD_TIMEOUT_MS,
			});
			return () => window.cancelIdleCallback(idleHandle);
		}
		// Safari has no requestIdleCallback — fall back to a bounded timer.
		const timeoutHandle = setTimeout(preloadPrimaryRouteCode, IDLE_PRELOAD_TIMEOUT_MS);
		return () => clearTimeout(timeoutHandle);
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
			<main class="app-content" inert={assistantDock.modal.current}>
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

	.app-content {
		flex: 1;
		min-width: 0;
		overflow: hidden auto;
	}

	.app-content-inner {
		max-width: var(--content-max-width);
		margin-inline: auto;
		padding-inline: var(--page-gutter);
		padding-block: var(--space-6);
	}

	@media (width < 640px) {
		.app-content-inner.wishlist-detail-content {
			padding-block: 0;
		}
	}
</style>
