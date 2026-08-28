import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { WIZARD_MODE } from './import_wizard_types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: ImportWizard } = await import('./ImportWizard.svelte');

function animation() {
	return { cancel: vi.fn() } as unknown as Animation;
}

async function pasteRows(screen: Awaited<ReturnType<typeof render>>) {
	await screen.getByRole('radio', { name: m.import_wizard_source_paste() }).click();
	const textarea = screen.getByPlaceholder(m.import_wizard_paste_placeholder());
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/plain', 'Name\tQuantity\nCamera\t1');
	textarea
		.element()
		.dispatchEvent(
			new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }),
		);
	await expect.element(screen.getByText(m.import_wizard_step_review())).toBeVisible();
}

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('ImportWizard step motion', () => {
	it('enters a forward step from +10px over 180 ms and advances connector progress over 220 ms', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const panelAnimation = animation();
		const connectorAnimation = animation();
		const animate = vi.spyOn(Element.prototype, 'animate').mockImplementation(function (
			this: Element,
		) {
			return (this as HTMLElement).dataset.importStepPanel !== undefined
				? panelAnimation
				: connectorAnimation;
		});
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});

		await pasteRows(screen);

		expect(animate).toHaveBeenCalledWith(
			[
				{ opacity: 0, transform: 'translateX(10px)' },
				{ opacity: 1, transform: 'translateX(0)' },
			],
			{ duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
			{ duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
	});

	it('enters a backward step from -10px and reverses connector progress', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const animate = vi
			.spyOn(Element.prototype, 'animate')
			.mockImplementation(() => animation());
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});
		await pasteRows(screen);
		animate.mockClear();

		await screen.getByRole('button', { name: m.import_wizard_back() }).click();

		expect(animate).toHaveBeenCalledWith(
			[
				{ opacity: 0, transform: 'translateX(-10px)' },
				{ opacity: 1, transform: 'translateX(0)' },
			],
			{ duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
			{ duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
	});

	it('swaps steps immediately without transforms when reduced motion is requested', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const animate = vi
			.spyOn(Element.prototype, 'animate')
			.mockImplementation(() => animation());
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});

		await pasteRows(screen);

		expect(animate).not.toHaveBeenCalled();
		await expect
			.element(screen.getByRole('button', { name: m.import_wizard_back() }))
			.toBeVisible();
	});

	it('cancels stale panel and connector runs before rapid backward navigation', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const activeRuns: ReturnType<typeof animation>[] = [];
		vi.spyOn(Element.prototype, 'animate').mockImplementation(() => {
			const run = animation();
			activeRuns.push(run);
			return run;
		});
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});
		await pasteRows(screen);
		expect(activeRuns).toHaveLength(2);

		await screen.getByRole('button', { name: m.import_wizard_back() }).click();

		expect(activeRuns[0].cancel).toHaveBeenCalledOnce();
		expect(activeRuns[1].cancel).toHaveBeenCalledOnce();
	});

	it('uses the same forward transition for Review to Confirm without retaining Review controls', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const animate = vi
			.spyOn(Element.prototype, 'animate')
			.mockImplementation(() => animation());
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});
		await pasteRows(screen);
		const next = screen.getByRole('button', { name: m.import_wizard_next() });
		await vi.waitFor(() => expect(next.element()).not.toBeDisabled());
		animate.mockClear();

		await next.click();

		expect(animate).toHaveBeenCalledWith(
			[
				{ opacity: 0, transform: 'translateX(10px)' },
				{ opacity: 1, transform: 'translateX(0)' },
			],
			{ duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		expect(
			screen.getByRole('button', { name: m.import_wizard_next() }).elements(),
		).toHaveLength(0);
		await expect
			.element(screen.getByRole('button', { name: m.import_wizard_commit_append() }))
			.toBeVisible();
	});

	it('cancels active step motion when the dialog closes', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const activeRuns: ReturnType<typeof animation>[] = [];
		vi.spyOn(Element.prototype, 'animate').mockImplementation(() => {
			const run = animation();
			activeRuns.push(run);
			return run;
		});
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});
		await pasteRows(screen);

		await screen.getByRole('button', { name: m.import_wizard_cancel() }).click();

		expect(activeRuns).toHaveLength(2);
		expect(activeRuns.every((run) => vi.mocked(run.cancel).mock.calls.length === 1)).toBe(true);
	});

	it('cancels active step motion during component teardown', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
		const activeRuns: ReturnType<typeof animation>[] = [];
		vi.spyOn(Element.prototype, 'animate').mockImplementation(() => {
			const run = animation();
			activeRuns.push(run);
			return run;
		});
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
		});
		await pasteRows(screen);

		await screen.unmount();

		expect(activeRuns.every((run) => vi.mocked(run.cancel).mock.calls.length === 1)).toBe(true);
	});
});
