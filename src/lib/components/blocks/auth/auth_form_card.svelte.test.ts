import '../../../../app.css';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BeforeNavigate } from '@sveltejs/kit';
import {
	isFacePaintHidden,
	isIndicatorOnFace,
	isIndicatorOver,
	isSlideRunning,
	nextFrames,
	recordSlides,
	resolveCssValue,
	selectionIndicatorOf,
} from '../../../../../tests/helpers/selection-slide-assertions.mjs';
import AuthFormCard from './AuthFormCard.svelte';

const navigation = vi.hoisted(() => ({
	callbacks: [] as Array<(navigation: BeforeNavigate) => void>,
	completeAll: [] as Array<() => void>,
}));

vi.mock('$app/navigation', () => ({
	beforeNavigate: (callback: (navigation: BeforeNavigate) => void) => {
		navigation.callbacks.push(callback);
	},
}));

const LOGIN_HREF = '/login?callbackUrl=%2Fmy-lists';
const REGISTER_HREF = '/register?callbackUrl=%2Fmy-lists';

async function renderCard(activePage: 'login' | 'register') {
	navigation.callbacks.length = 0;
	const screen = await render(AuthFormCard, {
		title: 'Title',
		subtitle: 'Subtitle',
		tabs: [
			{ label: 'Login', href: LOGIN_HREF, active: activePage === 'login' },
			{ label: 'Register', href: REGISTER_HREF, active: activePage === 'register' },
		],
		children: createRawSnippet(() => ({ render: () => '<p>Form</p>' })),
	});
	const tabList = screen.getByRole('navigation').element() as HTMLElement;
	const links = Array.from(tabList.querySelectorAll<HTMLElement>('a'));
	return { screen, tabList, links };
}

/** Starts a client navigation that stays pending until the test finishes. */
function navigateTo(href: string) {
	const complete = new Promise<void>((resolve) => navigation.completeAll.push(resolve));
	for (const callback of navigation.callbacks) {
		callback({
			from: null,
			to: { url: new URL(href, window.location.href) },
			type: 'link',
			willUnload: false,
			complete,
			cancel: vi.fn(),
		} as unknown as BeforeNavigate);
	}
}

afterEach(async () => {
	// Completing navigations discards any tab transition a test left unconsumed.
	for (const complete of navigation.completeAll.splice(0)) {
		complete();
	}
	await Promise.resolve();
});

describe('AuthFormCard tab slide', () => {
	it('places the shipped selected tab face on the current tab without animating on a fresh load', async () => {
		const { screen, tabList, links } = await renderCard('register');
		await nextFrames();
		const context = tabList.parentElement!;
		const indicatorStyle = getComputedStyle(selectionIndicatorOf(tabList));

		expect(isIndicatorOnFace(tabList, links[1])).toBe(true);
		expect(isSlideRunning(selectionIndicatorOf(tabList))).toBe(false);
		expect(indicatorStyle.backgroundColor).toBe(
			resolveCssValue(context, 'background-color', 'var(--card)'),
		);
		expect(indicatorStyle.borderTopWidth).toBe('2px');
		expect(indicatorStyle.borderTopStyle).toBe('solid');
		expect(indicatorStyle.borderTopColor).toBe(resolveCssValue(context, 'color', 'var(--ink)'));
		expect(indicatorStyle.boxShadow).toBe(
			resolveCssValue(context, 'box-shadow', 'var(--elevation-compact)'),
		);
		expect(indicatorStyle.borderTopLeftRadius).toBe('8px');
		expect(isFacePaintHidden(links[1])).toBe(true);
		await screen.unmount();
	});

	it('slides the selected face from the previous tab after navigating between tabs', async () => {
		const login = await renderCard('login');
		navigateTo(REGISTER_HREF);
		await login.screen.unmount();

		const { screen, tabList, links } = await renderCard('register');
		const slides = recordSlides(selectionIndicatorOf(tabList));

		expect(isIndicatorOver(tabList, links[0])).toBe(true);
		await expect.poll(() => isIndicatorOnFace(tabList, links[1])).toBe(true);
		expect(slides.hasSlid()).toBe(true);
		slides.stop();
		await screen.unmount();
	});

	it('hides the destination tab face from its first frame instead of fading it out', async () => {
		const login = await renderCard('login');
		navigateTo(REGISTER_HREF);
		await login.screen.unmount();

		const { screen, links } = await renderCard('register');
		const destinationFace = links[1];

		for (let frame = 0; frame < 3; frame += 1) {
			expect(isFacePaintHidden(destinationFace)).toBe(true);
			const decorationTransitions = destinationFace
				.getAnimations()
				.filter(
					(animation) =>
						animation instanceof CSSTransition &&
						animation.transitionProperty !== 'color',
				);
			expect(decorationTransitions).toHaveLength(0);
			await nextFrames(1);
		}
		await screen.unmount();
	});

	it('does not slide when the navigation leaves the auth tabs', async () => {
		const login = await renderCard('login');
		navigateTo('/my-lists');
		await login.screen.unmount();

		const { screen, tabList, links } = await renderCard('register');
		await nextFrames();

		expect(isIndicatorOnFace(tabList, links[1])).toBe(true);
		expect(isSlideRunning(selectionIndicatorOf(tabList))).toBe(false);
		await screen.unmount();
	});
});
