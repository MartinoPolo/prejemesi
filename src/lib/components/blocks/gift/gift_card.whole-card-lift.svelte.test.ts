import '../../../../app.css';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { cdp, userEvent } from 'vitest/browser';
import {
	createPixelAssertions,
	DEFAULT_PIXEL_TOLERANCE,
} from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GiftCardTestHost,
	IMAGE_URL,
	cleanupCardHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

const { expectPixelsNear } = createPixelAssertions(expect);

afterEach(() => {
	cleanupCardHosts();
	document.querySelector('[data-testid="pointer-rest-target"]')?.remove();
});

describe('GiftCard whole-card elevation', () => {
	it('moves the rendered image, title, price, overlays, and working actions as one surface', async () => {
		const onmore = vi.fn();
		const screen = await render(GiftCardTestHost, {
			gift: makeVisitorGift({ imageUrl: IMAGE_URL, price: 1299, currency: 'CZK' }),
			role: WISHLIST_ROLES.visitor,
			onmore,
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		const paintedSurface = owner.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		const renderedImage = owner.querySelector<HTMLImageElement>(
			'[data-testid="gift-card-image-frame"] img',
		)!;
		const title = owner.querySelector<HTMLElement>('h3')!;
		const price = owner.querySelector<HTMLElement>('[data-testid="gift-card-price"] > span')!;
		const like = owner
			.querySelector<HTMLButtonElement>('[data-like-heart]')!
			.closest('button')!;
		const actionOwner = owner.querySelector<HTMLButtonElement>(
			'[data-testid="gift-more-actions"]',
		)!;

		expect(owner.classList.contains('elevation-owner-raised')).toBe(true);
		for (const content of [renderedImage, title, price, like, actionOwner]) {
			expect(paintedSurface.contains(content)).toBe(true);
		}
		expect(getComputedStyle(owner).transform).toBe('none');

		const pointerRestTarget = document.createElement('span');
		pointerRestTarget.dataset.testid = 'pointer-rest-target';
		pointerRestTarget.style.cssText =
			'position:fixed;top:10px;left:10px;width:10px;height:10px;z-index:2147483647';
		document.body.append(pointerRestTarget);
		await userEvent.hover(pointerRestTarget);
		await expect
			.poll(
				() =>
					paintedSurface
						.getAnimations()
						.filter((animation) => animation.playState === 'running').length,
			)
			.toBe(0);
		const trackedElements = [renderedImage, title, price, like, actionOwner];
		const ownerBefore = owner.getBoundingClientRect();
		const paintedBefore = paintedSurface.getBoundingClientRect();
		const offsetsBefore = trackedElements.map((element) => {
			const bounds = element.getBoundingClientRect();
			return { x: bounds.x - paintedBefore.x, y: bounds.y - paintedBefore.y };
		});

		await screen.getByTestId('gift-card-surface').hover();
		await expect.poll(() => getComputedStyle(paintedSurface).translate).toBe('0px -2px');
		await expect
			.poll(
				() =>
					paintedSurface
						.getAnimations()
						.filter((animation) => animation.playState === 'running').length,
			)
			.toBe(0);
		const ownerAfter = owner.getBoundingClientRect();
		const paintedAfter = paintedSurface.getBoundingClientRect();

		expectPixelsNear(ownerAfter.top, ownerBefore.top);
		expectPixelsNear(paintedAfter.top, paintedBefore.top - 2);
		for (const [index, element] of trackedElements.entries()) {
			const bounds = element.getBoundingClientRect();
			expectPixelsNear(bounds.x - paintedAfter.x, offsetsBefore[index]!.x);
			expectPixelsNear(bounds.y - paintedAfter.y, offsetsBefore[index]!.y);
		}

		await userEvent.hover(pointerRestTarget);
		await expect
			.poll(() => Math.abs(paintedSurface.getBoundingClientRect().top - paintedBefore.top))
			.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		await userEvent.click(actionOwner);
		expect(onmore).toHaveBeenCalledOnce();
		actionOwner.focus();
		expect(document.activeElement).toBe(actionOwner);
		actionOwner.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
		);
		expect(onmore).toHaveBeenCalledTimes(2);
	});

	it('keeps nested control hover paint owned by the directly hovered control', async () => {
		const screen = await render(GiftCardTestHost, {
			gift: makeVisitorGift({
				links: [{ url: 'https://example.com/gift', label: 'Obchod' }],
				myReservationId: null,
				reservedCount: 0,
			}),
			role: WISHLIST_ROLES.moderator,
			onreserve: () => {},
			onreceived: () => {},
			onmore: () => {},
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		const title = owner.querySelector<HTMLElement>('h3')!;
		const more = owner.querySelector<HTMLButtonElement>('[data-testid="gift-more-actions"]')!;
		const received = owner.querySelector<HTMLButtonElement>(
			'[data-testid="gift-received-toggle"]',
		)!;
		const sourceLink = owner.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
		const moreSurface = more.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const receivedSurface = received.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const restingPaint = [moreSurface, receivedSurface, sourceLink].map(
			(element) => getComputedStyle(element).backgroundColor,
		);

		await userEvent.hover(title);
		await expect
			.poll(() =>
				[moreSurface, receivedSurface, sourceLink].map(
					(element) => getComputedStyle(element).backgroundColor,
				),
			)
			.toEqual(restingPaint);

		await userEvent.hover(more);
		await expect
			.poll(() => getComputedStyle(moreSurface).backgroundColor)
			.not.toBe(restingPaint[0]);
		expect(more.matches(':hover')).toBe(true);
		expect(received.matches(':hover')).toBe(false);
		expect(sourceLink.matches(':hover')).toBe(false);

		await screen.unmount();
	});

	it('does not make a dimmed card a raised owner', async () => {
		await render(GiftCardTestHost, {
			gift: makeVisitorGift({ isFullyReserved: true, reservedCount: 1 }),
			role: WISHLIST_ROLES.visitor,
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		expect(owner.classList.contains('elevation-owner')).toBe(false);
		expect(owner.classList.contains('elevation-owner-raised')).toBe(false);
	});

	describe('while the card action menu is open under a modal pointer lock', () => {
		let previousBodyPointerEvents = '';

		beforeEach(() => {
			previousBodyPointerEvents = document.body.style.pointerEvents;
		});

		afterEach(() => {
			document.body.style.pointerEvents = previousBodyPointerEvents;
		});

		async function movePointerAwayAndLockBody(): Promise<void> {
			const pointerRestTarget = document.createElement('span');
			pointerRestTarget.dataset.testid = 'pointer-rest-target';
			pointerRestTarget.style.cssText =
				'position:fixed;top:10px;left:10px;width:10px;height:10px;z-index:2147483647';
			document.body.append(pointerRestTarget);
			await userEvent.hover(pointerRestTarget);
			document.body.style.pointerEvents = 'none';
		}

		function runningAnimationCount(element: HTMLElement): number {
			return element.getAnimations().filter((animation) => animation.playState === 'running')
				.length;
		}

		it('keeps the open card lifted without :hover and rests once the menu closes', async () => {
			const screen = await render(GiftCardTestHost, {
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
				moreOpen: true,
			});
			await movePointerAwayAndLockBody();

			const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
			const paintedSurface = owner.querySelector<HTMLElement>(
				':scope > [data-slot="elevation-surface"]',
			)!;

			expect(owner.matches(':hover')).toBe(false);
			await expect.poll(() => getComputedStyle(paintedSurface).translate).toBe('0px -2px');
			await expect.poll(() => runningAnimationCount(paintedSurface)).toBe(0);
			expect(getComputedStyle(paintedSurface).scale).toBe('none');
			expect(getComputedStyle(owner).translate).toBe('none');
			const ownerWhileOpen = owner.getBoundingClientRect();
			const paintedWhileOpen = paintedSurface.getBoundingClientRect();

			await screen.rerender({ moreOpen: false });
			await expect.poll(() => getComputedStyle(paintedSurface).translate).toBe('none');
			await expect.poll(() => runningAnimationCount(paintedSurface)).toBe(0);
			expectPixelsNear(owner.getBoundingClientRect().top, ownerWhileOpen.top);
			expectPixelsNear(paintedSurface.getBoundingClientRect().top, paintedWhileOpen.top + 2);
		});

		it('leaves a dimmed card at rest', async () => {
			await render(GiftCardTestHost, {
				gift: makeVisitorGift({ isFullyReserved: true, reservedCount: 1 }),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
				moreOpen: true,
			});
			await movePointerAwayAndLockBody();

			const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
			const paintedSurface = owner.querySelector<HTMLElement>(
				':scope > [data-slot="elevation-surface"]',
			)!;
			await expect.poll(() => runningAnimationCount(paintedSurface)).toBe(0);
			expect(getComputedStyle(paintedSurface).translate).toBe('none');
		});

		it('does not lift a card behind its open actions sheet', async () => {
			await render(GiftCardTestHost, {
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
				moreOpen: true,
				moreSurface: 'dialog',
			});
			await movePointerAwayAndLockBody();

			const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
			const paintedSurface = owner.querySelector<HTMLElement>(
				':scope > [data-slot="elevation-surface"]',
			)!;
			await expect.poll(() => runningAnimationCount(paintedSurface)).toBe(0);
			expect(getComputedStyle(paintedSurface).translate).toBe('none');
			expect(getComputedStyle(paintedSurface).scale).toBe('none');
		});
	});

	describe('press ownership', () => {
		let releaseHeldPointer: (() => Promise<void>) | undefined;

		afterEach(async () => {
			await releaseHeldPointer?.();
			releaseHeldPointer = undefined;
		});

		/** Maps the element centre through the test iframes into top-level page coordinates. */
		function pagePointAtCentre(element: Element): { x: number; y: number } {
			const bounds = element.getBoundingClientRect();
			let x = bounds.left + bounds.width / 2;
			let y = bounds.top + bounds.height / 2;
			let frameWindow: Window = window;
			while (frameWindow.frameElement !== null) {
				const frame = frameWindow.frameElement as HTMLElement;
				const frameBounds = frame.getBoundingClientRect();
				const frameScale = frameBounds.width / frame.offsetWidth;
				x = frameBounds.left + (frame.clientLeft + x) * frameScale;
				y = frameBounds.top + (frame.clientTop + y) * frameScale;
				frameWindow = frameWindow.parent;
			}
			return { x, y };
		}

		// Vitest userEvent only clicks; a real held mouse button is needed to produce :active.
		async function pressAndHold(element: Element): Promise<void> {
			const point = pagePointAtCentre(element);
			const session = cdp();
			await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
			await session.send('Input.dispatchMouseEvent', {
				type: 'mousePressed',
				...point,
				button: 'left',
				clickCount: 1,
			});
			releaseHeldPointer = async () => {
				releaseHeldPointer = undefined;
				await session.send('Input.dispatchMouseEvent', {
					type: 'mouseReleased',
					...point,
					button: 'left',
					clickCount: 1,
				});
			};
		}

		async function settleFrames(frameCount: number): Promise<void> {
			for (let frame = 0; frame < frameCount; frame += 1) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
		}

		async function renderManagedCard(): Promise<{
			owner: HTMLElement;
			paintedSurface: HTMLElement;
		}> {
			await render(GiftCardTestHost, {
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
				onreceived: () => {},
				onmore: () => {},
			});
			const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
			const paintedSurface = owner.querySelector<HTMLElement>(
				':scope > [data-slot="elevation-surface"]',
			)!;
			return { owner, paintedSurface };
		}

		it('keeps the card unpressed while an inner control is held', async () => {
			const { owner, paintedSurface } = await renderManagedCard();
			const more = owner.querySelector<HTMLButtonElement>(
				'[data-testid="gift-more-actions"]',
			)!;

			await pressAndHold(more);
			await expect.poll(() => more.matches(':active')).toBe(true);
			await settleFrames(12);

			expect(getComputedStyle(paintedSurface).scale).toBe('none');
		});

		it('keeps the card unpressed when a held control becomes disabled', async () => {
			const { owner, paintedSurface } = await renderManagedCard();
			const received = owner.querySelector<HTMLButtonElement>(
				'[data-testid="gift-received-toggle"]',
			)!;

			await pressAndHold(received);
			await expect.poll(() => received.matches(':active')).toBe(true);
			received.disabled = true;
			await settleFrames(12);

			// The card stays :active after the held control is disabled, so :has(control:active) alone would press it.
			expect(owner.matches(':active')).toBe(true);
			expect(getComputedStyle(paintedSurface).scale).toBe('none');
		});

		it('keeps the card unpressed from its content while its actions sheet is open', async () => {
			await render(GiftCardTestHost, {
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
				moreOpen: true,
				moreSurface: 'dialog',
			});
			const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
			const paintedSurface = owner.querySelector<HTMLElement>(
				':scope > [data-slot="elevation-surface"]',
			)!;
			const title = owner.querySelector<HTMLElement>('h3')!;

			await pressAndHold(title);
			await expect.poll(() => owner.matches(':active')).toBe(true);
			await settleFrames(12);

			expect(getComputedStyle(paintedSurface).scale).toBe('none');
		});

		it('presses the card from its content after an earlier inner control press', async () => {
			const { owner, paintedSurface } = await renderManagedCard();
			const more = owner.querySelector<HTMLButtonElement>(
				'[data-testid="gift-more-actions"]',
			)!;
			const title = owner.querySelector<HTMLElement>('h3')!;

			await pressAndHold(more);
			await releaseHeldPointer?.();
			await pressAndHold(title);

			await expect.poll(() => getComputedStyle(paintedSurface).scale).toBe('0.98');
		});
	});
});
