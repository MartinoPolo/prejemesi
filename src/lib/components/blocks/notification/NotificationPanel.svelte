<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { useNotifications } from '$lib/modules/notifications/notifications.context.svelte.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import NotificationItem from './NotificationItem.svelte';

	const ctx = useNotifications();

	type ContentState = 'loading' | 'empty' | 'list';
	const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
	let contentElement = $state<HTMLElement | null>(null);
	let displayedContent = $state<ContentState>(untrack(getContentState));
	let activeAnimation: Animation | null = null;
	let pendingContent: Exclude<ContentState, 'loading'> | null = null;
	let transitionRun = 0;

	function getContentState(): ContentState {
		if (ctx.isLoading.current && ctx.notifications.current.length === 0) {
			return 'loading';
		}
		return ctx.notifications.current.length === 0 ? 'empty' : 'list';
	}

	function cancelActiveTransition() {
		transitionRun += 1;
		activeAnimation?.cancel();
		activeAnimation = null;
		pendingContent = null;
	}

	function reducedMotionRequested() {
		return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	}

	async function revealLoadedContent(nextContent: Exclude<ContentState, 'loading'>) {
		cancelActiveTransition();
		const run = transitionRun;
		pendingContent = nextContent;

		if (contentElement === null || reducedMotionRequested()) {
			displayedContent = nextContent;
			pendingContent = null;
			return;
		}

		const exit = contentElement.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 420,
			easing: STANDARD_EASING,
			fill: 'both',
		});
		activeAnimation = exit;
		await exit.finished.catch(() => undefined);
		if (run !== transitionRun) {
			return;
		}

		activeAnimation = null;
		displayedContent = nextContent;
		await tick();
		if (run !== transitionRun || contentElement === null) {
			return;
		}

		exit.cancel();
		const enter = contentElement.animate(
			[
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: 460, easing: STANDARD_EASING, fill: 'both' },
		);
		activeAnimation = enter;
		await enter.finished.catch(() => undefined);
		if (run === transitionRun) {
			enter.cancel();
			activeAnimation = null;
			pendingContent = null;
		}
	}

	$effect(() => {
		const isOpen = ctx.isOpen.current;
		const nextContent = getContentState();

		if (!isOpen) {
			cancelActiveTransition();
			displayedContent = nextContent;
			return;
		}

		if (nextContent === displayedContent) {
			return;
		}

		if (displayedContent === 'loading' && nextContent !== 'loading') {
			if (pendingContent === nextContent) {
				return;
			}
			void revealLoadedContent(nextContent);
		} else {
			cancelActiveTransition();
			displayedContent = nextContent;
		}
	});

	$effect(() => () => cancelActiveTransition());

	function handleMarkAsRead(notificationId: string) {
		void ctx.markAsRead([notificationId]);
	}

	function handleMarkAllAsRead() {
		void ctx.markAllAsRead();
	}
</script>

<div class="flex w-full flex-col">
	<!-- Header: px-4.5 keeps the title aligned with item content (6px list inset + 12px item padding) -->
	<div class="flex items-center justify-between px-4.5 pt-3 pb-2">
		<h3 class="font-heading text-sm font-semibold">{m.notification_panel_title()}</h3>
		{#if ctx.hasUnread.current}
			<Button intent="ghost" size="sm" onclick={handleMarkAllAsRead}>
				<CheckCheckIcon data-icon="inline-start" />
				{m.notification_mark_all()}
			</Button>
		{/if}
	</div>

	<Separator />

	<!-- Notification list: inset so rounded item backgrounds never touch the panel border or separator -->
	<div
		bind:this={contentElement}
		class="max-h-80 overflow-y-auto p-1.5"
		data-notification-panel-content
		aria-busy={displayedContent === 'loading'}
	>
		{#if displayedContent === 'loading'}
			<!-- Loading skeleton: one animated group containing exactly three placeholder rows. -->
			{#each [0, 1, 2] as index (index)}
				<div data-notification-skeleton class="flex items-start gap-3 px-3 py-2.5">
					<Skeleton class="size-8 shrink-0 rounded-full" />
					<div class="flex flex-1 flex-col gap-1.5">
						<Skeleton class="h-3.5 w-3/4" />
						<Skeleton class="h-3 w-1/3" />
					</div>
				</div>
			{/each}
		{:else if displayedContent === 'empty'}
			<!-- Empty state -->
			<div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
				<BellOffIcon class="size-8 opacity-70" />
				<p class="text-sm font-semibold">{m.notification_empty()}</p>
			</div>
		{:else}
			{#each ctx.notifications.current as notification (notification.id)}
				<NotificationItem {notification} onMarkAsRead={handleMarkAsRead} />
			{/each}
		{/if}
	</div>
</div>
