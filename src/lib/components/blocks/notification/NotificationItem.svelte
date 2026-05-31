<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import type { Notification } from '$lib/modules/notifications/types.js';
	import { formatRelativeTime } from '$lib/modules/notifications/notification-display.js';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import BookmarkCheckIcon from '@lucide/svelte/icons/bookmark-check';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { cn } from '$lib/utils.js';

	interface NotificationItemProps {
		notification: Notification;
		onMarkAsRead: (id: string) => void;
	}

	let { notification, onMarkAsRead }: NotificationItemProps = $props();

	const ICON_MAP = {
		liked_gift_reserved: HeartIcon,
		reserved_gift_edited: PencilIcon,
		wishlist_archived: ArchiveIcon,
		owner_self_promoted: ShieldIcon,
		new_gift_added: GiftIcon,
		gift_reserved: BookmarkCheckIcon,
		moderator_invited: UserPlusIcon,
	} as const;

	const IconComponent = $derived(ICON_MAP[notification.type] ?? BellIcon);

	const relativeTime = $derived(formatRelativeTime(notification.createdAt));

	function handleClick() {
		if (!notification.read) {
			onMarkAsRead(notification.id);
		}

		if (notification.wishlistId) {
			void goto(resolve('/(app)/w/[id]', { id: notification.wishlistId }));
		}
	}
</script>

<button
	type="button"
	class={cn(
		'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
		!notification.read && 'bg-primary/5',
	)}
	onclick={handleClick}
>
	<!-- Icon -->
	<span
		class={cn(
			'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
			notification.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
		)}
	>
		<IconComponent class="size-4" />
	</span>

	<!-- Content -->
	<div class="flex min-w-0 flex-1 flex-col gap-0.5">
		<p class={cn('text-sm leading-snug', !notification.read && 'font-medium')}>
			{notification.message}
		</p>
		{#if notification.actorName}
			<p class="text-xs text-muted-foreground">{notification.actorName}</p>
		{/if}
		<p class="text-xs text-muted-foreground">{relativeTime}</p>
	</div>

	<!-- Unread dot -->
	{#if !notification.read}
		<span class="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Neprecten"></span>
	{/if}
</button>
