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

	const user = $derived(data.user);
	const userInitials = $derived(
		user?.name
			? user.name
					.split(' ')
					.map((part: string) => part[0])
					.join('')
					.toUpperCase()
					.slice(0, 2)
			: 'U',
	);

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
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	.app-content {
		flex: 1;
		width: 100%;
		max-width: var(--content-max-width);
		margin-inline: auto;
		padding-inline: var(--space-6);
		padding-block: var(--space-6);
	}
</style>
