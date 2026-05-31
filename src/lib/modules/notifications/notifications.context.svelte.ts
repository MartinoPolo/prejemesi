import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import {
	getNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
} from './notifications.remote.js';
import type { Notification } from './types.js';

type NotificationsContext = ReturnType<typeof createNotificationsContext>;

const [useNotifications, setNotificationsInternal] = createContext<NotificationsContext>();
export { useNotifications };

export function setNotificationsContext(initialUnreadCount = 0) {
	const ctx = createNotificationsContext(initialUnreadCount);
	setNotificationsInternal(ctx);
	return ctx;
}

function createNotificationsContext(initialUnreadCount: number) {
	const notifications = new StateRaw<Notification[]>([]);
	const unreadCount = new StateRaw(initialUnreadCount);
	const isOpen = new StateRaw(false);
	const isLoading = new StateRaw(false);
	const hasLoaded = new StateRaw(false);

	const hasUnread = new Derived(() => unreadCount.current > 0);

	async function loadNotifications() {
		if (isLoading.current) {
			return;
		}
		isLoading.current = true;
		try {
			const [notificationList, count] = await Promise.allSettled([
				getNotifications(),
				getUnreadCount(),
			]);
			if (notificationList.status === 'fulfilled') {
				notifications.current = notificationList.value;
			}
			if (count.status === 'fulfilled') {
				unreadCount.current = count.value;
			}
			hasLoaded.current = true;
		} finally {
			isLoading.current = false;
		}
	}

	async function handleMarkAsRead(notificationIds: string[]) {
		if (notificationIds.length === 0) {
			return;
		}
		// Optimistic update
		notifications.current = notifications.current.map((n) =>
			notificationIds.includes(n.id) ? { ...n, read: true } : n,
		);
		const newlyRead = notificationIds.filter((id) =>
			notifications.current.some((n) => n.id === id),
		);
		unreadCount.current = Math.max(0, unreadCount.current - newlyRead.length);

		await markAsRead(notificationIds);
	}

	async function handleMarkAllAsRead() {
		// Optimistic update
		notifications.current = notifications.current.map((n) => ({ ...n, read: true }));
		unreadCount.current = 0;

		await markAllAsRead();
	}

	function open() {
		isOpen.current = true;
		if (!hasLoaded.current) {
			void loadNotifications();
		}
	}

	function close() {
		isOpen.current = false;
	}

	return {
		notifications: notifications.readonly(),
		unreadCount: unreadCount.readonly(),
		isOpen,
		isLoading: isLoading.readonly(),
		hasUnread,
		loadNotifications,
		markAsRead: handleMarkAsRead,
		markAllAsRead: handleMarkAllAsRead,
		open,
		close,
	};
}
