import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGiftCollectionMotion } from './gift_collection_motion.js';
import { createPixelAssertions } from '../../../tests/helpers/pixel-assertions.mjs';

const { expectPixelsNear } = createPixelAssertions(expect);

const containers: HTMLElement[] = [];
const coordinators: ReturnType<typeof createGiftCollectionMotion>[] = [];

afterEach(() => {
	for (const coordinator of coordinators) {
		coordinator.destroy();
	}
	coordinators.length = 0;
	for (const container of containers) {
		container.remove();
	}
	containers.length = 0;
	vi.restoreAllMocks();
});

function setup(reducedMotion = () => false) {
	const host = document.createElement('div');
	document.body.append(host);
	containers.push(host);
	const animations: {
		element: Element;
		frames: Keyframe[];
		options: KeyframeAnimationOptions;
		cancel: ReturnType<typeof vi.fn>;
	}[] = [];
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
		this: HTMLElement,
		frames,
		options,
	) {
		const animation = new EventTarget();
		const cancel = vi.fn(() => animation.dispatchEvent(new Event('cancel')));
		animations.push({
			element: this,
			frames: frames as Keyframe[],
			options: options as KeyframeAnimationOptions,
			cancel,
		});
		return Object.assign(animation, {
			cancel,
			finished: new Promise(() => {}),
		}) as unknown as Animation;
	});
	const coordinator = createGiftCollectionMotion(host, reducedMotion);
	coordinators.push(coordinator);
	return { host, coordinator, animations };
}

function gift(host: HTMLElement, id: string, position: { x: number; y: number }, visible = true) {
	const element = document.createElement('div');
	element.dataset.giftItem = '';
	element.dataset.giftId = id;
	element.textContent = `Gift ${id}`;
	element.getBoundingClientRect = () => ({
		left: position.x,
		top: position.y,
		width: 100,
		height: 80,
		right: position.x + 100,
		bottom: position.y + 80,
		x: position.x,
		y: position.y,
		toJSON: () => {},
	});
	if (!visible) {
		element.style.display = 'none';
	}
	host.append(element);
	return element;
}

async function settled() {
	await vi.waitFor(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('collection-owned gift identity motion', () => {
	it('moves the same visible identity across remounted sections without a duplicate visual', async () => {
		const { host, coordinator, animations } = setup();
		const first = gift(host, 'a', { x: 10, y: 10 });
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		first.remove();
		const destination = gift(host, 'a', { x: 10, y: 310 });
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		expect(animations[0]).toMatchObject({ element: destination, options: { duration: 325 } });
		expect(animations[0]?.frames[0]?.transform).toBe('translate(0px, -300px)');
		expect(animations[0]?.frames[0]?.opacity).toBe(1);
		expect(document.querySelectorAll('body > [aria-hidden="true"]')).toHaveLength(0);
		coordinator.beforeUpdate();
		expect(animations.every((animation) => animation.cancel.mock.calls.length === 0)).toBe(
			true,
		);
		coordinator.reset();
		expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true);
		expect(document.querySelectorAll('body > [aria-hidden="true"]')).toHaveLength(0);
	});

	it('does not fabricate travel for entering, exiting, hidden, or offscreen gifts', async () => {
		const { host, coordinator, animations } = setup();
		const source = gift(host, 'source', { x: 10, y: 10 });
		gift(host, 'offscreen', { x: 10, y: -300 });
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		source.remove();
		gift(host, 'incoming', { x: 10, y: 120 });
		gift(host, 'hidden', { x: 10, y: 220 }, false);
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(2));
		expect(
			animations.every((animation) =>
				animation.frames.every((frame) => !String(frame.transform).startsWith('translate')),
			),
		).toBe(true);
		expect(animations.some((animation) => animation.frames[0]?.opacity === 0)).toBe(true);
		expect(animations.some((animation) => animation.frames[1]?.opacity === 0)).toBe(true);
	});

	it('settles immediately on reduced motion and ignores a dragged hidden source', async () => {
		let reduced = false;
		const { host, coordinator, animations } = setup(() => reduced);
		const position = { x: 10, y: 10 };
		const source = gift(host, 'a', position);
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		position.y = 110;
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		reduced = true;
		coordinator.beforeUpdate();
		position.y = 210;
		coordinator.afterUpdate();
		await settled();
		expect(animations).toHaveLength(1);
		expect(animations[0]?.cancel).toHaveBeenCalled();
		source.dataset.giftMotionDragging = '';
		reduced = false;
		coordinator.beforeUpdate();
		position.y = 310;
		coordinator.afterUpdate();
		await settled();
		expect(animations).toHaveLength(1);
		document.dispatchEvent(new Event('scroll'));
	});

	it('settles a drop from the pointer overlay and never fabricates an invalid source', async () => {
		const { host, coordinator, animations } = setup();
		const source = gift(host, 'a', { x: 10, y: 10 });
		coordinator.afterUpdate();
		source.dataset.giftMotionDragging = '';
		coordinator.beforeUpdate();
		source.dispatchEvent(
			new CustomEvent('gift-motion-drop', {
				bubbles: true,
				detail: {
					giftId: 'a',
					rectangle: { left: 10, top: 410, width: 100, height: 80 },
				},
			}),
		);
		delete source.dataset.giftMotionDragging;
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		expect(animations[0]?.frames[0]).toMatchObject({
			transform: 'translate(0px, 400px)',
			opacity: 1,
		});
		expect(animations[0]?.options.duration).toBe(325);
		coordinator.reset();
		source.dataset.giftMotionDragging = '';
		source.dispatchEvent(
			new CustomEvent('gift-motion-drop', {
				bubbles: true,
				detail: {
					giftId: 'a',
					rectangle: { left: 10, top: 1610, width: 100, height: 80 },
				},
			}),
		);
		delete source.dataset.giftMotionDragging;
		await vi.waitFor(() => expect(animations).toHaveLength(2));
		expect(animations[1]?.frames[0]).toMatchObject({ opacity: 0, transform: 'scale(0.98)' });
		expect(
			animations[1]?.frames.some((frame) => String(frame.transform).startsWith('translate(')),
		).toBe(false);
	});

	it('settles reorder drag slot changes and scroll ends without cloning gifts', async () => {
		const { host, coordinator, animations } = setup();
		const position = { x: 10, y: 10 };
		const source = gift(host, 'dragged', { x: 10, y: 200 });
		const neighbour = gift(host, 'neighbour', position);
		coordinator.afterUpdate();
		source.dataset.giftMotionDragging = '';
		const cloneSpy = vi.spyOn(neighbour, 'cloneNode');
		coordinator.beforeUpdate();
		position.y = 110;
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		document.dispatchEvent(new Event('scrollend'));
		expect(animations[0]?.element).toBe(neighbour);
		expect(cloneSpy).not.toHaveBeenCalled();
	});

	it('keeps native WAAPI travel running through class changes, child mutations and initial resize callbacks', async () => {
		const host = document.createElement('div');
		const item = document.createElement('div');
		item.dataset.giftItem = '';
		item.dataset.giftId = 'native';
		item.style.cssText = 'width: 100px; height: 80px; margin-top: 10px';
		host.append(item);
		document.body.append(host);
		containers.push(host);
		const animationSpy = vi.spyOn(HTMLElement.prototype, 'animate');
		const coordinator = createGiftCollectionMotion(host, () => false);
		coordinators.push(coordinator);
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		item.style.marginTop = '310px';
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animationSpy).toHaveBeenCalledTimes(1));
		const active = item.getAnimations()[0]!;
		item.classList.add('unrelated-state');
		const content = document.createElement('span');
		content.style.position = 'absolute';
		item.append(content);
		await settled();
		expect(animationSpy).toHaveBeenCalledTimes(1);
		expect(item.getAnimations()[0]).toBe(active);
		expect(active.playState).toBe('running');
	});

	it('preserves a running toolbar height animation when collection DOM changes without new endpoints', async () => {
		const parent = document.createElement('div');
		const bar = document.createElement('div');
		bar.dataset.testid = 'wishlist-toolbar';
		const content = document.createElement('div');
		content.style.height = '40px';
		bar.append(content);
		const host = document.createElement('div');
		host.style.display = 'flow-root';
		const item = document.createElement('div');
		item.dataset.giftItem = '';
		item.dataset.giftId = 'a';
		item.style.cssText = 'width: 100px; height: 80px';
		host.append(item);
		parent.append(bar, host);
		document.body.append(parent);
		containers.push(parent);
		const coordinator = createGiftCollectionMotion(host, () => false);
		coordinators.push(coordinator);
		coordinator.afterUpdate();
		const sourceTop = item.getBoundingClientRect().top;
		coordinator.beforeUpdate();
		content.style.height = '80px';
		item.style.marginTop = '100px';
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(bar.getAnimations()).toHaveLength(1));
		const active = bar.getAnimations()[0]!;
		const running = parent.getAnimations({ subtree: true });
		for (const animation of running) {
			animation.pause();
			animation.currentTime = 0;
		}
		expectPixelsNear(item.getBoundingClientRect().top, sourceTop);
		for (const animation of running) {
			animation.play();
		}
		item.classList.add('unrelated');
		await settled();
		expect(bar.getAnimations()[0]).toBe(active);
		expect(active.playState).toBe('running');
	});

	it('rebases horizontal scrolling without cloning on each event or interrupting travel', async () => {
		const host = document.createElement('div');
		host.style.cssText = 'width: 150px; height: 400px; overflow: auto';
		const item = document.createElement('div');
		item.dataset.giftItem = '';
		item.dataset.giftId = 'scrolling';
		item.style.cssText = 'width: 300px; height: 80px';
		host.append(item);
		document.body.append(host);
		containers.push(host);
		const coordinator = createGiftCollectionMotion(host, () => false);
		coordinators.push(coordinator);
		coordinator.afterUpdate();
		await settled();
		coordinator.beforeUpdate();
		item.style.marginTop = '150px';
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(item.getAnimations()).toHaveLength(1));
		const animation = item.getAnimations()[0]!;
		const cloneSpy = vi.spyOn(item, 'cloneNode');
		for (const left of [10, 20, 30]) {
			host.scrollLeft = left;
			host.dispatchEvent(new Event('scroll'));
		}
		expect(cloneSpy).not.toHaveBeenCalled();
		expect(item.getAnimations()[0]).toBe(animation);
		expect(animation.playState).toBe('running');
	});

	it('retains the real source-only exit through the first resize observer callback', async () => {
		const host = document.createElement('div');
		const item = document.createElement('div');
		item.dataset.giftItem = '';
		item.dataset.giftId = 'exiting';
		item.style.cssText = 'width: 100px; height: 80px';
		host.append(item);
		document.body.append(host);
		containers.push(host);
		const coordinator = createGiftCollectionMotion(host, () => false);
		coordinators.push(coordinator);
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		item.remove();
		coordinator.afterUpdate();
		await vi.waitFor(() =>
			expect(document.querySelector('body > [aria-hidden="true"]')).not.toBeNull(),
		);
		const retained = document.querySelector<HTMLElement>('body > [aria-hidden="true"]')!;
		const active = retained.getAnimations()[0]!;
		await settled();
		expect(retained.isConnected).toBe(true);
		expect(retained.getAnimations()[0]).toBe(active);
	});

	it('discards drop overrides even when reduced motion skips their settlement', async () => {
		let reduced = true;
		const { host, coordinator, animations } = setup(() => reduced);
		const position = { x: 10, y: 10 };
		const source = gift(host, 'a', position);
		coordinator.afterUpdate();
		source.dispatchEvent(
			new CustomEvent('gift-motion-drop', {
				bubbles: true,
				detail: {
					giftId: 'a',
					rectangle: { left: 10, top: 410, width: 100, height: 80 },
				},
			}),
		);
		await settled();
		expect(animations).toHaveLength(0);
		reduced = false;
		coordinator.beforeUpdate();
		position.y = 100;
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		expect(animations[0]?.frames[0]?.transform).toBe('translate(0px, -90px)');
	});

	it('measures no gift while scrolling and adds gifts scrolled into view once the scroll ends', async () => {
		const { host, coordinator, animations } = setup();
		const visible = gift(host, 'visible', { x: 10, y: 10 });
		const latePosition = { x: 10, y: window.innerHeight + 500 };
		const late = gift(host, 'late', latePosition);
		coordinator.afterUpdate();
		await settled();
		await settled();
		const visibleReads = vi.spyOn(visible, 'getBoundingClientRect');
		const visibleClones = vi.spyOn(visible, 'cloneNode');
		latePosition.y = 100;
		for (let event = 0; event < 3; event++) {
			document.dispatchEvent(new Event('scroll'));
		}
		expect(visibleReads, 'a scroll event measured gifts').not.toHaveBeenCalled();

		document.dispatchEvent(new Event('scrollend'));
		expect(visibleReads, 'the scroll end did not measure').toHaveBeenCalled();
		expect(visibleClones, 'the scroll end cloned a known gift again').not.toHaveBeenCalled();
		coordinator.beforeUpdate();
		latePosition.y = 300;
		coordinator.afterUpdate();
		await vi.waitFor(() =>
			expect(animations.map((animation) => animation.element)).toContain(late),
		);
		expect(
			animations.find((animation) => animation.element === late)?.frames[0]?.transform,
		).toBe('translate(0px, -200px)');
	});

	it('ends a scroll after a quiet period in browsers without scrollend', async () => {
		let owner: object | null = window;
		while (owner !== null && !Object.hasOwn(owner, 'onscrollend')) {
			owner = Object.getPrototypeOf(owner) as object | null;
		}
		const descriptor =
			owner === null ? undefined : Object.getOwnPropertyDescriptor(owner, 'onscrollend');
		if (owner !== null) {
			Reflect.deleteProperty(owner, 'onscrollend');
		}
		try {
			const { host, coordinator } = setup();
			const visible = gift(host, 'visible', { x: 10, y: 10 });
			coordinator.afterUpdate();
			await settled();
			await settled();
			const visibleReads = vi.spyOn(visible, 'getBoundingClientRect');
			for (let event = 0; event < 3; event++) {
				document.dispatchEvent(new Event('scroll'));
				await new Promise((resolve) => setTimeout(resolve, 20));
			}
			expect(visibleReads, 'measured before the scroll went quiet').not.toHaveBeenCalled();
			await vi.waitFor(() => expect(visibleReads).toHaveBeenCalled(), { timeout: 2000 });
		} finally {
			if (owner !== null && descriptor !== undefined) {
				Object.defineProperty(owner, 'onscrollend', descriptor);
			}
		}
	});

	it('moves every on-screen gift of a long list without hit-testing the page', async () => {
		const { host, coordinator, animations } = setup();
		const rowHeight = 100;
		const positions = Array.from({ length: 120 }, (_, index) => ({
			x: 10,
			y: (index - 60) * rowHeight,
		}));
		positions.forEach((position, index) => gift(host, `gift-${index}`, position));
		const hitTests = vi.spyOn(document, 'elementsFromPoint');
		coordinator.afterUpdate();
		coordinator.beforeUpdate();
		for (const position of positions) {
			position.y += rowHeight / 2;
		}
		coordinator.afterUpdate();
		const onScreen = (top: number) => top + 80 > 0 && top < window.innerHeight;
		const stayedOnScreen = positions.flatMap((position, index) =>
			onScreen(position.y) && onScreen(position.y - rowHeight / 2) ? [`gift-${index}`] : [],
		);
		await vi.waitFor(() =>
			expect(animations.length).toBeGreaterThanOrEqual(stayedOnScreen.length),
		);
		const travel = new Map(
			animations.map((animation) => [
				(animation.element as HTMLElement).dataset.giftId,
				animation.frames[0]?.transform,
			]),
		);
		expect(
			stayedOnScreen.filter((id) => travel.get(id) !== `translate(0px, -${rowHeight / 2}px)`),
		).toEqual([]);
		expect(hitTests).not.toHaveBeenCalled();
	});

	it('settles again only when an observed gift really resizes', async () => {
		const { host, coordinator } = setup();
		gift(host, 'a', { x: 10, y: 10 });
		coordinator.afterUpdate();
		await settled();
		await settled();
		coordinator.beforeUpdate();
		const added = gift(host, 'b', { x: 10, y: 110 });
		const cloneSpy = vi.spyOn(added, 'cloneNode');
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(cloneSpy).toHaveBeenCalledTimes(1));
		await settled();
		await settled();
		expect(cloneSpy, 'the first resize notification settled again').toHaveBeenCalledTimes(1);

		added.style.height = '200px';
		await vi.waitFor(() =>
			expect(cloneSpy, 'a real resize did not settle').toHaveBeenCalledTimes(2),
		);
	});

	it('continues from the rendered position even when descendants patch before the pre-update hook', async () => {
		const host = document.createElement('div');
		host.style.cssText = 'position: fixed; left: 10px; top: 10px; width: 150px; height: 600px';
		const item = document.createElement('div');
		item.dataset.giftItem = '';
		item.dataset.giftId = 'interrupted';
		item.style.cssText = 'position: absolute; top: 10px; width: 100px; height: 80px';
		host.append(item);
		document.body.append(host);
		containers.push(host);
		const animationSpy = vi.spyOn(HTMLElement.prototype, 'animate');
		const coordinator = createGiftCollectionMotion(host, () => false);
		coordinators.push(coordinator);
		coordinator.afterUpdate();
		item.style.top = '310px';
		coordinator.beforeUpdate();
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animationSpy).toHaveBeenCalledTimes(1));
		const first = item.getAnimations()[0]!;
		first.pause();
		first.currentTime = 100;
		const renderedBefore = item.getBoundingClientRect().top;
		item.style.top = '410px';
		coordinator.beforeUpdate();
		coordinator.afterUpdate();
		await vi.waitFor(() => expect(animationSpy).toHaveBeenCalledTimes(2));
		const second = item.getAnimations()[0]!;
		second.pause();
		second.currentTime = 0;
		expectPixelsNear(item.getBoundingClientRect().top, renderedBefore);
		expect(first.playState).toBe('idle');
	});
});
