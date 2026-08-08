<script lang="ts">
	import Navbar from '$lib/components/blocks/navbar/Navbar.svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
	import * as m from '$lib/paraglide/messages.js';
	import { preloadCode } from '$app/navigation';
	import { onMount } from 'svelte';

	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';

	interface AppLayoutProps {
		data: LayoutData;
		children: Snippet;
	}

	// Primary nav targets warmed during idle time so the first in-app navigation is
	// instant. Only runs for authenticated users — anonymous visitors on public
	// wishlist pages rely on hover/tap intent preloading (data-sveltekit-preload-data
	// on <body>) instead. See docs/performance-budget.md.
	const AUTHENTICATED_PRIMARY_ROUTES = [
		'/home',
		'/my-lists',
		'/moderated',
		'/followed',
		'/settings',
	];
	const IDLE_PRELOAD_TIMEOUT_MS = 3_000;

	let { data, children }: AppLayoutProps = $props();

	const user: typeof data.user | null = $derived(
		typeof data.user === 'object' ? data.user : null,
	);
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

	onMount(() => {
		if (user === null) {
			return;
		}
		const preloadPrimaryRouteCode = () => {
			void Promise.allSettled(
				AUTHENTICATED_PRIMARY_ROUTES.map((route) => preloadCode(route)),
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
	<Navbar
		{user}
		userName={user?.name ?? m.nav_default_user()}
		userEmail={user?.email ?? ''}
		{userInitials}
		userImage={resolveUserImageUrl(user?.image)}
	/>
	<main class="app-content">
		<div class="app-content-inner">
			{@render children()}
		</div>
	</main>
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

	.app-content {
		flex: 1;
		overflow: hidden auto;
	}

	.app-content-inner {
		max-width: var(--content-max-width);
		margin-inline: auto;
		padding-inline: var(--space-6);
		padding-block: var(--space-6);
	}
</style>
