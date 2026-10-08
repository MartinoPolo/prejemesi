import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import GiftCategoryBadge from './GiftCategoryBadge.svelte';
import GiftPriorityBadge from './GiftPriorityBadge.svelte';

const { expectPixelsAtMost } = createPixelAssertions(expect);

const SHARED_BADGE_RADIUS = '12px';
const SHARED_BADGE_BORDER_WIDTH = '2px';

const hosts: HTMLElement[] = [];

function createHost(width: number): HTMLElement {
	const host = document.createElement('div');
	host.style.width = `${width}px`;
	document.body.append(host);
	hosts.push(host);
	return host;
}

function inkColor(): string {
	const probe = document.createElement('span');
	probe.className = 'border-2 border-ink';
	document.body.append(probe);
	const color = getComputedStyle(probe).borderTopColor;
	probe.remove();
	return color;
}

function lineCount(element: HTMLElement): number {
	const style = getComputedStyle(element);
	const contentHeight =
		element.clientHeight -
		Number.parseFloat(style.paddingTop) -
		Number.parseFloat(style.paddingBottom);
	return Math.round(contentHeight / Number.parseFloat(style.lineHeight));
}

function category(label: string) {
	return {
		id: 'category-test',
		presetKey: null,
		customLabel: label,
		color: '#0369A1',
		sortOrder: 0,
	};
}

function expectFlatSharedShape(badge: HTMLElement) {
	const style = getComputedStyle(badge);
	expect(style.boxShadow).toBe('none');
	expect(style.rotate).toBe('none');
	expect(style.transform).toBe('none');
	expect(style.borderTopLeftRadius).toBe(SHARED_BADGE_RADIUS);
	expect(style.borderBottomRightRadius).toBe(SHARED_BADGE_RADIUS);
	expect(style.borderTopWidth).toBe(SHARED_BADGE_BORDER_WIDTH);
	expect(style.borderTopStyle).toBe('solid');
	expect(style.borderTopColor).toBe(inkColor());
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('Gift information badges (issue #442)', () => {
	it('renders the category badge flat with the shared radius and ink border', async () => {
		const host = createHost(320);
		await render(GiftCategoryBadge, { category: category('Sport') }, { baseElement: host });
		const badge = host.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;

		expectFlatSharedShape(badge);
		expect(lineCount(badge)).toBe(1);
	});

	it('renders the priority badge outlined, flat and tinted with the shared shape', async () => {
		const host = createHost(320);
		await render(GiftPriorityBadge, { priorityLabel: 'Vysoka' }, { baseElement: host });
		const badge = host.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!;

		expectFlatSharedShape(badge);
		const cardProbe = document.createElement('span');
		cardProbe.className = 'bg-card';
		host.append(cardProbe);
		expect(getComputedStyle(badge).backgroundColor).not.toBe(
			getComputedStyle(cardProbe).backgroundColor,
		);
	});

	it('clamps a very long category to two lines while exposing the full label', async () => {
		const label = 'Sportovní vybavení pro dlouhé zimní výpravy celé rodiny do hor a na sníh';
		const host = createHost(160);
		await render(GiftCategoryBadge, { category: category(label) }, { baseElement: host });
		const badge = host.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;
		const style = getComputedStyle(badge);

		expect(lineCount(badge)).toBe(2);
		expect(style.webkitLineClamp).toBe('2');
		expect(style.overflowWrap).toBe('break-word');
		expect(badge.title).toBe(label);
		expect(badge.closest('[aria-hidden="true"]')).toBeNull();
		expect(badge.textContent?.trim()).toBe(label);
	});

	it('wraps a single word longer than the badge without overflowing', async () => {
		const label = 'Nejneobhospodařovávatelnějšími';
		const host = createHost(110);
		await render(GiftCategoryBadge, { category: category(label) }, { baseElement: host });
		const badge = host.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;

		expectPixelsAtMost(badge.getBoundingClientRect().right, host.getBoundingClientRect().right);
		expectPixelsAtMost(badge.scrollWidth, badge.clientWidth);
		expect(lineCount(badge)).toBeLessThanOrEqual(2);
	});
});
