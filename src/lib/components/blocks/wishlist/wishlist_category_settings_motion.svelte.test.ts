import { render } from 'vitest-browser-svelte';
import { createSubscriber } from 'svelte/reactivity';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';

const remote = vi.hoisted(() => ({
	query: null as unknown as { current: ManagedGiftCategory[] },
	reorder: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	getGiftCategories: vi.fn(() => remote.query),
	createCustomGiftCategoryCommand: vi.fn(),
	deleteCustomGiftCategoryCommand: vi.fn(),
	renameCustomGiftCategoryCommand: vi.fn(),
	reorderGiftCategories: remote.reorder,
	togglePresetGiftCategory: vi.fn(),
}));

import WishlistCategorySettings, {
	createCategorySettingsMotion,
} from './WishlistCategorySettings.svelte';

const RECT = {
	left: 20,
	top: 30,
	right: 220,
	bottom: 110,
	width: 200,
	height: 80,
	x: 20,
	y: 30,
	toJSON: () => ({}),
} satisfies DOMRect;

function row(id: string, rectangle: DOMRect = RECT) {
	const element = document.createElement('div');
	element.dataset.categoryRow = '';
	element.dataset.categoryId = id;
	element.innerHTML = `<label id="label-${id}" for="input-${id}">Category</label><input id="input-${id}">`;
	document.body.append(element);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rectangle);
	return element;
}

function animation() {
	return {
		finished: Promise.resolve(),
		cancel: vi.fn(),
		addEventListener: vi.fn(),
	} as unknown as Animation;
}

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: { finished, cancel: vi.fn(), addEventListener: vi.fn() } as unknown as Animation,
		finish,
	};
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('wishlist category settings motion', () => {
	it('FLIPs only continuously present visible database identities after reorder', async () => {
		const stable = row('category-db-1');
		const removed = row('category-db-2', { ...RECT, top: 130, bottom: 210, y: 130 });
		row('category-db-hidden', {
			...RECT,
			top: 230,
			bottom: 230,
			y: 230,
			height: 0,
		});
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation());
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(document.body);

		removed.remove();
		vi.mocked(stable.getBoundingClientRect).mockReturnValue({
			...RECT,
			top: 150,
			bottom: 230,
			y: 150,
		});
		row('category-db-inserted', { ...RECT, top: 250, bottom: 330, y: 250 });
		await motion.play(snapshot, document.body);

		expect(animate).toHaveBeenCalledOnce();
		expect(animate.mock.contexts[0]).toBe(stable);
		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'translate(0px, -120px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		motion.destroy();
	});

	it('starts the database-ID reorder settlement only after command success and refreshed query state', async () => {
		const first: ManagedGiftCategory = {
			id: 'category-db-1',
			presetKey: null,
			customLabel: 'First',
			sortOrder: 0,
			usedCount: 0,
		};
		const second: ManagedGiftCategory = {
			id: 'category-db-2',
			presetKey: null,
			customLabel: 'Second',
			sortOrder: 1,
			usedCount: 0,
		};
		let current = [first, second];
		let refresh = () => {};
		const subscribe = createSubscriber((update) => {
			refresh = update;
			return () => {};
		});
		remote.query = {
			get current() {
				subscribe();
				return current;
			},
		};
		let succeed!: () => void;
		remote.reorder.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					succeed = () => {
						current = [second, first];
						refresh();
						resolve();
					};
				}),
		);
		const screen = render(WishlistCategorySettings, {
			wishlistId: 'wishlist-db-1',
			isShared: false,
		});
		const firstRow = document.querySelector<HTMLElement>('[data-category-id="category-db-1"]')!;
		const secondRow = document.querySelector<HTMLElement>(
			'[data-category-id="category-db-2"]',
		)!;
		let refreshed = false;
		vi.spyOn(firstRow, 'getBoundingClientRect').mockImplementation(() => ({
			...RECT,
			top: refreshed ? 130 : 30,
			bottom: refreshed ? 210 : 110,
			y: refreshed ? 130 : 30,
		}));
		vi.spyOn(secondRow, 'getBoundingClientRect').mockImplementation(() => ({
			...RECT,
			top: refreshed ? 30 : 130,
			bottom: refreshed ? 110 : 210,
			y: refreshed ? 30 : 130,
		}));
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation());

		await screen.getByRole('button', { name: m.move_down() }).all()[0].click();
		expect(remote.reorder).toHaveBeenCalledWith({
			wishlistId: 'wishlist-db-1',
			categoryIds: ['category-db-2', 'category-db-1'],
		});
		expect(animate).not.toHaveBeenCalled();

		refreshed = true;
		succeed();
		await expect.poll(() => animate.mock.calls.length).toBe(2);
		expect(animate.mock.contexts).toEqual([secondRow, firstRow]);
	});

	it('retains an inert ID-stripped deleted row while its local exit and survivor settlement run', async () => {
		const deleted = row('category-db-deleted');
		const survivor = row('category-db-survivor', {
			...RECT,
			top: 130,
			bottom: 210,
			y: 130,
		});
		const exit = deferredAnimation();
		const settle = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(settle.animation)
			.mockReturnValueOnce(exit.animation);
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(document.body, 'category-db-deleted');

		expect(snapshot.retainedVisual?.isConnected).toBe(false);
		deleted.remove();
		vi.mocked(survivor.getBoundingClientRect).mockReturnValue(RECT);
		const playing = motion.play(snapshot, document.body);

		const clone = snapshot.retainedVisual!;
		expect(clone.isConnected).toBe(true);
		expect(clone.inert).toBe(true);
		expect(clone.getAttribute('aria-hidden')).toBe('true');
		expect(clone.querySelectorAll('[id]')).toHaveLength(0);
		expect(animate.mock.calls[0]).toEqual([
			[{ transform: 'translate(0px, 100px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		]);
		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 1, transform: 'scaleY(1)' },
				{ opacity: 0, transform: 'scaleY(0)' },
			],
			{ duration: 440, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		exit.finish();
		settle.finish();
		await playing;
		expect(clone.isConnected).toBe(false);
		expect(clone.getAttribute('style')).toBeNull();
		motion.destroy();
	});

	it('discards failed commands and cancels stale runs without leaving clones or animations', () => {
		const source = row('category-db-1');
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const failed = motion.capture(document.body, 'category-db-1');
		motion.discard(failed);

		expect(failed.retainedVisual?.isConnected).toBe(false);
		expect(failed.retainedVisual?.getAttribute('style')).toBeNull();

		const active = motion.capture(document.body, 'category-db-1');
		source.remove();
		void motion.play(active, document.body);
		motion.cancel();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(active.retainedVisual?.isConnected).toBe(false);
		expect(active.retainedVisual?.getAttribute('style')).toBeNull();
		motion.destroy();
	});

	it('applies the final reduced-motion state without transforms or retained visuals', async () => {
		const source = row('category-db-1');
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const motion = createCategorySettingsMotion({ reducedMotion: () => true });
		const snapshot = motion.capture(document.body, 'category-db-1');
		source.remove();

		await motion.play(snapshot, document.body);

		expect(snapshot.retainedVisual).toBeNull();
		expect(animate).not.toHaveBeenCalled();
		expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
		motion.destroy();
	});
});
