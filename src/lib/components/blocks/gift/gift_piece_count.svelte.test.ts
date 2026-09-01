import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPieceCount } from '$lib/modules/gifts/gift_display.js';

const { default: GiftPieceCount } = await import('./GiftPieceCount.svelte');

afterEach(() => vi.restoreAllMocks());

describe('GiftPieceCount', () => {
	it('crossfades only when the viewer gains an own reservation after initial mount', async () => {
		const animation = { cancel: vi.fn() } as unknown as Animation;
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});

		expect(animate).not.toHaveBeenCalled();
		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: 'reservation-1',
		});

		const count = document.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		const expected = formatPieceCount(3, 'visitor', 1)!;
		expect(count.textContent).toContain(expected.pieceText);
		expect(count.textContent).toContain(expected.reservedText);
		expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
	});

	it('updates quantity, role, and other visitors counts without acknowledgement', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});

		await screen.rerender({
			quantity: 4,
			role: 'moderator',
			reservedCount: 2,
			reservationAcknowledgementKey: null,
		});

		expect(document.querySelector('[data-testid="gift-piece-count"]')?.textContent).toContain(
			formatPieceCount(4, 'moderator', 2)!.reservedText,
		);
		expect(animate).not.toHaveBeenCalled();
	});

	it('keeps recipient reservation counts private without a revealing crossfade', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'recipient',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});

		await screen.rerender({
			quantity: 3,
			role: 'recipient',
			reservedCount: 2,
			reservationAcknowledgementKey: null,
		});

		const count = document.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		expect(count.textContent).toBe(formatPieceCount(3, 'recipient', 2)!.pieceText);
		expect(animate).not.toHaveBeenCalled();
	});

	it('cancels stale count animation so the final rapid own reservation wins', async () => {
		const firstAnimation = { cancel: vi.fn() } as unknown as Animation;
		const secondAnimation = { cancel: vi.fn() } as unknown as Animation;
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(firstAnimation)
			.mockReturnValueOnce(secondAnimation);
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});

		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: 'reservation-1',
		});
		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: null,
		});
		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 2,
			reservationAcknowledgementKey: 'reservation-2',
		});

		expect(firstAnimation.cancel).toHaveBeenCalledOnce();
		expect(animate).toHaveBeenCalledTimes(2);
		const expected = formatPieceCount(3, 'visitor', 2)!;
		expect(document.querySelector('[data-testid="gift-piece-count"]')?.textContent).toContain(
			expected.reservedText,
		);
	});

	it('updates count immediately without transforms under reduced motion', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});

		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: 'reservation-1',
		});

		const count = document.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		expect(count.textContent).toContain(formatPieceCount(3, 'visitor', 1)!.reservedText);
		expect(animate).not.toHaveBeenCalled();
		expect(count.style.transform).toBe('');
	});

	it('cancels an active count crossfade on teardown', async () => {
		const animation = { cancel: vi.fn() } as unknown as Animation;
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
		const screen = await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 0,
			reservationAcknowledgementKey: null,
		});
		await screen.rerender({
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: 'reservation-1',
		});

		await screen.unmount();

		expect(animation.cancel).toHaveBeenCalledOnce();
	});

	it('does not animate an own reservation already present on initial mount', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		await render(GiftPieceCount, {
			quantity: 3,
			role: 'visitor',
			reservedCount: 1,
			reservationAcknowledgementKey: 'reservation-1',
		});

		expect(animate).not.toHaveBeenCalled();
	});
});
