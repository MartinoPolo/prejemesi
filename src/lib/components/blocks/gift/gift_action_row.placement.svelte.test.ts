import '../../../../app.css';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import GiftActionRowTestHost from './GiftActionRowTestHost.svelte';

const { expectPixelsNear } = createPixelAssertions(expect);

async function settlePlacement() {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

describe('GiftActionRow intrinsic placement', () => {
	it('keeps one right-aligned row, overflows secondary actions, and restores them without duplicate controls', async () => {
		const onplacementchange = vi.fn();
		const screen = await render(GiftActionRowTestHost, {
			contentWidth: 260,
			onplacementchange,
		});
		await settlePlacement();

		const row = screen.getByTestId('gift-action-row').element() as HTMLElement;
		const reserve = screen.getByTestId('reserve-action').element() as HTMLElement;
		const received = screen.getByTestId('received-action').element() as HTMLElement;
		expectPixelsNear(received.getBoundingClientRect().top, reserve.getBoundingClientRect().top);
		expect(row.querySelector('[data-testid="gift-more-actions"]')).toHaveProperty(
			'inert',
			true,
		);
		expect(row.querySelectorAll('[data-testid="received-action"]')).toHaveLength(1);

		await screen.rerender({ contentWidth: 150, onplacementchange });
		await settlePlacement();
		expect(row.querySelectorAll('[data-testid="received-action"]')).toHaveLength(1);
		expect(
			(row.querySelector('[data-testid="gift-action-secondary"]') as HTMLElement).inert,
		).toBe(true);
		expect(row.querySelectorAll('[data-testid="reserve-action"]')).toHaveLength(1);
		expect(row.querySelectorAll('[data-testid="gift-more-actions"]')).toHaveLength(1);
		expect(onplacementchange).toHaveBeenLastCalledWith(['received']);
		const narrowReserve = screen.getByTestId('reserve-action').element() as HTMLElement;
		const more = screen.getByTestId('gift-more-actions').element() as HTMLElement;
		expectPixelsNear(
			narrowReserve.getBoundingClientRect().top,
			more.getBoundingClientRect().top,
		);
		expectPixelsNear(more.getBoundingClientRect().right, row.getBoundingClientRect().right);

		await screen.rerender({ contentWidth: 260, onplacementchange });
		await settlePlacement();
		expect(row.querySelectorAll('[data-testid="received-action"]')).toHaveLength(1);
		expect(row.querySelector('[data-testid="gift-more-actions"]')).toHaveProperty(
			'inert',
			true,
		);
		expect(onplacementchange).toHaveBeenLastCalledWith([]);
	});

	it('passes visible, pending, and disabled direct-action state to More', async () => {
		const onmore = vi.fn();
		const screen = await render(GiftActionRowTestHost, { contentWidth: 260, onmore });
		await settlePlacement();
		(screen.getByTestId('received-action').element() as HTMLButtonElement).click();
		await settlePlacement();

		await screen.rerender({ contentWidth: 150, onmore });
		await settlePlacement();
		(screen.getByTestId('gift-more-actions').element() as HTMLButtonElement).click();

		expect(onmore).toHaveBeenCalledOnce();
		expect(onmore.mock.calls[0]?.[1]).toEqual({
			visibleDirectActions: ['reserve'],
			pendingActions: ['received'],
			disabledActions: ['received'],
		});
	});

	it('keeps the primary command direct and both actions operable at an impossible synthetic width', async () => {
		const onplacementchange = vi.fn();
		const onmore = vi.fn();
		const onreserve = vi.fn();
		const screen = await render(GiftActionRowTestHost, {
			contentWidth: 35,
			onplacementchange,
			onmore,
		});
		await settlePlacement();

		const row = screen.getByTestId('gift-action-row').element() as HTMLElement;
		const receivedSlot = row.querySelector(
			'[data-testid="gift-action-secondary"]',
		) as HTMLElement;
		const reserve = screen.getByTestId('reserve-action').element() as HTMLButtonElement;
		const more = screen.getByTestId('gift-more-actions').element() as HTMLButtonElement;
		reserve.addEventListener('click', onreserve);
		expect(row.querySelectorAll('[data-testid="received-action"]')).toHaveLength(1);
		expect(receivedSlot.inert).toBe(true);
		expect(reserve.closest('[data-testid="gift-action-primary-group"]')).toBeTruthy();
		expect(reserve.closest('[data-testid="gift-action-secondary"]')).toBeNull();
		expect(reserve.closest('[inert]')).toBeNull();
		expect(more.inert).toBe(false);
		reserve.focus();
		expect(document.activeElement).toBe(reserve);
		reserve.click();
		expect(onreserve).toHaveBeenCalledOnce();
		more.focus();
		expect(document.activeElement).toBe(more);
		more.click();
		expect(onmore).toHaveBeenCalledOnce();
		expect(onplacementchange).toHaveBeenLastCalledWith(['received']);
	});

	it('hands focus to More when the focused direct command overflows', async () => {
		const screen = await render(GiftActionRowTestHost, { contentWidth: 260 });
		await settlePlacement();
		(screen.getByTestId('received-action').element() as HTMLElement).focus();

		await screen.rerender({ contentWidth: 150 });
		await settlePlacement();

		expect(document.activeElement).toBe(screen.getByTestId('gift-more-actions').element());
	});

	it('uses actual row content width when the caller does not supply a measurement', async () => {
		const screen = await render(GiftActionRowTestHost, { hostWidth: 150 });
		await settlePlacement();

		const row = screen.getByTestId('gift-action-row').element() as HTMLElement;
		expect(row.dataset.overflowActions).toBe('received');
		expect(row.querySelector('[data-testid="gift-action-secondary"]')).toHaveProperty(
			'inert',
			true,
		);
		expect(row.querySelector('[data-testid="gift-more-actions"]')).toHaveProperty(
			'inert',
			false,
		);

		await screen.rerender({ hostWidth: 260 });
		await settlePlacement();
		expect(row.dataset.overflowActions).toBe('');
		expect(row.querySelector('[data-testid="gift-action-secondary"]')).toHaveProperty(
			'inert',
			false,
		);
	});

	it('keeps one stateful control mounted and remeasures changing hidden content', async () => {
		const screen = await render(GiftActionRowTestHost, { contentWidth: 260 });
		await settlePlacement();
		const row = screen.getByTestId('gift-action-row').element() as HTMLElement;
		const received = screen.getByTestId('received-action').element() as HTMLButtonElement;
		received.click();
		await settlePlacement();
		expect(received.textContent).toContain('pending');

		await screen.rerender({ contentWidth: 150 });
		await settlePlacement();
		expect(row.querySelector('[data-testid="received-action"]')).toBe(received);
		expect(received.closest('[data-testid="gift-action-secondary"]')).toHaveProperty(
			'inert',
			true,
		);

		await screen.rerender({
			contentWidth: 260,
			secondaryLabel: 'Received command with a substantially longer localized pending label',
		});
		await settlePlacement();
		expect(received.closest('[data-testid="gift-action-secondary"]')).toHaveProperty(
			'inert',
			true,
		);
		expect(received.textContent).toContain('pending');

		await screen.rerender({ contentWidth: 260, secondaryLabel: 'Done' });
		await settlePlacement();
		expect(row.querySelector('[data-testid="received-action"]')).toBe(received);
		expect(received.closest('[data-testid="gift-action-secondary"]')).toHaveProperty(
			'inert',
			false,
		);
	});

	it('never overflows a command when no reachable More surface exists', async () => {
		const onplacementchange = vi.fn();
		const screen = await render(GiftActionRowTestHost, {
			contentWidth: 35,
			enableMore: false,
			onplacementchange,
		});
		await settlePlacement();

		const row = screen.getByTestId('gift-action-row').element() as HTMLElement;
		expect(row.querySelector('[data-testid="gift-more-actions"]')).toBeNull();
		expect(row.querySelectorAll('[inert]')).toHaveLength(0);
		expect(row.dataset.overflowActions).toBe('');
	});

	it('keeps the More trigger mounted while its menu owns focus and restores focus after close', async () => {
		const screen = await render(GiftActionRowTestHost, {
			contentWidth: 150,
			moreOpen: true,
		});
		await settlePlacement();
		const more = screen.getByTestId('gift-more-actions').element() as HTMLElement;
		more.focus();

		await screen.rerender({ contentWidth: 260, moreOpen: true });
		await settlePlacement();
		expect(screen.getByTestId('gift-more-actions').element()).toBe(more);
		expect(document.activeElement).toBe(more);

		await screen.rerender({ contentWidth: 260, moreOpen: false });
		await settlePlacement();
		expect(document.querySelector('[data-testid="gift-more-actions"]')).toHaveProperty(
			'inert',
			true,
		);
		expect(document.activeElement).toBe(screen.getByTestId('reserve-action').element());
	});

	it('does not steal focus after the user leaves the action row before a resize', async () => {
		const screen = await render(GiftActionRowTestHost, { contentWidth: 260 });
		await settlePlacement();
		(screen.getByTestId('received-action').element() as HTMLElement).focus();
		const outside = screen.getByTestId('outside-action').element() as HTMLElement;
		outside.focus();

		await screen.rerender({ contentWidth: 150 });
		await settlePlacement();

		expect(document.activeElement).toBe(outside);
	});
});
