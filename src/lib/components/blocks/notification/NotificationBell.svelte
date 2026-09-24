<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ControlSize } from '$lib/components/base/control_sizing.js';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { useNotifications } from '$lib/modules/notifications/notifications.context.svelte.js';
	import NotificationPanel from './NotificationPanel.svelte';

	interface NotificationBellProps {
		size?: ControlSize;
	}

	let { size }: NotificationBellProps = $props();

	const ctx = useNotifications();

	let popoverOpen = $state(false);

	function handleOpenChange(open: boolean) {
		popoverOpen = open;
		if (open) {
			ctx.open();
		} else {
			ctx.close();
		}
	}
</script>

<Popover.Root open={popoverOpen} onOpenChange={handleOpenChange}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<!-- Deliberately ghost (no sticker border): the bell sits in the personal cluster
			     next to the avatar, and an outlined circle would collide with the badge. -->
			<Button
				{...props}
				intent="ghost"
				{size}
				format="icon"
				class="relative"
				aria-label={m.notification_bell_label({ count: ctx.unreadCount.current })}
			>
				<BellIcon data-icon />
				{#if ctx.hasUnread.current}
					<span class="notif-badge" aria-hidden="true">
						{ctx.unreadCount.current > 99 ? '99+' : ctx.unreadCount.current}
					</span>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align="end"
		collisionPadding={8}
		class="flex w-80 max-h-[min(var(--bits-popover-content-available-height,calc(100dvh-1rem)),calc(100dvh-1rem))] flex-col overflow-hidden p-0"
	>
		<p class="sr-only">{m.notification_panel_title()}</p>
		<NotificationPanel />
	</Popover.Content>
</Popover.Root>

<style>
	.notif-badge {
		position: absolute;
		top: 0;
		right: 0;
		min-width: 17px;
		height: 17px;
		padding: 0 3px;
		background: var(--destructive);
		color: white;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: var(--weight-bold);
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		border: 2px solid var(--ink);
		transform: rotate(6deg);
		pointer-events: none;
	}
</style>
