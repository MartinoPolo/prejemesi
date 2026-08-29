import { describe, expect, it, vi } from 'vitest';
import { createIdentityLayoutMotion, LAYOUT_GIFT_MOTION_LIMIT } from './layout_motion.js';

function gift(id: string, rect: Partial<DOMRect> = {}) {
	const element = document.createElement('div');
	element.dataset.giftItem = '';
	element.dataset.giftId = id;
	document.body.append(element);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
		left: 10,
		top: 10,
		right: 110,
		bottom: 110,
		width: 100,
		height: 100,
		x: 10,
		y: 10,
		toJSON: () => ({}),
		...rect,
	});
	return element;
}

function animation() {
	return { cancel: vi.fn() } as unknown as Animation;
}

describe('identity layout motion', () => {
	it('does not FLIP zero-size, inserted, or removed gift identities', () => {
		const animate = vi.fn(() => animation());
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const stable = gift('stable');
		const removed = gift('removed');
		const hidden = gift('hidden', { width: 0, height: 0, right: 10, bottom: 10 });
		for (const element of [stable, removed, hidden]) {
			Object.defineProperty(element, 'animate', { value: animate });
		}
		const before = motion.capture(document.body);

		removed.remove();
		vi.mocked(hidden.getBoundingClientRect).mockReturnValue({
			...stable.getBoundingClientRect(),
			left: 200,
			top: 200,
			x: 200,
			y: 200,
			right: 300,
			bottom: 300,
		});
		const inserted = gift('inserted', { left: 200, top: 200, x: 200, y: 200 });
		Object.defineProperty(inserted, 'animate', { value: animate });
		motion.play(before, document.body);

		expect(animate).not.toHaveBeenCalled();
		motion.destroy();
		document.body.replaceChildren();
	});

	it('FLIPs a positive-size stable identity from real top-left coordinates', () => {
		const element = gift('origin', { left: 0, top: 0, x: 0, y: 0 });
		const animate = vi.fn(() => animation());
		Object.defineProperty(element, 'animate', { value: animate });
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const before = motion.capture(document.body);
		vi.mocked(element.getBoundingClientRect).mockReturnValue({
			...element.getBoundingClientRect(),
			left: 30,
			top: 40,
			x: 30,
			y: 40,
			right: 130,
			bottom: 140,
		});

		motion.play(before, document.body);

		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'translate(-30px, -40px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		motion.destroy();
		document.body.replaceChildren();
	});

	it('centers the bounded capture window on a gift found by viewport hit-testing', () => {
		const elements = Array.from({ length: LAYOUT_GIFT_MOTION_LIMIT + 100 }, (_, index) =>
			gift(`gift-${index}`),
		);
		const visibleIndex = 100;
		const content = document.createElement('span');
		elements[visibleIndex].append(content);
		const hitTest = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([content]);
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });

		const before = motion.capture(document.body);

		expect(before.gifts.has(`gift-${visibleIndex}`)).toBe(true);
		expect(elements[0].getBoundingClientRect).not.toHaveBeenCalled();
		expect(elements.at(-1)?.getBoundingClientRect).not.toHaveBeenCalled();
		expect(
			elements.reduce(
				(total, element) =>
					total + vi.mocked(element.getBoundingClientRect).mock.calls.length,
				0,
			),
		).toBe(LAYOUT_GIFT_MOTION_LIMIT);
		hitTest.mockRestore();
		motion.destroy();
		document.body.replaceChildren();
	});

	it('caps long-list rectangle reads and animations while excluding changed identities', () => {
		const animate = vi.fn(() => animation());
		const elements = Array.from({ length: LAYOUT_GIFT_MOTION_LIMIT + 100 }, (_, index) => {
			const element = gift(`gift-${index}`);
			Object.defineProperty(element, 'animate', { value: animate, configurable: true });
			return element;
		});
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const before = motion.capture(document.body);
		const removed = elements[0];
		const removedAnimate = vi.fn(() => animation());
		Object.defineProperty(removed, 'animate', { value: removedAnimate });
		removed.remove();
		const inserted = gift('inserted');
		const insertedAnimate = vi.fn(() => animation());
		Object.defineProperty(inserted, 'animate', { value: insertedAnimate });
		for (const element of elements) {
			vi.mocked(element.getBoundingClientRect).mockClear();
		}
		for (const element of elements.slice(1)) {
			vi.mocked(element.getBoundingClientRect).mockReturnValue({
				left: 20,
				top: 10,
				right: 120,
				bottom: 110,
				width: 100,
				height: 100,
				x: 20,
				y: 10,
				toJSON: () => ({}),
			});
		}

		motion.play(before, document.body);

		const rectangleReads = [...elements, inserted].reduce(
			(total, element) => total + vi.mocked(element.getBoundingClientRect).mock.calls.length,
			0,
		);
		expect(rectangleReads).toBeLessThanOrEqual(LAYOUT_GIFT_MOTION_LIMIT);
		expect(animate.mock.calls.length).toBeLessThanOrEqual(LAYOUT_GIFT_MOTION_LIMIT);
		expect(removedAnimate).not.toHaveBeenCalled();
		expect(insertedAnimate).not.toHaveBeenCalled();
		motion.destroy();
		document.body.replaceChildren();
	});

	it('FLIPs a stable visible identity whose coordinates changed over 520 ms', () => {
		const element = gift('stable');
		const animate = vi.fn(() => animation());
		Object.defineProperty(element, 'animate', { value: animate });
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const before = motion.capture(document.body);
		vi.mocked(element.getBoundingClientRect).mockReturnValue({
			...element.getBoundingClientRect(),
			left: 40,
			top: 70,
			x: 40,
			y: 70,
			right: 140,
			bottom: 170,
		});

		motion.play(before, document.body);

		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'translate(-30px, -60px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		motion.destroy();
		document.body.replaceChildren();
	});

	it('cancels an active run before capturing a rapid replacement run', () => {
		const element = gift('stable');
		const activeAnimation = animation();
		Object.defineProperty(element, 'animate', { value: vi.fn(() => activeAnimation) });
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const before = motion.capture(document.body);
		vi.mocked(element.getBoundingClientRect).mockReturnValue({
			...element.getBoundingClientRect(),
			left: 30,
			x: 30,
			right: 130,
		});
		motion.play(before, document.body);

		motion.capture(document.body);

		expect(activeAnimation.cancel).toHaveBeenCalledOnce();
		motion.destroy();
		document.body.replaceChildren();
	});

	it('applies reduced-motion changes without starting layout or transform animations', () => {
		const toolbar = document.createElement('div');
		toolbar.dataset.filterToolbar = '';
		document.body.append(toolbar);
		const element = gift('stable');
		const animate = vi.fn(() => animation());
		Object.defineProperty(element, 'animate', { value: animate });
		Object.defineProperty(toolbar, 'animate', { value: animate });
		vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
			left: 10,
			top: 10,
			right: 210,
			bottom: 50,
			width: 200,
			height: 40,
			x: 10,
			y: 10,
			toJSON: () => ({}),
		});
		const motion = createIdentityLayoutMotion({ reducedMotion: () => true });
		const before = motion.capture(document.body, toolbar);
		vi.mocked(element.getBoundingClientRect).mockReturnValue({
			...element.getBoundingClientRect(),
			left: 50,
			x: 50,
			right: 150,
		});

		motion.play(before, document.body, toolbar);

		expect(animate).not.toHaveBeenCalled();
		motion.destroy();
		document.body.replaceChildren();
	});

	it('interpolates the measured toolbar heights over 320 ms', () => {
		const toolbar = document.createElement('div');
		document.body.append(toolbar);
		const animate = vi.fn(() => animation());
		Object.defineProperty(toolbar, 'animate', { value: animate });
		vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
			left: 10,
			top: 10,
			right: 210,
			bottom: 50,
			width: 200,
			height: 40,
			x: 10,
			y: 10,
			toJSON: () => ({}),
		});
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const before = motion.capture(document.body, toolbar);
		vi.mocked(toolbar.getBoundingClientRect).mockReturnValue({
			...toolbar.getBoundingClientRect(),
			bottom: 90,
			height: 80,
		});

		motion.play(before, document.body, toolbar);

		expect(animate).toHaveBeenCalledWith(
			[
				{ height: '40px', overflow: 'clip' },
				{ height: '80px', overflow: 'clip' },
			],
			{ duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		motion.destroy();
		document.body.replaceChildren();
	});
});
