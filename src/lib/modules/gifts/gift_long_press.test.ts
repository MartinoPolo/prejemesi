import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGiftLongPressRecognizer, GIFT_REORDER_LONG_PRESS_MS } from './gift_long_press.js';

afterEach(() => vi.useRealTimers());

describe('gift long press', () => {
	it('opens at 500 ms but does nothing at 499 ms', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const pending = vi.fn();
		const press = createGiftLongPressRecognizer(open, pending);
		press.start(10, 10);
		expect(pending).toHaveBeenCalledWith(true);
		vi.advanceTimersByTime(499);
		expect(open).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(pending).toHaveBeenLastCalledWith(false);
		expect(open).toHaveBeenCalledOnce();
	});

	it('opens after the reorder long-press duration when given one', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const press = createGiftLongPressRecognizer(open, undefined, GIFT_REORDER_LONG_PRESS_MS);
		press.start(10, 10);
		vi.advanceTimersByTime(299);
		expect(open).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(open).toHaveBeenCalledOnce();
	});

	it('completes early, once, when the browser fires its long-press contextmenu first', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const pending = vi.fn();
		const press = createGiftLongPressRecognizer(open, pending);
		press.start(10, 10);
		vi.advanceTimersByTime(450);

		expect(press.complete()).toBe(true);
		expect(open).toHaveBeenCalledOnce();
		expect(pending).toHaveBeenLastCalledWith(false);
		vi.advanceTimersByTime(500);
		expect(open).toHaveBeenCalledOnce();
	});

	it('does not complete a press that was cancelled or never started', () => {
		vi.useFakeTimers();
		const open = vi.fn();
		const press = createGiftLongPressRecognizer(open);

		expect(press.complete()).toBe(false);
		press.start(10, 10);
		press.move(30, 10);
		expect(press.complete()).toBe(false);
		expect(open).not.toHaveBeenCalled();
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
