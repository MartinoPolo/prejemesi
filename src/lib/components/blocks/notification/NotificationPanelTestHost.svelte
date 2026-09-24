<script lang="ts">
	import { untrack } from 'svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import NotificationBell from './NotificationBell.svelte';
	import NotificationPanel from './NotificationPanel.svelte';

	type TestHostMode = 'panel' | 'bell';

	interface NotificationPanelTestHostProps {
		mode?: TestHostMode;
		open?: boolean;
		reload?: number;
		panelWidth?: number;
		initialUnreadCount?: number;
	}

	let {
		mode = 'panel',
		open = true,
		reload = 0,
		panelWidth = 320,
		initialUnreadCount = 0,
	}: NotificationPanelTestHostProps = $props();
	const ctx = setNotificationsContext(untrack(() => initialUnreadCount));
	let previousReload = 0;

	$effect(() => {
		if (mode !== 'panel') {
			return;
		}
		if (open) {
			ctx.open();
		} else {
			ctx.close();
		}
	});

	$effect(() => {
		if (reload > previousReload) {
			previousReload = reload;
			void ctx.loadNotifications();
		}
	});
</script>

{#if mode === 'bell'}
	<NotificationBell />
{:else}
	<div hidden={!open} style:width={`${panelWidth}px`}>
		<NotificationPanel />
	</div>
{/if}
