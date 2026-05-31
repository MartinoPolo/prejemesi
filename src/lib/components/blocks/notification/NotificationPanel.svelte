<script lang="ts">
	import { useNotifications } from '$lib/modules/notifications/notifications.context.svelte.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import NotificationItem from './NotificationItem.svelte';

	const ctx = useNotifications();

	function handleMarkAsRead(notificationId: string) {
		void ctx.markAsRead([notificationId]);
	}

	function handleMarkAllAsRead() {
		void ctx.markAllAsRead();
	}
</script>

<div class="flex w-80 flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between px-3 pb-2">
		<h3 class="text-sm font-semibold">Upozorneni</h3>
		{#if ctx.hasUnread.current}
			<Button intent="ghost" size="sm" onclick={handleMarkAllAsRead}>
				<CheckCheckIcon data-icon="inline-start" />
				Oznacit vse
			</Button>
		{/if}
	</div>

	<Separator />

	<!-- Notification list -->
	<div class="max-h-80 overflow-y-auto">
		{#if ctx.isLoading.current && ctx.notifications.current.length === 0}
			<!-- Loading skeleton -->
			{#each [0, 1, 2] as index (index)}
				<div class="flex items-start gap-3 px-3 py-2.5">
					<Skeleton class="size-8 shrink-0 rounded-full" />
					<div class="flex flex-1 flex-col gap-1.5">
						<Skeleton class="h-3.5 w-3/4" />
						<Skeleton class="h-3 w-1/3" />
					</div>
				</div>
			{/each}
		{:else if ctx.notifications.current.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
				<BellOffIcon class="size-8 opacity-50" />
				<p class="text-sm">Zadna upozorneni</p>
			</div>
		{:else}
			{#each ctx.notifications.current as notification (notification.id)}
				<NotificationItem {notification} onMarkAsRead={handleMarkAsRead} />
			{/each}
		{/if}
	</div>
</div>
