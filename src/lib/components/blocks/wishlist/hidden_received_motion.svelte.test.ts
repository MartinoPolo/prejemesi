import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHiddenReceivedMotion } from './hidden_received_motion.js';

const RECT = {
	left: 24,
	top: 36,
	right: 144,
	bottom: 116,
	width: 120,
	height: 80,
	x: 24,
	y: 36,
	toJSON: () => ({}),
} satisfies DOMRect;

function sourceVisual() {
	const source = document.createElement('article');
	source.id = 'gift-card';
	source.innerHTML =
		'<label id="gift-label" for="gift-action">Gift</label><button id="gift-action">Receive</button>';
	document.body.append(source);
	vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(RECT);
	return source;
}

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: {
			finished,
			cancel: vi.fn(),
			addEventListener: vi.fn(),
		} as unknown as Animation,
		finish,
	};
}

function gift(id: string, rectangle: DOMRect) {
	const element = document.createElement('article');
	element.dataset.giftItem = '';
	element.dataset.giftId = id;
	document.body.append(element);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rectangle);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('hidden received motion', () => {
	it('retains an inert ID-free visual at the source rectangle for the 340 ms local exit', async () => {
		const source = sourceVisual();
		const pending = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(pending.animation);
		const motion = createHiddenReceivedMotion({ reducedMotion: () => false });

		const snapshot = motion.capture(source, document.body);
		const clone = snapshot.retainedVisual!;

		expect(clone.isConnected).toBe(false);
		expect(source.isConnected).toBe(true);

		source.remove();
		const playing = motion.play(snapshot, document.body);

		expect(clone.isConnected).toBe(true);
		expect(clone).not.toBe(source);
		expect(clone.getAttribute('aria-hidden')).toBe('true');
		expect(clone.inert).toBe(true);
		expect(clone.style.pointerEvents).toBe('none');
		expect(clone.style.position).toBe('fixed');
		expect(clone.style.left).toBe('24px');
		expect(clone.style.top).toBe('36px');
		expect(clone.style.width).toBe('120px');
		expect(clone.style.height).toBe('80px');
		expect(clone.querySelectorAll('[id]').length).toBe(0);
		expect(animate).toHaveBeenCalledWith(
			[
				{ opacity: 1, transform: 'scale(1)' },
				{ opacity: 0, transform: 'scale(0.97)' },
			],
			{ duration: 340, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		);

		pending.finish();
		await playing;
		expect(clone.isConnected).toBe(false);
		motion.destroy();
	});

	it('settles only continuously visible sibling identities after the local exit finishes', async () => {
		const source = sourceVisual();
		const stable = gift('stable', RECT);
		const pending = deferredAnimation();
		const layoutAnimation = deferredAnimation().animation;
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(pending.animation)
			.mockReturnValue(layoutAnimation);
		const motion = createHiddenReceivedMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(source, document.body);

		source.remove();
		vi.mocked(stable.getBoundingClientRect).mockReturnValue({
			...RECT,
			left: 54,
			top: 76,
			x: 54,
			y: 76,
			right: 174,
			bottom: 156,
		});
		gift('inserted', { ...RECT, left: 200, top: 200, x: 200, y: 200, right: 320, bottom: 280 });
		const playing = motion.play(snapshot, document.body);

		expect(animate).toHaveBeenCalledTimes(1);
		pending.finish();
		await playing;

		expect(animate).toHaveBeenCalledTimes(2);
		expect(animate.mock.contexts[1]).toBe(stable);
		expect(animate.mock.calls[1]).toEqual([
			[{ transform: 'translate(-30px, -40px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		]);
		motion.destroy();
	});

	it('applies reduced motion immediately without a retained visual or transform animation', async () => {
		const source = sourceVisual();
		const stable = gift('stable', RECT);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const motion = createHiddenReceivedMotion({ reducedMotion: () => true });
		const snapshot = motion.capture(source, document.body);

		expect(snapshot.retainedVisual).toBeNull();
		source.remove();
		vi.mocked(stable.getBoundingClientRect).mockReturnValue({
			...RECT,
			left: 80,
			x: 80,
			right: 200,
		});
		await motion.play(snapshot, document.body);

		expect(document.body.children).toHaveLength(1);
		expect(stable.style.transform).toBe('');
		expect(animate).not.toHaveBeenCalled();
		motion.destroy();
	});

	it('cancels WAAPI and removes the retained visual when a rapid run supersedes it', () => {
		const firstSource = sourceVisual();
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createHiddenReceivedMotion({ reducedMotion: () => false });
		const firstSnapshot = motion.capture(firstSource, document.body);
		void motion.play(firstSnapshot, document.body);
		const firstClone = firstSnapshot.retainedVisual!;
		const secondSource = document.createElement('article');
		document.body.append(secondSource);
		vi.spyOn(secondSource, 'getBoundingClientRect').mockReturnValue(RECT);

		const secondSnapshot = motion.capture(secondSource, document.body);

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(firstClone.isConnected).toBe(false);
		expect(firstClone.getAttribute('style')).toBeNull();
		expect(secondSnapshot.retainedVisual?.isConnected).toBe(false);
		motion.destroy();
	});

	it('destroy cancels the active exit and clears its overlay styles', () => {
		const source = sourceVisual();
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createHiddenReceivedMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(source, document.body);
		void motion.play(snapshot, document.body);
		const clone = snapshot.retainedVisual!;

		motion.destroy();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(clone.isConnected).toBe(false);
		expect(clone.getAttribute('style')).toBeNull();
	});
});
