<script lang="ts">
	import { setNotificationsContext } from '$lib/modules/notifications/notifications.context.svelte.js';
	import NotificationPanel from './NotificationPanel.svelte';

	interface NotificationPanelTestHostProps {
		open?: boolean;
		reload?: number;
	}

	let { open = true, reload = 0 }: NotificationPanelTestHostProps = $props();
	const ctx = setNotificationsContext();
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

<div hidden={!open}>
	<NotificationPanel />
</div>
