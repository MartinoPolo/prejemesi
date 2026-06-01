<script lang="ts">
	import Navbar from '$lib/components/blocks/navbar/Navbar.svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';

	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';

	interface AppLayoutProps {
		data: LayoutData;
		children: Snippet;
	}

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

	setNotificationsContext();
</script>

<div class="app-shell">
	<Navbar
		{user}
		userName={user?.name ?? 'Uzivatel'}
		userEmail={user?.email ?? ''}
		{userInitials}
		userImage={user?.image}
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
