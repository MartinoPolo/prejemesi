import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { userEvent } from 'vitest/browser';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { Wishlist } from '$lib/modules/wishlists/types.js';
import type { Palette } from '$lib/theme/palettes.js';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistCard } = await import('./WishlistCard.svelte');
const { default: WishlistListView } = await import('./WishlistListView.svelte');
const { expectPixelsNear } = createPixelAssertions(expect);

const wishlist = {
	id: 'wishlist-1',
	shortId: 'test-list',
	title: 'Testovací seznam',
	status: 'active',
	theme: 'default',
	imageKey: null,
	imageSlots: null,
	eventDate: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-02T00:00:00Z'),
} as unknown as Wishlist;

function progressParts() {
	const progress = document.querySelector('[data-slot="progress"]') as HTMLElement;
	const indicator = progress?.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
	return { progress, indicator };
}

async function assertWholeSurfaceLift(owner: HTMLElement, content: HTMLElement[]) {
	const surface = owner.querySelector<HTMLElement>(':scope > [data-slot="elevation-surface"]')!;
	for (const element of content) {
		expect(element).not.toBeNull();
		expect(surface.contains(element)).toBe(true);
	}
	const restTarget = document.createElement('span');
	restTarget.style.cssText =
		'position:fixed;top:10px;left:10px;width:10px;height:10px;z-index:2147483647';
	document.body.append(restTarget);
	try {
		await userEvent.hover(restTarget);
		await expect
			.poll(
				() =>
					owner.getAnimations().filter((animation) => animation.playState === 'running')
						.length,
			)
			.toBe(0);
		await expect
			.poll(
				() =>
					surface.getAnimations().filter((animation) => animation.playState === 'running')
						.length,
			)
			.toBe(0);
		const ownerBefore = owner.getBoundingClientRect();
		const surfaceBefore = surface.getBoundingClientRect();
		const offsets = content.map(
			(element) => element.getBoundingClientRect().top - surfaceBefore.top,
		);
		await userEvent.hover(owner);
		await expect.poll(() => getComputedStyle(surface).translate).toBe('0px -2px');
		await expect
			.poll(
				() =>
					surface.getAnimations().filter((animation) => animation.playState === 'running')
						.length,
			)
			.toBe(0);
		const ownerAfter = owner.getBoundingClientRect();
		const surfaceAfter = surface.getBoundingClientRect();
		expectPixelsNear(ownerAfter.top, ownerBefore.top);
		expectPixelsNear(surfaceAfter.top, surfaceBefore.top - 2);
		for (const [index, element] of content.entries()) {
			expectPixelsNear(
				element.getBoundingClientRect().top - surfaceAfter.top,
				offsets[index]!,
			);
		}
		await userEvent.hover(restTarget);
		await expect
			.poll(() => Math.abs(surface.getBoundingClientRect().top - surfaceBefore.top))
			.toBeLessThanOrEqual(0.5);
	} finally {
		restTarget.remove();
	}
}

describe('Wishlist elevation', () => {
	it('lifts banner image, title, status, owner metadata, progress and body together while keeping its link stationary', async () => {
		const screen = await render(WishlistCard, {
			wishlist,
			recipientDisplayName: 'Marie',
			giftCount: 3,
			reservationProgress: { reserved: 1, total: 3 },
		});
		const owner = screen.container.querySelector<HTMLElement>('[data-testid="wishlist-card"]')!;
		expect(owner.getAttribute('href')).toContain('test-list');
		await assertWholeSurfaceLift(owner, [
			owner.querySelector<HTMLElement>('[aria-hidden="true"] > .absolute')!,
			owner.querySelector<HTMLElement>('div.truncate')!,
			owner.querySelector<HTMLElement>('[data-slot="badge"]')!,
			owner.querySelector<HTMLElement>('[data-slot="avatar"]')!,
			owner.querySelector<HTMLElement>('[data-slot="progress"]')!,
		]);
		await screen.unmount();
	});

	it('lifts the list row thumbnail, title and trailing metadata on the same surface', async () => {
		const screen = await render(WishlistListView, { items: [{ wishlist, giftCount: 3 }] });
		const owner = screen.container.querySelector<HTMLAnchorElement>('a')!;
		expect(owner.getAttribute('href')).toContain('test-list');
		await assertWholeSurfaceLift(owner, [
			owner.querySelector<HTMLElement>('.size-11')!,
			owner.querySelector<HTMLElement>('span.font-heading')!,
			owner.querySelector<HTMLElement>('[data-slot="badge"]')!,
		]);
		await screen.unmount();
	});

	it('keeps archived surfaces static and dimmed', async () => {
		const screen = await render(WishlistCard, {
			wishlist: { ...wishlist, status: 'archived' },
		});
		const owner = screen.container.querySelector<HTMLElement>('[data-testid="wishlist-card"]')!;
		const surface = owner.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		expect(owner.classList.contains('elevation-owner-raised')).toBe(false);
		expect(getComputedStyle(owner).opacity).toBe('0.7');
		const ordinaryShadow = document.createElement('span');
		ordinaryShadow.className = 'elevation-ordinary';
		owner.append(ordinaryShadow);
		expect(getComputedStyle(surface).boxShadow).toBe(
			getComputedStyle(ordinaryShadow).boxShadow,
		);
		expect(getComputedStyle(surface).boxShadow).not.toBe('none');
		ordinaryShadow.remove();
		await userEvent.hover(owner);
		expect(getComputedStyle(surface).translate).toBe('none');
		await screen.unmount();

		const list = await render(WishlistListView, {
			items: [{ wishlist: { ...wishlist, status: 'archived' } }],
		});
		const row = list.container.querySelector<HTMLAnchorElement>('a')!;
		const rowSurface = row.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		expect(row.classList.contains('elevation-owner-raised')).toBe(false);
		await userEvent.hover(row);
		expect(getComputedStyle(rowSurface).translate).toBe('none');
		await list.unmount();
	});
});

describe('WishlistCard actions', () => {
	it('keeps the nested unfollow action pointer-accessible without navigating the card', async () => {
		const actions = createRawSnippet(() => ({
			render: () => '<button type="button">Unfollow</button>',
		}));
		const screen = await render(WishlistCard, { wishlist, actions });
		const button = screen.container.querySelector<HTMLButtonElement>('button')!;
		const card = screen.container.querySelector<HTMLElement>('[data-testid="wishlist-card"]')!;
		const surface = card.querySelector<HTMLElement>('[data-slot="elevation-surface"]')!;
		const onUnfollow = vi.fn((event: MouseEvent) => event.preventDefault());
		button.addEventListener('click', onUnfollow);

		const bounds = button.getBoundingClientRect();
		expect(
			document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
		).toBe(button);
		await userEvent.click(button);
		expect(onUnfollow).toHaveBeenCalledOnce();
		expect(surface.contains(button)).toBe(true);
		await screen.unmount();
	});
});

describe('WishlistCard reservation progress', () => {
	it.each([
		{
			label: 'zero',
			reserved: 0,
			total: 0,
			max: '1',
			now: '0',
			transform: 'translateX(-100%)',
		},
		{
			label: 'partial',
			reserved: 2,
			total: 4,
			max: '4',
			now: '2',
			transform: 'translateX(-50%)',
		},
		{ label: 'full', reserved: 4, total: 4, max: '4', now: '4', transform: 'translateX(-0%)' },
	])(
		'renders finite, accurate $label semantics',
		async ({ reserved, total, max, now, transform }) => {
			const screen = await render(WishlistCard, {
				wishlist,
				reservationProgress: { reserved, total },
			});
			const { progress, indicator } = progressParts();

			expect(progress.getAttribute('aria-valuemax')).toBe(max);
			expect(progress.getAttribute('aria-valuenow')).toBe(now);
			expect(progress.getAttribute('aria-valuetext')).toBe(
				m.wishlist_reserved_ratio({ reserved, total }),
			);
			const renderedOffset = Number.parseFloat(
				indicator.style.transform.match(/translateX\((-?[\d.]+)%\)/)?.[1] ?? 'NaN',
			);
			const expectedOffset = Number.parseFloat(
				transform.match(/translateX\((-?[\d.]+)%\)/)?.[1] ?? 'NaN',
			);
			expect(Math.abs(renderedOffset)).toBe(Math.abs(expectedOffset));
			expect(Number.isFinite(renderedOffset)).toBe(true);
			expect(indicator.className).not.toContain('invisible');
			expect(screen.container.textContent).toContain(
				m.wishlist_reserved_ratio({ reserved, total }),
			);
			await screen.unmount();
		},
	);

	it('never renders reservation progress for the recipient card branch', async () => {
		const screen = await render(WishlistCard, { wishlist, giftCount: 0 });

		expect(screen.container.querySelector('[data-slot="progress"]')).toBeNull();
		expect(screen.container.textContent).not.toContain(m.wishlist_reservation_progress());
		await screen.unmount();
	});
});

describe('WishlistCard palette tint', () => {
	function tokenColor(scope: HTMLElement, token: string): string {
		const probe = document.createElement('span');
		probe.style.backgroundColor = `var(${token})`;
		scope.append(probe);
		const color = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return color;
	}

	it("tints the body and title plate from the wishlist's own palette", async () => {
		const screen = await render(WishlistCard, {
			wishlist: { ...wishlist, palette: 'ruby' },
			giftCount: 3,
		});
		const card = screen.container.querySelector<HTMLElement>('[data-testid="wishlist-card"]')!;
		expect(card.getAttribute('data-palette')).toBe('ruby');

		const surface = card.querySelector<HTMLElement>('[data-slot="elevation-surface"]')!;
		const plate = screen.getByText(wishlist.title).element() as HTMLElement;
		const plainCard = tokenColor(card, '--card');
		const surfaceBackground = getComputedStyle(surface).backgroundColor;
		const plateBackground = getComputedStyle(plate).backgroundColor;

		expect(surfaceBackground).not.toBe(plainCard);
		expect(surfaceBackground).toBe(tokenColor(card, '--wishlist-card-body'));
		expect(plateBackground).not.toBe(plainCard);
		expect(plateBackground).toBe(tokenColor(card, '--wishlist-card-plate'));
		expect(tokenColor(card, '--wishlist-card-body')).not.toBe(
			tokenColor(document.body, '--wishlist-card-body'),
		);
		await screen.unmount();
	});

	it('gives cards with different palettes different surface and title plate colors', async () => {
		async function paletteColors(palette: Palette) {
			const screen = await render(WishlistCard, {
				wishlist: { ...wishlist, palette },
				giftCount: 3,
			});
			const card = screen.container.querySelector<HTMLElement>(
				'[data-testid="wishlist-card"]',
			)!;
			const surface = card.querySelector<HTMLElement>('[data-slot="elevation-surface"]')!;
			const plate = screen.getByText(wishlist.title).element() as HTMLElement;
			const colors = {
				surface: getComputedStyle(surface).backgroundColor,
				plate: getComputedStyle(plate).backgroundColor,
			};
			await screen.unmount();
			return colors;
		}

		const mint = await paletteColors('mint');
		const ruby = await paletteColors('ruby');

		expect(mint.surface).not.toBe(ruby.surface);
		expect(mint.plate).not.toBe(ruby.plate);
	});
});

describe('WishlistCard compact size', () => {
	const createdPrefix = m.wishlist_created_at({ date: '' }).trim();
	const updatedPrefix = m.wishlist_updated_at({ date: '' }).trim();
	const datedWishlist = { ...wishlist, eventDate: new Date('2026-12-24T00:00:00Z') };

	it('keeps the full meta rows at the default size', async () => {
		const screen = await render(WishlistCard, { wishlist: datedWishlist, giftCount: 3 });
		const text = screen.container.textContent ?? '';
		expect(text).toContain(createdPrefix);
		expect(text).toContain(updatedPrefix);
		expect(text).toContain('🗓');
		await screen.unmount();
	});

	it('shows only the gift count on an own card', async () => {
		const screen = await render(WishlistCard, {
			wishlist: datedWishlist,
			giftCount: 3,
			size: 'compact',
		});
		const text = screen.container.textContent ?? '';
		expect(text).toContain(m.wishlist_gift_count_other({ count: 3 }));
		expect(text).not.toContain(createdPrefix);
		expect(text).not.toContain(updatedPrefix);
		expect(text).not.toContain('🗓');
		await screen.unmount();
	});

	it('shows the reservation progress label and gift total at the default size', async () => {
		const screen = await render(WishlistCard, {
			wishlist,
			recipientDisplayName: 'Marie',
			reservationProgress: { reserved: 1, total: 3 },
		});
		const text = screen.container.textContent ?? '';
		expect(text).toContain(m.wishlist_reservation_progress());
		expect(text).toContain(m.wishlist_total_gifts({ count: 3 }));
		await screen.unmount();
	});

	it('keeps recipient and reservation progress value but drops the progress label and totals', async () => {
		const screen = await render(WishlistCard, {
			wishlist,
			recipientDisplayName: 'Marie',
			reservationProgress: { reserved: 1, total: 3 },
			size: 'compact',
		});
		const text = screen.container.textContent ?? '';
		expect(text).toContain(m.wishlist_recipient_chip({ name: 'Marie' }));
		expect(text).toContain(m.wishlist_reserved_ratio({ reserved: 1, total: 3 }));
		expect(text).not.toContain(m.wishlist_reservation_progress());
		expect(text).not.toContain(m.wishlist_total_gifts({ count: 3 }));
		const progress = screen.container.querySelector('[data-slot="progress"]')!;
		expect(progress.getAttribute('aria-label')).toBe(m.wishlist_reservation_progress());
		await screen.unmount();
	});
});
