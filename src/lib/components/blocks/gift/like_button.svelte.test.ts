import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { SvelteMap } from 'svelte/reactivity';
import * as m from '$lib/paraglide/messages.js';

const mocks = vi.hoisted(() => ({
	useLikes: vi.fn(),
	toggleLike: vi.fn(),
}));

vi.mock('$lib/modules/likes/likes.context.svelte.js', () => ({
	useLikes: mocks.useLikes,
}));

vi.mock('$lib/modules/likes/likes.remote.js', () => ({
	toggleLike: mocks.toggleLike,
}));

const { default: LikeButton } = await import('./LikeButton.svelte');

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function likesContext(initiallyLiked = false) {
	const overrides = new SvelteMap<string, boolean>();
	const revertToggle = vi.fn((giftId: string, wasLiked: boolean) => {
		overrides.set(giftId, wasLiked);
	});
	const context = {
		isLiked: (giftId: string) => overrides.get(giftId) ?? initiallyLiked,
		optimisticToggle: vi.fn((giftId: string) => {
			const next = !(overrides.get(giftId) ?? initiallyLiked);
			overrides.set(giftId, next);
			return next;
		}),
		revertToggle,
		isAuthenticated: () => true,
		requireAuth: vi.fn(),
		toggleLike: mocks.toggleLike,
	};
	mocks.useLikes.mockReturnValue(context);
	return context;
}

function animation() {
	return {
		cancel: vi.fn(),
		finished: Promise.resolve(),
	} as unknown as Animation;
}

function mockReducedMotion(matches: boolean) {
	vi.spyOn(window, 'matchMedia').mockReturnValue({ matches } as MediaQueryList);
}

function mockElementAnimations(heartAnimation = animation(), countAnimation = animation()) {
	return vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
		this: HTMLElement,
	) {
		return this.dataset.likeHeart === undefined ? countAnimation : heartAnimation;
	});
}

async function renderLikeButton(likeCount = 4) {
	return render(LikeButton, {
		giftId: 'gift-1',
		giftName: 'Stolní lampa',
		likeCount,
	});
}

beforeEach(() => {
	mocks.useLikes.mockReset();
	mocks.toggleLike.mockReset();
	mockReducedMotion(false);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('LikeButton acknowledgement', () => {
	it('fills the heart immediately and plays the approved element-bound pop and count crossfade', async () => {
		likesContext();
		const remote = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValue(remote.promise);
		const heartAnimation = animation();
		const countAnimation = animation();
		await renderLikeButton();
		const animate = mockElementAnimations(heartAnimation, countAnimation);
		const button = page.getByRole('button');

		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(button)
			.toHaveAccessibleName(m.gift_like_remove_aria({ name: 'Stolní lampa' }));
		await expect.element(button).toHaveTextContent('5');
		expect(animate.mock.contexts[0]).toBe(document.querySelector('[data-like-heart]'));
		expect(animate.mock.calls[0]).toEqual([
			[{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
			{ duration: 160 },
		]);
		expect(animate.mock.contexts[1]).toBe(document.querySelector('button > span:last-child'));
		expect(animate.mock.calls[1]).toEqual([
			[{ opacity: 0 }, { opacity: 1 }],
			{ duration: 140 },
		]);
	});

	it('replaces the optimistic count with the authoritative remote count', async () => {
		likesContext();
		mocks.toggleLike.mockResolvedValue({ liked: true, likeCount: 9 });
		const screen = await renderLikeButton();
		mockElementAnimations();

		await page.getByRole('button').click();

		await expect.element(page.getByRole('button')).toHaveTextContent('9');
		await screen.unmount();
	});

	it('cancels stale motion and ignores an older response after a rapid double click', async () => {
		likesContext();
		const first = deferred<{ liked: boolean; likeCount: number }>();
		const second = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const pop = animation();
		const crossfade = animation();
		await renderLikeButton();
		mockElementAnimations(pop, crossfade);
		const button = page.getByRole('button');

		await button.click();
		await button.click();
		second.resolve({ liked: false, likeCount: 4 });
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveTextContent('4');
		first.resolve({ liked: true, likeCount: 99 });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.element().textContent).toContain('4');
		expect(pop.cancel).toHaveBeenCalledOnce();
		expect(crossfade.cancel).toHaveBeenCalledOnce();
	});

	it('cancels acknowledgement motion and rolls back state and count when persistence fails', async () => {
		const context = likesContext();
		const remote = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValue(remote.promise);
		const pop = animation();
		const crossfade = animation();
		await renderLikeButton();
		mockElementAnimations(pop, crossfade);
		const button = page.getByRole('button');

		await button.click();
		remote.reject(new Error('remote failed'));

		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveTextContent('4');
		expect(context.revertToggle).toHaveBeenCalledWith('gift-1', false);
		expect(pop.cancel).toHaveBeenCalledOnce();
		expect(crossfade.cancel).toHaveBeenCalledOnce();
	});

	it('cancels element-bound animations when the surface is torn down', async () => {
		likesContext();
		mocks.toggleLike.mockReturnValue(deferred<{ liked: boolean; likeCount: number }>().promise);
		const pop = animation();
		const crossfade = animation();
		const screen = await renderLikeButton();
		mockElementAnimations(pop, crossfade);

		await page.getByRole('button').click();
		await screen.unmount();

		expect(pop.cancel).toHaveBeenCalledOnce();
		expect(crossfade.cancel).toHaveBeenCalledOnce();
	});

	it('updates immediately without transform animation when reduced motion is preferred', async () => {
		likesContext();
		mockReducedMotion(true);
		mocks.toggleLike.mockResolvedValue({ liked: true, likeCount: 5 });
		await renderLikeButton();
		const animate = mockElementAnimations();
		const button = page.getByRole('button');

		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect.element(button).toHaveTextContent('5');
		expect(animate).not.toHaveBeenCalled();
	});
});
