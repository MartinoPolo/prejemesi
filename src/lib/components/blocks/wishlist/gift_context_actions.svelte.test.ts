import '../../../../app.css';
import type { ComponentProps } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';
import GiftContextActions from './GiftContextActions.svelte';
import GiftContextActionsTestHost from './GiftContextActionsTestHost.svelte';
import * as m from '$lib/paraglide/messages.js';

const { expectPixelsNear, expectPixelsAtLeast } = createPixelAssertions(expect);

function expectSemanticDangerText(surface: HTMLElement) {
	const tokenProbe = document.createElement('span');
	tokenProbe.style.color = 'var(--status-danger-text)';
	surface.append(tokenProbe);
	const expectedColor = getComputedStyle(tokenProbe).color;
	tokenProbe.remove();
	expect(getComputedStyle(surface).color).toBe(expectedColor);
}

const managerProps = {
	sessionId: 1,
	nativeOpen: false,
	programmaticOpen: true,
	mobile: true,
	name: 'Kolo',
	role: 'recipient' as const,
	primaryUrl: 'https://example.com/kolo',
	readOnly: false,
	received: false,
	priorityLevels: [{ id: 'high', label: 'Vysoká' }],
	categories: [{ id: 'sport', label: 'Sport' }],
	priorityReady: true,
	categoryReady: true,
	priorityLevelId: 'high',
	categoryId: null,
	onclose: vi.fn(),
	oncomplete: vi.fn(),
	onfinish: vi.fn((_policy, callback: () => void) => callback()),
	onedit: vi.fn(),
	onpriority: vi.fn(),
	oncategory: vi.fn(),
	onreceived: vi.fn(),
	onselect: vi.fn(),
};

describe('GiftContextActions desktop ContextMenu', () => {
	it('restores More only after the parent-owned genuine close completion', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'More';
		document.body.append(trigger);
		trigger.focus();
		const oncomplete = vi.fn();
		const screen = await render(GiftContextActionsTestHost, {
			...managerProps,
			oncomplete,
			mobile: false,
			nativeOpen: false,
			programmaticOpen: true,
			desktopAnchor: trigger,
		});
		await expect.element(screen.getByRole('menu')).toBeInTheDocument();
		expect(oncomplete).not.toHaveBeenCalled();

		await screen.rerender({ programmaticOpen: false });
		await expect.poll(() => oncomplete).toHaveBeenCalledWith(1);
		await expect.poll(() => document.activeElement).toBe(trigger);

		await screen.unmount();
		trigger.remove();
	});

	it('consumes a handoff once and preserves focus moved by its callback', async () => {
		const trigger = document.createElement('button');
		const dialogControl = document.createElement('button');
		trigger.textContent = 'More';
		dialogControl.textContent = 'Dialog control';
		document.body.append(trigger, dialogControl);
		const onedit = vi.fn(() => dialogControl.focus());
		const screen = await render(GiftContextActionsTestHost, {
			...managerProps,
			onedit,
			mobile: false,
			nativeOpen: false,
			programmaticOpen: true,
			desktopAnchor: trigger,
		});

		await screen.getByRole('menuitem', { name: m.gift_context_edit() }).click();
		await expect.poll(() => onedit).toHaveBeenCalledTimes(1);
		await expect.poll(() => document.activeElement).toBe(dialogControl);

		await screen.unmount();
		trigger.remove();
		dialogControl.remove();
	});

	it('uses full reversal labels, undo icons, and semantic red text in desktop overflow', async () => {
		const receivedScreen = await render(GiftContextActionsTestHost, {
			...managerProps,
			received: true,
			mobile: false,
			nativeOpen: true,
			programmaticOpen: false,
		});
		const received = receivedScreen
			.getByRole('menuitem', { name: m.gift_mark_unreceived() })
			.element();
		expect(received.classList.contains('text-status-danger-text')).toBe(true);
		expect(received.querySelector('.lucide-undo-2')).toBeTruthy();
		await receivedScreen.unmount();

		const purchasedScreen = await render(GiftContextActionsTestHost, {
			...managerProps,
			role: 'visitor' as const,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			purchased: true,
			oncancelreservation: vi.fn(),
			onpurchased: vi.fn(),
			mobile: false,
			nativeOpen: true,
			programmaticOpen: false,
		});
		const purchased = purchasedScreen
			.getByRole('menuitem', { name: m.gift_mark_unbought() })
			.element();
		const cancellation = purchasedScreen
			.getByRole('menuitem', { name: m.reserve_button_cancel() })
			.element();
		expect(purchased.classList.contains('text-status-danger-text')).toBe(true);
		expect(purchased.querySelector('.lucide-undo-2')).toBeTruthy();
		expect(cancellation.classList.contains('text-status-danger-text')).toBe(true);
		await purchasedScreen.unmount();
	});

	it('uses menu roles and nested submenus for configured manager choices', async () => {
		managerProps.onpriority.mockReset();
		managerProps.oncategory.mockReset();
		const screen = await render(GiftContextActionsTestHost, {
			...managerProps,
			mobile: false,
			nativeOpen: true,
			programmaticOpen: false,
		});
		await expect.element(screen.getByRole('menu')).toBeInTheDocument();
		const priorityTrigger = screen.getByRole('menuitem', { name: m.gift_priority_label() });
		await expect.element(priorityTrigger).toBeInTheDocument();
		await expect
			.element(screen.getByRole('menuitem', { name: m.gift_context_category() }))
			.toBeInTheDocument();
		await priorityTrigger.click();
		const highPriorityOption = screen.getByRole('menuitemradio', { name: 'Vysoká' });
		await expect.element(highPriorityOption).toBeInTheDocument();
		await highPriorityOption.click();
		expect(managerProps.onpriority).toHaveBeenCalledWith('high');
		await screen.unmount();
	});
});

describe('GiftContextActions placement-aware More', () => {
	it('excludes direct actions while retaining an overflowed Received command as disabled', async () => {
		const onreceived = vi.fn();
		const screen = await render(GiftContextActions, {
			...managerProps,
			onreceived,
			placementSnapshot: {
				visibleDirectActions: [],
				pendingActions: ['received'],
				disabledActions: ['received'],
			},
		});

		const received = screen.getByRole('button', { name: m.gift_mark_received() });
		await expect.element(received).toBeInTheDocument();
		await expect.element(received).toBeDisabled();
		await received.click({ force: true });
		expect(onreceived).not.toHaveBeenCalled();
		await screen.unmount();

		const directScreen = await render(GiftContextActions, {
			...managerProps,
			placementSnapshot: {
				visibleDirectActions: ['received'],
				pendingActions: [],
				disabledActions: [],
			},
		});
		await expect
			.element(directScreen.getByRole('button', { name: m.gift_mark_received() }))
			.not.toBeInTheDocument();
		await expect
			.element(directScreen.getByRole('button', { name: m.gift_context_edit() }))
			.toBeInTheDocument();
		await directScreen.unmount();
	});

	it('keeps the full capability menu for native invocation without a placement snapshot', async () => {
		const screen = await render(GiftContextActionsTestHost, {
			...managerProps,
			mobile: false,
			nativeOpen: true,
			programmaticOpen: false,
		});
		await expect
			.element(screen.getByRole('menuitem', { name: m.gift_mark_received() }))
			.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('GiftContextActions mobile Sheet', () => {
	afterEach(async () => {
		await page.viewport(1280, 720);
		document.documentElement.classList.remove('dark');
	});

	it.each(['light', 'dark'])(
		'keeps reversal text red on actual hover in %s mobile overflow',
		async (mode) => {
			document.documentElement.classList.toggle('dark', mode === 'dark');
			const receivedScreen = await render(GiftContextActions, {
				...managerProps,
				received: true,
			});
			const receivedAction = receivedScreen.getByRole('button', {
				name: m.gift_mark_unreceived(),
			});
			const received = receivedAction.element();
			expect(received.querySelector('.text-status-danger-text')).toBeTruthy();
			const receivedSurface = received.querySelector<HTMLElement>('.elevation-surface')!;
			expectSemanticDangerText(receivedSurface);
			await receivedAction.hover();
			expectSemanticDangerText(receivedSurface);
			expect(received.querySelector('.lucide-undo-2')).toBeTruthy();
			await receivedScreen.unmount();

			const purchasedScreen = await render(GiftContextActions, {
				...managerProps,
				role: 'visitor' as const,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
				purchased: true,
				oncancelreservation: vi.fn(),
				onpurchased: vi.fn(),
			});
			const purchased = purchasedScreen
				.getByRole('button', { name: m.gift_mark_unbought() })
				.element();
			const cancellation = purchasedScreen
				.getByRole('button', { name: m.reserve_button_cancel() })
				.element();
			expect(purchased.querySelector('.text-status-danger-text')).toBeTruthy();
			expect(purchased.querySelector('.lucide-undo-2')).toBeTruthy();
			expect(cancellation.querySelector('.text-status-danger-text')).toBeTruthy();
			for (const action of [
				purchasedScreen.getByRole('button', { name: m.gift_mark_unbought() }),
				purchasedScreen.getByRole('button', { name: m.reserve_button_cancel() }),
			]) {
				const surface = action.element().querySelector<HTMLElement>('.elevation-surface')!;
				expectSemanticDangerText(surface);
				await action.hover();
				expectSemanticDangerText(surface);
			}
			await purchasedScreen.unmount();
		},
	);

	it('shows decorative right chevrons at the far edge of nested action rows', async () => {
		const screen = await render(GiftContextActions, managerProps);
		for (const name of [m.gift_priority_label(), m.gift_context_category()]) {
			const row = screen.getByRole('button', { name, exact: true }).element();
			const surface = row.querySelector<HTMLElement>(':scope > .elevation-surface')!;
			const chevron = row.querySelector<SVGElement>(
				'svg.lucide-chevron-right[aria-hidden="true"]',
			);

			expect(chevron).toBeTruthy();
			expect(surface.lastElementChild).toBe(chevron);
			const surfaceStyle = getComputedStyle(surface);
			expectPixelsNear(
				chevron!.getBoundingClientRect().right,
				surface.getBoundingClientRect().right -
					parseFloat(surfaceStyle.borderRightWidth) -
					parseFloat(surfaceStyle.paddingRight),
			);
		}
		await screen.unmount();
	});

	it('keeps nested chevrons visible while their rows are loading and disabled', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			priorityReady: false,
			categoryReady: false,
		});
		for (const name of [
			`${m.gift_priority_label()}: ${m.moderator_loading()}`,
			`${m.gift_context_category()}: ${m.moderator_loading()}`,
		]) {
			const row = screen.getByRole('button', { name, exact: true }).element();
			expect(row.querySelector('svg.lucide-chevron-right[aria-hidden="true"]')).toBeTruthy();
		}
		await screen.unmount();
	});

	it('does not add right chevrons to terminal mobile actions', async () => {
		const screen = await render(GiftContextActions, managerProps);
		for (const name of [
			m.gift_context_open_link(),
			m.gift_context_copy_link(),
			m.gift_context_edit(),
		]) {
			const row = screen
				.getByRole(name === m.gift_context_open_link() ? 'link' : 'button', {
					name,
					exact: true,
				})
				.element();
			expect(row.querySelector('svg.lucide-chevron-right')).toBeNull();
		}
		await screen.unmount();
	});

	it('uses the inset rounded action-sheet shell with shared header, body, rows, and icon column', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftContextActions, managerProps);
		const dialog = screen.getByRole('dialog', { name: 'Kolo' }).element() as HTMLElement;
		const dialogRect = dialog.getBoundingClientRect();
		const dialogStyle = getComputedStyle(dialog);

		expectPixelsNear(dialogRect.left, window.innerWidth - dialogRect.right);
		expect(dialogRect.left).toBeGreaterThan(0);
		expect(parseFloat(dialogStyle.borderLeftWidth)).toBeGreaterThan(0);
		expect(dialogStyle.borderLeftWidth).toBe(dialogStyle.borderRightWidth);
		expect(dialogStyle.borderLeftWidth).toBe(dialogStyle.borderTopWidth);
		expect(dialogStyle.borderTopLeftRadius).toBe(dialogStyle.borderTopRightRadius);
		expect(parseFloat(dialogStyle.borderTopLeftRadius)).toBeGreaterThan(0);

		const header = dialog.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
		const headerStyle = getComputedStyle(header);
		expectPixelsNear(
			header.getBoundingClientRect().width,
			dialogRect.width -
				parseFloat(dialogStyle.borderLeftWidth) -
				parseFloat(dialogStyle.borderRightWidth),
		);
		expect(headerStyle.paddingLeft).toBe('16px');
		expectContentClearsOverlayClose(
			header,
			dialog.querySelector<HTMLElement>('[data-slot="sheet-close"]')!,
		);
		expect(headerStyle.paddingTop).toBe('12px');
		expect(headerStyle.paddingBottom).toBe('12px');
		expectPixelsNear(parseFloat(headerStyle.borderBottomWidth), 1);

		const body = header.nextElementSibling as HTMLElement;
		const bodyStyle = getComputedStyle(body);
		expect(bodyStyle.paddingLeft).toBe('8px');
		expect(bodyStyle.paddingRight).toBe('8px');
		expect(bodyStyle.paddingTop).toBe('8px');
		expect(bodyStyle.paddingBottom).toBe('8px');

		const iconRow = screen.getByRole('button', { name: m.gift_context_edit() }).element();
		const nestedRow = screen.getByRole('button', { name: m.gift_priority_label() }).element();
		expect(nestedRow.querySelector('svg.lucide-star')).toBeTruthy();
		for (const row of [iconRow, nestedRow]) {
			expectPixelsAtLeast(row.getBoundingClientRect().height, 48);
			const surface = row.querySelector<HTMLElement>(':scope > .elevation-surface')!;
			expect(surface).toBeTruthy();
			expect(getComputedStyle(surface).justifyContent).toBe('flex-start');
		}
		const iconText = Array.from(
			iconRow.querySelector(':scope > .elevation-surface')!.childNodes,
		).find(
			(node) =>
				node.nodeType === Node.TEXT_NODE &&
				node.textContent !== null &&
				node.textContent.trim() !== '',
		) as Text;
		const nestedText = Array.from(
			nestedRow.querySelector(':scope > .elevation-surface')!.childNodes,
		).find(
			(node) =>
				node.nodeType === Node.TEXT_NODE &&
				node.textContent !== null &&
				node.textContent.trim() !== '',
		) as Text;
		const textLeft = (node: Text) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return range.getBoundingClientRect().left;
		};
		expectPixelsNear(textLeft(nestedText), textLeft(iconText));
		await screen.unmount();
	});

	it('drills into configured priorities and provides Back without exposing like/reserve actions', async () => {
		const screen = await render(GiftContextActions, managerProps);
		await screen.getByRole('button', { name: m.gift_priority_label() }).click();
		await expect
			.element(screen.getByRole('heading', { name: m.gift_priority_label() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: new RegExp('Vysoká') }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_back() }))
			.toBeInTheDocument();
		await expect.element(screen.getByText(/rezerv/i)).not.toBeInTheDocument();
		await expect.element(screen.getByText(/líb/i)).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('shows loading-labeled manager controls as disabled until choices are ready', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			priorityReady: false,
			categoryReady: false,
		});
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_priority_label()}: ${m.moderator_loading()}`,
				}),
			)
			.toBeDisabled();
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_context_category()}: ${m.moderator_loading()}`,
				}),
			)
			.toBeDisabled();
		await screen.unmount();
	});

	it('limits visitors to link actions', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
		});
		await expect
			.element(screen.getByRole('link', { name: m.gift_context_open_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_copy_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_edit() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('renders derived reservation and Purchased actions and dispatches their callbacks', async () => {
		const oncancelreservation = vi.fn();
		const onpurchased = vi.fn();
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation,
			onpurchased,
		});

		await screen.getByRole('button', { name: m.reserve_button_cancel() }).click();
		expect(oncancelreservation).toHaveBeenCalledOnce();
		await screen.unmount();

		const purchasedScreen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation,
			onpurchased,
		});
		await purchasedScreen.getByRole('button', { name: m.gift_mark_bought() }).click();
		expect(onpurchased).toHaveBeenCalledOnce();
		await purchasedScreen.unmount();
	});

	it('keeps archived reservation context to own cancellation only', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			readOnly: true,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation: vi.fn(),
			onpurchased: vi.fn(),
		});
		await expect
			.element(screen.getByRole('button', { name: m.reserve_button_cancel() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_mark_bought() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('normalizes a scheme-less primary URL in the mobile external link', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			primaryUrl: 'alza.cz/product',
		});
		const link = screen.getByRole('link', { name: m.gift_context_open_link() });
		await expect.element(link).toHaveAttribute('href', 'https://alza.cz/product');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('external'));
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
		await screen.unmount();
	});
});

describe('GiftContextActions grouped menus with organization icons (#447)', () => {
	type MenuSurface = 'dropdown' | 'context' | 'sheet';
	type DesktopMenuKind = Exclude<MenuSurface, 'sheet'>;
	type MenuProps = Partial<ComponentProps<typeof GiftContextActions>>;
	const menuSurfaces: readonly MenuSurface[] = ['dropdown', 'context', 'sheet'];
	const separatorMarker = '---';
	const desktopSeparatorSelectors: Record<DesktopMenuKind, string> = {
		dropdown: '[data-slot="dropdown-menu-separator"]',
		context: '[data-slot="context-menu-separator"]',
	};
	const mobileSeparatorSelector = '[data-slot="separator"]';
	const reservationOwnerProps = {
		canReserve: true,
		ownsReservation: true,
		canTrackPurchased: true,
	};
	const managerSequence = [
		m.gift_context_open_link(),
		m.gift_context_copy_link(),
		separatorMarker,
		m.gift_context_edit(),
		m.gift_mark_received(),
		m.gift_context_select_multiple(),
		separatorMarker,
		m.gift_priority_label(),
		m.gift_context_category(),
	];

	afterEach(async () => {
		await page.viewport(1280, 720);
	});

	function menuSequence(container: Element, itemSelector: string, separatorSelector: string) {
		return Array.from(container.querySelectorAll(`${itemSelector}, ${separatorSelector}`)).map(
			(element) =>
				element.matches(separatorSelector) ? separatorMarker : element.textContent!.trim(),
		);
	}

	function labelLeft(element: Element) {
		const label = Array.from(element.childNodes).find(
			(node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '',
		)!;
		const range = document.createRange();
		range.selectNodeContents(label);
		return range.getBoundingClientRect().left;
	}

	async function renderDesktopMenu(kind: DesktopMenuKind, props: MenuProps = {}) {
		const trigger = document.createElement('button');
		trigger.textContent = 'More';
		document.body.append(trigger);
		const screen = await render(GiftContextActionsTestHost, {
			...managerProps,
			...props,
			mobile: false,
			nativeOpen: kind === 'context',
			programmaticOpen: kind === 'dropdown',
			desktopAnchor: trigger,
		});
		const menu = screen.getByRole('menu');
		await expect.element(menu).toBeInTheDocument();
		return {
			screen,
			menu: menu.element(),
			async cleanup() {
				await screen.unmount();
				trigger.remove();
			},
		};
	}

	function mobileMainScreen() {
		return document.querySelector<HTMLElement>('[data-mobile-screen="main"]')!;
	}

	async function renderedMenuSequence(surface: MenuSurface, props: MenuProps = {}) {
		if (surface === 'sheet') {
			const screen = await render(GiftContextActions, { ...managerProps, ...props });
			const sequence = menuSequence(mobileMainScreen(), 'a, button', mobileSeparatorSelector);
			await screen.unmount();
			return sequence;
		}
		const desktopMenu = await renderDesktopMenu(surface, props);
		const sequence = menuSequence(
			desktopMenu.menu,
			'[role="menuitem"]',
			desktopSeparatorSelectors[surface],
		);
		await desktopMenu.cleanup();
		return sequence;
	}

	for (const surface of menuSurfaces) {
		it(`orders ${surface} groups link, gift, organization with separators only between them`, async () => {
			expect(await renderedMenuSequence(surface)).toEqual(managerSequence);
			expect(await renderedMenuSequence(surface, { role: 'visitor' })).toEqual([
				m.gift_context_open_link(),
				m.gift_context_copy_link(),
			]);
		});

		it(`ends the ${surface} gift group with cancel reservation then purchased before organization`, async () => {
			const reservationCallbacks = {
				onreserve: vi.fn(),
				oncancelreservation: vi.fn(),
				onpurchased: vi.fn(),
			};
			expect(
				await renderedMenuSequence(surface, {
					...reservationOwnerProps,
					...reservationCallbacks,
					role: 'moderator',
				}),
			).toEqual([
				m.gift_context_open_link(),
				m.gift_context_copy_link(),
				separatorMarker,
				m.gift_context_edit(),
				m.gift_mark_received(),
				m.gift_context_select_multiple(),
				m.reserve_button_cancel(),
				m.gift_mark_bought(),
				separatorMarker,
				m.gift_priority_label(),
				m.gift_context_category(),
			]);
			expect(
				await renderedMenuSequence(surface, {
					...reservationOwnerProps,
					...reservationCallbacks,
					role: 'visitor',
				}),
			).toEqual([
				m.gift_context_open_link(),
				m.gift_context_copy_link(),
				separatorMarker,
				m.reserve_button_cancel(),
				m.gift_mark_bought(),
			]);
		});

		it(`omits ${surface} reservation actions without callbacks and leaves no stray separator`, async () => {
			const linkSequence = [m.gift_context_open_link(), m.gift_context_copy_link()];
			for (const reservationProps of [{ canReserve: true }, reservationOwnerProps]) {
				expect(
					await renderedMenuSequence(surface, { ...reservationProps, role: 'visitor' }),
				).toEqual(linkSequence);
				expect(await renderedMenuSequence(surface, reservationProps)).toEqual(
					managerSequence,
				);
			}
		});
	}

	it('gives desktop Priority and Category icons with labels aligned to plain items', async () => {
		const { screen, cleanup } = await renderDesktopMenu('dropdown');
		const plainItem = screen.getByRole('menuitem', { name: m.gift_context_edit() }).element();
		const priority = screen.getByRole('menuitem', { name: m.gift_priority_label() }).element();
		const category = screen
			.getByRole('menuitem', { name: m.gift_context_category() })
			.element();

		expect(priority.querySelector('svg.lucide-star')).toBeTruthy();
		expect(category.querySelector('svg.lucide-tag')).toBeTruthy();
		for (const submenuTrigger of [priority, category]) {
			expectPixelsNear(labelLeft(submenuTrigger), labelLeft(plainItem));
		}
		await cleanup();
	});

	it('gives mobile Priority and Category icons with labels aligned to plain rows', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftContextActions, managerProps);
		const surfaceOf = (element: Element) =>
			element.querySelector(':scope > .elevation-surface')!;
		const plainRow = screen.getByRole('button', { name: m.gift_context_edit() }).element();
		const priority = screen
			.getByRole('button', { name: m.gift_priority_label(), exact: true })
			.element();
		const category = screen
			.getByRole('button', { name: m.gift_context_category(), exact: true })
			.element();

		expect(priority.querySelector('svg.lucide-star')).toBeTruthy();
		expect(category.querySelector('svg.lucide-tag')).toBeTruthy();
		for (const nestedRow of [priority, category]) {
			expectPixelsNear(labelLeft(surfaceOf(nestedRow)), labelLeft(surfaceOf(plainRow)));
		}
		await screen.unmount();
	});
});
