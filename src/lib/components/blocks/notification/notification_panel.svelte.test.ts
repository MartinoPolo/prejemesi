import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '$lib/modules/notifications/types.js';
import * as m from '$lib/paraglide/messages.js';

const remotes = vi.hoisted(() => ({
	getNotifications: vi.fn<() => Promise<Notification[]>>(),
	getUnreadCount: vi.fn(async () => 0),
	markAsRead: vi.fn(async () => undefined),
	markAllAsRead: vi.fn(async () => undefined),
}));

vi.mock('$lib/modules/notifications/notifications.remote.js', () => remotes);

const { default: NotificationPanelTestHost } = await import('./NotificationPanelTestHost.svelte');

function notification(id: string, message: string): Notification {
	return {
		id,
		type: 'gift_reserved',
		message,
		wishlistId: 'wishlist-1',
		wishlistShortId: 'family',
		giftId: 'gift-1',
		actorName: 'Tereza',
		digest: null,
		href: null,
		read: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: { finished, cancel: vi.fn() } as unknown as Animation,
		finish,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	remotes.getNotifications.mockReset();
	remotes.getUnreadCount.mockClear();
});

describe('NotificationPanel loading handoff', () => {
	it('fades the three-skeleton group out before settling the loaded keyed list in as one container', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		const exit = deferredAnimation();
		const enter = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(enter.animation);
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		const content = document.querySelector<HTMLElement>('[data-notification-panel-content]')!;
		expect(content.getAttribute('aria-busy')).toBe('true');

		response.resolve([
			notification('notification-a', 'První oznámení'),
			notification('notification-b', 'Druhé oznámení'),
		]);
		await vi.waitFor(() => expect(animate).toHaveBeenCalledOnce());

		expect(screen.getByText('První oznámení').query()).toBeNull();
		expect(animate.mock.calls[0]).toEqual([
			[{ opacity: 1 }, { opacity: 0 }],
			{ duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		exit.finish();
		await expect.element(screen.getByText('První oznámení')).toBeVisible();
		await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(2));
		expect(content.getAttribute('aria-busy')).toBe('false');
		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		enter.finish();
		await screen.unmount();
	});

	it('keeps the empty state semantics when the first notification request fails', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		const exit = deferredAnimation();
		const enter = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(enter.animation);
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		response.reject(new Error('notification load failed'));
		await vi.waitFor(() => expect(HTMLElement.prototype.animate).toHaveBeenCalledOnce());
		exit.finish();

		await expect.element(screen.getByText(m.notification_empty())).toBeVisible();
		expect(
			document.querySelector('[data-notification-panel-content]')?.getAttribute('aria-busy'),
		).toBe('false');
		enter.finish();
		await screen.unmount();
	});

	it('swaps immediately without a transform when reduced motion is requested', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		response.resolve([notification('notification-a', 'Bez pohybu')]);

		await expect.element(screen.getByText('Bez pohybu')).toBeVisible();
		const content = document.querySelector<HTMLElement>('[data-notification-panel-content]')!;
		expect(content.style.transform).toBe('');
		expect(animate).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('cancels the skeleton exit and synchronizes loaded content before a rapid reopen', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		const staleExit = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(staleExit.animation);
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		response.resolve([notification('notification-latest', 'Nejnovější stav')]);
		await vi.waitFor(() => expect(animate).toHaveBeenCalledOnce());

		await screen.rerender({ open: false });
		await vi.waitFor(() => expect(staleExit.animation.cancel).toHaveBeenCalledOnce());
		expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(0);

		await screen.rerender({ open: true });
		await expect.element(screen.getByText('Nejnovější stav')).toBeVisible();
		staleExit.finish();
		expect(animate).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('cancels content entry without resuming stale motion after a rapid reopen', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		const exit = deferredAnimation();
		const staleEnter = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(staleEnter.animation);
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		response.resolve([notification('notification-latest', 'Nejnovější stav')]);
		await vi.waitFor(() => expect(animate).toHaveBeenCalledOnce());
		exit.finish();
		await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(2));

		await screen.rerender({ open: false });
		await vi.waitFor(() => expect(staleEnter.animation.cancel).toHaveBeenCalledOnce());
		await screen.rerender({ open: true });

		await expect.element(screen.getByText('Nejnovější stav')).toBeVisible();
		staleEnter.finish();
		expect(animate).toHaveBeenCalledTimes(2);
		await screen.unmount();
	});

	it('cancels an in-flight loading handoff on teardown', async () => {
		const response = deferred<Notification[]>();
		remotes.getNotifications.mockReturnValue(response.promise);
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const screen = await render(NotificationPanelTestHost, { open: true });

		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-notification-skeleton]')).toHaveLength(3);
		});
		response.resolve([notification('notification-a', 'Po načtení')]);
		await vi.waitFor(() => expect(pending.animation.cancel).not.toHaveBeenCalled());
		await vi.waitFor(() => expect(HTMLElement.prototype.animate).toHaveBeenCalledOnce());

		await screen.unmount();
		expect(pending.animation.cancel).toHaveBeenCalledOnce();
	});
});
