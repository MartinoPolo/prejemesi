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

function backgroundOf(className: string, scope: HTMLElement): string {
	const probe = document.createElement('span');
	probe.className = className;
	scope.append(probe);
	const color = getComputedStyle(probe).backgroundColor;
	probe.remove();
	return color;
}

describe('NavDropdown (issue #442)', () => {
	it('opens at its standard offset plus the Black shadow clearance', async () => {
		await page.viewport(1000, 700);
		document.documentElement.dataset.depth = 'black';
		const menu = await openMenu();
		const trigger = document.querySelector<HTMLElement>('a.nav-link')!;
		const shadowOffset = Number.parseFloat(
			getComputedStyle(menu).getPropertyValue('--elevation-ordinary-offset'),
		);

		expect(shadowOffset).toBeGreaterThan(0);
		expectPixelsNear(
			menu.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
			NAV_SIDE_OFFSET + shadowOffset,
		);
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
