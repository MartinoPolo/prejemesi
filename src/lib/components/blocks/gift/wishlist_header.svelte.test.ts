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
			.toHaveStyle({ width: '40px', height: '40px' });
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
});
