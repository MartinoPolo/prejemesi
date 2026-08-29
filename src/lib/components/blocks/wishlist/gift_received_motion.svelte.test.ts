import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGiftReceivedMotion } from './gift_received_motion.js';

const RECT = {
	left: 20,
	top: 30,
	right: 140,
	bottom: 110,
	width: 120,
	height: 80,
	x: 20,
	y: 30,
	toJSON: () => ({}),
} satisfies DOMRect;

const FAR_RECT = {
	...RECT,
	left: 920,
	top: 1230,
	right: 1040,
	bottom: 1310,
	x: 920,
	y: 1230,
} satisfies DOMRect;

function gift(id: string, rectangle: DOMRect = RECT) {
	const element = document.createElement('article');
	element.dataset.giftItem = '';
	element.dataset.giftId = id;
	element.innerHTML = `<label id="label-${id}" for="action-${id}">Gift</label><button id="action-${id}" data-gift-received-action="${id}">Receive</button>`;
	document.body.append(element);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rectangle);
	return element;
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

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('received gift motion', () => {
	it('uses exactly half the previous 650ms minimum duration for a short flight', async () => {
		const source = gift('moved');
		const flight = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(flight.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', { ...RECT, left: 120, top: 130, right: 240, bottom: 210, x: 120, y: 130 });

		const playing = motion.play(snapshot, document.body);

		expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 325 });
		flight.finish();
		expect(await playing).toBe(true);
		motion.destroy();
	});

	it('extends a far flight in proportion to its Euclidean translation distance', async () => {
		const source = gift('moved');
		const flight = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(flight.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', FAR_RECT);

		const playing = motion.play(snapshot, document.body);

		expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 1000 });
		flight.finish();
		expect(await playing).toBe(true);
		motion.destroy();
	});

	it('does not cap an absolute-bottom flight duration', async () => {
		const source = gift('moved');
		const flight = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(flight.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', {
			...RECT,
			top: 7530,
			bottom: 7610,
			y: 7530,
		});

		const playing = motion.play(snapshot, document.body);

		expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 5000 });
		flight.finish();
		expect(await playing).toBe(true);
		motion.destroy();
	});

	it('uses a valid custom maximum velocity for a far flight', async () => {
		const source = gift('moved');
		const flight = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(flight.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
			maxAverageFlightVelocityPxPerSecond: 3000,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', FAR_RECT);

		const playing = motion.play(snapshot, document.body);

		expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 500 });
		flight.finish();
		expect(await playing).toBe(true);
		motion.destroy();
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MIN_VALUE])(
		'falls back to the default velocity for invalid value %s',
		async (invalidVelocity) => {
			const source = gift('moved');
			const flight = deferredAnimation();
			const animate = vi
				.spyOn(HTMLElement.prototype, 'animate')
				.mockReturnValue(flight.animation);
			const motion = createGiftReceivedMotion({
				reducedMotion: () => false,
				maxAverageFlightVelocityPxPerSecond: invalidVelocity,
			});
			const snapshot = motion.capture('moved', source, document.body);
			source.remove();
			gift('moved', FAR_RECT);

			const playing = motion.play(snapshot, document.body);
			const timing = animate.mock.calls[0]?.[1] as KeyframeAnimationOptions;

			expect(timing.duration).toBe(1000);
			expect(Number.isFinite(timing.duration)).toBe(true);
			flight.finish();
			expect(await playing).toBe(true);
			motion.destroy();
		},
	);

	it('accepts a positive-size visible source at the viewport origin', async () => {
		const source = gift('moved', {
			...RECT,
			left: 0,
			top: 0,
			right: 120,
			bottom: 80,
			x: 0,
			y: 0,
		});
		const flight = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(flight.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', { ...RECT, left: 300, top: 400, right: 420, bottom: 480, x: 300, y: 400 });

		const playing = motion.play(snapshot, document.body);

		expect(animate).toHaveBeenCalledOnce();
		flight.finish();
		expect(await playing).toBe(true);
		motion.destroy();
	});

	it('flies only the same visible identity and concurrently FLIPs displaced siblings', async () => {
		const source = gift('moved');
		source.style.setProperty('--wishlist-card-surface', 'oklch(42% 0.2 18)');
		const sibling = gift('sibling', { ...RECT, left: 160, right: 280, x: 160 });
		const flight = deferredAnimation();
		const siblingFlip = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(flight.animation)
			.mockReturnValueOnce(siblingFlip.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);

		expect(snapshot.retainedVisual?.isConnected).toBe(false);
		expect(source.isConnected).toBe(true);
		expect(source.style.opacity).toBe('');

		source.remove();
		const destination = gift('moved', {
			...RECT,
			left: 300,
			top: 400,
			right: 480,
			bottom: 500,
			width: 180,
			height: 100,
			x: 300,
			y: 400,
		});
		vi.mocked(sibling.getBoundingClientRect).mockReturnValue({
			...RECT,
			left: 30,
			top: 40,
			right: 150,
			bottom: 120,
			x: 30,
			y: 40,
		});
		const playing = motion.play(snapshot, document.body);

		expect(destination.style.opacity).toBe('0');
		const clone = animate.mock.contexts[0] as HTMLElement;
		expect(clone).not.toBe(destination);
		expect(clone.inert).toBe(true);
		expect(clone.getAttribute('aria-hidden')).toBe('true');
		expect(clone.querySelectorAll('[id]').length).toBe(0);
		expect(clone.style.getPropertyValue('--wishlist-card-surface')).toBe('oklch(42% 0.2 18)');
		expect(animate.mock.calls[0]).toEqual([
			[
				{ transform: 'translate(0px, 0px) scale(1, 1)' },
				{ transform: 'translate(280px, 370px) scale(1.5, 1.25)' },
			],
			{ duration: 325, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);
		expect(animate.mock.contexts[1]).toBe(sibling);
		expect(animate.mock.calls[1]).toEqual([
			[{ transform: 'translate(130px, -10px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		]);

		flight.finish();
		await vi.waitFor(() => expect(clone.isConnected).toBe(false));
		expect(destination.style.opacity).toBe('');
		expect(siblingFlip.animation.cancel).not.toHaveBeenCalled();

		siblingFlip.finish();
		expect(await playing).toBe(true);
		expect(document.activeElement).toBe(destination.querySelector('button'));
		motion.destroy();
	});

	it('keeps the moving gift visible with a continuous flight on compact viewports', async () => {
		const source = gift('moved');
		const exit = deferredAnimation();
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(exit.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		const destination = gift('moved', { ...RECT, left: 900, right: 1020, x: 900 });

		const playing = motion.play(snapshot, document.body);

		expect(destination.style.opacity).toBe('0');

		expect(animate).toHaveBeenCalledWith(
			[
				{ transform: 'translate(0px, 0px) scale(1, 1)' },
				{ transform: 'translate(880px, 0px) scale(1, 1)' },
			],
			{ duration: 587, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		);
		exit.finish();
		expect(await playing).toBe(true);
		expect(destination.style.opacity).toBe('');
		motion.destroy();
	});

	it('never flies a newly inserted result without a matching visible source identity', async () => {
		const differentSource = gift('old');
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const snapshot = motion.capture('inserted', differentSource, document.body);
		gift('inserted', { ...RECT, left: 300, right: 420, x: 300 });

		expect(await motion.play(snapshot, document.body)).toBe(true);
		expect(animate).not.toHaveBeenCalled();
		motion.destroy();
	});

	it('reduced motion settles focus immediately without clones or transforms', async () => {
		const source = gift('moved');
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const motion = createGiftReceivedMotion({
			reducedMotion: () => true,
		});
		const snapshot = motion.capture('moved', source, document.body);
		source.remove();
		const destination = gift('moved', { ...RECT, left: 300, right: 420, x: 300 });

		expect(await motion.play(snapshot, document.body)).toBe(true);
		expect(animate).not.toHaveBeenCalled();
		expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
		expect(document.activeElement).toBe(destination.querySelector('button'));
		motion.destroy();
	});

	it('failure and teardown cancel stale animation, remove clones, and restore stable focus', async () => {
		const toolbar = document.createElement('div');
		toolbar.dataset.testid = 'wishlist-toolbar';
		const fallback = document.createElement('button');
		toolbar.append(fallback);
		document.body.append(toolbar);
		const source = gift('moved');
		(source.querySelector('button') as HTMLButtonElement).focus();
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const failed = motion.capture('moved', source, document.body);
		const clone = failed.retainedVisual!;

		motion.discard(failed);

		expect(clone.isConnected).toBe(false);
		expect(clone.getAttribute('style')).toBeNull();
		expect(document.activeElement).toBe(source.querySelector('button'));

		const next = motion.capture('moved', source, document.body);
		source.remove();
		gift('moved', { ...RECT, left: 300, right: 420, x: 300 });
		void motion.play(next, document.body);
		const activeClone = next.retainedVisual!;
		motion.destroy();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(activeClone.isConnected).toBe(false);
		expect(activeClone.getAttribute('style')).toBeNull();
	});

	it('uses the toolbar fallback only when the invoking control is no longer connected', () => {
		const toolbar = document.createElement('div');
		toolbar.dataset.testid = 'wishlist-toolbar';
		const fallback = document.createElement('button');
		toolbar.append(fallback);
		document.body.append(toolbar);
		const unrelated = document.createElement('button');
		document.body.append(unrelated);
		unrelated.focus();
		const source = gift('moved');
		const motion = createGiftReceivedMotion({ reducedMotion: () => false });
		const snapshot = motion.capture('moved', source, document.body);
		snapshot.invokingControl?.remove();

		motion.discard(snapshot);

		expect(document.activeElement).toBe(fallback);
		motion.destroy();
	});

	it('restores a concealed destination when a rapid run cancels an active handoff', () => {
		const source = gift('moved');
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createGiftReceivedMotion({
			reducedMotion: () => false,
		});
		const first = motion.capture('moved', source, document.body);
		source.remove();
		const destination = gift('moved', { ...RECT, left: 300, right: 420, x: 300 });
		void motion.play(first, document.body);
		expect(destination.style.opacity).toBe('0');

		motion.capture('moved', destination, document.body);

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(destination.style.opacity).toBe('');
		motion.destroy();
	});
});
