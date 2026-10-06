import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
import NavDropdown from './NavDropdown.svelte';
import type { NavDropdownItem } from './navbar_types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { expectPixelsNear } = createPixelAssertions(expect);
const NAV_SIDE_OFFSET = 8;
const LONGER_THAN_CLOSE_GRACE_MS = 300;

const sharedList: NavDropdownItem = {
	name: 'Vánoce 2026',
	meta: '8 přání',
	href: '#vanoce',
	emoji: '🎄',
	imageUrl: null,
	imageFrame: wishlistSlotToFrameProps(null, 'thumbnail'),
	badgeLabel: 'Sdíleno',
	badgeVariant: 'shared',
};

afterEach(() => {
	delete document.documentElement.dataset.depth;
});

async function openMenu(): Promise<HTMLElement> {
	await render(NavDropdown, {
		title: 'Seznamy',
		viewAllHref: '#all',
		items: [sharedList],
		defaultOpen: true,
	});
	const menu = page.getByRole('menu');
	await expect.element(menu).toBeVisible();
	const element = menu.element() as HTMLElement;
	await Promise.all(
		element
			.getAnimations({ subtree: true })
			.filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
			.map((animation) => animation.finished),
	);
	return element;
}

function navTrigger(): HTMLElement {
	return document.querySelector<HTMLElement>('a.nav-link')!;
}

function dispatchMousePointer(
	target: EventTarget,
	type: 'pointerenter' | 'pointerleave' | 'pointermove',
	clientX: number,
	clientY: number,
): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: type === 'pointermove',
			pointerType: 'mouse',
			clientX,
			clientY,
		}),
	);
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function backgroundOf(className: string, scope: HTMLElement): string {
	const probe = document.createElement('span');
	probe.className = className;
	scope.append(probe);
	const color = getComputedStyle(probe).backgroundColor;
	probe.remove();
	return color;
}

describe('NavDropdown (issue #442)', () => {
	it('opens at exactly its standard offset at Black depth because the trigger casts no shadow', async () => {
		await page.viewport(1000, 700);
		document.documentElement.dataset.depth = 'black';
		const menu = await openMenu();
		const trigger = navTrigger();

		expectPixelsNear(
			menu.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
			NAV_SIDE_OFFSET,
		);
	});

	it.each(['soft', 'ink', 'black'] as const)(
		'stays open while a mouse crosses the gap into the menu at %s depth',
		async (depth) => {
			await page.viewport(1000, 700);
			document.documentElement.dataset.depth = depth;
			const menu = await openMenu();
			const trigger = navTrigger();
			const triggerRect = trigger.getBoundingClientRect();
			const menuTop = menu.getBoundingClientRect().top;
			const gapX = triggerRect.left + triggerRect.width / 2;

			dispatchMousePointer(trigger, 'pointerleave', gapX, triggerRect.bottom);
			dispatchMousePointer(document.body, 'pointermove', gapX, triggerRect.bottom + 1);
			await wait(LONGER_THAN_CLOSE_GRACE_MS);
			dispatchMousePointer(document.body, 'pointermove', gapX, menuTop - 1);
			await wait(LONGER_THAN_CLOSE_GRACE_MS);
			dispatchMousePointer(menu, 'pointerenter', gapX, menuTop + 1);
			await wait(LONGER_THAN_CLOSE_GRACE_MS);

			expect(trigger.getAttribute('aria-expanded')).toBe('true');
			await expect.element(page.getByRole('menu')).toBeVisible();
		},
	);

	it('closes after the grace once the mouse leaves the gap away from both surfaces', async () => {
		await page.viewport(1000, 700);
		const menu = await openMenu();
		const trigger = navTrigger();
		const triggerRect = trigger.getBoundingClientRect();
		const gapX = triggerRect.left + triggerRect.width / 2;

		dispatchMousePointer(trigger, 'pointerleave', gapX, triggerRect.bottom);
		dispatchMousePointer(document.body, 'pointermove', gapX, triggerRect.bottom + 1);
		await wait(LONGER_THAN_CLOSE_GRACE_MS);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');

		dispatchMousePointer(
			document.body,
			'pointermove',
			menu.getBoundingClientRect().right + 200,
			triggerRect.bottom + 1,
		);

		await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('closes after the grace once the mouse leaves the document from the gap', async () => {
		await page.viewport(1000, 700);
		await openMenu();
		const trigger = navTrigger();
		const triggerRect = trigger.getBoundingClientRect();
		const gapX = triggerRect.left + triggerRect.width / 2;

		dispatchMousePointer(trigger, 'pointerleave', gapX, triggerRect.bottom);
		dispatchMousePointer(document.body, 'pointermove', gapX, triggerRect.bottom + 1);
		await wait(LONGER_THAN_CLOSE_GRACE_MS);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');

		dispatchMousePointer(
			document.documentElement,
			'pointerleave',
			gapX,
			triggerRect.bottom + 1,
		);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');

		await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('keeps the subtle status badge visible on the focused row with the card fill', async () => {
		const menu = await openMenu();
		const row = menu.querySelector<HTMLElement>('[role="menuitem"]')!;
		const badge = row.querySelector<HTMLElement>('[data-slot="badge"]')!;
		const restingBadgeBackground = getComputedStyle(badge).backgroundColor;

		row.focus();

		await expect
			.poll(() => getComputedStyle(badge).backgroundColor)
			.toBe(backgroundOf('bg-card', menu));
		expect(restingBadgeBackground).not.toBe(backgroundOf('bg-card', menu));
		expect(getComputedStyle(row).backgroundColor).not.toBe(
			getComputedStyle(badge).backgroundColor,
		);
	});
});
