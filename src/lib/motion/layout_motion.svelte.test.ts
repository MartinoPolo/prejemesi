import { describe, expect, it, vi } from 'vitest';
import { createIdentityLayoutMotion } from './layout_motion.js';

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
	it('does not FLIP invalid, inserted, or removed gift identities', () => {
		const animate = vi.fn(() => animation());
		const motion = createIdentityLayoutMotion({ reducedMotion: () => false });
		const stable = gift('stable');
		const removed = gift('removed');
		const hidden = gift('hidden', { width: 0, height: 0, right: 10, bottom: 10 });
		const origin = gift('origin', { left: 0, top: 0, x: 0, y: 0 });
		for (const element of [stable, removed, hidden, origin]) {
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
		vi.mocked(origin.getBoundingClientRect).mockReturnValue({
			...stable.getBoundingClientRect(),
			left: 300,
			top: 300,
			x: 300,
			y: 300,
			right: 400,
			bottom: 400,
		});
		const inserted = gift('inserted', { left: 200, top: 200, x: 200, y: 200 });
		Object.defineProperty(inserted, 'animate', { value: animate });
		motion.play(before, document.body);

		expect(animate).not.toHaveBeenCalled();
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
