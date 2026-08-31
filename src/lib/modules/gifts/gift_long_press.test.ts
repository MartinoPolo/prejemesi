import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGiftLongPressRecognizer } from './gift_long_press.js';

afterEach(() => vi.useRealTimers());

describe('gift long press', () => {
	it('opens at 600ms but does nothing at 599ms', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const pending = vi.fn();
		const press = createGiftLongPressRecognizer(open, pending);
		press.start(10, 10);
		expect(pending).toHaveBeenCalledWith(true);
		vi.advanceTimersByTime(599);
		expect(open).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(pending).toHaveBeenLastCalledWith(false);
		expect(open).toHaveBeenCalledOnce();
	});

	it('aborts after movement exceeds eight pixels', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const pending = vi.fn();
		const press = createGiftLongPressRecognizer(open, pending);
		press.start(10, 10);
		press.move(19, 10);
		vi.advanceTimersByTime(600);
		expect(open).not.toHaveBeenCalled();
		expect(pending).toHaveBeenLastCalledWith(false);
	});

	it.each(['end', 'cancel', 'scroll'] as const)('aborts on %s', (abort) => {
		vi.useFakeTimers();
		const open = vi.fn();
		const pending = vi.fn();
		const press = createGiftLongPressRecognizer(open, pending);
		press.start(0, 0);
		press[abort]();
		vi.advanceTimersByTime(600);
		expect(open).not.toHaveBeenCalled();
		expect(pending).toHaveBeenLastCalledWith(false);
	});

	it('allows only the most recently started recognizer to remain pending', () => {
		vi.useFakeTimers();
		const firstOpen = vi.fn();
		const firstPending = vi.fn();
		const secondOpen = vi.fn();
		const first = createGiftLongPressRecognizer(firstOpen, firstPending);
		const second = createGiftLongPressRecognizer(secondOpen);

		first.start(0, 0);
		second.start(10, 10);
		vi.advanceTimersByTime(600);

		expect(firstPending).toHaveBeenLastCalledWith(false);
		expect(firstOpen).not.toHaveBeenCalled();
		expect(secondOpen).toHaveBeenCalledOnce();
	});
});
