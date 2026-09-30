import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
const { default: LandingDemo } = await import('./LandingDemo.svelte');
import LandingDemoInteractiveFixture from './LandingDemoInteractiveFixture.svelte';

describe('LandingDemo client loading', () => {
	it('renders the localized shell while loading, then mounts interactive content', async () => {
		let finishLoading!: (module: { default: typeof LandingDemoInteractiveFixture }) => void;
		const loadDemo = vi.fn(
			() =>
				new Promise<{ default: typeof LandingDemoInteractiveFixture }>((resolve) => {
					finishLoading = resolve;
				}),
		);
		const screen = await render(LandingDemo, { loadDemo });
		expect(loadDemo).toHaveBeenCalledOnce();
		await expect
			.element(screen.getByTestId('landing-demo-badge'))
			.toHaveTextContent(m.landing_demo_badge());
		await expect.element(screen.getByRole('status')).toBeInTheDocument();
		finishLoading({ default: LandingDemoInteractiveFixture });
		await expect.element(screen.getByTestId('landing-demo-interactive-fixture')).toBeVisible();
	});

	it('offers a localized page reload when the interactive chunk fails', async () => {
		const failure = new Error('missing chunk');
		const loadDemo = vi.fn().mockRejectedValue(failure);
		const reloadPage = vi.fn();
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const screen = await render(LandingDemo, { loadDemo, reloadPage });
			await expect.element(screen.getByRole('alert')).toBeVisible();
			await expect
				.element(screen.getByRole('alert'))
				.toHaveTextContent(m.landing_demo_unavailable());
			await screen.getByRole('button', { name: m.import_wizard_reload() }).click();
			expect(reloadPage).toHaveBeenCalledOnce();
			expect(loadDemo).toHaveBeenCalledOnce();
			expect(consoleError).toHaveBeenCalledWith(
				'[LandingDemo] interactive chunk failed to load',
				failure,
			);
		} finally {
			consoleError.mockRestore();
		}
	});

	it('ignores a load completing after unmount', async () => {
		let finishLoading!: (module: { default: typeof LandingDemoInteractiveFixture }) => void;
		const screen = await render(LandingDemo, {
			loadDemo: () =>
				new Promise((resolve) => {
					finishLoading = resolve;
				}),
		});
		await screen.unmount();
		finishLoading({ default: LandingDemoInteractiveFixture });
		await expect
			.element(screen.getByTestId('landing-demo-interactive-fixture'))
			.not.toBeInTheDocument();
	});
});
