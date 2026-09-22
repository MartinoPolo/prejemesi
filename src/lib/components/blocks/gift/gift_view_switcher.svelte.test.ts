import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { GIFT_VIEW_MODES } from '$lib/modules/gifts/types.js';
import GiftViewSwitcher from './GiftViewSwitcher.svelte';

function hasVisibleBoxShadow(element: Element): boolean {
	const boxShadow = getComputedStyle(element).boxShadow;
	if (boxShadow === 'none') {
		return false;
	}
	const alphas = Array.from(boxShadow.matchAll(/rgba\([^)]*, ([\d.]+)\)/g), (match) =>
		Number(match[1]),
	);
	return alphas.length === 0 || alphas.some((alpha) => alpha > 0);
}

function requireElement(element: Element | null): Element {
	if (element === null) {
		throw new TypeError('Expected an element in the rendered switcher');
	}
	return element;
}

function requireHTMLElement(element: Element | null): HTMLElement {
	if (!(element instanceof HTMLElement)) {
		throw new TypeError('Expected an HTML element in the rendered switcher');
	}
	return element;
}

async function renderDefaultCardSwitcher() {
	const screen = await render(GiftViewSwitcher, {
		value: GIFT_VIEW_MODES.card,
		onchange: vi.fn(),
	});
	const group = requireHTMLElement(screen.getByTestId('gift-view-switcher').element());
	const card = requireHTMLElement(
		screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`).element(),
	);
	const list = requireHTMLElement(
		screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).element(),
	);

	return {
		screen,
		group,
		card,
		list,
		cardSurface: requireHTMLElement(card.querySelector('.elevation-surface')),
		listSurface: requireHTMLElement(list.querySelector('.elevation-surface')),
	};
}

async function withRootTokenOverrides(
	overrides: Readonly<Record<`--${string}`, string>>,
	runAssertions: () => Promise<void>,
): Promise<void> {
	const rootStyle = document.documentElement.style;
	const previousProperties = Object.keys(overrides).map((property) => ({
		property,
		value: rootStyle.getPropertyValue(property),
		priority: rootStyle.getPropertyPriority(property),
	}));
	for (const [property, value] of Object.entries(overrides)) {
		rootStyle.setProperty(property, value);
	}

	try {
		await runAssertions();
	} finally {
		for (const { property, value, priority } of previousProperties) {
			rootStyle.setProperty(property, value, priority);
		}
	}
}

function expectSelectedFaceGeometry(
	group: HTMLElement,
	selected: HTMLElement,
	expected: Readonly<{ size: number; backingWidth: number }>,
	backingPosition?: Readonly<{ left: number; right: number }>,
): void {
	const selectedSurface = requireHTMLElement(selected.querySelector('.elevation-surface'));
	const selectedSurfaceBounds = selectedSurface.getBoundingClientRect();
	const selectedBounds = selected.getBoundingClientRect();
	const backingStyle = getComputedStyle(group, '::before');

	expect(selectedSurfaceBounds.width).toBe(expected.size);
	expect(selectedSurfaceBounds.height).toBe(expected.size);
	expect(selectedSurfaceBounds.x + selectedSurfaceBounds.width / 2).toBeCloseTo(
		selectedBounds.x + selectedBounds.width / 2,
		1,
	);
	expect(selectedSurfaceBounds.y + selectedSurfaceBounds.height / 2).toBeCloseTo(
		selectedBounds.y + selectedBounds.height / 2,
		1,
	);
	expect(parseFloat(backingStyle.width)).toBe(expected.backingWidth);
	if (backingPosition) {
		expect(parseFloat(backingStyle.left)).toBe(backingPosition.left);
		expect(parseFloat(backingStyle.right)).toBe(backingPosition.right);
	}
}

describe('GiftViewSwitcher toggle selection (fixes: re-click deselects both items)', () => {
	it('switches mode and fires onchange exactly once when clicking the inactive item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('keeps the active item checked and does not fire onchange when re-clicking it', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		const activeItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		await activeItem.click();

		expect(onchange).not.toHaveBeenCalled();
		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('always has exactly one checked item after re-clicking the active item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.list, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		const cardItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const listItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);
		await expect.element(cardItem).toHaveAttribute('aria-checked', 'false');
		await expect.element(listItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('projects legacy compact mode to exactly one checked card radio', async () => {
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element();

		expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
		await expect
			.element(screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`))
			.toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('leaves legacy compact mode when the projected card radio is clicked', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange,
		});

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`).click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith(GIFT_VIEW_MODES.card);
		await screen.unmount();
	});

	it('moves focus and requests the next selection with arrow navigation', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		(card.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		await expect.element(list).toHaveFocus();
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('does not mutate disabled controls and retains their labels and state', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
			disabled: true,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		await expect.element(card).toHaveAccessibleName('Karta');
		await expect.element(list).toHaveAccessibleName('Seznam');
		await expect.element(card).toBeDisabled();
		await expect.element(list).toBeDisabled();
		await list.click({ force: true });
		expect(onchange).not.toHaveBeenCalled();
		await expect.element(card).toHaveAttribute('aria-checked', 'true');
		await expect.element(list).toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it.each([
		{
			viewportWidth: 390,
			expected: { rootWidth: 79, size: 40, segment: 38, backingWidth: 79 },
			backingPositions: undefined,
		},
		{
			viewportWidth: 800,
			expected: { rootWidth: 67, size: 32, segment: 32, backingWidth: 66 },
			backingPositions: {
				card: { left: 1, right: 0 },
				list: { left: 0, right: 1 },
			},
		},
	])(
		'preserves semantic geometry while painting a flush connected backing and button face at $viewportWidth px',
		async ({ viewportWidth, expected, backingPositions }) => {
			await page.viewport(viewportWidth, 720);
			const { screen, group, card, list } = await renderDefaultCardSwitcher();

			try {
				const trayBounds = group.getBoundingClientRect();
				expect(trayBounds.width).toBe(expected.rootWidth);
				expect(trayBounds.height).toBe(expected.size);
				for (const item of [card, list]) {
					expect(item.getBoundingClientRect().width).toBe(expected.segment);
					expect(item.getBoundingClientRect().height).toBe(expected.segment);
					expect(
						requireElement(item.querySelector('svg')).getBoundingClientRect().width,
					).toBe(16);
					expect(
						requireElement(item.querySelector('svg')).getBoundingClientRect().height,
					).toBe(16);
				}

				expectSelectedFaceGeometry(group, card, expected, backingPositions?.card);
				await list.click();
				expectSelectedFaceGeometry(group, list, expected, backingPositions?.list);
			} finally {
				await screen.unmount();
			}
		},
	);

	it('uses one contextual tray shadow with no frame and only a selected Button face', async () => {
		await withRootTokenOverrides(
			{
				'--accent': 'rgb(11, 22, 33)',
				'--card': 'rgb(44, 55, 66)',
				'--ink': 'rgb(77, 88, 99)',
			},
			async () => {
				const { screen, group, card, list, cardSurface, listSurface } =
					await renderDefaultCardSwitcher();

				try {
					const groupStyle = getComputedStyle(group);
					const cardStyle = getComputedStyle(card);
					const listStyle = getComputedStyle(list);
					const backingStyle = getComputedStyle(group, '::before');

					expect(groupStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
					expect(parseFloat(groupStyle.borderWidth)).toBe(0);
					expect(hasVisibleBoxShadow(group)).toBe(false);
					expect(parseFloat(groupStyle.paddingLeft)).toBe(1);
					expect(groupStyle.paddingLeft).toBe(groupStyle.paddingRight);
					expect(groupStyle.paddingTop).toBe(groupStyle.paddingBottom);
					expect(backingStyle.backgroundColor).toBe('rgb(11, 22, 33)');
					expect(hasVisibleBoxShadow(group)).toBe(false);
					expect(backingStyle.boxShadow).not.toBe('none');
					expect(backingStyle.boxShadow).not.toContain('inset');
					expect(cardStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
					expect(listStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
					expect(parseFloat(cardStyle.borderWidth)).toBe(0);
					expect(parseFloat(listStyle.borderWidth)).toBe(0);
					expect(parseFloat(groupStyle.getPropertyValue('--border-w'))).toBe(2.5);
					const selectedBorderWidth = getComputedStyle(cardSurface).borderWidth;
					expect(parseFloat(selectedBorderWidth)).toBeGreaterThan(0);
					expect(getComputedStyle(cardSurface).borderColor).toBe('rgb(77, 88, 99)');
					expect(getComputedStyle(cardSurface).backgroundColor).toBe('rgb(44, 55, 66)');
					expect(hasVisibleBoxShadow(cardSurface)).toBe(false);
					expect(parseFloat(getComputedStyle(listSurface).borderWidth)).toBe(0);
					expect(getComputedStyle(listSurface).backgroundColor).toBe('rgba(0, 0, 0, 0)');
					expect(cardStyle.outlineStyle).not.toBe('solid');
					expect(listStyle.outlineStyle).not.toBe('solid');
					expect(
						requireElement(card.querySelector('svg')).getBoundingClientRect().y,
					).toBeCloseTo(
						requireElement(list.querySelector('svg')).getBoundingClientRect().y,
						1,
					);

					await list.click();

					expect(parseFloat(getComputedStyle(cardSurface).borderWidth)).toBe(0);
					expect(getComputedStyle(cardSurface).backgroundColor).toBe('rgba(0, 0, 0, 0)');
					expect(getComputedStyle(listSurface).borderWidth).toBe(selectedBorderWidth);
					expect(getComputedStyle(listSurface).backgroundColor).toBe('rgb(44, 55, 66)');
					expect(getComputedStyle(group, '::before').boxShadow).toBe(
						backingStyle.boxShadow,
					);
				} finally {
					await screen.unmount();
				}
			},
		);
	});

	it('keeps the inactive connected surface paint static on hover', async () => {
		await withRootTokenOverrides(
			{
				'--accent': 'rgb(11, 22, 33)',
				'--foreground': 'rgb(44, 55, 66)',
				'--muted-foreground': 'rgb(77, 88, 99)',
			},
			async () => {
				const { screen, listSurface: inactiveSurface } = await renderDefaultCardSwitcher();

				try {
					const restingPaint = {
						backgroundColor: getComputedStyle(inactiveSurface).backgroundColor,
						color: getComputedStyle(inactiveSurface).color,
					};

					expect(restingPaint).toEqual({
						backgroundColor: 'rgba(0, 0, 0, 0)',
						color: 'rgb(77, 88, 99)',
					});
					await userEvent.hover(inactiveSurface);
					expect({
						backgroundColor: getComputedStyle(inactiveSurface).backgroundColor,
						color: getComputedStyle(inactiveSurface).color,
					}).toEqual(restingPaint);
				} finally {
					await screen.unmount();
				}
			},
		);
	});

	it('uses contextual light and dark depth tokens without hover motion', async () => {
		const root = document.documentElement;
		const previousDepth = root.dataset.depth;
		const wasDark = root.classList.contains('dark');
		const { screen, group, card, cardSurface } = await renderDefaultCardSwitcher();
		const contextualPaint = new Set<string>();

		try {
			for (const dark of [false, true]) {
				root.classList.toggle('dark', dark);
				for (const depth of ['soft', 'ink', 'black']) {
					root.dataset.depth = depth;
					contextualPaint.add(
						`${getComputedStyle(group, '::before').boxShadow}|${getComputedStyle(cardSurface).backgroundColor}`,
					);
					expect(getComputedStyle(group, '::before').boxShadow).not.toBe('none');
					expect(hasVisibleBoxShadow(cardSurface)).toBe(false);
				}
			}
			expect(contextualPaint.size).toBeGreaterThan(3);

			const beforeHover = {
				owner: card.getBoundingClientRect().toJSON(),
				surface: cardSurface.getBoundingClientRect().toJSON(),
				shadow: getComputedStyle(group, '::before').boxShadow,
			};
			await userEvent.hover(card);
			expect(card.getBoundingClientRect().toJSON()).toEqual(beforeHover.owner);
			expect(cardSurface.getBoundingClientRect().toJSON()).toEqual(beforeHover.surface);
			expect(getComputedStyle(group, '::before').boxShadow).toBe(beforeHover.shadow);
			expect(getComputedStyle(cardSurface).translate).toBe('0px');
			expect(getComputedStyle(cardSurface).scale).toBe('1');
		} finally {
			await screen.unmount();
			if (previousDepth === undefined) {
				delete root.dataset.depth;
			} else {
				root.dataset.depth = previousDepth;
			}
			root.classList.toggle('dark', wasDark);
		}
	});

	it('keeps the visible focus outline outside the shared tray boundary', async () => {
		const { screen, group, card } = await renderDefaultCardSwitcher();

		try {
			await userEvent.tab();
			await expect
				.element(screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`))
				.toHaveFocus();
			expect(card.matches(':focus-visible')).toBe(true);
			expect(getComputedStyle(group).overflow).toBe('visible');
			expect(getComputedStyle(card).outlineStyle).toBe('solid');
			expect(parseFloat(getComputedStyle(card).outlineWidth)).toBeGreaterThan(0);
			expect(parseFloat(getComputedStyle(card).outlineOffset)).toBeGreaterThan(0);
		} finally {
			await screen.unmount();
		}
	});
});
