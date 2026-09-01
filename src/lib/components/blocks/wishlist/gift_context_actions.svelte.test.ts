import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import GiftContextActions from './GiftContextActions.svelte';
import GiftContextActionsTestHost from './GiftContextActionsTestHost.svelte';
import * as m from '$lib/paraglide/messages.js';

const managerProps = {
	open: true,
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
	onedit: vi.fn(),
	onpriority: vi.fn(),
	oncategory: vi.fn(),
	onreceived: vi.fn(),
	onselect: vi.fn(),
};

describe('GiftContextActions desktop ContextMenu', () => {
	it('uses menu roles and nested submenus for configured manager choices', async () => {
		managerProps.onpriority.mockReset();
		managerProps.oncategory.mockReset();
		const screen = await render(GiftContextActionsTestHost, { ...managerProps, mobile: false });
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

describe('GiftContextActions mobile Sheet', () => {
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
			.element(screen.getByRole('button', { name: m.gift_context_open_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_copy_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_edit() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('normalizes a scheme-less primary URL before opening it on mobile', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const screen = await render(GiftContextActions, {
			...managerProps,
			primaryUrl: 'alza.cz/product',
		});
		await screen.getByRole('button', { name: m.gift_context_open_link() }).click();
		expect(open).toHaveBeenCalledWith(
			'https://alza.cz/product',
			'_blank',
			'noopener,noreferrer',
		);
		open.mockRestore();
		await screen.unmount();
	});
});
