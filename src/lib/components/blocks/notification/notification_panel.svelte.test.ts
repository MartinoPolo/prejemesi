import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Notification } from '$lib/modules/notifications/types.js';
import type { NewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';
import * as m from '$lib/paraglide/messages.js';
import { getLocale, overwriteGetLocale, type Locale } from '$lib/paraglide/runtime.js';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';

const remotes = vi.hoisted(() => ({
	getNotifications: vi.fn<() => Promise<Notification[]>>(),
	getUnreadCount: vi.fn(async () => 0),
	markAsRead: vi.fn(async () => undefined),
	markAllAsRead: vi.fn(async () => undefined),
}));

vi.mock('$lib/modules/notifications/notifications.remote.js', () => remotes);

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: navigation.goto }));

const { default: NotificationPanelTestHost } = await import('./NotificationPanelTestHost.svelte');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);
const originalGetLocale = getLocale;

function notification(
	id: string,
	message: string,
	overrides: Partial<Notification> = {},
): Notification {
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
		...overrides,
	};
}

function cssPixels(value: string): number {
	return Number.parseFloat(value);
}

function cssRadius(value: string): readonly [horizontal: number, vertical: number] {
	const [horizontal, vertical = horizontal] = value.split(' ');
	return [cssPixels(horizontal!), cssPixels(vertical!)];
}

function expectRectInsideInnerRoundedBoundary(innerRect: DOMRect, outer: HTMLElement): void {
	const outerRect = outer.getBoundingClientRect();
	const style = getComputedStyle(outer);
	const border = {
		top: cssPixels(style.borderTopWidth),
		right: cssPixels(style.borderRightWidth),
		bottom: cssPixels(style.borderBottomWidth),
		left: cssPixels(style.borderLeftWidth),
	};
	const innerBoundary = {
		top: outerRect.top + border.top,
		right: outerRect.right - border.right,
		bottom: outerRect.bottom - border.bottom,
		left: outerRect.left + border.left,
	};

	expectPixelsAtLeast(innerRect.left, innerBoundary.left);
	expectPixelsAtMost(innerRect.right, innerBoundary.right);
	expectPixelsAtLeast(innerRect.top, innerBoundary.top);
	expectPixelsAtMost(innerRect.bottom, innerBoundary.bottom);

	const corners = [
		{
			name: 'top-left',
			point: { x: innerRect.left, y: innerRect.top },
			outerRadius: cssRadius(style.borderTopLeftRadius),
			borderX: border.left,
			borderY: border.top,
			directionX: 1,
			directionY: 1,
		},
		{
			name: 'top-right',
			point: { x: innerRect.right, y: innerRect.top },
			outerRadius: cssRadius(style.borderTopRightRadius),
			borderX: border.right,
			borderY: border.top,
			directionX: -1,
			directionY: 1,
		},
		{
			name: 'bottom-right',
			point: { x: innerRect.right, y: innerRect.bottom },
			outerRadius: cssRadius(style.borderBottomRightRadius),
			borderX: border.right,
			borderY: border.bottom,
			directionX: -1,
			directionY: -1,
		},
		{
			name: 'bottom-left',
			point: { x: innerRect.left, y: innerRect.bottom },
			outerRadius: cssRadius(style.borderBottomLeftRadius),
			borderX: border.left,
			borderY: border.bottom,
			directionX: 1,
			directionY: -1,
		},
	] as const;

	let checkedCurvedCorners = 0;
	for (const corner of corners) {
		const [outerRadiusX, outerRadiusY] = corner.outerRadius;
		const radiusX = Math.max(0, outerRadiusX - corner.borderX);
		const radiusY = Math.max(0, outerRadiusY - corner.borderY);
		if (radiusX === 0 || radiusY === 0) {
			continue;
		}

		const centerX =
			corner.directionX === 1
				? outerRect.left + outerRadiusX
				: outerRect.right - outerRadiusX;
		const centerY =
			corner.directionY === 1
				? outerRect.top + outerRadiusY
				: outerRect.bottom - outerRadiusY;
		const inCornerCurve =
			corner.directionX * (corner.point.x - centerX) < 0 &&
			corner.directionY * (corner.point.y - centerY) < 0;
		if (!inCornerCurve) {
			continue;
		}

		checkedCurvedCorners += 1;
		const normalizedDistance =
			((corner.point.x - centerX) / radiusX) ** 2 +
			((corner.point.y - centerY) / radiusY) ** 2;
		expect(
			normalizedDistance,
			`scrollport ${corner.name} corner must remain inside the popover's inner rounded edge`,
		).toBeLessThanOrEqual(1);
	}
	expect(checkedCurvedCorners).toBeGreaterThanOrEqual(2);
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

afterEach(async () => {
	vi.restoreAllMocks();
	remotes.getNotifications.mockReset();
	remotes.getUnreadCount.mockReset().mockResolvedValue(0);
	remotes.markAsRead.mockClear();
	remotes.markAllAsRead.mockClear();
	navigation.goto.mockClear();
	await page.viewport(1280, 720);
	overwriteGetLocale(originalGetLocale);
});

describe('NotificationPanel row layout', () => {
	const longEnglishMessage =
		'A long notification message in English wraps across several lines inside the narrow notification panel without covering the next activity.';
	const longActorName = 'Alexandra Montgomery-Svobodová with an unusually long display name';
	const digest: NewGiftDigestPayload = {
		version: 1,
		totalCount: 3,
		wishlistCount: 2,
		wishlists: [
			{
				wishlistId: 'wishlist-czech',
				shortId: 'rodina',
				title: 'Rodinné vánoční dárky a dlouhá přání',
				count: 2,
				namePreviews: ['Velký fotografický atlas', 'Stolní hra pro celou rodinu'],
			},
			{
				wishlistId: 'wishlist-english',
				shortId: 'birthday',
				title: 'Birthday wishes for everyone',
				count: 1,
				namePreviews: ['Walking shoes'],
			},
		],
	};

	it.each([
		{
			viewportName: 'desktop',
			viewportWidth: 1280,
			locale: 'cs',
			expectedHref: '/followed',
		},
		{
			viewportName: 'desktop',
			viewportWidth: 1280,
			locale: 'en',
			expectedHref: '/en/followed',
		},
		{
			viewportName: 'mobile',
			viewportWidth: 390,
			locale: 'cs',
			expectedHref: '/followed',
		},
		{
			viewportName: 'mobile',
			viewportWidth: 390,
			locale: 'en',
			expectedHref: '/en/followed',
		},
	] satisfies Array<{
		viewportName: string;
		viewportWidth: number;
		locale: Locale;
		expectedHref: string;
	}>)(
		'contains adjacent short, long, and digest rows without overlap on $viewportName in $locale',
		async ({ viewportWidth, locale, expectedHref }) => {
			await page.viewport(viewportWidth, 720);
			overwriteGetLocale(() => locale);
			expect(getLocale()).toBe(locale);
			const panelTitle = m.notification_panel_title({}, { locale });
			const markAllLabel = m.notification_mark_all({}, { locale });
			const unreadLabel = m.notification_unread({}, { locale });
			const notificationRows = [
				notification('notification-short', 'Krátké oznámení'),
				notification('notification-long', longEnglishMessage, {
					actorName: longActorName,
					href: '/followed',
				}),
				notification('notification-digest', 'Byly přidány nové dárky', {
					type: 'new_gift_added',
					actorName: null,
					digest,
					giftId: null,
					href: '/followed',
				}),
				notification('notification-four', 'Další krátké oznámení'),
				notification('notification-five', longEnglishMessage, {
					actorName: longActorName,
				}),
				notification('notification-six', 'Poslední oznámení v posuvném panelu'),
			];
			remotes.getNotifications.mockResolvedValue(notificationRows);
			remotes.getUnreadCount.mockResolvedValue(notificationRows.length);
			vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
			const screen = render(NotificationPanelTestHost, {
				open: true,
				panelWidth: 320,
				initialUnreadCount: notificationRows.length,
			});

			await expect.element(screen.getByRole('heading', { name: panelTitle })).toBeVisible();
			await expect.element(screen.getByText(longEnglishMessage).first()).toBeVisible();
			await expect.element(screen.getByText('Byly přidány nové dárky')).toBeVisible();
			await expect.element(screen.getByText(longActorName).first()).toBeVisible();
			expect(screen.getByLabelText(unreadLabel).all()).toHaveLength(notificationRows.length);

			const content = document.querySelector<HTMLElement>(
				'[data-notification-panel-content]',
			)!;
			const frame = content.parentElement!;
			const panel = frame.parentElement!;
			const rows = Array.from(
				content.querySelectorAll<HTMLButtonElement>(':scope > button[data-slot="button"]'),
			);
			const rowSurfaces = rows.map(
				(row) =>
					row.querySelector<HTMLElement>(':scope > [data-slot="elevation-surface"]')!,
			);
			expect(rows).toHaveLength(notificationRows.length);
			expectPixelsNear(panel.getBoundingClientRect().width, 320);

			for (const [index, row] of rows.entries()) {
				const rowRect = row.getBoundingClientRect();
				expectPixelsAtMost(
					row.scrollHeight,
					row.clientHeight,
					`notification row ${index} must grow around wrapped content`,
				);
				expect(row.querySelector('svg')).not.toBeNull();
				expect(row.querySelector('p:last-child')).not.toBeNull();
				expect(row.querySelector('span[aria-label]')).not.toBeNull();

				for (const part of row.querySelectorAll<HTMLElement>(
					'svg, p, ul, span[aria-label]',
				)) {
					const partRect = part.getBoundingClientRect();
					expectPixelsAtLeast(partRect.top, rowRect.top);
					expectPixelsAtMost(partRect.right, rowRect.right);
					expectPixelsAtMost(partRect.bottom, rowRect.bottom);
					expectPixelsAtLeast(partRect.left, rowRect.left);
				}

				const nextSurface = rowSurfaces[index + 1];
				if (nextSurface !== undefined) {
					expectPixelsNear(
						rowSurfaces[index]!.getBoundingClientRect().bottom + 6,
						nextSurface.getBoundingClientRect().top,
						`notification row surfaces ${index} and ${index + 1} need a consistent visible gap`,
					);
				}
			}
			expect(rows[2]!.querySelector('ul')).not.toBeNull();

			await screen.getByText(longEnglishMessage).first().click();
			await vi.waitFor(() => {
				expect(remotes.markAsRead).toHaveBeenCalledWith(['notification-long']);
				expect(navigation.goto).toHaveBeenCalledWith(expectedHref);
			});
			await screen.getByRole('button', { name: markAllLabel }).click();
			await vi.waitFor(() => expect(remotes.markAllAsRead).toHaveBeenCalledOnce());

			expectPixelsAtLeast(content.scrollHeight, content.clientHeight + 1);
			const maximumScrollTop = content.scrollHeight - content.clientHeight;
			for (const scrollTop of [0, maximumScrollTop / 2, maximumScrollTop]) {
				content.scrollTop = scrollTop;
				const panelRect = panel.getBoundingClientRect();
				const contentRect = content.getBoundingClientRect();
				expectPixelsAtLeast(contentRect.left, panelRect.left + 6);
				expectPixelsAtMost(contentRect.right, panelRect.right - 6);
				expectPixelsAtMost(contentRect.bottom, panelRect.bottom - 6);
				const insetPoint = document.elementFromPoint(
					contentRect.left + contentRect.width / 2,
					contentRect.bottom + 3,
				);
				expect(insetPoint?.closest('button[data-slot="button"]')).toBeNull();
			}

			const finalRowRect = rowSurfaces.at(-1)!.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			expectPixelsAtLeast(finalRowRect.top, contentRect.top);
			expectPixelsAtMost(finalRowRect.bottom, contentRect.bottom);
			await screen.unmount();
		},
	);

	it('sizes the real popover to a short row stack without unused scrollport height', async () => {
		const notificationRows = [
			notification('notification-one', 'První krátké oznámení'),
			notification('notification-two', 'Druhé krátké oznámení'),
		];
		remotes.getNotifications.mockResolvedValue(notificationRows);
		remotes.getUnreadCount.mockResolvedValue(notificationRows.length);
		const screen = render(NotificationPanelTestHost, {
			mode: 'bell',
			initialUnreadCount: notificationRows.length,
		});

		await screen
			.getByRole('button', {
				name: m.notification_bell_label({ count: notificationRows.length }),
			})
			.click();
		await expect.element(screen.getByText('Druhé krátké oznámení')).toBeVisible();

		const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]')!;
		for (const animation of popover.getAnimations({ subtree: true })) {
			animation.finish();
		}
		const content = popover.querySelector<HTMLElement>('[data-notification-panel-content]')!;
		const frame = content.parentElement!;
		const panel = frame.parentElement!;
		const header = screen
			.getByRole('heading', { name: m.notification_panel_title() })
			.element().parentElement!;
		const separator = panel.querySelector<HTMLElement>('[data-slot="separator"]')!;
		const rowSurfaces = Array.from(
			content.querySelectorAll<HTMLElement>(
				':scope > button[data-slot="button"] > [data-slot="elevation-surface"]',
			),
		);
		const rowGap = cssPixels(getComputedStyle(content).rowGap);
		const rowStackHeight =
			rowSurfaces.reduce((height, row) => height + row.getBoundingClientRect().height, 0) +
			rowGap * (rowSurfaces.length - 1);
		const contentRect = content.getBoundingClientRect();

		expect(rowSurfaces).toHaveLength(notificationRows.length);
		expectPixelsNear(contentRect.height, rowStackHeight);
		expectPixelsNear(contentRect.top, rowSurfaces[0]!.getBoundingClientRect().top);
		expectPixelsNear(contentRect.bottom, rowSurfaces.at(-1)!.getBoundingClientRect().bottom);
		expectPixelsAtMost(content.scrollHeight, content.clientHeight);
		content.scrollTop = 1;
		expect(content.scrollTop).toBe(0);

		const frameStyle = getComputedStyle(frame);
		const popoverStyle = getComputedStyle(popover);
		const expectedPopoverHeight =
			cssPixels(popoverStyle.borderTopWidth) +
			cssPixels(popoverStyle.borderBottomWidth) +
			header.getBoundingClientRect().height +
			separator.getBoundingClientRect().height +
			cssPixels(frameStyle.paddingTop) +
			rowStackHeight +
			cssPixels(frameStyle.paddingBottom);
		const popoverHeight = popover.getBoundingClientRect().height;
		expectPixelsNear(popoverHeight, expectedPopoverHeight);
		expect(popoverHeight).toBeLessThan(cssPixels(popoverStyle.maxHeight));
		expect(contentRect.height).toBeLessThan(cssPixels(getComputedStyle(content).maxHeight));
		await screen.unmount();
	});

	it.each([
		{ viewportName: 'desktop', viewportWidth: 1280, locale: 'cs' },
		{ viewportName: 'mobile', viewportWidth: 390, locale: 'en' },
	] satisfies Array<{ viewportName: string; viewportWidth: number; locale: Locale }>)(
		'keeps the real popover inside a short $viewportName viewport while its list scrolls',
		async ({ viewportWidth, locale }) => {
			await page.viewport(viewportWidth, 320);
			overwriteGetLocale(() => locale);
			const notificationRows = Array.from({ length: 10 }, (_, index) =>
				notification(
					`notification-${index}`,
					index % 3 === 1 ? longEnglishMessage : `Notification ${index + 1}`,
					index % 3 === 2
						? {
								type: 'new_gift_added',
								actorName: null,
								digest,
								giftId: null,
								href: '/followed',
							}
						: {},
				),
			);
			remotes.getNotifications.mockResolvedValue(notificationRows);
			remotes.getUnreadCount.mockResolvedValue(notificationRows.length);
			const screen = render(NotificationPanelTestHost, {
				mode: 'bell',
				initialUnreadCount: notificationRows.length,
			});

			await screen
				.getByRole('button', {
					name: m.notification_bell_label({ count: notificationRows.length }, { locale }),
				})
				.click();
			await expect
				.element(
					screen.getByRole('heading', {
						name: m.notification_panel_title({}, { locale }),
					}),
				)
				.toBeVisible();
			await expect.element(screen.getByText('Notification 10')).toBeVisible();

			const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]')!;
			for (const animation of popover.getAnimations({ subtree: true })) {
				animation.finish();
			}
			const content = popover.querySelector<HTMLElement>(
				'[data-notification-panel-content]',
			)!;
			const header = screen
				.getByRole('heading', { name: m.notification_panel_title({}, { locale }) })
				.element().parentElement!;
			const popoverRect = popover.getBoundingClientRect();
			expectPixelsNear(popoverRect.height, cssPixels(getComputedStyle(popover).maxHeight));
			expectPixelsAtLeast(popoverRect.top, 8);
			expectPixelsAtMost(popoverRect.bottom, 312);
			expectPixelsAtLeast(content.scrollHeight, content.clientHeight + 1);
			expectRectInsideInnerRoundedBoundary(content.getBoundingClientRect(), popover);

			const maximumScrollTop = content.scrollHeight - content.clientHeight;
			for (const scrollTop of [0, maximumScrollTop / 2, maximumScrollTop]) {
				content.scrollTop = scrollTop;
				const currentPopoverRect = popover.getBoundingClientRect();
				const contentRect = content.getBoundingClientRect();
				const headerRect = header.getBoundingClientRect();
				expectPixelsAtLeast(headerRect.top, currentPopoverRect.top);
				expectPixelsAtMost(headerRect.bottom, contentRect.top);
				expectPixelsAtMost(contentRect.bottom, currentPopoverRect.bottom);

				const bottomInsetPoint = document.elementFromPoint(
					contentRect.left + contentRect.width / 2,
					contentRect.bottom + 3,
				);
				expect(bottomInsetPoint?.closest('button[data-slot="button"]')).toBeNull();
			}

			const finalRow = content.querySelectorAll<HTMLElement>(
				':scope > button > [data-slot="elevation-surface"]',
			)[notificationRows.length - 1]!;
			const finalRowButton = finalRow.parentElement!;
			const finalRowRect = finalRow.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			expectPixelsAtLeast(finalRowRect.top, contentRect.top);
			expectPixelsAtMost(finalRowRect.bottom, contentRect.bottom);

			const contentRadius = cssRadius(getComputedStyle(content).borderBottomLeftRadius)[0];
			expect(contentRadius).toBeGreaterThan(0);
			const cornerProbeInset = Math.max(1, contentRadius / 8);
			const visibleRowPoint = document.elementFromPoint(
				contentRect.left + contentRect.width / 2,
				contentRect.bottom - cornerProbeInset,
			);
			expect(visibleRowPoint?.closest('button[data-slot="button"]')).toBe(finalRowButton);
			const clippedCornerPoint = document.elementFromPoint(
				contentRect.left + cornerProbeInset,
				contentRect.bottom - cornerProbeInset,
			);
			expect(clippedCornerPoint?.closest('button[data-slot="button"]')).toBeNull();
			await expect
				.element(
					screen.getByRole('button', { name: m.notification_mark_all({}, { locale }) }),
				)
				.toBeVisible();
			await screen.unmount();
		},
	);
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
