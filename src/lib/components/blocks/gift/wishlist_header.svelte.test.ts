import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import WishlistHeader from './WishlistHeader.svelte';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const baseProps = {
	title: 'Velmi dlouhý název narozeninového seznamu přání pro naši Aničku',
	recipientDisplayName: 'Anička',
	recipientImage: null,
	isForSomeoneElse: true,
	managerNames: ['Martin'],
	description: 'Popis seznamu, který na mobilu nemá zvětšovat hero.',
	imageKey: null,
	imageSrc: null,
	imageSlots: null,
	themeEmoji: '🎁',
	eventDate: null,
	status: 'active' as const,
	role: 'moderator' as const,
	giftCount: 13,
	recipientIsModerator: false,
	onshare: vi.fn(),
	onmoderators: vi.fn(),
	onarchive: vi.fn(),
	oneditimage: vi.fn(),
	oneditrecipient: vi.fn(),
	onsettings: vi.fn(),
};

afterEach(async () => {
	await page.viewport(1280, 720);
});

function computedRotation(element: HTMLElement) {
	const transform = getComputedStyle(element).transform;
	if (transform === 'none') {
		return 0;
	}
	const matrix = new DOMMatrixReadOnly(transform);
	return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

describe('WishlistHeader responsive presentation', () => {
	it('renders a fixed compact mobile hero with an equally inset thumbnail and one management trigger', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, baseProps);
		const hero = screen.getByTestId('wishlist-mobile-hero');
		const photo = screen.getByTestId('wishlist-mobile-photo');
		const heroBox = await hero.element().getBoundingClientRect();
		const photoBox = await photo.element().getBoundingClientRect();

		expect(heroBox.height).toBeGreaterThanOrEqual(104);
		expect(heroBox.height).toBeLessThanOrEqual(120);
		expect(photoBox.width).toBeGreaterThanOrEqual(84);
		expect(photoBox.width).toBeLessThanOrEqual(96);
		expect(Math.abs(photoBox.width - photoBox.height)).toBeLessThanOrEqual(1);
		expect(
			Math.abs(photoBox.left - heroBox.left - (photoBox.top - heroBox.top)),
		).toBeLessThanOrEqual(1);
		await expect.element(screen.getByTestId('wishlist-banner')).not.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_more_actions() }))
			.toHaveStyle({ width: '32px', height: '32px' });
		await screen.unmount();
	});

	it('opens hero More with the shared inset Wishlist bottom-sheet geometry', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, baseProps);
		await screen.getByRole('button', { name: m.gift_more_actions() }).click();
		const dialog = screen.getByRole('dialog', { name: m.gift_more_actions() }).element();
		const rect = dialog.getBoundingClientRect();
		const style = getComputedStyle(dialog);

		expect(dialog).toHaveAttribute('data-side', 'bottom');
		expect(rect.left).toBeCloseTo(8, 0);
		expect(rect.right).toBeCloseTo(382, 0);
		expect(style.bottom).toBe('0px');
		expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
		expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
		await screen.unmount();
	});

	it('keeps lifecycle and privacy notices outside the compact hero', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeader, {
			...baseProps,
			status: 'archived' as const,
			role: 'moderator' as const,
		});
		const hero = screen.getByTestId('wishlist-mobile-hero');
		const archivedNotice = screen.getByText(m.wishlist_archived_banner());
		const privacyNotice = screen.getByText(
			m.wishlist_moderator_sees_reservations({ name: baseProps.recipientDisplayName }),
		);
		expect(hero.element().contains(archivedNotice.element())).toBe(false);
		expect(hero.element().contains(privacyNotice.element())).toBe(false);
		await screen.unmount();
	});

	it('reserves desktop copy space for hero actions at the 640px breakpoint', async () => {
		await page.viewport(640, 720);
		const screen = await render(WishlistHeader, baseProps);
		const banner = screen.getByTestId('wishlist-banner').element();
		const actions = banner.querySelector(
			'.desktop-header-actions [data-testid="wishlist-header-actions"]',
		) as HTMLElement;
		const title = screen.getByRole('heading', { level: 1, name: baseProps.title }).element();
		const recipient = Array.from(banner.querySelectorAll('strong')).find(
			(element) => element.textContent === baseProps.recipientDisplayName,
		) as HTMLElement;
		const actionsBox = actions.getBoundingClientRect();
		for (const content of [title, recipient]) {
			const box = content.getBoundingClientRect();
			const overlaps =
				box.left < actionsBox.right &&
				box.right > actionsBox.left &&
				box.top < actionsBox.bottom &&
				box.bottom > actionsBox.top;
			expect(overlaps).toBe(false);
		}
		await screen.unmount();
	});

	it('exposes desktop management workflows only through the hero More menu', async () => {
		await page.viewport(1280, 720);
		const screen = await render(WishlistHeader, baseProps);
		const banner = screen.getByTestId('wishlist-banner').element();
		const visibleButtons = Array.from(
			banner.querySelectorAll<HTMLButtonElement>('button'),
		).filter((button) => button.getClientRects().length > 0);

		expect(
			visibleButtons.filter(
				(button) => button.getAttribute('aria-label') === m.gift_more_actions(),
			),
		).toHaveLength(1);
		for (const label of [
			m.wishlist_share_label(),
			m.wishlist_moderators_label(),
			m.wishlist_archive_label(),
		]) {
			expect(
				visibleButtons.some((button) => button.getAttribute('aria-label') === label),
			).toBe(false);
		}
		await screen.unmount();
	});

	it('preserves the notebook presentation and fixture heading contract from sm upward', async () => {
		await page.viewport(640, 720);
		const fixtureImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
		const screen = await render(WishlistHeader, {
			...baseProps,
			headingLevel: 2 as const,
			imageSrc: fixtureImage,
		});
		await expect.element(screen.getByTestId('wishlist-banner')).toBeVisible();
		await expect.element(screen.getByTestId('wishlist-mobile-hero')).not.toBeVisible();
		await expect
			.element(screen.getByRole('heading', { level: 2, name: baseProps.title }))
			.toBeVisible();
		expect(
			screen.getByTestId('wishlist-banner').element().querySelector('.polaroid'),
		).not.toBeNull();
		expect(
			screen
				.getByTestId('wishlist-banner')
				.element()
				.querySelector('img')
				?.getAttribute('src'),
		).toBe(fixtureImage);
		await screen.unmount();
	});

	it('keeps reassurance and trust notices horizontal, contained, and operable', async () => {
		const variants = [
			{
				recipientIsModerator: false,
				text: m.wishlist_moderator_sees_reservations({
					name: baseProps.recipientDisplayName,
				}),
			},
			{
				recipientIsModerator: true,
				text: m.wishlist_trust_warning({ name: baseProps.recipientDisplayName }),
			},
		];

		for (const width of [320, 390, 1280]) {
			for (const variant of variants) {
				await page.viewport(width, 720);
				const onarchive = vi.fn();
				const screen = await render(WishlistHeader, {
					...baseProps,
					eventDate: new Date('2000-01-01T00:00:00.000Z'),
					recipientIsModerator: variant.recipientIsModerator,
					onarchive,
				});
				const title = screen.getByText(variant.text);
				const notice = title.element().closest<HTMLElement>('[data-slot="alert"]')!;
				const assertHorizontal = () =>
					expect(Math.abs(computedRotation(notice))).toBeLessThan(0.001);

				await expect.element(title).toBeVisible();
				assertHorizontal();
				await title.hover();
				assertHorizontal();
				notice.tabIndex = 0;
				notice.focus();
				expect(document.activeElement).toBe(notice);
				assertHorizontal();

				const bounds = notice.getBoundingClientRect();
				expect(bounds.left).toBeGreaterThanOrEqual(0);
				expect(bounds.right).toBeLessThanOrEqual(width);
				expect(parseFloat(getComputedStyle(notice).borderTopWidth)).toBeGreaterThan(0);

				const archive = screen.getByRole('button', { name: m.wishlist_archive_button() });
				await expect.element(archive).toBeVisible();
				await archive.click();
				expect(onarchive).toHaveBeenCalledOnce();
				await screen.unmount();
			}
		}
	});
});
