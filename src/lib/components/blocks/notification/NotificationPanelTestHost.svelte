<script lang="ts">
	import { untrack } from 'svelte';
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import NotificationPanel from './NotificationPanel.svelte';

	interface NotificationPanelTestHostProps {
		open?: boolean;
		reload?: number;
		panelWidth?: number;
		initialUnreadCount?: number;
	}

	let {
		open = true,
		reload = 0,
		panelWidth = 320,
		initialUnreadCount = 0,
	}: NotificationPanelTestHostProps = $props();
	const ctx = setNotificationsContext(untrack(() => initialUnreadCount));
	let previousReload = 0;

	$effect(() => {
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

<div hidden={!open} style:width={`${panelWidth}px`}>
	<NotificationPanel />
</div>
